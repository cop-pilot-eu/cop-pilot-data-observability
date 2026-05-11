from fastapi import APIRouter

from ..models.stats_payload_model import StatsPayload
from ..models.stats_response_model import StatsResponse
from ..services.stats_service import stats_service

router = APIRouter()


@router.post("/calculate-stats", tags=["calculate-stats"])
async def calculate_stats(payload: StatsPayload) -> StatsResponse:
    return await stats_service.retrieve_stats(payload=payload)
