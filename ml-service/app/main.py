"""
ML Pricing Engine — FastAPI application entry point.

Startup sequence:
  1. Configure structured JSON logging
  2. Load valid cars + support counts
  3. Load active model
  4. Warm up SHAP explainer (blocking)
  5. Yield to FastAPI

Middleware:
  - RequestLoggingMiddleware: structured JSON request/response logs
  - MetricsMiddleware: Prometheus error tracking

Routes:
  - /health           : service health + model version
  - /api/v1/predict   : single prediction
  - /api/v1/predict/batch : batch prediction
  - /metrics          : Prometheus scrape endpoint
"""
import logging

from fastapi import FastAPI
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.logging_config import setup_logging
from app.core.middleware import RequestLoggingMiddleware
from app.core.metrics import MetricsMiddleware, metrics_endpoint
from app.api import predict, health
from app.services.model_state import load_valid_cars, load_active_model, load_model_diagnostics
from app.services.explainer import warm_up_shap
from app.services.ensemble_explainer import init_ensemble_explainer, warm_up_ensemble_shap

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging(log_level=settings.log_level)
    logger.info("Starting ML Pricing Engine...")

    load_valid_cars()
    load_active_model()
    load_model_diagnostics()
    warm_up_shap()
    init_ensemble_explainer()
    warm_up_ensemble_shap()
    logger.info("ML Pricing Engine ready.")
    yield
    logger.info("ML Pricing Engine shutting down.")


app = FastAPI(
    title="ML Pricing Engine API",
    description="API for predicting used car prices using quantile regression models.",
    version="1.1.0",
    lifespan=lifespan,
)

# Middleware (order matters: outermost first)
app.add_middleware(MetricsMiddleware)
app.add_middleware(RequestLoggingMiddleware)

# Routers
app.include_router(health.router)
app.include_router(predict.router)

# Prometheus metrics endpoint
app.add_api_route("/metrics", metrics_endpoint, methods=["GET"], include_in_schema=False)
