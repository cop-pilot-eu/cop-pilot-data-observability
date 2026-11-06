# Resampling and reference ranges

This document tells how the system selects the reference data of each entity, and when it resamples the data to 1 minute. It also gives the setup procedure for a new environment.

To change the reference range of one entity, refer to [reference-override.md](reference-override.md).

## Contents

- [Why](#why)
- [Components](#components)
- [How it works](#how-it-works)
  - [1. The 1-minute aggregate](#1-the-1-minute-aggregate)
  - [2. The reference range of each entity](#2-the-reference-range-of-each-entity)
  - [3. How data-analytics uses it](#3-how-data-analytics-uses-it)
- [Configuration](#configuration)
- [Setup](#setup)
- [Troubleshooting](#troubleshooting)
- [Limits](#limits)

## Why

Data drift and data quality compare two time ranges of one entity:

- The reference range: a period of normal data. Each entity has its own range.
- The analysis range: the period that the user selects in the frontend.

Some entities send readings each second or faster. For these entities, a week of raw data is millions of rows. To make the calculation fast, the system uses 1-minute buckets for these entities. Slow entities (for example, one reading each 60 s) use raw data.

## Components

| Component | Type | Written by | Read by |
| --- | --- | --- | --- |
| `context_history_entity_observed_idx` | Index on `context_history` `(broker_id, entity_id, observed_at DESC)` | Migration | `EntityReferenceService`, data-analytics |
| `context_history_1m` | TimescaleDB continuous aggregate, 1-minute buckets | Backfill script, refresh policy | data-analytics |
| `entity_reference` | Table, one row for each entity with a complete reference range | `EntityReferenceService` | data-analytics |
| `entity_reference_override` | Table, manual reference ranges | Operator (SQL) | `EntityReferenceService` |

The migration `EntityReference` drops the old table `reference_data`. The reference data is now a time range of `context_history` or `context_history_1m`.

## How it works

### 1. The 1-minute aggregate

`context_history_1m` has one row for each `(broker_id, entity_id, attr_name, bucket)`. It uses only numeric values (`jsonb_typeof(value) = 'number'`). Each row has these columns:

| Column | Value |
| --- | --- |
| `bucket` | Start of the 1-minute bucket |
| `value` | Average of the values |
| `std` | Standard deviation of the values |
| `min`, `max` | Minimum and maximum value |
| `count` | Number of readings |
| `latency_ms` | Average of `abs(time - observed_at)`, in ms |
| `latency_max_ms` | Maximum of `abs(time - observed_at)`, in ms |

Two processes write the aggregate:

- The backfill script fills the history one time. It refreshes one hypertable chunk (7 days) at a time.
- The refresh policy runs each minute in TimescaleDB. It refreshes the range from 1 day ago to 1 minute ago.

The aggregate does not include the current minute. The policy does not refresh data older than 1 day. If old data arrives late, refresh its range manually:

```sql
CALL refresh_continuous_aggregate('context_history_1m', '<start>', '<end>');
```

### 2. The reference range of each entity

`EntityReferenceService` calculates the reference range of each entity. It runs at each backend startup, and then each hour. It does not block the startup.

For each `(broker_id, entity_id)` in `context_history`, the service does these steps:

1. It finds the reference range:
   - If the entity has a row in `entity_reference_override`, it uses that row.
   - If not, `ref_start` is the first UTC midnight at or after the first reading. `ref_end` is `ref_start + REFERENCE_DAYS × 24 h`.
2. It skips the entity if `ref_end` is in the future.
3. It calculates the native interval: the median gap between the distinct timestamps in the range. It ignores gaps shorter than 1 s, so a burst of readings counts as one reading.
4. It skips the entity if it cannot calculate the native interval (fewer than 2 readings 1 s or more apart).
5. It sets `resampled = native_interval_s < 50`.
6. It writes or updates the row in `entity_reference`.

The service then deletes each `entity_reference` row that it did not write. All the steps run in one transaction.

Notes:

- The range is `[ref_start, ref_end)`. `ref_end` is not in the range.
- The limit is 50 s, not 60 s. An entity that sends one reading each 60 s with jitter stays on raw data.
- The service adds hours, not days. Thus each range is exactly `REFERENCE_DAYS × 24` hours.
- A new entity gets a row 1 hour or less after its reference range is complete.
- If a refresh is still running at the next hour, the service skips that hour.

At the end of each refresh, the backend writes this log line:

```
entity_reference: <n> rows (<m> resampled, <o> overrides applied, <u> not applied), REFERENCE_DAYS=7, <t> ms
```

`entity_reference` columns:

| Column | Value |
| --- | --- |
| `broker_id`, `entity_id` | Primary key |
| `ref_start`, `ref_end` | Reference range, `[ref_start, ref_end)` |
| `native_interval_s` | Median gap between readings in the reference range, in seconds |
| `resampled` | `true` if `native_interval_s < 50` |
| `reference_source` | `default` or `override` |
| `updated_at` | Time of the last refresh |

### 3. How data-analytics uses it

For each stats request, data-analytics does these steps:

1. It reads the `entity_reference` row of the entity. If there is no row, it returns `The reference range of this entity is not complete yet.`
2. It reads the reference data:
   - If `resampled = true`, it reads `context_history_1m`.
   - If `resampled = false`, it reads raw `context_history` (numeric values only).
3. It keeps the reference data in memory. If `ref_start` or `ref_end` changes, it reads the data again.
4. It moves the start of the analysis range to `ref_end` if the start is before `ref_end`. Thus the two ranges do not overlap.
5. It reads the analysis data from the same source as the reference data.
6. It calculates the reports. The expected interval between readings is:
   - 1 minute for resampled entities.
   - `native_interval_s` for the other entities.

For resampled entities, each attribute `<attr>` gives three features: `<attr>` (average), `<attr>_std`, and `<attr>_count`. All three features go into the drift report.

If `resampled = true` and `context_history_1m` has no data for the reference range, data-analytics returns `No reference data for this entity.` Usually, this means that the backfill did not run.

## Configuration

| Variable | Default | Description |
| --- | --- | --- |
| `REFERENCE_DAYS` | `7` | Length of the default reference range, in days. Minimum `1`. |

If you change `REFERENCE_DAYS`, restart the backend. The backend writes all rows again. Data-analytics reads the new reference data at the next request.

## Setup

Do these steps one time for each environment, in this order.

1. Set `REFERENCE_DAYS` in `.env`. If you do not set it, the backend uses `7`.
2. Make sure that `reference_data` is empty. The migration deletes this table:

   ```sql
   SELECT count(*) FROM reference_data;
   ```

3. Run the migrations:

   ```bash
   # development
   $ yarn migration:run

   # production (in the container)
   $ docker exec cop-pilot-data-observability-be npm run migration:run:prod
   ```

   The index build locks inserts into `context_history` until it completes. For 27M rows, this takes approximately 2 minutes. Notifications that arrive in this period wait.

4. Fill the history of `context_history_1m`. You can do this step while the backend runs:

   ```bash
   # development
   $ yarn context_history_1m:backfill

   # production (in the container)
   $ docker exec cop-pilot-data-observability-be npm run context_history_1m:backfill:prod
   ```

   The script writes one line for each chunk. If a chunk fails, the script writes its `CALL refresh_continuous_aggregate(...)` statement at the end. Run only that statement again in `psql`.

5. Make sure that the aggregate has data:

   ```sql
   SELECT count(*), min(bucket), max(bucket) FROM context_history_1m;
   ```

6. Make sure that the backend log has the `entity_reference: <n> rows ...` line.

   If the backend ran before step 3, its startup refresh failed, because `entity_reference` did not exist. The next hourly refresh fills the table. To fill it immediately, restart the backend.

## Troubleshooting

| Symptom | Cause | Action |
| --- | --- | --- |
| `The reference range of this entity is not complete yet.` | The entity has no `entity_reference` row. Its reference range ends in the future, or it has too few readings. | Wait. Or write an override, refer to [reference-override.md](reference-override.md). |
| `No reference data for this entity.` | The entity is resampled, and `context_history_1m` has no data for its reference range. | Run the backfill (setup step 4). |
| `The selected range is inside the reference range (until ...)` | The analysis range ends before `ref_end`. | Select a range after `ref_end`. |
| `entity_reference refresh failed: ...` in the backend log | The refresh query failed. | Read the error. The service tries again at the next hour. |

## Limits

- Run only one backend replica. The refresh has no lock between replicas.
- Only numeric attributes go into the reports. Text, boolean, and object values are ignored.
