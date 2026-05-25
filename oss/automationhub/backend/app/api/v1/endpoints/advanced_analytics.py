"""
Advanced Analytics & Intelligence API Endpoints
REST API for AI-powered analytics, anomalies, predictions, and intelligence reports
"""

import asyncio
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func

from app.api.v1.deps import get_current_user, get_db_session, get_tenant_id
from app.database import get_db
from app.models.user import User
from app.models.advanced_analytics import (
    AnalyticsMetric, AnomalyDetection, PredictiveModel,
    PerformanceForecast, IntelligenceReport, InsightPattern,
    AnomalyAlert
)
from app.schemas.advanced_analytics import (
    MetricsCollectionRequest, MetricsCollectionResponse,
    AnomalyDetectionRequest, AnomalyDetectionResponse,
    PredictionRequest, PredictionResponse,
    IntelligenceReportRequest, IntelligenceReportResponse,
    AnalyticsMetricCreate, AnalyticsMetricResponse,
    PredictiveModelCreate, PredictiveModelResponse,
    IntelligenceReportCreate, IntelligenceReportResponse,
    AnalyticsDashboardData, AnomalySummary, PredictionAccuracyData
)
from app.services.advanced_analytics_service import advanced_analytics_service
from app.core.permissions import require_permission
from app.core.exceptions import ValidationError, NotFoundError
from app.utils.audit import log_action

router = APIRouter()


# Metrics Collection Endpoints
@router.post("/metrics/collect", response_model=MetricsCollectionResponse)
async def collect_metrics(
    request: MetricsCollectionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: UUID = Depends(get_tenant_id)
):
    """Collect metrics from multiple sources"""
    try:
        # Collect metrics data
        metrics_data = await advanced_analytics_service.collect_metrics(
            request.metric_type,
            request.time_range,
            request.providers,
            request.resources
        )

        # Store metrics in database
        metrics_count = 0
        collection_start = datetime.now(timezone.utc)

        for data_source in metrics_data.get("data_sources", []):
            if "aggregated_metrics" in data_source:
                agg_metrics = data_source["aggregated_metrics"]

                # Create aggregated metric record
                metric = AnalyticsMetric(
                    tenant_id=tenant_id,
                    metric_name=f"{request.metric_type}_aggregated",
                    metric_type=request.metric_type,
                    value=agg_metrics.get("total_monthly_cost", 0) if request.metric_type.value == "cost" else agg_metrics.get("overall_health_percentage", 0),
                    timestamp=metrics_data["end_time"],
                    collected_at=collection_start,
                    avg_value=agg_metrics.get("total_monthly_cost", 0) if request.metric_type.value == "cost" else agg_metrics.get("overall_health_percentage", 0),
                    min_value=0,
                    max_value=agg_metrics.get("total_monthly_cost", 0) if request.metric_type.value == "cost" else 100,
                    count_samples=agg_metrics.get("total_resources", 0),
                    metadata={
                        "metric_type": request.metric_type.value,
                        "time_range": request.time_range,
                        "aggregation": request.aggregation
                    }
                )
                db.add(metric)
                metrics_count += 1

        db.commit()

        collection_duration = (datetime.now(timezone.utc) - collection_start).total_seconds()

        # Log action
        await log_action(
            user_id=str(current_user.id),
            tenant_id=str(tenant_id),
            action="collect_analytics_metrics",
            details={
                "metric_type": request.metric_type.value,
                "time_range": request.time_range,
                "metrics_count": metrics_count,
                "collection_duration": collection_duration
            }
        )

        return MetricsCollectionResponse(
            metric_type=request.metric_type,
            time_range=request.time_range,
            start_time=metrics_data["start_time"],
            end_time=metrics_data["end_time"],
            data_sources=metrics_data["data_sources"],
            aggregated_metrics=metrics_data.get("aggregated_metrics", {}),
            total_metrics_collected=metrics_count,
            collection_duration=collection_duration,
            generated_at=datetime.now(timezone.utc)
        )

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to collect metrics: {str(e)}"
        )


