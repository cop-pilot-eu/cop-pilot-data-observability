from pydantic import Field

from .camel_case_model import CamelCaseModel


class StatsPayload(CamelCaseModel):
    from_datetime: str = Field(alias="from")
    to_datetime: str = Field(alias="to")
    entity_id: str
