import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.chat import router as chat_router
from app.core.config import settings

# ── Logging ──────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


app = FastAPI(
    title="Used cars AI Assistant",
    description="AI-powered chatbot for helping customers find cars and answer automotive questions",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ─────────────────────────────────────────────────────────
# Reads CORS_ORIGINS from env / .env (default "*").
# Set CORS_ORIGINS="http://localhost:5173,https://yourdomain.com" in
# production to restrict allowed origins.
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

# Include routers
app.include_router(
    chat_router,
    prefix="/api/v1",
    tags=["Chat"]
)


# Health check endpoint
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