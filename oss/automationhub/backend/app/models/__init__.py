"""
Database models for UPM.Plus
"""

# Import Tenant first so "tenants" table exists when User.tenant_id FK is resolved
from .tenant import Tenant, TenantConfiguration, TenantUsageLog
from .user import User
# Import branding so Tenant.branding and tenant_brands table resolve
from . import branding
from .organization import Organization
from .workflow import Workflow
from .task import Task
from .agent import Agent
from .document import Document

# Enhanced workflow persistence models
from .workflow_persistence import (
    WorkflowDefinition,
    WorkflowExecution,
    NodeExecution,
    ExecutionAuditLog,
    WorkflowVersion,
    WorkflowStatus,
    ExecutionStatus,
    NodeStatus,
    AuditEventType
)

__all__ = [
    "User",
    "Organization", 
    "Workflow",
    "Task",
    "Agent",
    "Document",
    # Persistence models
    "WorkflowDefinition",
    "WorkflowExecution", 
    "NodeExecution",
    "ExecutionAuditLog",
    "WorkflowVersion",
    # Enums
    "WorkflowStatus",
    "ExecutionStatus",
    "NodeStatus",
    "AuditEventType"
]