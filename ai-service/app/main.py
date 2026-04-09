import logging
import time
from logging.handlers import RotatingFileHandler
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.chat import router as chat_router

logger = logging.getLogger(__name__)

LOG_FORMAT = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
LOG_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"
_LOGGING_CONFIGURED = False


def configure_logging() -> None:
    """Configure console and rotating file logging for the service."""
    global _LOGGING_CONFIGURED

    if _LOGGING_CONFIGURED:
        return

    log_level = getattr(logging, settings.log_level.upper(), logging.INFO)
    formatter = logging.Formatter(LOG_FORMAT, datefmt=LOG_DATE_FORMAT)
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)

    if not root_logger.handlers:
        console_handler = logging.StreamHandler()
        console_handler.setLevel(log_level)
        console_handler.setFormatter(formatter)
        root_logger.addHandler(console_handler)

    log_file_path = Path(settings.log_file_path)
    log_file_path.parent.mkdir(parents=True, exist_ok=True)

    file_handler_exists = any(
        isinstance(handler, RotatingFileHandler)
        and Path(getattr(handler, "baseFilename", "")).resolve() == log_file_path.resolve()
        for handler in root_logger.handlers
    )

    if not file_handler_exists:
        try:
            file_handler = RotatingFileHandler(
                log_file_path,
                maxBytes=settings.log_max_bytes,
                backupCount=settings.log_backup_count,
                encoding="utf-8",
            )
            file_handler.setLevel(log_level)
            file_handler.setFormatter(formatter)
            root_logger.addHandler(file_handler)
        except OSError as exc:
            root_logger.warning(
                "File logging disabled for %s: %s",
                log_file_path,
                exc,
            )

    for logger_name in ("app", "app.api", "app.services", "app.core"):
        logging.getLogger(logger_name).setLevel(log_level)

    logging.getLogger(__name__).info("Logging initialized. Writing to %s", log_file_path)

    _LOGGING_CONFIGURED = True


configure_logging()


app = FastAPI(
    title="Used cars AI Assistant",
    description="AI-powered chatbot for helping customers find cars and answer automotive questions",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ─────────────────────────────────────────────────────────
allowed_origins = [
    origin.strip()
    for origin in settings.cors_origins.split(",")
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(
    chat_router,
    prefix="/api/v1",
    tags=["Chat"]
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log each request so service usage and failures are persisted."""
    start_time = time.perf_counter()
    client_host = request.client.host if request.client else "unknown"

    logger.info(
        "Request started method=%s path=%s client=%s",
        request.method,
        request.url.path,
        client_host,
    )

    try:
        response = await call_next(request)
    except Exception:
        elapsed = time.perf_counter() - start_time
        logger.exception(
            "Request failed method=%s path=%s client=%s duration=%.3fs",
            request.method,
            request.url.path,
            client_host,
            elapsed,
        )
        raise

    elapsed = time.perf_counter() - start_time
    logger.info(
        "Request completed method=%s path=%s status=%s client=%s duration=%.3fs",
        request.method,
        request.url.path,
        response.status_code,
        client_host,
        elapsed,
    )

    return response


@app.get(
    "/health",
    tags=["System"],
    summary="Health Check",
    description="Check if the API is running"
)
async def health_check():
    """
    Health check endpoint.
    
    Returns:
        dict: Service status
    """

    return {
        "status": "healthy",
        "service": "car-dealership-ai",
        "version": "0.1.0"
    }


# Root endpoint
@app.get(
    "/",
    tags=["System"],
    summary="API Information"
)
async def root():
    """
    Root endpoint with API information.
    
    Returns:
        dict: API welcome message and documentation links
    """
    return {
        "message": "Welcome to Karna AI Assistant API",
        "docs": "/docs",
        "health": "/health",
        "chat_endpoint": "/api/v1/chat"
    }