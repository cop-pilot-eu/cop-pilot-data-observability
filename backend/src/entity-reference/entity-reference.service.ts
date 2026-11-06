import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { APP_CONFIG_KEY, AppConfigDTO, InjectConfig } from '../common';

// One row per entity with a complete range: first UTC midnight at/after
// first reading + REFERENCE_DAYS, or the override.
// - entities: recursive skip-scan on the index; GROUP BY reads the whole table.
// - < 2 distinct timestamps: no median, skipped.
// - gap >= 1: a ms-apart burst counts as one reading.
// - < 50, not < 60: jittery 60 s feeds stay slow.
// - hours, not days: timestamptz + '1 day' adds 23/25 h across DST.
const UPSERT_SQL = `
WITH RECURSIVE entities AS (
  (SELECT broker_id, entity_id FROM context_history
   WHERE broker_id IS NOT NULL ORDER BY broker_id, entity_id LIMIT 1)
  UNION ALL
  SELECT next.broker_id, next.entity_id FROM entities e CROSS JOIN LATERAL (
    SELECT c.broker_id, c.entity_id FROM context_history c
    WHERE (c.broker_id, c.entity_id) > (e.broker_id, e.entity_id)
    ORDER BY c.broker_id, c.entity_id LIMIT 1) next
), ranges AS (
  SELECT e.broker_id, e.entity_id, s.ref_start,
         coalesce(o.ref_end, s.ref_start + make_interval(hours => 24 * $1)) AS ref_end,
         CASE WHEN o.broker_id IS NULL THEN 'default' ELSE 'override' END AS reference_source
  FROM entities e CROSS JOIN LATERAL (
    SELECT c.observed_at FROM context_history c
    WHERE c.broker_id = e.broker_id AND c.entity_id = e.entity_id
    ORDER BY c.observed_at LIMIT 1) first
  LEFT JOIN entity_reference_override o
    ON o.broker_id = e.broker_id AND o.entity_id = e.entity_id
  CROSS JOIN LATERAL (SELECT coalesce(o.ref_start,
    date_trunc('day', first.observed_at - interval '1 microsecond', 'UTC') + interval '24 hours'
  ) AS ref_start) s
)
INSERT INTO entity_reference
  (broker_id, entity_id, ref_start, ref_end, native_interval_s, resampled, reference_source, updated_at)
SELECT r.broker_id, r.entity_id, r.ref_start, r.ref_end,
       n.native_interval_s, n.native_interval_s < 50, r.reference_source, now()
FROM ranges r CROSS JOIN LATERAL (
  SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY gap) AS native_interval_s
  FROM (
    SELECT extract(epoch FROM observed_at - lag(observed_at) OVER (ORDER BY observed_at)) AS gap
    FROM (SELECT DISTINCT c.observed_at FROM context_history c
          WHERE c.broker_id = r.broker_id AND c.entity_id = r.entity_id
            AND c.observed_at >= r.ref_start AND c.observed_at < r.ref_end) ts
  ) gaps
  WHERE gap >= 1
) n
WHERE r.ref_end <= now() AND n.native_interval_s IS NOT NULL
ON CONFLICT (broker_id, entity_id) DO UPDATE SET
  ref_start = EXCLUDED.ref_start,
  ref_end = EXCLUDED.ref_end,
  native_interval_s = EXCLUDED.native_interval_s,
  resampled = EXCLUDED.resampled,
  reference_source = EXCLUDED.reference_source,
  updated_at = EXCLUDED.updated_at
RETURNING broker_id, entity_id, ref_start, ref_end, resampled, reference_source`;

// After the DELETE: override without a row = not applied. The entity then
// has no row, even if its default range is complete.
const UNAPPLIED_OVERRIDES_SQL = `
SELECT o.broker_id, o.entity_id, o.ref_start, e.ref_end,
       CASE
         WHEN NOT EXISTS (SELECT 1 FROM context_history c
                          WHERE c.broker_id = o.broker_id AND c.entity_id = o.entity_id)
           THEN 'no data for this entity in context_history'
         WHEN e.ref_end > now()
           THEN 'reference range not complete yet'
         ELSE 'fewer than 2 readings 1 s or more apart in the range'
       END AS problem
FROM entity_reference_override o
CROSS JOIN LATERAL (SELECT coalesce(o.ref_end,
  o.ref_start + make_interval(hours => 24 * $1)) AS ref_end) e
LEFT JOIN entity_reference r
  ON r.broker_id = o.broker_id AND r.entity_id = o.entity_id
WHERE r.broker_id IS NULL`;

