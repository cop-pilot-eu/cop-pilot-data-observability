from typing import Literal

from pydantic import PositiveInt
from pydantic_settings import BaseSettings


class _Config(BaseSettings):
    postgres_host: str
    postgres_port: int
    postgres_user: str
    postgres_password: str
    postgres_db: str

    # NannyML drift chunking, applied identically to reference and analysis
    chunk_by: Literal["size", "period"] = "size"
    chunk_size: PositiveInt = 60
    chunk_period: str = "h"

    class Config:
        env_file = ".env"


Config = _Config()
