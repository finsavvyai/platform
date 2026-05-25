"""
Celery configuration for background tasks
"""

from celery import Celery
from app.core.config import settings

# Create Celery instance
celery_app = Celery(
    "upm-plus",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "app.tasks.workflow_tasks",
        "app.tasks.agent_tasks",
        "app.tasks.document_tasks"
    ]
)

# Configure Celery
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=30 * 60,  # 30 minutes
    task_soft_time_limit=25 * 60,  # 25 minutes
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=1000,
)

# Beat schedule for periodic tasks
celery_app.conf.beat_schedule = {
    "cleanup-expired-sessions": {
        "task": "app.tasks.maintenance_tasks.cleanup_expired_sessions",
        "schedule": 3600.0,  # Every hour
    },
    "update-agent-metrics": {
        "task": "app.tasks.agent_tasks.update_agent_metrics",
        "schedule": 300.0,  # Every 5 minutes
    },
    "process-pending-documents": {
        "task": "app.tasks.document_tasks.process_pending_documents",
        "schedule": 60.0,  # Every minute
    },
}