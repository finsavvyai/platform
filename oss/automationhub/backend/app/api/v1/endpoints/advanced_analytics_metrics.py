"""
Advanced Analytics: metrics collection and listing endpoints.
"""

from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.api.deps import get_current_user
from app.core.database import get_db
from app.middleware.tenant import get_current_tenant_id as get_tenant_id
from app.models.user import User
from app.models.advanced_analytics import AnalyticsMetric
from app.schemas.advanced_analytics import (
    MetricsCollectionRequest,
    MetricsCollectionResponse,
    AnalyticsMetricCreate,
    AnalyticsMetricResponse,
)
from app.services.advanced_analytics_service import advanced_analytics_service

from .advanced_analytics_common import log_action

router = APIRouter()


@router.post("/metrics/collect", response_model=MetricsCollectionResponse)
async def collect_metrics(
    request: MetricsCollectionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: UUID = Depends(get_tenant_id),
):
    """Collect metrics from multiple sources."""
    try:
        metrics_data = await advanced_analytics_service.collect_metrics(
            request.metric_type,
            request.time_range,
            request.providers,
            request.resources,
        )
        metrics_count = 0
        t0 = datetime.now(timezone.utc)
        is_cost = request.metric_type.value == "cost"
        for data_source in metrics_data.get("data_sources", []):
            if "aggregated_metrics" not in data_source:
                continue
            agg = data_source["aggregated_metrics"]
            val = agg.get("total_monthly_cost", 0) if is_cost else agg.get("overall_health_percentage", 0)
            metric = AnalyticsMetric(
                tenant_id=tenant_id,
                metric_name=f"{request.metric_type}_aggregated",
                metric_type=request.metric_type,
                value=val,
                timestamp=metrics_data["end_time"],
                collected_at=t0,
                avg_value=val,
                min_value=0,
                max_value=agg.get("total_monthly_cost", 100) if is_cost else 100,
                count_samples=agg.get("total_resources", 0),
                extra_metadata={
                    "metric_type": request.metric_type.value,
                    "time_range": request.time_range,
                    "aggregation": getattr(request, "aggregation", None),
                },
            )
            db.add(metric)
            metrics_count += 1
        db.commit()
        duration = (datetime.now(timezone.utc) - t0).total_seconds()
        await log_action(
            user_id=str(current_user.id),
            tenant_id=str(tenant_id),
            action="collect_analytics_metrics",
            details={
                "metric_type": request.metric_type.value,
                "time_range": request.time_range,
                "metrics_count": metrics_count,
                "collection_duration": duration,
            },
        )
        return MetricsCollectionResponse(
            metric_type=request.metric_type,
            time_range=request.time_range,
            start_time=metrics_data["start_time"],
            end_time=metrics_data["end_time"],
            data_sources=metrics_data["data_sources"],
            aggregated_metrics=metrics_data.get("aggregated_metrics", {}),
            total_metrics_collected=metrics_count,
            collection_duration=duration,
            generated_at=datetime.now(timezone.utc),
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to collect metrics: {str(e)}",
        )


@router.get("/metrics", response_model=List[AnalyticsMetricResponse])
async def list_metrics(
    metric_type: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    provider_id: Optional[UUID] = Query(None),
    resource_id: Optional[UUID] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: UUID = Depends(get_tenant_id),
):
    """List collected analytics metrics."""
    try:
        query = db.query(AnalyticsMetric).filter(AnalyticsMetric.tenant_id == tenant_id)
        if metric_type:
            query = query.filter(AnalyticsMetric.metric_type == metric_type)
        if start_date:
            query = query.filter(AnalyticsMetric.timestamp >= start_date)
        if end_date:
            query = query.filter(AnalyticsMetric.timestamp <= end_date)
        if provider_id:
            query = query.filter(AnalyticsMetric.provider_id == provider_id)
        if resource_id:
            query = query.filter(AnalyticsMetric.resource_id == resource_id)
        metrics = query.order_by(AnalyticsMetric.timestamp.desc()).offset(skip).limit(limit).all()
        return metrics
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to list metrics: {str(e)}")


@router.get("/metrics/summary")
async def get_metrics_summary(
    metric_type: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: UUID = Depends(get_tenant_id),
):
    """Get metrics summary (counts and aggregates by type)."""
    try:
        query = db.query(AnalyticsMetric).filter(AnalyticsMetric.tenant_id == tenant_id)
        if metric_type:
            query = query.filter(AnalyticsMetric.metric_type == metric_type)
        if start_date:
            query = query.filter(AnalyticsMetric.timestamp >= start_date)
        if end_date:
            query = query.filter(AnalyticsMetric.timestamp <= end_date)
        total = query.count()
        by_type_q = (
            db.query(AnalyticsMetric.metric_type, func.count(AnalyticsMetric.id).label("count"))
            .filter(AnalyticsMetric.tenant_id == tenant_id)
            .group_by(AnalyticsMetric.metric_type)
        )
        if metric_type:
            by_type_q = by_type_q.filter(AnalyticsMetric.metric_type == metric_type)
        if start_date:
            by_type_q = by_type_q.filter(AnalyticsMetric.timestamp >= start_date)
        if end_date:
            by_type_q = by_type_q.filter(AnalyticsMetric.timestamp <= end_date)
        by_type = {row.metric_type: row.count for row in by_type_q.all()}
        return {"total_metrics": total, "by_metric_type": by_type}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to get metrics summary: {str(e)}")


@router.post("/metrics", response_model=AnalyticsMetricResponse, status_code=status.HTTP_201_CREATED)
async def create_metric(
    metric_data: AnalyticsMetricCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: UUID = Depends(get_tenant_id),
):
    """Create a new analytics metric entry."""
    try:
        data = metric_data.model_dump() if hasattr(metric_data, "model_dump") else metric_data.dict()
        if "metadata" in data:
            data["extra_metadata"] = data.pop("metadata", {})
        metric = AnalyticsMetric(tenant_id=tenant_id, created_by=current_user.id, **data)
        db.add(metric)
        db.commit()
        db.refresh(metric)
        await log_action(
            user_id=str(current_user.id),
            tenant_id=str(tenant_id),
            action="create_analytics_metric",
            resource_id=str(metric.id),
            resource_type="analytics_metric",
            details={"metric_name": metric.metric_name, "metric_type": getattr(metric.metric_type, "value", metric.metric_type)},
        )
        return metric
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to create metric: {str(e)}")