@router.get("/metrics", response_model=List[AnalyticsMetricResponse])
async def list_metrics(
    metric_type: Optional[str] = Query(None, description="Filter by metric type"),
    start_date: Optional[datetime] = Query(None, description="Filter by start date"),
    end_date: Optional[datetime] = Query(None, description="Filter by end date"),
    provider_id: Optional[UUID] = Query(None, description="Filter by provider"),
    resource_id: Optional[UUID] = Query(None, description="Filter by resource"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of records"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: UUID = Depends(get_tenant_id)
):
    """List collected analytics metrics"""
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
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list metrics: {str(e)}"
        )


@router.post("/metrics", response_model=AnalyticsMetricResponse, status_code=status.HTTP_201_CREATED)
async def create_metric(
    metric_data: AnalyticsMetricCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: UUID = Depends(get_tenant_id)
):
    """Create a new analytics metric entry"""
    try:
        metric = AnalyticsMetric(
            tenant_id=tenant_id,
            created_by=current_user.id,
            **metric_data.dict()
        )

        db.add(metric)
        db.commit()
        db.refresh(metric)

        # Log action
        await log_action(
            user_id=str(current_user.id),
            tenant_id=str(tenant_id),
            action="create_analytics_metric",
            resource_id=str(metric.id),
            resource_type="analytics_metric",
            details={"metric_name": metric.metric_name, "metric_type": metric.metric_type.value}
        )

        return metric

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create metric: {str(e)}"
        )


# Anomaly Detection Endpoints
@router.post("/anomalies/detect", response_model=AnomalyDetectionResponse)
async def detect_anomalies(
    request: AnomalyDetectionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: UUID = Depends(get_tenant_id)
):
    """Detect anomalies in metrics data"""
    try:
        # Collect metrics data for analysis
        metrics_data = await advanced_analytics_service.collect_metrics(
            request.metric_type,
            request.time_range,
            request.providers,
            request.resources
        )

        # Detect anomalies
        anomalies = await advanced_analytics_service.detect_anomalies(
            metrics_data,
            request.sensitivity,
            request.analysis_window
        )

        # Analyze anomaly distribution
        anomaly_count_by_severity = {}
        anomaly_count_by_type = {}
        for anomaly in anomalies:
            severity = anomaly["severity"]
            anomaly_type = anomaly.get("metric_type", "unknown")

            anomaly_count_by_severity[severity] = anomaly_count_by_severity.get(severity, 0) + 1
            anomaly_count_by_type[anomaly_type] = anomaly_count_by_type.get(anomaly_type, 0) + 1

        # Calculate detection confidence
        confidence_values = [a["confidence"] for a in anomalies]
        avg_confidence = sum(confidence_values) / len(confidence_values) if confidence_values else 0

        # Generate recommendations based on anomalies
        recommendations = await _generate_anomaly_recommendations(anomalies)

        # Log action
        await log_action(
            user_id=str(current_user.id),
            tenant_id=str(tenant_id),
            action="detect_anomalies",
            details={
                "metric_type": request.metric_type.value,
                "time_range": request.time_range,
                "anomalies_detected": len(anomalies),
                "sensitivity": request.sensitivity
            }
        )

        return AnomalyDetectionResponse(
            anomalies_detected=len(anomalies),
            anomaly_count_by_severity=anomaly_count_by_severity,
            anomaly_count_by_type=anomaly_count_by_type,
            detection_confidence=avg_confidence,
            anomalies=anomalies,
            recommendations=recommendations,
            generated_at=datetime.now(timezone.utc)
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to detect anomalies: {str(e)}"
        )


@router.get("/anomalies", response_model=List[AnomalyDetectionResponse])
async def list_anomalies(
    metric_type: Optional[str] = Query(None, description="Filter by metric type"),
    severity: Optional[str] = Query(None, description="Filter by severity"),
    status: Optional[str] = Query(None, description="Filter by status"),
    start_date: Optional[datetime] = Query(None, description="Filter by start date"),
    end_date: Optional[datetime] = Query(None, description="Filter by end date"),
    provider_id: Optional[UUID] = Query(None, description="Filter by provider"),
    resource_id: Optional[UUID] = Query(None, description="Filter by resource"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of records"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: UUID = Depends(get_tenant_id)
):
    """List detected anomalies"""
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

        anomalies = query.order_by(AnomalyDetection.timestamp.desc()).offset(skip).limit(limit).all()
        return anomalies

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list anomalies: {str(e)}"
        )


