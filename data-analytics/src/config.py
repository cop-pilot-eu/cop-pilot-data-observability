from pydantic_settings import BaseSettings


class _Config(BaseSettings):
    postgres_host: str
    postgres_port: int
    postgres_user: str
    postgres_password: str
    postgres_db: str

    class Config:
        env_file = ".env"


Config = _Config()
