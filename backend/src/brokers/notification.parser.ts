import { BadRequestException, Logger } from '@nestjs/common';
import { CreateContextHistory } from '../dto';
import { BrokerConfig, RawEntity } from './brokers.types';

// standalone Logger, not injected — keeps this file unit-testable with no TestingModule
const logger = new Logger('NotificationParser');

/**
 * In order: resolve broker (done by
 * the caller before this is invoked) -> extract entities -> stamp `time`
 * once, here -> look up entity type (unmapped => skip + warn, still HTTP
 * 200) -> resolve `observed_at` (no trustworthy source, or unresolvable =>
 * fall back to `time`) -> drop anything not in `fields` -> emit one row per
 * scalar attribute.
 */
export function parseNotification(
  broker: BrokerConfig,
  body: unknown,
  receivedAt: Date,
): CreateContextHistory[] {
  const entities = extractEntities(body);
  const rows: CreateContextHistory[] = [];

  for (const entity of entities) {
    const entityType = entity.type as string;
    const entityConfig = broker.entityTypes[entityType];
    if (!entityConfig || !entityConfig.subscribe) {
      logger.warn(
        `[${broker.id}] skipping entity ${String(entity.id)}: type "${entityType}" unmapped or unsubscribed`,
      );
      continue;
    }

    // source has no trustworthy timestamp, or it didn't resolve — fall back
    // to receive time rather than drop the row.
    const observedAt =
      (entityConfig.observedAtSource &&
        resolveObservedAt(
          entity,
          entityConfig.observedAtSource,
          broker.sourceTimeZone,
        )) ||
      receivedAt;

    for (const field of entityConfig.fields) {
      // a field missing from
      // this entity is a partial notification, not an anomaly — skip silently.
      if (!(field in entity)) continue;

      const parsed = parseAttribute(entity[field]);
      if (!parsed) {
        logger.warn(
          `[${broker.id}] skipping non-scalar attribute "${field}" on entity ${String(entity.id)}`,
        );
        continue;
      }

      rows.push({
        observedAt,
        time: receivedAt,
        entityId: entity.id as string,
        entityType,
        attrName: field,
        attrType: parsed.attrType,
        value: parsed.value,
        metadata: parsed.metadata,
        brokerId: broker.id,
      });
    }
  }

  return rows;
}

// malformed envelope
// (no `data` array, or a non-object body) -> 400, not 500, log raw payload at warn.
function extractEntities(body: unknown): RawEntity[] {
  const data = (body as { data?: unknown } | null)?.data;
  if (typeof body !== 'object' || body === null || !Array.isArray(data)) {
    logger.warn(`malformed notification envelope: ${JSON.stringify(body)}`);
    throw new BadRequestException(
      'Notification envelope must be an object with a data array',
    );
  }
  return data as RawEntity[];
}

// `source` may be a dotted path (e.g. `soilMoisture.timestamp`) reaching into
// an NGSI attribute's own sub-properties — walk each segment as a raw object
// property first (NGSI sub-properties aren't {type,value}-wrapped until the
// final segment), then unwrap the landed value through parseAttribute.
function resolveObservedAt(
  entity: RawEntity,
  source: string,
  timeZone?: string,
): Date | null {
  const [root, ...rest] = source.split('.');
  let raw: unknown = entity[root];
  for (const key of rest) {
    if (typeof raw !== 'object' || raw === null) return null;
    raw = (raw as Record<string, unknown>)[key];
  }
  const value = parseAttribute(raw)?.value ?? raw;
  if (typeof value !== 'string') return null;
  const date =
    timeZone && !HAS_OFFSET.test(value)
      ? parseInZone(value, timeZone)
      : new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

// trailing `Z` or `±hh:mm` / `±hhmm` — the value pins its own instant.
const HAS_OFFSET = /(Z|[+-]\d{2}:?\d{2})$/i;

// Wall-clock `value` (no offset) read in `timeZone` (cluster2
// FloodMonitoring sends Europe/Madrid local time). Offset is looked up at the
// instant itself, so DST is handled: +01:00 in winter, +02:00 in summer.
// The repeated hour at the autumn DST switch is ambiguous, this
// picks one of the two (≤1 h off, once a year); fix needs the source to send
// an offset.
function parseInZone(value: string, timeZone: string): Date {
  const guess = new Date(`${value}Z`);
  if (isNaN(guess.getTime())) return guess;
  const first = new Date(`${value}${zoneOffset(guess, timeZone)}`);
  // second pass: near a DST switch the offset at `guess` can differ from the
  // offset at the real instant.
  return new Date(`${value}${zoneOffset(first, timeZone)}`);
}

// `GMT+01:00` -> `+01:00`, bare `GMT` -> `Z`.
function zoneOffset(at: Date, timeZone: string): string {
  const name = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'longOffset',
  })
    .formatToParts(at)
    .find((part) => part.type === 'timeZoneName')!.value;
  return name.slice(3) || 'Z';
}

function parseAttribute(attribute: unknown): {
  attrType: string;
  value: unknown;
  metadata: Record<string, unknown>;
} | null {
  if (typeof attribute !== 'object' || attribute === null) return null;
  const { type, value, ...metadata } = attribute as Record<string, unknown>;
  // non-scalar attribute
  // values are deferred, not flattened here.
  if (typeof value === 'object' && value !== null) return null;
  return { attrType: type as string, value, metadata };
}