# Prediction Endpoints
@router.post("/predictions/generate", response_model=PredictionResponse)
async def generate_predictions(
    request: PredictionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: UUID = Depends(get_tenant_id)
):
    """Generate predictions using ML models"""
    try:
        # Generate predictions
        predictions = await advanced_analytics_service.generate_predictions(
            request.metric_type,
            request.prediction_horizon,
            request.confidence_threshold
        )

        # Analyze prediction confidence distribution
        confidence_values = [p["confidence"] for p in predictions.get("predictions", [])]
        confidence_distribution = {
            "high": len([c for c in confidence_values if c >= 0.8]),
            "medium": len([c for c in confidence_values if 0.6 <= c < 0.8]),
            "low": len([c for c in confidence_values if c < 0.6])
        }

        # Calculate prediction accuracy if available
        prediction_accuracy = predictions.get("model_performance", {}).get("r2", None)

        # Log action
        await log_action(
            user_id=str(current_user.id),
            tenant_id=str(tenant_id),
            action="generate_predictions",
            details={
                "metric_type": request.metric_type.value,
                "prediction_horizon": request.prediction_horizon,
                "confidence_threshold": request.confidence_threshold,
                "predictions_count": len(predictions.get("predictions", [])),
                "model_performance": predictions.get("model_performance", {})
            }
        )

        return PredictionResponse(
            metric_type=request.metric_type,
            prediction_horizon=request.prediction_horizon,
            model_performance=predictions.get("model_performance", {}),
            predictions=predictions.get("predictions", []),
            confidence_distribution=confidence_distribution,
            prediction_accuracy=prediction_accuracy,
            generated_at=datetime.now(timezone.utc)
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate predictions: {str(e)}"
        )


@router.get("/predictions", response_model=List[PerformanceForecastResponse])
async def list_predictions(
    metric_type: Optional[str] = Query(None, description="Filter by metric type"),
    start_date: Optional[datetime] = Query(None, description="Filter by start date"),
    end_date: Optional[datetime] = Query(None, description="Filter by end date"),
    resource_id: Optional[UUID] = Query(None, description="Filter by resource"),
    confidence_min: Optional[float] = Query(0.0, ge=0, le=1, description="Minimum confidence"),
    status: Optional[str] = Query(None, description="Filter by status"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of records"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: UUID = Depends(get_tenant_id)
):
    """List performance forecasts"""
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
        if confidence_min:
            query = query.filter(PerformanceForecast.confidence >= confidence_min)
        if status:
            query = query.filter(PerformanceForecast.status == status)

        forecasts = query.order_by(PerformanceForecast.timestamp.asc()).offset(skip).limit(limit).all()
        return forecasts

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list predictions: {str(e)}"
        )


# Intelligence Report Endpoints
@router.post("/reports/generate", response_model=IntelligenceReportResponse)
async def generate_intelligence_report(
    request: IntelligenceReportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: UUID = Depends(get_tenant_id)
):
    """Generate comprehensive intelligence report"""
    try:
        # Generate intelligence report
        report_data = await advanced_analytics_service.generate_intelligence_report(
            request.report_type,
            request.time_range,
            request.include_recommendations
        )

        # Store report in database
        report = IntelligenceReport(
            id=UUID(report_data["id"]),
            tenant_id=tenant_id,
            report_name=f"{request.report_type.value.replace('_', ' ').title()} - {datetime.now().strftime('%Y-%m-%d')}",
            report_type=request.report_type,
            time_range=request.time_range,
            data_sources=report_data.get("detailed_analysis", {}).get("metrics_data", {}).get("data_sources", []),
            filters=request.custom_filters or {},
            analysis_types=request.analysis_types,
            executive_summary=report_data["executive_summary"],
            key_insights=report_data["key_insights"],
            recommendations=report_data["recommendations"],
            detailed_analysis=report_data["detailed_analysis"],
            charts=report_data["charts"],
            created_by=current_user.id,
            generated_at=report_data["generated_at"]
        )

        db.add(report)
        db.commit()
        db.refresh(report)

        # Generate download URL
        download_url = f"/api/v1/analytics/reports/{report.id}/download"

        # Log action
        await log_action(
            user_id=str(current_user.id),
            tenant_id=str(tenant_id),
            action="generate_intelligence_report",
            resource_id=str(report.id),
            resource_type="intelligence_report",
            details={
                "report_type": request.report_type.value,
                "time_range": request.time_range,
                "insights_count": len(report_data["key_insights"]),
                "recommendations_count": len(report_data["recommendations"])
            }
        )

        return IntelligenceReportResponse(
            id=report.id,
            report_name=report.report_name,
            report_type=report.report_type,
            time_range=report.time_range,
            executive_summary=report.executive_summary,
            key_insights_count=len(report.key_insights),
            recommendations_count=len(report.recommendations),
            overall_score=report.executive_summary.get("overall_score"),
            risk_assessment=report.risk_assessment,
            charts=report.charts,
            download_url=download_url,
            generated_at=report.generated_at
        )

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate intelligence report: {str(e)}"
        )


