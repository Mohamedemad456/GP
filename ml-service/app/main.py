from fastapi import FastAPI
from contextlib import asynccontextmanager
from app.api import predict, health
from app.services.predictor import load_valid_cars, load_active_model

@asynccontextmanager
async def lifespan(app: FastAPI):
    load_valid_cars()
    load_active_model()
    yield

app = FastAPI(
    title="ML Pricing Engine API",
    description="API for predicting used car prices using quantile regression models.",
    version="1.0.0",
    lifespan=lifespan
)

app.include_router(health.router)
app.include_router(predict.router)
