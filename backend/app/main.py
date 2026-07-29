from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import asyncio

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.database import create_db_and_tables
from app.bot.runner import start_mezon_bot


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Khởi tạo Database
    create_db_and_tables()
    
    # Bật Bot Mezon chạy ngầm cùng lúc
    asyncio.create_task(start_mezon_bot())
    
    yield
    # Shutdown (cleanup if needed)


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="Backend API cho Mezon Knowledge Hub — quản lý tài liệu, lộ trình học và tích hợp Mezon Bot.",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok", "app": settings.APP_NAME, "version": "1.0.0"}
