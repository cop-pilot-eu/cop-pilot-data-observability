import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from src.routers import stats_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    logging.info("[+] Lifespan starting...")
    try:
        yield
    finally:
        logging.info("[+] Lifespan stops...")


app = FastAPI(lifespan=lifespan)

app.include_router(stats_router.router)
