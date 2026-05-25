"""
Advanced Analytics: predictions and model performance endpoints.
"""

from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.api.deps import get_current_user
from app.core.database import get_db
from app.middleware.tenant import get_current_tenant_id as get_tenant_id
from app.models.user import User
from app.models.advanced_analytics import PredictiveModel, PerformanceForecast
from app.schemas.advanced_analytics import (
    PredictionRequest,
    PredictionResponse,
    PerformanceForecastResponse,
)
from app.services.advanced_analytics_service import advanced_analytics_service

from .advanced_analytics_common import log_action

router = APIRouter()


@router.post("/predictions/generate", response_model=PredictionResponse)
async def generate_predictions(
    request: PredictionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: UUID = Depends(get_tenant_id),
):
    """Generate predictions using ML models."""
    try:
        predictions = await advanced_analytics_service.generate_predictions(
            request.metric_type,
            request.prediction_horizon,
            request.confidence_threshold,
        )
        pred_list = predictions.get("predictions", [])
        conf_vals = [p["confidence"] for p in pred_list]
        confidence_distribution = {
            "high": len([c for c in conf_vals if c >= 0.8]),
            "medium": len([c for c in conf_vals if 0.6 <= c < 0.8]),
            "low": len([c for c in conf_vals if c < 0.6]),
        }
        prediction_accuracy = predictions.get("model_performance", {}).get("r2")
        await log_action(
            user_id=str(current_user.id),
            tenant_id=str(tenant_id),
            action="generate_predictions",
            details={
                "metric_type": request.metric_type.value,
                "prediction_horizon": request.prediction_horizon,
                "confidence_threshold": request.confidence_threshold,
                "predictions_count": len(pred_list),
                "model_performance": predictions.get("model_performance", {}),
            },
        )
        return PredictionResponse(
            metric_type=request.metric_type,
            prediction_horizon=request.prediction_horizon,
            model_performance=predictions.get("model_performance", {}),
            predictions=pred_list,
            confidence_distribution=confidence_distribution,
            prediction_accuracy=prediction_accuracy,
            generated_at=datetime.now(timezone.utc),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate predictions: {str(e)}",
        )


@router.get("/predictions", response_model=List[PerformanceForecastResponse])
async def list_predictions(
    metric_type: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    resource_id: Optional[UUID] = Query(None),
    confidence_min: Optional[float] = Query(0.0, ge=0, le=1),
    status: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: UUID = Depends(get_tenant_id),
):
    """List performance forecasts."""
    try:
        query = db.query(PerformanceForecast).filter(PerformanceForecast.tenant_id == tenant_id)
        if metric_type:
            query = query.filter(PerformanceForecast.metric_type == metric_type)
        if start_date:
            query = query.filter(PerformanceForecast.timestamp >= start_date)
        if end_date:
            query = query.filter(PerformanceForecast.timestamp <= end_date)
        if resource_id:
            query = query.filter(PerformanceForecast.resource_id == resource_id)
        if confidence_min is not None:
            query = query.filter(PerformanceForecast.confidence >= confidence_min)
        if status:
            query = query.filter(PerformanceForecast.status == status)
        forecasts = query.order_by(PerformanceForecast.timestamp.asc()).offset(skip).limit(limit).all()
        return forecasts
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list predictions: {str(e)}",
        )


@router.get("/predictions/models/{metric_type}")
async def get_model_performance(
    metric_type: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: UUID = Depends(get_tenant_id),
):
    """Get predictive model performance for a metric type."""
    try:
        models = (
            db.query(PredictiveModel)
            .filter(
                and_(
                    PredictiveModel.tenant_id == tenant_id,
                    PredictiveModel.status == "active",
                )
            )
            .all()
        )
        by_metric = [
            m for m in models
            if (getattr(m, "model_category", None) or "").lower() == metric_type.lower()
        ]
        if not by_metric:
            by_metric = models
        result = []
        for m in by_metric[:20]:
            result.append({
                "model_id": str(m.id),
                "model_name": m.model_name,
                "model_type": m.model_type,
                "metric_type": getattr(m, "model_category", metric_type),
                "r2_score": m.r2_score,
                "mae": m.mae,
                "rmse": m.rmse,
                "status": m.status,
                "last_trained": m.last_trained.isoformat() if m.last_trained else None,
            })
        return {"metric_type": metric_type, "models": result}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get model performance: {str(e)}",
        )