type EntityKey = { broker_id: string; entity_id: string };
type Range = { ref_start: Date; ref_end: Date };

// entity_reference rows written by UPSERT_SQL (RETURNING subset).
type EntityReferenceUpserted = EntityKey &
  Range & {
    resampled: boolean;
    reference_source: 'default' | 'override';
  };

// entity_reference_override rows with no entity_reference row. ref_end is
// computed: the stored column can be NULL.
type EntityReferenceOverrideUnapplied = EntityKey & Range & { problem: string };

const REFRESH_INTERVAL_MS = 60 * 60 * 1000;

@Injectable()
export class EntityReferenceService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(EntityReferenceService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly dataSource: DataSource,
    @InjectConfig(APP_CONFIG_KEY) private readonly appConfig: AppConfigDTO,
  ) {}

  // Not awaited: do not block boot. Hourly: new entities get a row
  // <= 1 h after ref_end.
  // No cross-replica lock; add pg_try_advisory_xact_lock if >1 replica.
  onApplicationBootstrap(): void {
    void this.safeRefresh();
    this.timer = setInterval(
      () => void this.safeRefresh(),
      REFRESH_INTERVAL_MS,
    );
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  // Skip the tick if the last refresh still runs (setInterval does not await).
  private async safeRefresh(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.refresh();
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `entity_reference refresh failed: ${err.message}`,
        err.stack,
      );
    } finally {
      this.running = false;
    }
  }

  // Steps, in one transaction:
  // 1. Upsert one entity_reference row per entity with a complete reference
  //    range (override, else first UTC midnight + REFERENCE_DAYS): native
  //    interval and resampled flag.
  // 2. Delete the rows that step 1 did not write.
  // 3. Find the overrides with no row, and why.
  // Then log each override (applied or not) and one summary line.
  async refresh(): Promise<void> {
    const t0 = Date.now();
    const days = this.appConfig.referenceDays;
    const { entityReferenceRows, entityReferenceOverrideUnappliedRows } =
      await this.dataSource.transaction(async (manager) => {
        const entityReferenceRows = await manager.query<
          EntityReferenceUpserted[]
        >(UPSERT_SQL, [days]);
        // Deletes rows the upsert did not rewrite (now() = tx start): range no
        // longer complete, or entity gone. Invariant: UPSERT_SQL rewrites every
        // row to keep; a new filter there deletes the rows it excludes.
        await manager.query(
          `DELETE FROM entity_reference WHERE updated_at < now()`,
        );
        const entityReferenceOverrideUnappliedRows = await manager.query<
          EntityReferenceOverrideUnapplied[]
        >(UNAPPLIED_OVERRIDES_SQL, [days]);
        return { entityReferenceRows, entityReferenceOverrideUnappliedRows };
      });
    const fast = entityReferenceRows.filter((row) => row.resampled).length;
    const overridden = entityReferenceRows.filter(
      (row) => row.reference_source === 'override',
    );
    for (const row of overridden) {
      this.logger.log(
        `entity_reference override applied: ${row.broker_id} ${row.entity_id} ${range(row)}`,
      );
    }
    for (const row of entityReferenceOverrideUnappliedRows) {
      this.logger.warn(
        `entity_reference override not applied: ${row.broker_id} ${row.entity_id} ${range(row)}: ${row.problem}. The entity has no reference range.`,
      );
    }
    this.logger.log(
      `entity_reference: ${entityReferenceRows.length} rows (${fast} resampled, ${overridden.length} overrides applied, ${entityReferenceOverrideUnappliedRows.length} not applied), REFERENCE_DAYS=${days}, ${Date.now() - t0} ms`,
    );
  }
}

function range(row: Range): string {
  return `[${row.ref_start.toISOString()}, ${row.ref_end.toISOString()})`;
}
