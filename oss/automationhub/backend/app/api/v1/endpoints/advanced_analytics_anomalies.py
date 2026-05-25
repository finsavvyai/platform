"""
Advanced Analytics: anomaly detection and lifecycle endpoints.
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
from app.models.advanced_analytics import AnomalyDetection
from app.schemas.advanced_analytics import (
    AnomalyDetectionRequest,
    AnomalyDetectionResponse,
    AnomalyDetectionListItemResponse,
)
from app.services.advanced_analytics_service import advanced_analytics_service

from .advanced_analytics_common import log_action
from .advanced_analytics_helpers import generate_anomaly_recommendations

router = APIRouter()


@router.post("/anomalies/detect", response_model=AnomalyDetectionResponse)
async def detect_anomalies(
    request: AnomalyDetectionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: UUID = Depends(get_tenant_id),
):
    """Detect anomalies in metrics data."""
    try:
        metrics_data = await advanced_analytics_service.collect_metrics(
            request.metric_type,
            request.time_range,
            request.providers,
            request.resources,
        )
        anomalies = await advanced_analytics_service.detect_anomalies(
            metrics_data,
            request.sensitivity,
            request.analysis_window,
        )
        anomaly_count_by_severity: dict = {}
        anomaly_count_by_type: dict = {}
        for a in anomalies:
            sev = a["severity"]
            typ = a.get("metric_type", "unknown")
            anomaly_count_by_severity[sev] = anomaly_count_by_severity.get(sev, 0) + 1
            anomaly_count_by_type[typ] = anomaly_count_by_type.get(typ, 0) + 1
        conf_vals = [a["confidence"] for a in anomalies]
        avg_confidence = sum(conf_vals) / len(conf_vals) if conf_vals else 0.0
        recommendations = await generate_anomaly_recommendations(anomalies)
        await log_action(
            user_id=str(current_user.id),
            tenant_id=str(tenant_id),
            action="detect_anomalies",
            details={
                "metric_type": request.metric_type.value,
                "time_range": request.time_range,
                "anomalies_detected": len(anomalies),
                "sensitivity": request.sensitivity,
            },
        )
        return AnomalyDetectionResponse(
            anomalies_detected=len(anomalies),
            anomaly_count_by_severity=anomaly_count_by_severity,
            anomaly_count_by_type=anomaly_count_by_type,
            detection_confidence=avg_confidence,
            analysis_duration=0.0,
            anomalies=anomalies,
            recommendations=recommendations,
            generated_at=datetime.now(timezone.utc),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to detect anomalies: {str(e)}",
        )


@router.get("/anomalies", response_model=List[AnomalyDetectionListItemResponse])
async def list_anomalies(
    metric_type: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
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
    """List detected anomalies."""
    try:
        query = db.query(AnomalyDetection).filter(AnomalyDetection.tenant_id == tenant_id)
        if metric_type:
            query = query.filter(AnomalyDetection.metric_type == metric_type)
        if severity:
            query = query.filter(AnomalyDetection.severity == severity)
        if status:
            query = query.filter(AnomalyDetection.status == status)
        if start_date:
            query = query.filter(AnomalyDetection.timestamp >= start_date)
        if end_date:
            query = query.filter(AnomalyDetection.timestamp <= end_date)
        if provider_id:
            query = query.filter(AnomalyDetection.provider_id == provider_id)
        if resource_id:
            query = query.filter(AnomalyDetection.resource_id == resource_id)
        items = query.order_by(AnomalyDetection.timestamp.desc()).offset(skip).limit(limit).all()
        return items
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list anomalies: {str(e)}",
        )


@router.post("/anomalies/{anomaly_id}/acknowledge")
async def acknowledge_anomaly(
    anomaly_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: UUID = Depends(get_tenant_id),
):
    """Mark an anomaly as acknowledged (under investigation)."""
    anomaly = db.query(AnomalyDetection).filter(
        and_(
            AnomalyDetection.id == anomaly_id,
            AnomalyDetection.tenant_id == tenant_id,
        )
    ).first()
    if not anomaly:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Anomaly not found")
    anomaly.status = "investigating"
    db.commit()
    db.refresh(anomaly)
    await log_action(
        user_id=str(current_user.id),
        tenant_id=str(tenant_id),
        action="acknowledge_anomaly",
        resource_id=str(anomaly_id),
        resource_type="anomaly_detection",
    )
    return {"id": str(anomaly.id), "status": anomaly.status}


@router.post("/anomalies/{anomaly_id}/resolve")
async def resolve_anomaly(
    anomaly_id: UUID,
    resolution_notes: Optional[str] = Query(None),
    resolution_method: Optional[str] = Query("manual"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: UUID = Depends(get_tenant_id),
):
    """Mark an anomaly as resolved."""
    anomaly = db.query(AnomalyDetection).filter(
        and_(
            AnomalyDetection.id == anomaly_id,
            AnomalyDetection.tenant_id == tenant_id,
        )
    ).first()
    if not anomaly:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Anomaly not found")
    anomaly.status = "resolved"
    anomaly.resolved_at = datetime.now(timezone.utc)
    if resolution_notes is not None:
        anomaly.resolution_notes = resolution_notes
    if resolution_method is not None:
        anomaly.resolution_method = resolution_method
    db.commit()
    db.refresh(anomaly)
    await log_action(
        user_id=str(current_user.id),
        tenant_id=str(tenant_id),
        action="resolve_anomaly",
        resource_id=str(anomaly_id),
        resource_type="anomaly_detection",
        details={"resolution_method": resolution_method},
    )
    return {"id": str(anomaly.id), "status": anomaly.status}
