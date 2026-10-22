from datetime import datetime

import pandas as pd
from sqlmodel import select

from ..core.clients.postgres_client import async_session
from ..models.sql.context_history_sql_model import ContextHistory
from ..models.sql.reference_data_sql_model import ReferenceData
from ..models.stats_payload_model import StatsPayload
from ..models.stats_response_model import StatsResponse
from .data_observability import DataObservability


class StatsService:
    @staticmethod
    def calculate_stats(current_df: pd.DataFrame, reference_df: pd.DataFrame) -> StatsResponse:
        data_obs = DataObservability(current_df, reference_df)
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
    async def retrieve_stats(payload: StatsPayload) -> StatsResponse:
        # Convert strings to datetime
        start_dt = datetime.fromisoformat(payload.from_datetime.replace("Z", "+00:00"))
        end_dt = datetime.fromisoformat(payload.to_datetime.replace("Z", "+00:00"))

        async with async_session() as session:
            result = await session.exec(
                select(ReferenceData)
                .where(ReferenceData.entity_id == payload.entity_id)
                .order_by(ReferenceData.observed_at.desc())
            )
            data = result.all()

            reference_df = pd.DataFrame([item.model_dump() for item in data])

            if reference_df.empty:
                return StatsResponse()

            result = await session.exec(
                select(ContextHistory)
                .where(ContextHistory.entity_id == payload.entity_id)
                .where(ContextHistory.observed_at.between(start_dt, end_dt))
                .order_by(ContextHistory.observed_at.desc())
            )
            data = result.all()

            # Convert data to pandas DataFrame
            current_df = pd.DataFrame([item.model_dump() for item in data])

            if current_df.empty:
                return StatsResponse()

            return StatsService.calculate_stats(current_df=current_df, reference_df=reference_df)


stats_service = StatsService()
