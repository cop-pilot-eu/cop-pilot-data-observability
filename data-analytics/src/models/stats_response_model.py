import math
from datetime import datetime
from typing import Optional, Union

from pydantic import Field, field_validator

from .camel_case_model import CamelCaseModel


class DataQualityReport(CamelCaseModel):
    number_of_attributes: int
    number_of_records: int
    total_missing_values: int
    completeness: float = Field(validation_alias="completeness_%")
    avg_latency_ms: int
    completeness_diff_percentage: float 
    avg_latency_diff_percentage: float


class AttributeQualityReport(CamelCaseModel):
    dtype: str
    count: int
    missing: int
    mean: Union[float, str]
    min: Union[float, str]
    max: Union[float, str]
    outliers: Union[int, str]


class Column(CamelCaseModel):
    name: str
    value: Optional[Union[float, str]] = None
    metric: str
    lower_threshold: Optional[float] = None
    upper_threshold: Optional[float] = None
    alert: bool

    @field_validator("value", mode="before")
    @classmethod
    def fix_invalid_value(cls: "type[Column]", v: Optional[Union[float, str]]) -> Optional[Union[float, str]]:
        if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
            return None
        return v


class DataDriftReport(CamelCaseModel):
    chunk_index: int
    chunk_key: str
    chunk_start_index: int
    chunk_end_index: int
    chunk_start_date: datetime
    chunk_end_date: datetime
    chunk_period: str
    columns: list[Column]


class DataDistributionReport(CamelCaseModel):
    attribute: str
    bin: str
    bin_edges: Optional[list[float]] = None
    reference: float
    analysis: float


class DataDriftSummary(CamelCaseModel):
    chunk_start_date: datetime
    chunk_end_date: datetime
    name: str
    value: Optional[float] = None
    upper_threshold: Optional[float] = None
    alert: bool


class LatencyDistributionReport(CamelCaseModel):
    bin: str
    bin_edges: list[float]
    latency: float


class ResponseTimesReport(CamelCaseModel):
    observed_at: datetime
    latency: float
    normal_response: int
    slower_than_usual_response: int
    unacceptably_slow_response: int


class StatsResponse(CamelCaseModel):
    data_quality_report: Optional[DataQualityReport] = None
    attribute_quality_report: Optional[dict[str, AttributeQualityReport]] = None
    data_drift_report: Optional[list[DataDriftReport]] = None
    data_distribution_report: Optional[list[DataDistributionReport]] = None
    data_drift_summary: Optional[list[DataDriftSummary]] = None
    latency_distribution_report: Optional[list[LatencyDistributionReport]] = None
    response_times_report: Optional[list[ResponseTimesReport]] = None
    # Why the reports are empty, e.g. reference range not complete yet.
    message: str | None = None
