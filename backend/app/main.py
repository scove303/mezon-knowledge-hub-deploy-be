from contextlib import asynccontextmanager
from collections import defaultdict
import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, JSONResponse
import asyncio

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.database import create_db_and_tables, run_migrations
from app.bot.runner import start_mezon_bot


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Khởi tạo Database & Chạy auto-migrations
    create_db_and_tables()
    run_migrations()
    
    # Bật Bot Mezon chạy ngầm cùng lúc (không làm sập app nếu bot fail)
    async def safe_start_bot():
        try:
            await start_mezon_bot()
        except Exception as e:
            print(f"[BOT] Khong the khoi dong Mezon Bot (se chay rieng): {e}")
            import sys
            sys.stdout.flush()
    
    bot_task = asyncio.create_task(safe_start_bot())
    
    yield
    # Shutdown (cleanup)
    bot_task.cancel()
    try:
        await bot_task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="Backend API cho Mezon Knowledge Hub — quản lý tài liệu, lộ trình học và tích hợp Mezon Bot.",
    openapi_url=f"{settings.API_V1_STR}/openapi.json" if settings.DEBUG else None,
    docs_url=f"{settings.API_V1_STR}/docs" if settings.DEBUG else None,
    redoc_url=f"{settings.API_V1_STR}/redoc" if settings.DEBUG else None,
    lifespan=lifespan,
)

# CORS
cors_origins = list(settings.BACKEND_CORS_ORIGINS)
if settings.FRONTEND_URL and settings.FRONTEND_URL not in cors_origins:
    cors_origins.append(settings.FRONTEND_URL)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security Headers Middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response: Response = await call_next(request)
    # Content Security Policy - strict default, adjust as needed for frontend
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https:; "
        "font-src 'self' data:; "
        "connect-src 'self' https: wss:; "
        "frame-ancestors 'none'; "
        "base-uri 'self'; "
        "form-action 'self'"
    )
    # Prevent clickjacking
    response.headers["X-Frame-Options"] = "DENY"
    # Enforce HTTPS (HSTS) - only in production
    if not settings.DEBUG:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
    # Prevent MIME type sniffing
    response.headers["X-Content-Type-Options"] = "nosniff"
    # Referrer policy
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    # Permissions policy (feature policy)
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    return response


# =====================================================================
# GLOBAL RATE LIMITING MIDDLEWARE
# =====================================================================
# In-memory sliding window rate limiter
# Structure: {key: [(timestamp, count), ...]}
_rate_limit_store: dict[str, list[tuple[float, int]]] = defaultdict(list)
_rate_limit_lock = asyncio.Lock()

# Rate limit configuration: path_prefix -> (max_requests, window_seconds)
# Stricter limits for auth and AI endpoints
RATE_LIMIT_CONFIG = {
    "/auth/": (10, 60),           # 10 requests per minute for auth
    "/ai/": (20, 60),             # 20 requests per minute for AI endpoints
    "/shared-chats/": (30, 60),   # 30 requests per minute for shared chats
    "/folders/": (60, 60),        # 60 requests per minute for folders
    "/files/": (60, 60),          # 60 requests per minute for files
    "default": (120, 60),         # 120 requests per minute default
}


def _get_client_key(request: Request, path: str) -> str:
    """Generate rate limit key based on client IP and optionally user_id."""
    # Get client IP
    client_ip = request.client.host if request.client else "unknown"
    
    # Try to get user_id from auth header (for authenticated endpoints)
    auth_header = request.headers.get("Authorization", "")
    user_part = ""
    if auth_header.startswith("Bearer "):
        # Use first 8 chars of token as user identifier (without decoding)
        token_snippet = auth_header[7:15]
        user_part = f":user_{token_snippet}"
    
    return f"{client_ip}{user_part}:{path}"


def _check_rate_limit(key: str, max_requests: int, window_seconds: int) -> tuple[bool, int, int]:
    """Check if request is within rate limit. Returns (allowed, remaining, retry_after)."""
    now = time.time()
    window_start = now - window_seconds
    
    # Clean old entries
    requests = _rate_limit_store[key]
    while requests and requests[0][0] < window_start:
        requests.pop(0)
    
    current_count = sum(count for _, count in requests)
    
    if current_count >= max_requests:
        # Calculate retry after (when oldest request expires)
        oldest_time = requests[0][0] if requests else now
        retry_after = int(oldest_time + window_seconds - now) + 1
        return False, 0, max(retry_after, 1)
    
    # Add current request
    requests.append((now, 1))
    remaining = max_requests - current_count - 1
    return True, remaining, 0


def _get_rate_limit_config(path: str) -> tuple[int, int]:
    """Get rate limit config for a path."""
    for prefix, config in RATE_LIMIT_CONFIG.items():
        if path.startswith(prefix):
            return config
    return RATE_LIMIT_CONFIG["default"]


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    """Global rate limiting middleware."""
    path = request.url.path
    
    # Skip rate limiting for health check
    if path == "/health":
        return await call_next(request)
    
    # Get rate limit config for this path
    max_requests, window_seconds = _get_rate_limit_config(path)
    
    # Generate client key
    client_key = _get_client_key(request, path)
    
    # Check rate limit
    allowed, remaining, retry_after = _check_rate_limit(client_key, max_requests, window_seconds)
    
    if not allowed:
        return JSONResponse(
            status_code=429,
            content={
                "success": False,
                "message": "Quá nhiều yêu cầu. Vui lòng thử lại sau.",
                "data": None,
                "retry_after": retry_after,
            },
            headers={
                "X-RateLimit-Limit": str(max_requests),
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": str(int(time.time()) + retry_after),
                "Retry-After": str(retry_after),
            },
        )
    
    # Process request
    response = await call_next(request)
    
    # Add rate limit headers to response
    response.headers["X-RateLimit-Limit"] = str(max_requests)
    response.headers["X-RateLimit-Remaining"] = str(remaining)
    response.headers["X-RateLimit-Reset"] = str(int(time.time()) + window_seconds)
    
    return response

# Routes
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok", "app": settings.APP_NAME, "version": "1.0.0"}
