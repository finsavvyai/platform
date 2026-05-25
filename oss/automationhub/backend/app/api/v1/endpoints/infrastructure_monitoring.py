"""
Infrastructure Monitoring API Endpoints
Real-time monitoring and auto-scaling for deployed infrastructure
"""

from typing import List, Optional
from uuid import UUID
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel, Field
import logging

from app.services.infrastructure_monitoring import (
    InfrastructureMonitoringService,
    MetricType,
    AlertSeverity,
    ScalingDirection,
    MonitoringStatus,
    AlertRule,
    ScalingPolicy,
    Alert,
    ScalingAction,
    MonitoringReport,
    infrastructure_monitoring_service
)
from app.core.auth import get_current_user
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter()


# Pydantic models for API
class MonitoringConfigModel(BaseModel):
    """API model for monitoring configuration"""
    metrics_interval: int = Field(default=60, description="Metrics collection interval in seconds")
    scaling_enabled: bool = Field(default=False, description="Enable auto-scaling")
    alert_rules: Optional[List[UUID]] = Field(None, description="Alert rule IDs to apply")
    custom_thresholds: Optional[dict] = Field(None, description="Custom metric thresholds")


class AlertRuleModel(BaseModel):
    """API model for alert rule"""
    name: str = Field(..., description="Alert rule name")
    deployment_id: Optional[UUID] = Field(None, description="Specific deployment ID (None for global)")
    metric_type: MetricType = Field(..., description="Metric type to monitor")
    threshold: float = Field(..., description="Alert threshold value")
    comparison: str = Field(default=">", description="Comparison operator (>, <, >=, <=, ==, !=)")
    duration: int = Field(default=300, description="Duration in seconds before triggering")
    severity: AlertSeverity = Field(default=AlertSeverity.MEDIUM, description="Alert severity")
    enabled: bool = Field(default=True, description="Whether rule is enabled")
    actions: List[str] = Field(default=[], description="Actions to execute on alert")

    class Config:
        json_encoders = {
            MetricType: lambda v: v.value,
            AlertSeverity: lambda v: v.value
        }


class ScalingPolicyModel(BaseModel):
    """API model for scaling policy"""
    name: str = Field(..., description="Scaling policy name")
    deployment_id: UUID = Field(..., description="Target deployment ID")
    min_instances: int = Field(default=1, description="Minimum number of instances")
    max_instances: int = Field(default=10, description="Maximum number of instances")
    target_cpu: float = Field(default=70.0, description="Target CPU utilization percentage")
    target_memory: float = Field(default=80.0, description="Target memory utilization percentage")
    scale_up_threshold: float = Field(default=80.0, description="Scale up threshold")
    scale_down_threshold: float = Field(default=30.0, description="Scale down threshold")
    scale_up_cooldown: int = Field(default=300, description="Scale up cooldown in seconds")
    scale_down_cooldown: int = Field(default=600, description="Scale down cooldown in seconds")
    enabled: bool = Field(default=True, description="Whether policy is enabled")


class MetricQueryModel(BaseModel):
    """API model for metric queries"""
    deployment_id: Optional[UUID] = Field(None, description="Deployment ID to filter by")
    metric_types: Optional[List[MetricType]] = Field(None, description="Metric types to include")
    start_time: Optional[datetime] = Field(None, description="Start time for query")
    end_time: Optional[datetime] = Field(None, description="End time for query")
    limit: int = Field(default=100, description="Maximum number of results")

    class Config:
        json_encoders = {
            MetricType: lambda v: v.value
        }


class AlertResponseModel(BaseModel):
    """API response model for alerts"""
    id: UUID
    rule_id: UUID
    deployment_id: UUID
    severity: AlertSeverity
    message: str
    metric_value: float
    threshold: float
    timestamp: datetime
    acknowledged: bool
    resolved: bool
    resolution_timestamp: Optional[datetime] = None


class MonitoringStatusResponse(BaseModel):
    """API response for monitoring status"""
    deployment_id: UUID
    status: str
    started_at: Optional[datetime]
    platform: str
    environment: str
    metrics_count: int
    active_alerts: int
    recent_scaling_actions: int
    config: dict


@router.get("/health")
async def health_check():
    """Health check for infrastructure monitoring service"""
    return await infrastructure_monitoring_service.health_check()


