"""
Prometheus monitoring metrics for the ML service.

Exposes custom metrics at /metrics for Prometheus scraping:
  - prediction_requests_total (counter, labelled by confidence)
  - prediction_duration_seconds (histogram)
  - prediction_errors_total (counter)
  - batch_prediction_requests_total (counter)
  - http_request_duration_seconds (histogram)
"""
import logging
import time

from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger(__name__)

PREDICTION_REQUESTS = Counter(
    "prediction_requests_total",
    "Total prediction requests",
    ["confidence"],
)

PREDICTION_DURATION = Histogram(
    "prediction_duration_seconds",
    "Prediction latency in seconds",
    buckets=[0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
)

PREDICTION_ERRORS = Counter(
    "prediction_errors_total",
    "Total prediction errors",
)

BATCH_REQUESTS = Counter(
    "batch_prediction_requests_total",
    "Total batch prediction requests",
)

PREDICTION_REQUESTS_BY_ENDPOINT = Counter(
    "prediction_requests_by_endpoint_total",
    "Total prediction requests labelled by endpoint type",
    ["endpoint"],
)

HTTP_REQUEST_DURATION = Histogram(
    "http_request_duration_seconds",
    "HTTP request latency in seconds",
    ["method", "path", "status_code"],
    buckets=[0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
)


def metrics_endpoint(request: Request) -> Response:
    """Serve Prometheus metrics."""
    return Response(
        content=generate_latest(),
        media_type=CONTENT_TYPE_LATEST,
    )


def record_prediction(confidence: str, duration_s: float) -> None:
    """Record a successful prediction in Prometheus metrics."""
    PREDICTION_REQUESTS.labels(confidence=confidence).inc()
    PREDICTION_DURATION.observe(duration_s)


def record_prediction_error() -> None:
    """Record a prediction error in Prometheus metrics."""
    PREDICTION_ERRORS.inc()


def record_batch_request() -> None:
    """Record a batch prediction request."""
    BATCH_REQUESTS.inc()


def record_prediction_by_endpoint(endpoint: str) -> None:
    """Record a prediction request by endpoint type (single or batch)."""
    PREDICTION_REQUESTS_BY_ENDPOINT.labels(endpoint=endpoint).inc()


class MetricsMiddleware:
    """ASGI middleware to record generic HTTP timing and unhandled errors."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        start = time.monotonic()
        method = scope.get("method", "UNKNOWN")
        path = scope.get("path", "")
        status_code = "500"

        async def send_with_metrics(message):
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = str(message.get("status", 500))
            if message["type"] == "http.response.body" and not message.get("more_body") is True:
                HTTP_REQUEST_DURATION.labels(
                    method=method,
                    path=path,
                    status_code=status_code,
                ).observe(time.monotonic() - start)
            await send(message)

        try:
            await self.app(scope, receive, send_with_metrics)
        except Exception:
            record_prediction_error()
            raise