@router.get("/reports", response_model=List[IntelligenceReportResponse])
async def list_intelligence_reports(
    report_type: Optional[str] = Query(None, description="Filter by report type"),
    status: Optional[str] = Query(None, description="Filter by status"),
    priority: Optional[str] = Query(None, description="Filter by priority"),
    start_date: Optional[datetime] = Query(None, description="Filter by generation start date"),
    end_date: Optional[datetime] = Query(None, description="Filter by generation end date"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of records"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: UUID = Depends(get_tenant_id)
):
    """List intelligence reports"""
    try:
        query = db.query(IntelligenceReport).filter(IntelligenceReport.tenant_id == tenant_id)

        if report_type:
            query = query.filter(IntelligenceReport.report_type == report_type)
        if status:
            query = query.filter(IntelligenceReport.status == status)
        if priority:
            query = query.filter(IntelligenceReport.priority == priority)
        if start_date:
            query = query.filter(IntelligenceReport.generated_at >= start_date)
        if end_date:
            query = query.filter(IntelligenceReport.generated_at <= end_date)

        reports = query.order_by(IntelligenceReport.generated_at.desc()).offset(skip).limit(limit).all()
        return reports

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list intelligence reports: {str(e)}"
        )


@router.get("/reports/{report_id}/download")
async def download_report(
    report_id: UUID,
    format: str = Query("json", description="Download format: json, pdf, csv"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: UUID = Depends(get_tenant_id)
):
    """Download intelligence report in various formats"""
    try:
        # Get report
        report = db.query(IntelligenceReport).filter(
            and_(
                IntelligenceReport.id == report_id,
                IntelligenceReport.tenant_id == tenant_id
            )
        ).first()

        if not report:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Report not found"
            )

        # Increment download count
        report.download_count += 1
        report.last_downloaded = datetime.now(timezone.utc)
        db.commit()

        # Generate downloadable content based on format
        if format == "json":
            content = {
                "report_id": str(report.id),
                "report_name": report.report_name,
                "report_type": report.report_type,
                "time_range": report.time_range,
                "generated_at": report.generated_at.isoformat(),
                "executive_summary": report.executive_summary,
                "key_insights": report.key_insights,
                "recommendations": report.recommendations,
                "detailed_analysis": report.detailed_analysis,
                "charts": report.charts
            }

            filename = f"{report.report_name}.json"
            media_type = "application/json"

        elif format == "csv":
            # Generate CSV content
            content = _generate_csv_report(report)
            filename = f"{report.report_name}.csv"
            media_type = "text/csv"

        elif format == "pdf":
            # Generate PDF content (would use a PDF library in production)
            content = _generate_pdf_report(report)
            filename = f"{report.report_name}.pdf"
            media_type = "application/pdf"

        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unsupported format. Use json, csv, or pdf."
            )

        # Log download
        await log_action(
            user_id=str(current_user.id),
            tenant_id=str(tenant_id),
            action="download_intelligence_report",
            resource_id=str(report_id),
            resource_type="intelligence_report",
            details={"format": format, "filename": filename}
        )

        return StreamingResponse(
            iter([content]),
            media_type=media_type,
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to download report: {str(e)}"
        )