@router.post("/start/{deployment_id}")
async def start_monitoring(
    deployment_id: UUID,
    config: MonitoringConfigModel,
    current_user: User = Depends(get_current_user)
):
    """Start monitoring a deployment"""
    try:
        logger.info(f"User {current_user.email} starting monitoring for deployment {deployment_id}")

        result = await infrastructure_monitoring_service.start_monitoring(
            deployment_id=deployment_id,
            config=config.dict()
        )

        return {
            "success": True,
            "deployment_id": deployment_id,
            "message": "Monitoring started successfully",
            "config": result["config"]
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to start monitoring: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to start monitoring: {str(e)}")


@router.post("/stop/{deployment_id}")
async def stop_monitoring(
    deployment_id: UUID,
    current_user: User = Depends(get_current_user)
):
    """Stop monitoring a deployment"""
    try:
        logger.info(f"User {current_user.email} stopping monitoring for deployment {deployment_id}")

        result = await infrastructure_monitoring_service.stop_monitoring(deployment_id)

        return {
            "success": True,
            "deployment_id": deployment_id,
            "message": "Monitoring stopped successfully",
            "final_report": result.get("final_report")
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to stop monitoring: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to stop monitoring: {str(e)}")


@router.get("/status/{deployment_id}")
async def get_monitoring_status(
    deployment_id: UUID,
    current_user: User = Depends(get_current_user)
) -> MonitoringStatusResponse:
    """Get monitoring status for a deployment"""
    try:
        status = await infrastructure_monitoring_service.get_monitoring_status(deployment_id)

        if status.get("status") == "not_monitored":
            raise HTTPException(status_code=404, detail="No active monitoring session found")

        return MonitoringStatusResponse(
            deployment_id=UUID(status["deployment_id"]),
            status=status["status"],
            started_at=datetime.fromisoformat(status["started_at"]) if status.get("started_at") else None,
            platform=status["platform"],
            environment=status["environment"],
            metrics_count=status["metrics_count"],
            active_alerts=status["active_alerts"],
            recent_scaling_actions=status["recent_scaling_actions"],
            config=status["config"]
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get monitoring status: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get status: {str(e)}")


@router.get("/metrics")
async def get_metrics(
    query: MetricQueryModel = Depends(),
    current_user: User = Depends(get_current_user)
):
    """Get infrastructure metrics"""
    try:
        # Get metrics from the monitoring service buffer
        all_metrics = infrastructure_monitoring_service.metrics_buffer

        # Apply filters
        filtered_metrics = all_metrics

        if query.deployment_id:
            filtered_metrics = [m for m in filtered_metrics if m.deployment_id == query.deployment_id]

        if query.metric_types:
            filtered_metrics = [m for m in filtered_metrics if m.metric_type in query.metric_types]

        if query.start_time:
            filtered_metrics = [m for m in filtered_metrics if m.timestamp >= query.start_time]

        if query.end_time:
            filtered_metrics = [m for m in filtered_metrics if m.timestamp <= query.end_time]

        # Limit results
        filtered_metrics = filtered_metrics[-query.limit:]

        return {
            "metrics": [
                {
                    "deployment_id": str(m.deployment_id),
                    "metric_type": m.metric_type.value,
                    "value": m.value,
                    "unit": m.unit,
                    "timestamp": m.timestamp.isoformat(),
                    "tags": m.tags,
                    "source": m.source
                }
                for m in filtered_metrics
            ],
            "total_count": len(filtered_metrics),
            "query": query.dict()
        }

    except Exception as e:
        logger.error(f"Failed to get metrics: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get metrics: {str(e)}")


@router.get("/alerts")
async def get_alerts(
    deployment_id: Optional[UUID] = None,
    severity: Optional[AlertSeverity] = None,
    resolved: Optional[bool] = None,
    limit: int = 100,
    current_user: User = Depends(get_current_user)
) -> List[AlertResponseModel]:
    """Get infrastructure alerts"""
    try:
        all_alerts = list(infrastructure_monitoring_service.active_alerts.values())

        # Apply filters
        if deployment_id:
            all_alerts = [a for a in all_alerts if a.deployment_id == deployment_id]

        if severity:
            all_alerts = [a for a in all_alerts if a.severity == severity]

        if resolved is not None:
            all_alerts = [a for a in all_alerts if a.resolved == resolved]

        # Sort by timestamp (newest first) and limit
        all_alerts = sorted(all_alerts, key=lambda x: x.timestamp, reverse=True)[:limit]

        return [
            AlertResponseModel(
                id=alert.id,
                rule_id=alert.rule_id,
                deployment_id=alert.deployment_id,
                severity=alert.severity,
                message=alert.message,
                metric_value=alert.metric_value,
                threshold=alert.threshold,
                timestamp=alert.timestamp,
                acknowledged=alert.acknowledged,
                resolved=alert.resolved,
                resolution_timestamp=alert.resolution_timestamp
            )
            for alert in all_alerts
        ]

    except Exception as e:
        logger.error(f"Failed to get alerts: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get alerts: {str(e)}")


@router.post("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(
    alert_id: UUID,
    current_user: User = Depends(get_current_user)
):
    """Acknowledge an alert"""
    try:
        if alert_id not in infrastructure_monitoring_service.active_alerts:
            raise HTTPException(status_code=404, detail="Alert not found")

        alert = infrastructure_monitoring_service.active_alerts[alert_id]
        alert.acknowledged = True

        logger.info(f"User {current_user.email} acknowledged alert {alert_id}")

        return {
            "success": True,
            "alert_id": alert_id,
            "message": "Alert acknowledged successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to acknowledge alert: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to acknowledge alert: {str(e)}")


@router.post("/alerts/{alert_id}/resolve")
async def resolve_alert(
    alert_id: UUID,
    current_user: User = Depends(get_current_user)
):
    """Resolve an alert"""
    try:
        if alert_id not in infrastructure_monitoring_service.active_alerts:
            raise HTTPException(status_code=404, detail="Alert not found")

        alert = infrastructure_monitoring_service.active_alerts[alert_id]
        alert.resolved = True
        alert.resolution_timestamp = datetime.now()

        logger.info(f"User {current_user.email} resolved alert {alert_id}")

        return {
            "success": True,
            "alert_id": alert_id,
            "message": "Alert resolved successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to resolve alert: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to resolve alert: {str(e)}")


@router.post("/alert-rules")
async def create_alert_rule(
    rule: AlertRuleModel,
    current_user: User = Depends(get_current_user)
):
    """Create a new alert rule"""
    try:
        logger.info(f"User {current_user.email} creating alert rule: {rule.name}")

        alert_rule = AlertRule(
            name=rule.name,
            deployment_id=rule.deployment_id,
            metric_type=rule.metric_type,
            threshold=rule.threshold,
            comparison=rule.comparison,
            duration=rule.duration,
            severity=rule.severity,
            enabled=rule.enabled,
            actions=rule.actions
        )

        infrastructure_monitoring_service.alert_rules[alert_rule.id] = alert_rule

        return {
            "success": True,
            "rule_id": alert_rule.id,
            "message": "Alert rule created successfully"
        }

    except Exception as e:
        logger.error(f"Failed to create alert rule: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create alert rule: {str(e)}")


@router.get("/alert-rules")
async def get_alert_rules(
    deployment_id: Optional[UUID] = None,
    enabled: Optional[bool] = None,
    current_user: User = Depends(get_current_user)
):
    """Get alert rules"""
    try:
        rules = list(infrastructure_monitoring_service.alert_rules.values())

        # Apply filters
        if deployment_id:
            rules = [r for r in rules if r.deployment_id == deployment_id]

        if enabled is not None:
            rules = [r for r in rules if r.enabled == enabled]

        return {
            "rules": [
                {
                    "id": str(rule.id),
                    "name": rule.name,
                    "deployment_id": str(rule.deployment_id) if rule.deployment_id else None,
                    "metric_type": rule.metric_type.value,
                    "threshold": rule.threshold,
                    "comparison": rule.comparison,
                    "duration": rule.duration,
                    "severity": rule.severity.value,
                    "enabled": rule.enabled,
                    "actions": rule.actions
                }
                for rule in rules
            ],
            "total_count": len(rules)
        }

    except Exception as e:
        logger.error(f"Failed to get alert rules: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get alert rules: {str(e)}")


@router.post("/scaling-policies")
async def create_scaling_policy(
    policy: ScalingPolicyModel,
    current_user: User = Depends(get_current_user)
):
    """Create a new auto-scaling policy"""
    try:
        logger.info(f"User {current_user.email} creating scaling policy: {policy.name}")

        # Get deployment info
        from app.services.infrastructure_deployment import infrastructure_deployment_service
        deployment = await infrastructure_deployment_service.get_deployment_status(policy.deployment_id)
        if not deployment:
            raise HTTPException(status_code=404, detail="Deployment not found")

        scaling_policy = ScalingPolicy(
            name=policy.name,
            deployment_id=policy.deployment_id,
            platform=deployment.platform,
            min_instances=policy.min_instances,
            max_instances=policy.max_instances,
            target_cpu=policy.target_cpu,
            target_memory=policy.target_memory,
            scale_up_threshold=policy.scale_up_threshold,
            scale_down_threshold=policy.scale_down_threshold,
            scale_up_cooldown=policy.scale_up_cooldown,
            scale_down_cooldown=policy.scale_down_cooldown,
            enabled=policy.enabled
        )

        infrastructure_monitoring_service.scaling_policies[scaling_policy.id] = scaling_policy

        return {
            "success": True,
            "policy_id": scaling_policy.id,
            "message": "Scaling policy created successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create scaling policy: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create scaling policy: {str(e)}")


@router.get("/scaling-policies")
async def get_scaling_policies(
    deployment_id: Optional[UUID] = None,
    enabled: Optional[bool] = None,
    current_user: User = Depends(get_current_user)
):
    """Get auto-scaling policies"""
    try:
        policies = list(infrastructure_monitoring_service.scaling_policies.values())

        # Apply filters
        if deployment_id:
            policies = [p for p in policies if p.deployment_id == deployment_id]

        if enabled is not None:
            policies = [p for p in policies if p.enabled == enabled]

        return {
            "policies": [
                {
                    "id": str(policy.id),
                    "name": policy.name,
                    "deployment_id": str(policy.deployment_id),
                    "platform": policy.platform.value,
                    "min_instances": policy.min_instances,
                    "max_instances": policy.max_instances,
                    "target_cpu": policy.target_cpu,
                    "target_memory": policy.target_memory,
                    "scale_up_threshold": policy.scale_up_threshold,
                    "scale_down_threshold": policy.scale_down_threshold,
                    "scale_up_cooldown": policy.scale_up_cooldown,
                    "scale_down_cooldown": policy.scale_down_cooldown,
                    "enabled": policy.enabled
                }
                for policy in policies
            ],
            "total_count": len(policies)
        }

    except Exception as e:
        logger.error(f"Failed to get scaling policies: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get scaling policies: {str(e)}")


@router.get("/scaling-actions")
async def get_scaling_actions(
    deployment_id: Optional[UUID] = None,
    limit: int = 50,
    current_user: User = Depends(get_current_user)
):
    """Get scaling action history"""
    try:
        actions = infrastructure_monitoring_service.scaling_history

        # Apply filters
        if deployment_id:
            actions = [a for a in actions if a.deployment_id == deployment_id]

        # Sort by timestamp (newest first) and limit
        actions = sorted(actions, key=lambda x: x.timestamp, reverse=True)[:limit]

        return {
            "actions": [
                {
                    "id": str(action.id),
                    "deployment_id": str(action.deployment_id),
                    "direction": action.direction.value,
                    "current_instances": action.current_instances,
                    "target_instances": action.target_instances,
                    "reason": action.reason,
                    "timestamp": action.timestamp.isoformat(),
                    "success": action.success,
                    "error_message": action.error_message
                }
                for action in actions
            ],
            "total_count": len(actions)
        }

    except Exception as e:
        logger.error(f"Failed to get scaling actions: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get scaling actions: {str(e)}")


@router.post("/reports/{deployment_id}")
async def generate_monitoring_report(
    deployment_id: UUID,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    current_user: User = Depends(get_current_user)
):
    """Generate comprehensive monitoring report"""
    try:
        logger.info(f"User {current_user.email} generating monitoring report for {deployment_id}")

        # Default to last 24 hours if no time range specified
        if not end_time:
            end_time = datetime.now()
        if not start_time:
            start_time = end_time - timedelta(hours=24)

        report = await infrastructure_monitoring_service.generate_monitoring_report(
            deployment_id=deployment_id,
            start_time=start_time,
            end_time=end_time
        )

        return {
            "deployment_id": str(report.deployment_id),
            "period_start": report.period_start.isoformat(),
            "period_end": report.period_end.isoformat(),
            "performance_score": report.performance_score,
            "metrics_summary": report.metrics_summary,
            "alerts_summary": report.alerts_summary,
            "scaling_actions_count": len(report.scaling_actions),
            "recommendations": report.recommendations,
            "cost_analysis": report.cost_analysis
        }

    except Exception as e:
        logger.error(f"Failed to generate monitoring report: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate report: {str(e)}")


@router.get("/dashboard/{deployment_id}")
async def get_monitoring_dashboard(
    deployment_id: UUID,
    current_user: User = Depends(get_current_user)
):
    """Get monitoring dashboard data"""
    try:
        # Get current status
        status = await infrastructure_monitoring_service.get_monitoring_status(deployment_id)

        # Get recent metrics (last hour)
        recent_metrics = [
            m for m in infrastructure_monitoring_service.metrics_buffer
            if m.deployment_id == deployment_id and
            m.timestamp > datetime.now() - timedelta(hours=1)
        ]

        # Get active alerts
        active_alerts = [
            a for a in infrastructure_monitoring_service.active_alerts.values()
            if a.deployment_id == deployment_id and not a.resolved
        ]

        # Get recent scaling actions
        recent_scaling = [
            s for s in infrastructure_monitoring_service.scaling_history
            if s.deployment_id == deployment_id and
            s.timestamp > datetime.now() - timedelta(hours=6)
        ]

        return {
            "deployment_id": str(deployment_id),
            "status": status,
            "recent_metrics": {
                "count": len(recent_metrics),
                "latest": [
                    {
                        "metric_type": m.metric_type.value,
                        "value": m.value,
                        "unit": m.unit,
                        "timestamp": m.timestamp.isoformat()
                    }
                    for m in recent_metrics[-10:]  # Last 10 metrics
                ]
            },
            "active_alerts": {
                "count": len(active_alerts),
                "critical": len([a for a in active_alerts if a.severity == AlertSeverity.CRITICAL]),
                "high": len([a for a in active_alerts if a.severity == AlertSeverity.HIGH])
            },
            "recent_scaling": {
                "count": len(recent_scaling),
                "last_action": recent_scaling[-1].direction.value if recent_scaling else None
            }
        }

    except Exception as e:
        logger.error(f"Failed to get dashboard data: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get dashboard data: {str(e)}")


@router.get("/metric-types")
async def get_metric_types():
    """Get available metric types"""
    return {
        "metric_types": [
            {
                "value": metric.value,
                "name": metric.value.replace("_", " ").title(),
                "description": _get_metric_description(metric)
            }
            for metric in MetricType
        ]
    }


@router.get("/alert-severities")
async def get_alert_severities():
    """Get available alert severity levels"""
    return {
        "severities": [
            {
                "value": severity.value,
                "name": severity.value.title(),
                "description": _get_severity_description(severity)
            }
            for severity in AlertSeverity
        ]
    }


def _get_metric_description(metric: MetricType) -> str:
    """Get description for metric type"""
    descriptions = {
        MetricType.CPU_USAGE: "CPU utilization percentage",
        MetricType.MEMORY_USAGE: "Memory utilization percentage",
        MetricType.DISK_USAGE: "Disk space utilization percentage",
        MetricType.NETWORK_IN: "Incoming network traffic",
        MetricType.NETWORK_OUT: "Outgoing network traffic",
        MetricType.REQUEST_COUNT: "Number of requests per minute",
        MetricType.RESPONSE_TIME: "Average response time",
        MetricType.ERROR_RATE: "Error rate percentage",
        MetricType.CUSTOM: "Custom metric"
    }
    return descriptions.get(metric, "No description available")


def _get_severity_description(severity: AlertSeverity) -> str:
    """Get description for alert severity"""
    descriptions = {
        AlertSeverity.CRITICAL: "Requires immediate attention",
        AlertSeverity.HIGH: "Should be addressed soon",
        AlertSeverity.MEDIUM: "Normal priority alert",
        AlertSeverity.LOW: "Low priority notification",
        AlertSeverity.INFO: "Informational alert"
    }
    return descriptions.get(severity, "No description available")