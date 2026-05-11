from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy.dialects.postgresql import JSONB, TIMESTAMP
from sqlmodel import Column, Field, SQLModel


class ReferenceData(SQLModel, table=True):  # type: ignore
    __tablename__ = "reference_data"

    observed_at: datetime = Field(sa_column=Column(TIMESTAMP(timezone=True), primary_key=True))
    time: datetime = Field(sa_column=Column(TIMESTAMP(timezone=True), nullable=False))
    entity_id: str = Field(primary_key=True)
    entity_type: str
    attr_name: str = Field(primary_key=True)
    attr_type: Optional[str] = Field(default=None, nullable=True)
    value: Optional[Any] = Field(default=None, sa_column=Column(JSONB, nullable=True))
    context_metadata: Optional[Dict[str, Any]] = Field(
        default=None, sa_column=Column("metadata", JSONB, nullable=True), alias="metadata"
    )
