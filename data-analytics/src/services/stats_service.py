from datetime import datetime

import pandas as pd
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.clients.postgres_client import async_session
from ..models.stats_payload_model import StatsPayload
from ..models.stats_response_model import StatsResponse
from .data_observability import DataObservability

# entity_reference is written by the backend (boot, then hourly); resampled
# entities read context_history_1m, the others raw context_history. Ranges are
# half-open: [start, end).
ENTITY_REFERENCE_SQL = text(
    """
    SELECT ref_start, ref_end, native_interval_s, resampled
    FROM entity_reference
    WHERE broker_id = :broker_id AND entity_id = :entity_id
    """
)

# Raw. Numeric values only, cast the same way as context_history_1m: a single
# text value would otherwise turn every pivoted column into object dtype.
CONTEXT_HISTORY_SQL = text(
    """
    SELECT observed_at, time, entity_id, attr_name, (value #>> '{}')::float8 AS value
    FROM context_history
    WHERE broker_id = :broker_id AND entity_id = :entity_id
      AND observed_at >= :start AND observed_at < :end
      AND jsonb_typeof(value) = 'number'
    """
)

# Resampled.
CONTEXT_HISTORY_1M_SQL = text(
    """
    SELECT bucket AS observed_at, entity_id, attr_name,
           value, std, count, latency_ms::float8 AS latency_ms
    FROM context_history_1m
    WHERE broker_id = :broker_id AND entity_id = :entity_id
      AND bucket >= :start AND bucket < :end
    """
)

# (broker_id, entity_id) -> (ref_start, ref_end, reference rows). One entry per
# entity: a new reference range (REFERENCE_DAYS changed) replaces the old one.
_reference_cache: dict[tuple[str, str], tuple[datetime, datetime, pd.DataFrame]] = {}


class StatsService:
    @staticmethod
    def calculate_stats(
        current_df: pd.DataFrame,
        reference_df: pd.DataFrame,
        interval: pd.Timedelta | None = None,
        analysis_range: tuple | None = None,
        reference_range: tuple | None = None,
    ) -> StatsResponse:
        data_obs = DataObservability(current_df, reference_df, interval, analysis_range, reference_range)
        drift_report, summary = data_obs.get_data_drift_report()
        latency_distribution, response_times = data_obs.get_latency_report()
        return StatsResponse(
            data_quality_report=data_obs.get_data_quality_report(),
            attribute_quality_report=data_obs.get_attribute_quality_report(),
            data_drift_report=drift_report,
            data_drift_summary=summary,
            data_distribution_report=data_obs.get_data_distribution_report(),
            latency_distribution_report=latency_distribution,
            response_times_report=response_times,
            # multivariate_drift_report = data_obs.get_multivariate_drift_report()
        )

    @staticmethod
    def _buckets_to_rows(df: pd.DataFrame) -> pd.DataFrame:
        """Reshape context_history_1m rows to the raw-row shape DataObservability reads.

        One bucket row per attribute becomes three rows: `<attr>`, `<attr>_std`, `<attr>_count`.
        """
        if df.empty:
            return df
        # One latency per bucket (mean over its attributes), read by DataObservability as latency_ms
        df["latency_ms"] = df.groupby("observed_at")["latency_ms"].transform("mean")
        # A bucket with one reading has no spread; NaN would count as missing.
        df["std"] = df["std"].fillna(0.0)
        df["count"] = df["count"].astype(float)
        rows = df.melt(
            id_vars=["observed_at", "entity_id", "attr_name", "latency_ms"],
            value_vars=["value", "std", "count"],
            var_name="stat",
            value_name="v",
        )
        rows["attr_name"] = rows["attr_name"] + rows["stat"].map({"value": "", "std": "_std", "count": "_count"})
        return rows.drop(columns="stat").rename(columns={"v": "value"})

    @staticmethod
    async def _read_entity_context_history(
        session: AsyncSession, resampled: bool, broker_id: str, entity_id: str, start: datetime, end: datetime
    ) -> pd.DataFrame:
        params = {"broker_id": broker_id, "entity_id": entity_id, "start": start, "end": end}
        result = await session.execute(CONTEXT_HISTORY_1M_SQL if resampled else CONTEXT_HISTORY_SQL, params)
        df = pd.DataFrame(result.fetchall(), columns=list(result.keys()))
        return StatsService._buckets_to_rows(df) if resampled else df

    @staticmethod
    async def retrieve_stats(payload: StatsPayload) -> StatsResponse:
        # Convert strings to datetime
        start_dt = datetime.fromisoformat(payload.from_datetime.replace("Z", "+00:00"))
        end_dt = datetime.fromisoformat(payload.to_datetime.replace("Z", "+00:00"))
        key = (payload.broker_id, payload.entity_id)

        async with async_session() as session:
            ref = (await session.execute(ENTITY_REFERENCE_SQL, {"broker_id": key[0], "entity_id": key[1]})).first()
            if ref is None:
                return StatsResponse(message="The reference range of this entity is not complete yet.")

            cached = _reference_cache.get(key)
            if cached and cached[:2] == (ref.ref_start, ref.ref_end):
                reference_df = cached[2]
            else:
                reference_df = await StatsService._read_entity_context_history(
                    session, ref.resampled, *key, ref.ref_start, ref.ref_end
                )
                if reference_df.empty:
                    # Not cached: for a resampled entity this means the backfill has not run yet.
                    return StatsResponse(message="No reference data for this entity.")
                _reference_cache[key] = (ref.ref_start, ref.ref_end, reference_df)

            # The analysis window never overlaps the reference range.
            start_dt = max(start_dt, ref.ref_end)
            if start_dt >= end_dt:
                return StatsResponse(
                    message=f"The selected range is inside the reference range (until {ref.ref_end.isoformat()})."
                )

            current_df = await StatsService._read_entity_context_history(session, ref.resampled, *key, start_dt, end_dt)

        if current_df.empty:
            return StatsResponse(message="No data in the selected range.")

        # One slot of the data: the bucket for resampled entities, the native interval for raw ones.
        interval = pd.Timedelta(minutes=1) if ref.resampled else pd.Timedelta(seconds=ref.native_interval_s)
        # copy(): DataObservability changes its input frames; the cached one must stay as read.
        return StatsService.calculate_stats(
            current_df=current_df,
            reference_df=reference_df.copy(),
            interval=interval,
            analysis_range=(start_dt, end_dt),
            reference_range=(ref.ref_start, ref.ref_end),
        )


stats_service = StatsService()
