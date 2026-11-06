import { MigrationInterface, QueryRunner } from 'typeorm';

// WITH NO DATA: TypeORM runs migrations in a transaction, and WITH DATA cannot.
// History is filled by `context_history_1m:backfill`; the policy only refreshes
// the last day.
export class ContextHistory1m1793700000002 implements MigrationInterface {
  name = 'ContextHistory1m1793700000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE MATERIALIZED VIEW "context_history_1m"
       WITH (timescaledb.continuous) AS
       SELECT "broker_id",
              "entity_id",
              "attr_name",
              time_bucket('1 minute', "observed_at")                        AS "bucket",
              avg(("value" #>> '{}')::float)                                AS "value",
              stddev(("value" #>> '{}')::float)                             AS "std",
              min(("value" #>> '{}')::float)                                AS "min",
              max(("value" #>> '{}')::float)                                AS "max",
              count(*)                                                      AS "count",
              avg(abs(extract(epoch FROM ("time" - "observed_at"))) * 1000) AS "latency_ms",
              max(abs(extract(epoch FROM ("time" - "observed_at"))) * 1000) AS "latency_max_ms"
       FROM "context_history"
       WHERE jsonb_typeof("value") = 'number'
       GROUP BY "broker_id", "entity_id", "attr_name", "bucket"
       WITH NO DATA`,
    );
    await queryRunner.query(
      `SELECT add_continuous_aggregate_policy('context_history_1m',
         start_offset      => INTERVAL '1 day',
         end_offset        => INTERVAL '1 minute',
         schedule_interval => INTERVAL '1 minute')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `SELECT remove_continuous_aggregate_policy('context_history_1m', if_exists => true)`,
    );
    await queryRunner.query(`DROP MATERIALIZED VIEW "context_history_1m"`);
  }
}
