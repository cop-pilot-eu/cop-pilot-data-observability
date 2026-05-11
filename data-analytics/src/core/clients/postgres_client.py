from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from src.config import Config

DATABASE_URL = f"postgresql+asyncpg://{Config.postgres_user}:{Config.postgres_password}@{Config.postgres_host}:{Config.postgres_port}/{Config.postgres_db}"

engine: AsyncEngine = create_async_engine(
    DATABASE_URL, echo=False, pool_size=10, max_overflow=20, pool_timeout=30, pool_recycle=1800
)

async_session = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def init_postgres_client() -> None:
    async with engine.begin() as connection:
        await connection.run_sync(SQLModel.metadata.create_all)
