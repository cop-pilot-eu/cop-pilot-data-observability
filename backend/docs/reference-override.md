# Override the reference range of an entity

This document tells how to set a manual reference range for one entity. For the default reference range, refer to [resampling.md](resampling.md).

## Contents

- [When to use an override](#when-to-use-an-override)
- [How it works](#how-it-works)
- [Procedure](#procedure)
- [Change or remove an override](#change-or-remove-an-override)
- [Override not applied](#override-not-applied)

## When to use an override

Use an override when the default reference range of an entity does not contain normal data. Examples:

- The entity was on and off in its first week, during installation. It sends full data from the second week.
- The entity had a failure in its first days.
- You want a longer or shorter reference range for one entity than `REFERENCE_DAYS`.

## How it works

The table `entity_reference_override` has one row for each entity with a manual range:

| Column | Value |
| --- | --- |
| `broker_id`, `entity_id` | Primary key |
| `ref_start` | Start of the range. Must be UTC midnight. |
| `ref_end` | End of the range (not included). Must be UTC midnight, or null. If null, the range is `REFERENCE_DAYS` days long. |
| `reason` | Why you set the override. Required. |
| `created_at`, `updated_at` | Set automatically. A trigger sets `updated_at` at each `UPDATE`. |

The database rejects a row if:

- `ref_start` or `ref_end` is not UTC midnight.
- `ref_end` is not after `ref_start`.

The boundaries must be UTC midnight so that the range contains only full days. If data-analytics divides drift by period (`CHUNK_BY=period`), each chunk is then full.

At each refresh (startup, then each hour), `EntityReferenceService` uses the override instead of the default range. The override must also meet the usual conditions:

- `ref_end` is in the past.
- The range has 2 or more readings 1 s or more apart.

If the override does not meet these conditions, the entity gets no `entity_reference` row. The service does not use the default range in this case. Data-analytics then returns `The reference range of this entity is not complete yet.`

The service also calculates `native_interval_s` and `resampled` again from the override range.

## Procedure

1. Find the first good day of the entity. Use the frontend, or count the readings for each day:

   ```sql
   SELECT date_trunc('day', observed_at, 'UTC') AS day, count(*)
   FROM context_history
   WHERE broker_id = 'cluster3e-uc3' AND entity_id = 'urn:ngsi-ld:CHPUnit:SERVER1:CHP1'
   GROUP BY 1 ORDER BY 1;
   ```

2. Write the override. This example sets a range of 8 days:

   ```sql
   INSERT INTO entity_reference_override (broker_id, entity_id, ref_start, ref_end, reason)
   VALUES ('cluster3e-uc3', 'urn:ngsi-ld:CHPUnit:SERVER1:CHP1',
           '2026-09-23 00:00+00', '2026-10-01 00:00+00',
           'On and off in the first week, during installation');
   ```

   Use `+00` in the timestamps. If you do not, the database uses the time zone of the session.

3. Wait for the next hourly refresh, or restart the backend.
4. Make sure that the backend log has this line:

   ```
   entity_reference override applied: cluster3e-uc3 urn:ngsi-ld:CHPUnit:SERVER1:CHP1 [2026-09-23T00:00:00.000Z, 2026-10-01T00:00:00.000Z)
   ```

5. Make sure that the row has `reference_source = 'override'`:

   ```sql
   SELECT * FROM entity_reference WHERE entity_id = 'urn:ngsi-ld:CHPUnit:SERVER1:CHP1';
   ```

You must write the override in each environment. The table is not in git.

## Change or remove an override

- To change an override, use `UPDATE`. Then do steps 3 to 5 again.
- To go back to the default range, use `DELETE`. At the next refresh, the entity gets its default range.

Data-analytics reads the new reference data at the next request after the refresh.

## Override not applied

If the override is not applied, the backend log has this line:

```
entity_reference override not applied: <broker_id> <entity_id> [<ref_start>, <ref_end>): <cause>. The entity has no reference range.
```

| Cause | Action |
| --- | --- |
| `no data for this entity in context_history` | Make sure that `broker_id` and `entity_id` are correct. They are case-sensitive. |
| `reference range not complete yet` | `ref_end` is in the future. Wait, or set an earlier `ref_end`. |
| `fewer than 2 readings 1 s or more apart in the range` | The range has no usable data. Select a different range. |

Until you correct the override, the entity has no reference range.