# Dashboard Data Endpoint
@router.get("/dashboard", response_model=AnalyticsDashboardData)
async def get_analytics_dashboard(
    time_range: str = Query("24h", max_length=20),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: UUID = Depends(get_tenant_id)
):
    """Get analytics dashboard data"""
    try:
        # Get overview metrics
        total_metrics = db.query(AnalyticsMetric).filter(
            AnalyticsMetric.tenant_id == tenant_id
        ).count()

        # Get anomaly summary
        anomaly_summary_query = db.query(
            AnomalyDetection.status,
            func.count(AnomalyDetection.id).label("count")
        ).filter(
            AnomalyDetection.tenant_id == tenant_id
        ).group_by(AnomalyDetection.status)

        anomaly_summary = {
            status: count for status, count in anomaly_summary.all()
        }

        # Get recent anomalies
        recent_anomalies = db.query(AnomalyDetection).filter(
            AnomalyDetection.tenant_id == tenant_id
        ).order_by(AnomalyDetection.detected_at.desc()).limit(10).all()

        # Get recent predictions
        recent_predictions = db.query(PerformanceForecast).filter(
            PerformanceForecast.tenant_id == tenant_id,
            PerformanceForecast.timestamp >= datetime.now(timezone.utc) - timedelta(hours=24)
        ).order_by(PerformanceForecast.timestamp.desc()).limit(10).all()

        # Calculate health indicators
        health_metrics = db.query(AnalyticsMetric).filter(
            and_(
                AnalyticsMetric.tenant_id == tenant_id,
                AnalyticsMetric.metric_type == "performance"
            ),
            AnalyticsMetric.timestamp >= datetime.now(timezone.utc) - timedelta(hours=24)
        ).all()

        avg_health = sum(m.value for m in health_metrics) / len(health_metrics) if health_metrics else 0

        # Get cost analysis (simplified)
        cost_metrics = db.query(AnalyticsMetric).filter(
            and_(
                AnalyticsMetric.tenant_id == tenant_id,
                AnalyticsMetric.metric_type == "cost"
            ),
            AnalyticsMetric.timestamp >= datetime.now(timezone.utc) - timedelta(days=30)
        ).all()

        total_cost = sum(m.value for m in cost_metrics)

        dashboard_data = AnalyticsDashboardData(
            overview={
                "total_metrics": total_metrics,
                "active_alerts": anomaly_summary.get("active", 0),
                "health_score": avg_health,
                "cost_trend": "stable"  # Would calculate actual trend
            },
            metrics_summary={
                "performance_metrics": len([m for m in health_metrics if m.metric_type == "performance"]),
                "cost_metrics": len(cost_metrics),
                "security_metrics": 0,  # Would query security metrics
                "user_behavior_metrics": 0
            },
            anomaly_summary=AnomalySummary(
                total_anomalies=sum(anomaly_summary.values()),
                active_anomalies=anomaly_summary.get("active", 0),
                resolved_anomalies=anomaly_summary.get("resolved", 0),
                critical_anomalies=0,  # Would filter by severity
                anomalies_by_severity={
                    "critical": 0,
                    "high": 0,
                    "medium": 0,
                    "low": 0
                },
                anomalies_by_type=anomaly_summary,
                recent_anomalies=[
                    {
                        "id": str(a.id),
                        "anomaly_type": a.anomaly_type,
                        "severity": a.severity,
                        "metric_name": a.metric_name,
                        "timestamp": a.detected_at,
                        "value": float(a.value),
                        "confidence": a.confidence
                    } for a in recent_anomalies
                ]
            ),
            prediction_summary={
                "total_predictions": len(recent_predictions),
                "average_confidence": sum(p.confidence for p in recent_predictions) / len(recent_predictions) if recent_predictions else 0,
                "accuracy_score": 0.85,  # Would calculate from actual vs predicted
                "recent_predictions": [
                    {
                        "id": str(p.id),
                        "metric_name": p.metric_name,
                        "timestamp": p.timestamp,
                        "predicted_value": float(p.predicted_value),
                        "confidence": p.confidence,
                        "status": p.status
                    } for p in recent_predictions
                ]
            },
            health_indicators={
                "overall_health": avg_health,
                "performance_health": avg_health,
                "security_health": 95.0,  # Would calculate from security metrics
                "availability_health": 99.9,  # Would calculate from uptime metrics
                "cost_efficiency": 85.0  # Would calculate from cost optimization
            },
            cost_analysis={
                "total_monthly_cost": total_cost,
                "cost_per_resource": total_cost / max(total_metrics, 1),
                "cost_trend": "increasing",  # Would calculate from historical data
                "optimization_opportunities": 3,  # Would count from cost anomalies
                "estimated_savings": 1250.50  # Would calculate from optimization suggestions
            },
            performance_trends={
                "cpu_utilization": 68.5,
                "memory_utilization": 72.3,
                "network_latency": 145.2,
                "response_time": 125.8,
                "throughput": 1250,
                "error_rate": 0.02
            },
            security_status={
                "threats_blocked": 45,
                "vulnerabilities": 12,
                "compliance_score": 92.5,
                "security_events": 23,
                "risk_level": "low"
            },
            updated_at=datetime.now(timezone.utc)
        )

        return dashboard_data

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get dashboard data: {str(e)}"
        )


