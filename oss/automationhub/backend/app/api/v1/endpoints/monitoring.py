"""
Task Monitoring WebSocket and API Endpoints

This module provides WebSocket endpoints for real-time task monitoring
and REST API endpoints for monitoring data and analytics.
"""

import json
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.services.task_monitor import (
    get_task_monitor, AlertSeverity, AlertType, DashboardConfig
)
from app.services.notification_service import (
    get_notification_service, NotificationChannel, NotificationPriority, NotificationRule
)
from app.services.alerting_service import (
    get_alerting_service, AlertStatus, AlertRule as AlertingRule
)
from app.services.log_aggregation_service import (
    get_log_analytics_service, LogLevel, LogSource, LogQuery, LogAlertRule
)
from app.services.task_executor import get_task_executor
from app.schemas.task import TaskResponse

logger = logging.getLogger(__name__)
router = APIRouter()


@router.websocket("/ws/{user_id}")
async def websocket_monitoring_endpoint(
    websocket: WebSocket,
    user_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    WebSocket endpoint for real-time task monitoring.

    Provides real-time updates for:
    - Task status changes
    - Performance metrics
    - System alerts
    - Resource usage monitoring
    """
    # Get monitoring service
    monitor = await get_task_monitor(db)

    try:
        # Connect WebSocket
        connection_id = await monitor.connect_websocket(
            websocket=websocket,
            user_id=user_id
        )

        logger.info(f"WebSocket connected: {connection_id} for user: {user_id}")

        # Handle messages
        while True:
            try:
                # Receive message from client
                data = await websocket.receive_text()
                message = json.loads(data)

                # Handle different message types
                await handle_websocket_message(monitor, connection_id, message, user_id)

            except WebSocketDisconnect:
                logger.info(f"WebSocket disconnected: {connection_id}")
                break
            except Exception as e:
                logger.error(f"WebSocket message error: {e}")
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": f"Message processing error: {str(e)}"
                }))

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected during setup: {user_id}")
    except Exception as e:
        logger.error(f"WebSocket connection error: {e}")
    finally:
        # Clean up connection
        if 'connection_id' in locals():
            await monitor.disconnect_websocket(connection_id)


async def handle_websocket_message(
    monitor,
    connection_id: UUID,
    message: Dict[str, Any],
    user_id: UUID
):
    """Handle incoming WebSocket messages"""
    message_type = message.get("type")

    if message_type == "subscribe_task":
        task_id = UUID(message.get("task_id"))
        await monitor.subscribe_to_task(connection_id, task_id)

    elif message_type == "subscribe_alerts":
        subscribe = message.get("subscribe", True)
        await monitor.subscribe_to_alerts(connection_id, subscribe)

    elif message_type == "get_task_status":
        task_id = UUID(message.get("task_id"))
        # This would be handled by sending current status
        pass

    elif message_type == "ping":
        # Respond to ping
        websocket = monitor.connections.get(connection_id).websocket
        await websocket.send_text(json.dumps({"type": "pong"}))

    else:
        logger.warning(f"Unknown WebSocket message type: {message_type}")


@router.get("/status")
async def get_monitoring_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get current monitoring system status.
    """
    try:
        monitor = await get_task_monitor(db)
        system_status = await monitor._get_system_status()

        return {
            "status": "healthy",
            "monitoring": {
                "active_connections": system_status.get("active_connections", 0),
                "active_alerts": system_status.get("active_alerts", 0),
                "monitoring_active": system_status.get("monitoring_active", False)
            },
            "task_executor": {
                "running_tasks": system_status.get("running_tasks", 0),
                "pending_tasks": system_status.get("pending_tasks", 0),
                "total_agents": system_status.get("total_agents", 0)
            },
            "timestamp": datetime.utcnow().isoformat()
        }

    except Exception as e:
        logger.error(f"Failed to get monitoring status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tasks")
async def get_monitoring_tasks(
    status: Optional[str] = Query(None, description="Filter by task status"),
    task_type: Optional[str] = Query(None, description="Filter by task type"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of tasks"),
    offset: int = Query(0, ge=0, description="Number of tasks to skip"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get tasks with monitoring data.
    """
    try:
        executor = await get_task_executor(db)

        if status == "running":
            tasks = await executor.get_running_tasks()
        else:
            # Get all tasks with optional filtering
            # This would require additional implementation in the executor
            tasks = []

        return {
            "tasks": [task.dict() for task in tasks[:limit]],
            "total": len(tasks),
            "filters": {
                "status": status,
                "task_type": task_type
            },
            "pagination": {
                "limit": limit,
                "offset": offset
            }
        }

    except Exception as e:
        logger.error(f"Failed to get monitoring tasks: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tasks/{task_id}")
async def get_task_monitoring_details(
    task_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get detailed monitoring information for a specific task.
    """
    try:
        executor = await get_task_executor(db)
        monitor = await get_task_monitor(db)

        # Get task status
        task = await executor.get_task_status(task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")

        # Get resource metrics
        metrics = await executor.get_task_metrics(task_id)

        # Get task events
        events = await monitor.redis.lrange(f"task_events:{task_id}", 0, 99)

        return {
            "task": task.dict(),
            "metrics": metrics.dict() if metrics else None,
            "events": events,
            "resource_usage": {
                "current": metrics.dict() if metrics else None,
                "history": []  # Would need implementation for historical data
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get task monitoring details: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/metrics")
async def get_performance_metrics(
    time_range: str = Query("hour", description="Time range: hour, day, week, month"),
    metric_names: Optional[List[str]] = Query(None, description="Specific metrics to retrieve"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get performance metrics and trends.
    """
    try:
        monitor = await get_task_monitor(db)

        # Default metrics if none specified
        if not metric_names:
            metric_names = [
                "task_execution_time",
                "cpu_usage",
                "memory_usage",
                "agent_response_time",
                "task_success_rate"
            ]

        # Get performance trends
        trends = await monitor.get_performance_trends(
            metric_names=metric_names,
            time_period=time_range
        )

        # Get current system metrics
        system_metrics = await monitor.redis.get("system_metrics") or {}

        return {
            "time_range": time_range,
            "system_metrics": system_metrics,
            "trends": [trend.dict() for trend in trends],
            "timestamp": datetime.utcnow().isoformat()
        }

    except Exception as e:
        logger.error(f"Failed to get performance metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/alerts")
async def get_alerts(
    severity: Optional[AlertSeverity] = Query(None, description="Filter by alert severity"),
    alert_type: Optional[AlertType] = Query(None, description="Filter by alert type"),
    resolved: Optional[bool] = Query(None, description="Filter by resolution status"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of alerts"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get monitoring alerts.
    """
    try:
        monitor = await get_task_monitor(db)

        # Get alerts for current user
        alerts = await monitor.get_active_alerts(
            user_id=current_user.id,
            severity=severity,
            limit=limit
        )

        # Apply additional filters
        if alert_type:
            alerts = [a for a in alerts if a.alert_type == alert_type]

        if resolved is not None:
            alerts = [a for a in alerts if a.resolved == resolved]

        return {
            "alerts": [alert.dict() for alert in alerts],
            "total": len(alerts),
            "filters": {
                "severity": severity,
                "alert_type": alert_type,
                "resolved": resolved
            },
            "pagination": {
                "limit": limit
            }
        }

    except Exception as e:
        logger.error(f"Failed to get alerts: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/alerts")
async def create_alert(
    alert_data: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new monitoring alert.
    """
    try:
        monitor = await get_task_monitor(db)

        alert = await monitor.create_alert(
            alert_type=AlertType(alert_data.get("alert_type")),
            severity=AlertSeverity(alert_data.get("severity")),
            title=alert_data.get("title"),
            description=alert_data.get("description"),
            task_id=UUID(alert_data.get("task_id")) if alert_data.get("task_id") else None,
            agent_id=UUID(alert_data.get("agent_id")) if alert_data.get("agent_id") else None,
            user_id=current_user.id,
            data=alert_data.get("data", {})
        )

        return {
            "alert": alert.dict(),
            "message": "Alert created successfully"
        }

    except Exception as e:
        logger.error(f"Failed to create alert: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/alerts/{alert_id}/resolve")
async def resolve_alert(
    alert_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Resolve a monitoring alert.
    """
    try:
        monitor = await get_task_monitor(db)

        # Get alert and check authorization
        if alert_id not in monitor._active_alerts:
            raise HTTPException(status_code=404, detail="Alert not found")

        alert = monitor._active_alerts[alert_id]

        # Check if user can resolve this alert
        if alert.user_id != current_user.id:
            # In a real implementation, you'd check for admin/manager roles
            raise HTTPException(status_code=403, detail="Not authorized to resolve this alert")

        # Mark as resolved
        alert.resolved = True
        alert.resolved_at = datetime.utcnow()

        # Update in Redis
        await monitor.redis.set(
            f"alert:{alert_id}",
            alert.dict(),
            expire=3600
        )

        return {
            "alert": alert.dict(),
            "message": "Alert resolved successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to resolve alert: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dashboards")
async def get_dashboards(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get monitoring dashboards for the current user.
    """
    try:
        # This would typically query a database for dashboard configurations
        # For now, return a simple list
        return {
            "dashboards": [
                {
                    "id": "default",
                    "name": "System Overview",
                    "description": "Default system monitoring dashboard",
                    "is_public": True,
                    "widgets": [
                        {
                            "id": "system_status",
                            "type": "system_status",
                            "title": "System Status",
                            "position": {"x": 0, "y": 0, "w": 6, "h": 4}
                        },
                        {
                            "id": "active_tasks",
                            "type": "task_status",
                            "title": "Active Tasks",
                            "position": {"x": 6, "y": 0, "w": 6, "h": 4}
                        }
                    ]
                }
            ]
        }

    except Exception as e:
        logger.error(f"Failed to get dashboards: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/dashboards")
async def create_dashboard(
    dashboard_data: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new monitoring dashboard.
    """
    try:
        monitor = await get_task_monitor(db)

        dashboard = await monitor.create_dashboard(
            name=dashboard_data.get("name"),
            user_id=current_user.id,
            description=dashboard_data.get("description"),
            widgets=dashboard_data.get("widgets", []),
            filters=dashboard_data.get("filters", {}),
            refresh_interval=dashboard_data.get("refresh_interval", 30)
        )

        return {
            "dashboard": dashboard.dict(),
            "message": "Dashboard created successfully"
        }

    except Exception as e:
        logger.error(f"Failed to create dashboard: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dashboards/{dashboard_id}")
async def get_dashboard_data(
    dashboard_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get data for a specific dashboard.
    """
    try:
        monitor = await get_task_monitor(db)
        dashboard_data = await monitor.get_dashboard_data(dashboard_id, current_user.id)

        if not dashboard_data:
            raise HTTPException(status_code=404, detail="Dashboard not found")

        return dashboard_data

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get dashboard data: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/analytics")
async def get_monitoring_analytics(
    time_range: str = Query("day", description="Time range for analytics"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get comprehensive monitoring analytics.
    """
    try:
        executor = await get_task_executor(db)
        monitor = await get_task_monitor(db)

        # Convert time range to timedelta
        if time_range == "hour":
            delta = timedelta(hours=1)
        elif time_range == "day":
            delta = timedelta(days=1)
        elif time_range == "week":
            delta = timedelta(weeks=1)
        else:  # month
            delta = timedelta(days=30)

        # Get performance analytics from executor
        performance_analytics = await executor.get_performance_analytics(
            time_range=delta
        )

        # Get system metrics
        system_metrics = await monitor.redis.get("system_metrics") or {}

        # Get alert analytics
        alerts = await monitor.get_active_alerts(user_id=current_user.id)
        alert_analytics = {
            "total_alerts": len(alerts),
            "by_severity": {
                severity.value: len([a for a in alerts if a.severity == severity])
                for severity in AlertSeverity
            },
            "by_type": {
                alert_type.value: len([a for a in alerts if a.alert_type == alert_type])
                for alert_type in AlertType
            }
        }

        return {
            "time_range": time_range,
            "performance": performance_analytics,
            "system": system_metrics,
            "alerts": alert_analytics,
            "timestamp": datetime.utcnow().isoformat()
        }

    except Exception as e:
        logger.error(f"Failed to get monitoring analytics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Notification Management Endpoints
@router.post("/notifications/rules")
async def create_notification_rule(
    rule_data: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new notification rule.
    """
    try:
        notification_service = await get_notification_service()

        rule = await notification_service.create_notification_rule(rule_data)

        return {
            "rule": rule.dict(),
            "message": "Notification rule created successfully"
        }

    except Exception as e:
        logger.error(f"Failed to create notification rule: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/notifications/rules")
async def get_notification_rules(
    enabled_only: bool = Query(False, description="Get only enabled rules"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get notification rules.
    """
    try:
        notification_service = await get_notification_service()

        # This would be implemented in the notification service
        # For now, return a placeholder response
        return {
            "rules": [],
            "total": 0,
            "enabled_only": enabled_only
        }

    except Exception as e:
        logger.error(f"Failed to get notification rules: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/notifications/rules/{rule_id}")
async def update_notification_rule(
    rule_id: UUID,
    updates: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update a notification rule.
    """
    try:
        notification_service = await get_notification_service()

        rule = await notification_service.update_notification_rule(rule_id, updates)

        return {
            "rule": rule.dict(),
            "message": "Notification rule updated successfully"
        }

    except Exception as e:
        logger.error(f"Failed to update notification rule: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/notifications/rules/{rule_id}")
async def delete_notification_rule(
    rule_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a notification rule.
    """
    try:
        notification_service = await get_notification_service()

        await notification_service.delete_notification_rule(rule_id)

        return {"message": "Notification rule deleted successfully"}

    except Exception as e:
        logger.error(f"Failed to delete notification rule: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/notifications/history")
async def get_notification_history(
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of notifications"),
    hours: int = Query(24, ge=1, le=168, description="Time range in hours"),
    channel: Optional[NotificationChannel] = Query(None, description="Filter by channel"),
    status: Optional[str] = Query(None, description="Filter by status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get notification history.
    """
    try:
        notification_service = await get_notification_service()

        notifications = await notification_service.get_notification_history(
            limit=limit,
            hours=hours,
            channel=channel
        )

        return {
            "notifications": notifications,
            "total": len(notifications),
            "filters": {
                "limit": limit,
                "hours": hours,
                "channel": channel.value if channel else None,
                "status": status
            }
        }

    except Exception as e:
        logger.error(f"Failed to get notification history: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/notifications/statistics")
async def get_notification_statistics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get notification delivery statistics.
    """
    try:
        notification_service = await get_notification_service()

        stats = await notification_service.get_delivery_statistics()

        return {
            "statistics": stats,
            "timestamp": datetime.utcnow().isoformat()
        }

    except Exception as e:
        logger.error(f"Failed to get notification statistics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Alert Management Endpoints
@router.post("/alerts/rules")
async def create_alert_rule(
    rule_data: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new alert rule.
    """
    try:
        alerting_service = await get_alerting_service()

        rule = await alerting_service.create_alert_rule(rule_data)

        return {
            "rule": rule.dict(),
            "message": "Alert rule created successfully"
        }

    except Exception as e:
        logger.error(f"Failed to create alert rule: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/alerts/rules")
async def get_alert_rules(
    enabled_only: bool = Query(False, description="Get only enabled rules"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get alert rules.
    """
    try:
        # This would be implemented in the alerting service
        # For now, return a placeholder response
        return {
            "rules": [],
            "total": 0,
            "enabled_only": enabled_only
        }

    except Exception as e:
        logger.error(f"Failed to get alert rules: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/alerts/rules/{rule_id}")
async def update_alert_rule(
    rule_id: UUID,
    updates: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update an alert rule.
    """
    try:
        alerting_service = await get_alerting_service()

        rule = await alerting_service.update_alert_rule(rule_id, updates)

        return {
            "rule": rule.dict(),
            "message": "Alert rule updated successfully"
        }

    except Exception as e:
        logger.error(f"Failed to update alert rule: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/alerts/rules/{rule_id}")
async def delete_alert_rule(
    rule_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete an alert rule.
    """
    try:
        alerting_service = await get_alerting_service()

        await alerting_service.delete_alert_rule(rule_id)

        return {"message": "Alert rule deleted successfully"}

    except Exception as e:
        logger.error(f"Failed to delete alert rule: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/alerts/manual")
async def create_manual_alert(
    alert_data: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a manual alert.
    """
    try:
        alerting_service = await get_alerting_service()

        alert = await alerting_service.create_manual_alert(
            name=alert_data.get("name"),
            description=alert_data.get("description"),
            severity=AlertSeverity(alert_data.get("severity")),
            source=alert_data.get("source", "manual"),
            context=alert_data.get("context", {}),
            tags=alert_data.get("tags", [])
        )

        return {
            "alert": alert.dict(),
            "message": "Manual alert created successfully"
        }

    except Exception as e:
        logger.error(f"Failed to create manual alert: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/alerts/active")
async def get_active_alerts(
    severity: Optional[AlertSeverity] = Query(None, description="Filter by severity"),
    source: Optional[str] = Query(None, description="Filter by source"),
    tags: Optional[List[str]] = Query(None, description="Filter by tags"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of alerts"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get active alerts.
    """
    try:
        alerting_service = await get_alerting_service()

        alerts = await alerting_service.get_active_alerts(
            severity=severity,
            source=source,
            tags=tags,
            limit=limit
        )

        return {
            "alerts": [alert.dict() for alert in alerts],
            "total": len(alerts),
            "filters": {
                "severity": severity.value if severity else None,
                "source": source,
                "tags": tags,
                "limit": limit
            }
        }

    except Exception as e:
        logger.error(f"Failed to get active alerts: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/alerts/history")
async def get_alert_history(
    hours: int = Query(24, ge=1, le=168, description="Time range in hours"),
    severity: Optional[AlertSeverity] = Query(None, description="Filter by severity"),
    source: Optional[str] = Query(None, description="Filter by source"),
    status: Optional[AlertStatus] = Query(None, description="Filter by status"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of alerts"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get alert history.
    """
    try:
        alerting_service = await get_alerting_service()

        alerts = await alerting_service.get_alert_history(
            hours=hours,
            severity=severity,
            source=source,
            status=status,
            limit=limit
        )

        return {
            "alerts": alerts,
            "total": len(alerts),
            "filters": {
                "hours": hours,
                "severity": severity.value if severity else None,
                "source": source,
                "status": status.value if status else None,
                "limit": limit
            }
        }

    except Exception as e:
        logger.error(f"Failed to get alert history: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(
    alert_id: UUID,
    acknowledgment_data: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Acknowledge an alert.
    """
    try:
        alerting_service = await get_alerting_service()

        success = await alerting_service.acknowledge_alert(
            alert_id=alert_id,
            user_id=current_user.id,
            message=acknowledgment_data.get("message")
        )

        if not success:
            raise HTTPException(status_code=404, detail="Alert not found or cannot be acknowledged")

        return {
            "message": "Alert acknowledged successfully",
            "alert_id": str(alert_id),
            "acknowledged_by": str(current_user.id),
            "acknowledged_at": datetime.utcnow().isoformat()
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to acknowledge alert: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/alerts/{alert_id}/resolve")
async def resolve_alert(
    alert_id: UUID,
    resolution_data: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Resolve an alert.
    """
    try:
        alerting_service = await get_alerting_service()

        success = await alerting_service.resolve_alert(
            alert_id=alert_id,
            user_id=current_user.id,
            resolution_message=resolution_data.get("message")
        )

        if not success:
            raise HTTPException(status_code=404, detail="Alert not found")

        return {
            "message": "Alert resolved successfully",
            "alert_id": str(alert_id),
            "resolved_by": str(current_user.id),
            "resolved_at": datetime.utcnow().isoformat()
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to resolve alert: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/alerts/statistics")
async def get_alert_statistics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get comprehensive alert statistics.
    """
    try:
        alerting_service = await get_alerting_service()

        stats = await alerting_service.get_alert_statistics()

        return {
            "statistics": stats,
            "timestamp": datetime.utcnow().isoformat()
        }

    except Exception as e:
        logger.error(f"Failed to get alert statistics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/test-notification")
async def test_notification(
    test_data: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Send a test notification.
    """
    try:
        notification_service = await get_notification_service()

        # Create test alert data
        alert_data = {
            "alert_id": str(uuid4()),
            "alert_title": "Test Alert",
            "description": test_data.get("message", "This is a test notification"),
            "severity": test_data.get("severity", "medium"),
            "timestamp": datetime.utcnow().isoformat(),
            "source": "test",
            "metric_name": "test_metric",
            "current_value": 85.0,
            "threshold_value": 80.0,
            "additional_details": test_data.get("details", "")
        }

        # Send notification
        notifications = await notification_service.send_notification(alert_data)

        return {
            "message": "Test notification sent successfully",
            "notifications_sent": len(notifications),
            "notification_ids": [str(n.id) for n in notifications]
        }

    except Exception as e:
        logger.error(f"Failed to send test notification: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Log Management Endpoints
@router.post("/logs/ingest")
async def ingest_log(
    log_data: Union[str, Dict[str, Any]],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Ingest a log entry for processing and indexing.
    """
    try:
        log_analytics_service = await get_log_analytics_service()

        log_id = await log_analytics_service.ingest_log(log_data)

        return {
            "log_id": str(log_id),
            "message": "Log ingested successfully",
            "timestamp": datetime.utcnow().isoformat()
        }

    except Exception as e:
        logger.error(f"Failed to ingest log: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/logs/search")
async def search_logs(
    query: LogQuery,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Search logs based on query criteria.
    """
    try:
        log_analytics_service = await get_log_analytics_service()

        results = await log_analytics_service.search_logs(query)

        return results

    except Exception as e:
        logger.error(f"Failed to search logs: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/logs/analytics")
async def get_log_analytics(
    time_range: str = Query("day", description="Time range: hour, day, week, month"),
    group_by: Optional[str] = Query(None, description="Field to group analytics by"),
    source: Optional[LogSource] = Query(None, description="Filter by log source"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get log analytics and statistics.
    """
    try:
        log_analytics_service = await get_log_analytics_service()

        analytics = await log_analytics_service.get_log_analytics(
            time_range=time_range,
            group_by=group_by,
            source=source
        )

        return analytics

    except Exception as e:
        logger.error(f"Failed to get log analytics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/logs/alerts")
async def create_log_alert_rule(
    rule_data: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new log-based alert rule.
    """
    try:
        log_analytics_service = await get_log_analytics_service()

        rule = await log_analytics_service.create_log_alert_rule(rule_data)

        return {
            "rule": rule.dict(),
            "message": "Log alert rule created successfully"
        }

    except Exception as e:
        logger.error(f"Failed to create log alert rule: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/logs/sources")
async def get_log_sources(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get available log sources.
    """
    try:
        return {
            "sources": [
                {"value": source.value, "label": source.value.title()}
                for source in LogSource
            ]
        }

    except Exception as e:
        logger.error(f"Failed to get log sources: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/logs/levels")
async def get_log_levels(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get available log levels.
    """
    try:
        return {
            "levels": [
                {"value": level.value, "label": level.value.upper()}
                for level in LogLevel
            ]
        }

    except Exception as e:
        logger.error(f"Failed to get log levels: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/logs/test")
async def test_log_ingestion(
    test_data: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Test log ingestion with sample data.
    """
    try:
        log_analytics_service = await get_log_analytics_service()

        # Create test log entries
        test_logs = [
            {
                "timestamp": datetime.utcnow().isoformat(),
                "level": test_data.get("level", "info"),
                "source": test_data.get("source", "test"),
                "component": "test_component",
                "message": test_data.get("message", "This is a test log entry"),
                "user_id": current_user.id,
                "metadata": {"test": True, "user": str(current_user.id)}
            }
        ]

        results = []
        for log_data in test_logs:
            try:
                log_id = await log_analytics_service.ingest_log(log_data)
                results.append({"log_id": str(log_id), "status": "success"})
            except Exception as e:
                results.append({"error": str(e), "status": "failed"})

        return {
            "message": "Test log ingestion completed",
            "results": results,
            "timestamp": datetime.utcnow().isoformat()
        }

    except Exception as e:
        logger.error(f"Failed to test log ingestion: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Comprehensive System Status Endpoint
@router.get("/system/status")
async def get_comprehensive_system_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get comprehensive system status including all monitoring services.
    """
    try:
        # Get task monitor status
        monitor = await get_task_monitor(db)
        system_status = await monitor._get_system_status()

        # Get notification service stats
        notification_service = await get_notification_service()
        notification_stats = await notification_service.get_delivery_statistics()

        # Get alerting service stats
        alerting_service = await get_alerting_service()
        alerting_stats = await alerting_service.get_alert_statistics()

        # Get log analytics service metrics
        log_analytics_service = await get_log_analytics_service()
        log_analytics = await log_analytics_service.get_log_analytics("hour")

        return {
            "status": "healthy",
            "services": {
                "task_monitor": {
                    "status": system_status.get("monitoring_active", False),
                    "active_connections": system_status.get("active_connections", 0),
                    "active_alerts": system_status.get("active_alerts", 0)
                },
                "notification_service": {
                    "status": "active",
                    "statistics": notification_stats
                },
                "alerting_service": {
                    "status": "active",
                    "statistics": alerting_stats
                },
                "log_analytics": {
                    "status": "active",
                    "analytics": log_analytics
                }
            },
            "timestamp": datetime.utcnow().isoformat()
        }

    except Exception as e:
        logger.error(f"Failed to get comprehensive system status: {e}")
        raise HTTPException(status_code=500, detail=str(e))