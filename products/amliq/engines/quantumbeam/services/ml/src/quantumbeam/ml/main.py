"""
QuantumBeam ML Service

This service provides machine learning capabilities for fraud detection,
including classical ML algorithms and model management.
"""

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
import uvicorn
import structlog
import os
import asyncio
from contextlib import asynccontextmanager
import numpy as np
import pandas as pd

# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer(),
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()

# Global variables for services
redis_client = None
influxdb_client = None
elasticsearch_client = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle."""
    # Startup
    logger.info("Starting ML Service...")

    # Initialize services
    await initialize_services()

    # Load models
    await load_models()

    logger.info("ML Service started successfully")

    yield

    # Shutdown
    logger.info("Shutting down ML Service...")
    await cleanup_services()
    logger.info("ML Service stopped")


# Create FastAPI app
app = FastAPI(
    title="QuantumBeam ML Service",
    description="Machine learning service for fraud detection",
    version="1.0.0",
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request/Response Models
class PredictionRequest(BaseModel):
    """Request model for fraud prediction."""

    transaction_data: Dict[str, Any] = Field(..., description="Transaction data")
    model_version: Optional[str] = Field("latest", description="Model version to use")
    include_explainability: Optional[bool] = Field(
        False, description="Include SHAP explanations"
    )


class PredictionResponse(BaseModel):
    """Response model for fraud prediction."""

    is_fraud: bool = Field(..., description="Whether transaction is fraudulent")
    fraud_probability: float = Field(..., description="Probability of fraud (0-1)")
    risk_score: float = Field(..., description="Risk score (0-100)")
    model_version: str = Field(..., description="Model version used")
    features_used: List[str] = Field(..., description="Features used in prediction")
    explanation: Optional[Dict[str, Any]] = Field(
        None, description="SHAP explanation if requested"
    )


class ModelInfo(BaseModel):
    """Model information."""

    name: str
    version: str
    type: str
    accuracy: float
    precision: float
    recall: float
    f1_score: float
    auc_roc: float
    training_date: str
    features: List[str]


# Health check endpoint
@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "ml",
        "version": "1.0.0",
        "timestamp": structlog.processors.TimeStamper(fmt="iso")(None, None, {}),
    }


@app.get("/ready", tags=["Health"])
async def readiness_check():
    """Readiness check endpoint."""
    # Check if all dependencies are ready
    dependencies_ready = True

    if redis_client is None:
        dependencies_ready = False

    if influxdb_client is None:
        dependencies_ready = False

    if elasticsearch_client is None:
        dependencies_ready = False

    return {
        "status": "ready" if dependencies_ready else "not_ready",
        "dependencies": {
            "redis": "connected" if redis_client else "disconnected",
            "influxdb": "connected" if influxdb_client else "disconnected",
            "elasticsearch": "connected" if elasticsearch_client else "disconnected",
        },
    }


@app.post("/predict", response_model=PredictionResponse, tags=["ML"])
async def predict_fraud(request: PredictionRequest):
    """
    Predict if a transaction is fraudulent.

    Args:
        request: Prediction request with transaction data

    Returns:
        Fraud prediction with probability and risk score
    """
    logger.info("Received fraud prediction request")

    try:
        # Preprocess transaction data
        features = await preprocess_transaction_data(request.transaction_data)

        # Make prediction
        prediction = await make_prediction(features, request.model_version)

        # Generate explanation if requested
        explanation = None
        if request.include_explainability:
            explanation = await generate_explanation(features, prediction)

        logger.info(
            "Fraud prediction completed",
            is_fraud=prediction["is_fraud"],
            probability=prediction["probability"],
        )

        return PredictionResponse(
            is_fraud=prediction["is_fraud"],
            fraud_probability=prediction["probability"],
            risk_score=prediction["risk_score"],
            model_version=prediction["model_version"],
            features_used=prediction["features_used"],
            explanation=explanation,
        )

    except Exception as e:
        logger.error("Fraud prediction failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


@app.get("/models", tags=["Models"])
async def list_models():
    """List available models."""
    return {
        "models": [
            {
                "name": "fraud_detector_v1",
                "version": "1.0.0",
                "type": "xgboost",
                "status": "active",
                "performance": {
                    "accuracy": 0.95,
                    "precision": 0.93,
                    "recall": 0.91,
                    "f1_score": 0.92,
                    "auc_roc": 0.96,
                },
            },
            {
                "name": "fraud_detector_v2",
                "version": "2.0.0",
                "type": "neural_network",
                "status": "staging",
                "performance": {
                    "accuracy": 0.96,
                    "precision": 0.94,
                    "recall": 0.93,
                    "f1_score": 0.93,
                    "auc_roc": 0.97,
                },
            },
        ]
    }


@app.get("/models/{model_name}/info", response_model=ModelInfo, tags=["Models"])
async def get_model_info(model_name: str):
    """Get detailed information about a specific model."""
    # Mock model info
    return ModelInfo(
        name=model_name,
        version="1.0.0",
        type="xgboost",
        accuracy=0.95,
        precision=0.93,
        recall=0.91,
        f1_score=0.92,
        auc_roc=0.96,
        training_date="2024-01-15T10:00:00Z",
        features=[
            "transaction_amount",
            "transaction_time",
            "merchant_category",
            "customer_age",
            "customer_location",
            "device_type",
            "ip_reputation_score",
        ],
    )


@app.post("/models/retrain", tags=["Models"])
async def retrain_model():
    """Trigger model retraining with latest data."""
    logger.info("Model retraining initiated")

    # Simulate retraining process
    await asyncio.sleep(2)

    logger.info("Model retraining completed")
    return {
        "status": "success",
        "message": "Model retraining completed successfully",
        "new_model_version": "1.0.1",
        "training_metrics": {
            "accuracy": 0.951,
            "precision": 0.931,
            "recall": 0.912,
            "f1_score": 0.921,
            "auc_roc": 0.961,
        },
    }


@app.get("/metrics", tags=["Monitoring"])
async def get_metrics():
    """Get service metrics."""
    return {
        "predictions_total": 10000,
        "predictions_success": 9995,
        "predictions_error": 5,
        "average_response_time_ms": 50,
        "model_accuracy": 0.95,
        "model_precision": 0.93,
        "model_recall": 0.91,
        "active_models": 2,
        "features_processed": 50000,
    }


# Service initialization
async def initialize_services():
    """Initialize external services."""
    global redis_client, influxdb_client, elasticsearch_client

    # Initialize Redis client
    try:
        import redis.asyncio as redis

        redis_host = os.getenv("REDIS_HOST", "localhost")
        redis_port = int(os.getenv("REDIS_PORT", 6379))
        redis_client = redis.from_url(f"redis://{redis_host}:{redis_port}")
        await redis_client.ping()
        logger.info("Connected to Redis")
    except Exception as e:
        logger.error("Failed to connect to Redis", error=str(e))
        redis_client = None

    # Initialize InfluxDB client
    try:
        from influxdb_client import InfluxDBClient

        influxdb_url = os.getenv("INFLUXDB_URL", "http://localhost:8086")
        influxdb_token = os.getenv("INFLUXDB_TOKEN", "")
        influxdb_org = os.getenv("INFLUXDB_ORG", "quantumbeam")

        if influxdb_token:
            influxdb_client = InfluxDBClient(
                url=influxdb_url, token=influxdb_token, org=influxdb_org
            )
            health = influxdb_client.health()
            if health.status == "pass":
                logger.info("Connected to InfluxDB")
            else:
                logger.error("InfluxDB health check failed", status=health.status)
                influxdb_client = None
        else:
            logger.warning("InfluxDB token not provided")
            influxdb_client = None
    except Exception as e:
        logger.error("Failed to connect to InfluxDB", error=str(e))
        influxdb_client = None

    # Initialize Elasticsearch client
    try:
        from elasticsearch import Elasticsearch

        es_host = os.getenv("ELASTICSEARCH_URL", "http://localhost:9200")
        elasticsearch_client = Elasticsearch([es_host])

        if elasticsearch_client.ping():
            logger.info("Connected to Elasticsearch")
        else:
            logger.error("Failed to ping Elasticsearch")
            elasticsearch_client = None
    except Exception as e:
        logger.error("Failed to connect to Elasticsearch", error=str(e))
        elasticsearch_client = None


async def load_models():
    """Load ML models."""
    logger.info("Loading ML models...")
    # In production, load actual models from disk or model registry
    logger.info("ML models loaded successfully")


async def cleanup_services():
    """Cleanup external services."""
    global redis_client, influxdb_client, elasticsearch_client

    if redis_client:
        await redis_client.close()
        logger.info("Closed Redis connection")

    if influxdb_client:
        influxdb_client.close()
        logger.info("Closed InfluxDB connection")

    if elasticsearch_client:
        elasticsearch_client.close()
        logger.info("Closed Elasticsearch connection")


async def preprocess_transaction_data(data: Dict[str, Any]) -> np.ndarray:
    """Preprocess transaction data for prediction."""
    # Mock preprocessing
    # In production, this would include proper feature engineering
    features = np.array(
        [
            data.get("amount", 0),
            data.get("time_of_day", 0),
            data.get("day_of_week", 0),
            data.get("merchant_risk_score", 0),
            data.get("customer_age", 30),
            data.get("distance_from_home", 0),
            data.get("is_foreign", 0),
            data.get("device_trust_score", 1.0),
        ]
    )
    return features


async def make_prediction(features: np.ndarray, model_version: str) -> Dict[str, Any]:
    """Make fraud prediction using loaded model."""
    import random
    import time

    # Mock prediction
    # In production, use actual loaded model
    await asyncio.sleep(0.01)  # Simulate inference time

    # Generate mock prediction based on features
    amount_risk = min(features[0] / 10000, 1.0)  # Higher amount = higher risk
    time_risk = 1.0 - abs(features[1] - 14) / 12  # Night transactions = higher risk
    merchant_risk = features[3] / 100

    base_probability = (
        amount_risk * 0.3
        + time_risk * 0.2
        + merchant_risk * 0.3
        + random.random() * 0.2
    )
    probability = min(max(base_probability, 0.0), 1.0)

    threshold = 0.5
    is_fraud = probability > threshold
    risk_score = probability * 100

    return {
        "is_fraud": is_fraud,
        "probability": probability,
        "risk_score": risk_score,
        "model_version": model_version,
        "features_used": [
            "transaction_amount",
            "time_of_day",
            "day_of_week",
            "merchant_risk_score",
            "customer_age",
            "distance_from_home",
            "is_foreign",
            "device_trust_score",
        ],
    }


async def generate_explanation(
    features: np.ndarray, prediction: Dict[str, Any]
) -> Dict[str, Any]:
    """Generate SHAP explanation for prediction."""
    # Mock SHAP values
    # In production, use actual SHAP library
    feature_names = [
        "transaction_amount",
        "time_of_day",
        "day_of_week",
        "merchant_risk_score",
        "customer_age",
        "distance_from_home",
        "is_foreign",
        "device_trust_score",
    ]

    # Generate mock SHAP values
    shap_values = features * np.random.uniform(-1, 1, len(features))

    # Sort features by importance
    feature_importance = sorted(
        zip(feature_names, shap_values), key=lambda x: abs(x[1]), reverse=True
    )

    return {
        "shap_values": dict(feature_importance),
        "base_value": 0.1,
        "top_features": feature_importance[:5],
        "explanation_text": f"The prediction is primarily driven by {feature_importance[0][0]} (impact: {feature_importance[0][1]:.3f})",
    }


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, log_level="debug")