# Helper functions
async def _generate_anomaly_recommendations(anomalies: List[Dict]) -> List[Dict]:
    """Generate recommendations based on detected anomalies"""
    recommendations = []

    # Count anomalies by severity
    severity_counts = {}
    for anomaly in anomalies:
        severity = anomaly.get("severity")
        severity_counts[severity] = severity_counts.get(severity, 0) + 1

    # Generate recommendations based on severity and type
    if severity_counts.get("critical", 0) > 0:
        recommendations.append({
            "type": "urgent_action",
            "priority": "critical",
            "title": "Critical anomalies detected",
            "description": f"{severity_counts['critical']} critical anomalies require immediate attention",
            "actions": [
                "Review and resolve critical anomalies immediately",
                "Implement emergency response procedures",
                "Notify relevant stakeholders"
            ],
            "estimated_impact": "Prevent potential system failures or data breaches"
        })

    if severity_counts.get("high", 0) > 3:
        recommendations.append({
            "type": "investigation",
            "priority": "high",
            "title": "High severity anomalies require attention",
            "description": f"{severity_counts['high']} high severity anomalies detected",
            "actions": [
                "Investigate root causes of high severity anomalies",
                "Review system performance metrics",
                "Consider temporary mitigations"
            ],
            "estimated_impact": "Improve system stability and performance"
        })

    # Cost optimization recommendations
    cost_anomalies = [a for a in anomalies if a.get("metric_type") == "cost"]
    if cost_anomalies:
        recommendations.append({
            "type": "cost_optimization",
            "priority": "medium",
            "title": "Cost optimization opportunities identified",
            "description": f"{len(cost_anomalies)} cost-related anomalies detected",
            "actions": [
                "Review resource utilization and rightsizing",
                "Implement cost anomaly alerting",
                "Consider reserved instances for stable workloads"
            ],
            "estimated_impact": "Reduce monthly costs by 10-20%"
        })

    return recommendations


def _generate_csv_report(report: IntelligenceReport) -> str:
    """Generate CSV content for a report"""
    import io
    import csv

    output = io.StringIO()

    # Create CSV writer
    writer = csv.writer(output)

    # Write header
    writer.writerow(["Report Name", "Type", "Generated At", "Key Insights Count", "Recommendations Count"])

    # Write data rows
    writer.writerow([
        report.report_name,
        report.report_type,
        report.generated_at.isoformat() if report.generated_at else "",
        len(report.key_insights),
        len(report.recommendations)
    ])

    # Add insights section
    writer.writerow([])
    writer.writerow(["Key Insights"])
    writer.writerow(["#", "Type", "Title", "Description"])

    for i, insight in enumerate(report.key_insights, 1):
        writer.writerow([i, insight.get("type", "N/A"), insight.get("title", "N/A"), insight.get("description", "N/A")])

    # Add recommendations section
    writer.writerow([])
    writer.writerow(["Recommendations"])
    writer.writerow(["#", "Category", "Priority", "Title", "Description"])

    for i, recommendation in enumerate(report.recommendations, 1):
        writer.writerow([
            i,
            recommendation.get("category", "N/A"),
            recommendation.get("priority", "N/A"),
            recommendation.get("title", "N/A"),
            recommendation.get("description", "N/A")
        ])

    return output.getvalue()


def _generate_pdf_report(report: IntelligenceReport) -> bytes:
    """Generate PDF content for a report"""
    # This would use a PDF library like ReportLab in production
    # For now, return placeholder content
    content = f"""
    Intelligence Report: {report.report_name}

    Type: {report.report_type}
    Time Range: {report.time_range}
    Generated At: {report.generated_at}

    Executive Summary:
    {report.executive_summary}

    Key Insights: {len(report.key_insights)}
    Recommendations: {len(report.recommendations)}
    """

    return content.encode('utf-8')