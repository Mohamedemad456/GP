"""
Health check response schemas.

HealthResponse:
    - status: "healthy" | "unhealthy"
    - model_version: active model version string
    - model_trained_at: training date
    - uptime_seconds: service uptime

ModelInfoResponse:
    - version, metrics (mape, r2, mae), feature_list, n_training_samples
"""

# TODO: Implement Pydantic models
