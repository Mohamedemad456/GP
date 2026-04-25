from fastapi import FastAPI
from contextlib import asynccontextmanager
from app.api import predict, health
from app.services.predictor import load_valid_cars

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Load the lookup list of valid car models so we can validate requests
    load_valid_cars()
    yield
    # Shutdown
    pass

app = FastAPI(
    title="ML Pricing Engine API",
    description="API for predicting used car prices. Currently returning dummy data for backend integration.",
    version="1.0.0",
    lifespan=lifespan
)

app.include_router(health.router)
app.include_router(predict.router)
