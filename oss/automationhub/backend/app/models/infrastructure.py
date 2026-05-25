"""
Infrastructure Models
SQLAlchemy models for Ansible playbooks, inventories, executions, and infrastructure management
"""

import uuid
from datetime import datetime, timezone as dt_timezone
from typing import List, Optional, Dict, Any

from sqlalchemy import Column, String, Text, Integer, Float, Boolean, DateTime, JSON, ForeignKey
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship, validates
from sqlalchemy.ext.declarative import declarative_base

from app.core.database import Base

class AnsiblePlaybook(Base):
    """Ansible playbook model for storing automation playbooks"""
    __tablename__ = "ansible_playbooks"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    content = Column(Text, nullable=False)
    category = Column(String(100), nullable=False, index=True)
    tags = Column(JSON, nullable=True, default=list)
    variables_schema = Column(JSON, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    execution_count = Column(Integer, nullable=False, default=0)
    last_executed = Column(DateTime(timezone=True), nullable=True)
    average_execution_time = Column(Float, nullable=True)

    # Metadata
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.now(dt_timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.now(dt_timezone.utc), onupdate=datetime.now(dt_timezone.utc))
    created_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    updated_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    # Relationships
    executions = relationship("AnsibleExecution", back_populates="playbook", cascade="all, delete-orphan")

    # Relationships to User (need to be defined after User model)
    # creator = relationship("User", foreign_keys=[created_by])
    # updater = relationship("User", foreign_keys=[updated_by])

    @validates('name')
    def validate_name(self, key, value):
        if not value or len(value.strip()) < 1:
            raise ValueError('Playbook name cannot be empty')
        if len(value) > 255:
            raise ValueError('Playbook name too long')
        return value.strip()

    @validates('category')
    def validate_category(self, key, value):
        if not value or len(value.strip()) < 1:
            raise ValueError('Category cannot be empty')
        return value.strip()

    def __repr__(self):
        return f"<AnsiblePlaybook(id={self.id}, name='{self.name}', category='{self.category}')>"


class AnsibleInventory(Base):
    """Ansible inventory model for storing host inventories"""
    __tablename__ = "ansible_inventories"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    inventory_type = Column(String(50), nullable=False, index=True)  # static, dynamic, hybrid
    content = Column(Text, nullable=True)  # For static inventories
    script_content = Column(Text, nullable=True)  # For dynamic inventories
    variables = Column(JSON, nullable=True)
    host_count = Column(Integer, nullable=False, default=0)
    group_count = Column(Integer, nullable=False, default=0)
    last_synced = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True, index=True)

    # Metadata
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.now(dt_timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.now(dt_timezone.utc), onupdate=datetime.now(dt_timezone.utc))
    created_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    updated_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    # Relationships
    executions = relationship("AnsibleExecution", back_populates="inventory")

    @validates('inventory_type')
    def validate_inventory_type(self, key, value):
        valid_types = ['static', 'dynamic', 'hybrid']
        if value not in valid_types:
            raise ValueError(f'Inventory type must be one of: {valid_types}')
        return value

    def __repr__(self):
        return f"<AnsibleInventory(id={self.id}, name='{self.name}', type='{self.inventory_type}')>"


class AnsibleExecution(Base):
    """Ansible execution model for tracking playbook runs"""
    __tablename__ = "ansible_executions"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    playbook_id = Column(PG_UUID(as_uuid=True), ForeignKey("ansible_playbooks.id"), nullable=False, index=True)
    inventory_id = Column(PG_UUID(as_uuid=True), ForeignKey("ansible_inventories.id"), nullable=True, index=True)
    status = Column(String(50), nullable=False, index=True)  # pending, running, success, failed, cancelled, timeout
    return_code = Column(Integer, nullable=True)

    # Execution details
    extra_vars = Column(JSON, nullable=True)
    tags = Column(JSON, nullable=True, default=list)
    skip_tags = Column(JSON, nullable=True, default=list)
    limit = Column(String(255), nullable=True)
    forks = Column(Integer, nullable=False, default=10)
    timeout = Column(Integer, nullable=False, default=3600)

    # Results
    stdout = Column(Text, nullable=True)
    stderr = Column(Text, nullable=True)
    execution_time = Column(Float, nullable=True)
    stats = Column(JSON, nullable=True)  # Playbook recap stats
    host_results = Column(JSON, nullable=True)  # Detailed host results
    error_message = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.now(dt_timezone.utc))
    started_at = Column(DateTime(timezone=True), nullable=True)
    finished_at = Column(DateTime(timezone=True), nullable=True)
    created_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    # Relationships
    playbook = relationship("AnsiblePlaybook", back_populates="executions")
    inventory = relationship("AnsibleInventory", back_populates="executions")

    # Relationship to User
    # executor = relationship("User", foreign_keys=[created_by])

    @validates('status')
    def validate_status(self, key, value):
        valid_statuses = ['pending', 'running', 'success', 'failed', 'cancelled', 'timeout']
        if value not in valid_statuses:
            raise ValueError(f'Status must be one of: {valid_statuses}')
        return value

    @validates('forks')
    def validate_forks(self, key, value):
        if value < 1 or value > 100:
            raise ValueError('Forks must be between 1 and 100')
        return value

    @validates('timeout')
    def validate_timeout(self, key, value):
        if value < 60 or value > 86400:  # 1 minute to 24 hours
            raise ValueError('Timeout must be between 60 and 86400 seconds')
        return value

    def __repr__(self):
        return f"<AnsibleExecution(id={self.id}, playbook_id='{self.playbook_id}', status='{self.status}')>"


class ScheduledExecution(Base):
    """Scheduled execution model for recurring playbook runs"""
    __tablename__ = "scheduled_executions"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    playbook_id = Column(PG_UUID(as_uuid=True), ForeignKey("ansible_playbooks.id"), nullable=False, index=True)
    inventory_id = Column(PG_UUID(as_uuid=True), ForeignKey("ansible_inventories.id"), nullable=True, index=True)
    schedule = Column(String(255), nullable=False)  # Cron expression
    timezone = Column(String(50), nullable=False, default="UTC")

    # Execution parameters
    extra_vars = Column(JSON, nullable=True)
    tags = Column(JSON, nullable=True, default=list)
    skip_tags = Column(JSON, nullable=True, default=list)
    limit = Column(String(255), nullable=True)
    forks = Column(Integer, nullable=False, default=10)
    timeout = Column(Integer, nullable=False, default=3600)

    # State
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    last_run = Column(DateTime(timezone=True), nullable=True)
    next_run = Column(DateTime(timezone=True), nullable=True, index=True)
    run_count = Column(Integer, nullable=False, default=0)
    success_count = Column(Integer, nullable=False, default=0)
    failure_count = Column(Integer, nullable=False, default=0)
    last_execution_id = Column(PG_UUID(as_uuid=True), nullable=True)

    # Metadata
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.now(dt_timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.now(dt_timezone.utc), onupdate=datetime.now(dt_timezone.utc))
    created_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    updated_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    # Relationships
    playbook = relationship("AnsiblePlaybook")
    inventory = relationship("AnsibleInventory")

    # Relationship to User
    # creator = relationship("User", foreign_keys=[created_by])
    # updater = relationship("User", foreign_keys=[updated_by])

    def __repr__(self):
        return f"<ScheduledExecution(id={self.id}, name='{self.name}', schedule='{self.schedule}')>"


class InfrastructureProvider(Base):
    """Infrastructure provider model for cloud and on-premise integrations"""
    __tablename__ = "infrastructure_providers"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False, index=True)
    provider_type = Column(String(50), nullable=False, index=True)  # aws, azure, gcp, digitalocean, onpremise
    region = Column(String(100), nullable=True)
    endpoint = Column(String(500), nullable=True)  # API endpoint or connection details
    credentials = Column(JSON, nullable=True)  # Encrypted credentials
    configuration = Column(JSON, nullable=True)  # Provider-specific configuration
    capabilities = Column(JSON, nullable=True, default=list)  # Available capabilities

    # State
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    is_connected = Column(Boolean, nullable=False, default=False)
    last_verified = Column(DateTime(timezone=True), nullable=True)
    verification_error = Column(Text, nullable=True)

    # Metrics
    resource_count = Column(Integer, nullable=False, default=0)
    last_sync = Column(DateTime(timezone=True), nullable=True)

    # Metadata
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.now(dt_timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.now(dt_timezone.utc), onupdate=datetime.now(dt_timezone.utc))
    created_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    updated_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    def __repr__(self):
        return f"<InfrastructureProvider(id={self.id}, name='{self.name}', type='{self.provider_type}')>"


class InfrastructureResource(Base):
    """Infrastructure resource model for tracking managed resources"""
    __tablename__ = "infrastructure_resources"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    provider_id = Column(PG_UUID(as_uuid=True), ForeignKey("infrastructure_providers.id"), nullable=False, index=True)
    resource_type = Column(String(100), nullable=False, index=True)  # vm, container, network, storage, etc.
    resource_id = Column(String(255), nullable=False, index=True)  # Provider-specific resource ID
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)

    # Resource details
    specifications = Column(JSON, nullable=True)  # CPU, memory, storage, etc.
    configuration = Column(JSON, nullable=True)  # Current configuration
    tags = Column(JSON, nullable=True, default=list)  # Resource tags

    # State
    status = Column(String(50), nullable=False, index=True)  # running, stopped, terminated, etc.
    health = Column(String(50), nullable=True, index=True)  # healthy, unhealthy, unknown
    last_seen = Column(DateTime(timezone=True), nullable=True)
    created_at_provider = Column(DateTime(timezone=True), nullable=True)

    # Metrics
    cost_per_hour = Column(Float, nullable=True)
    total_cost = Column(Float, nullable=True)
    uptime_percentage = Column(Float, nullable=True)

    # Relationships
    provider = relationship("InfrastructureProvider")

    def __repr__(self):
        return f"<InfrastructureResource(id={self.id}, name='{self.name}', type='{self.resource_type}')>"


class AnsibleWebhook(Base):
    """Webhook model for Ansible event notifications"""
    __tablename__ = "ansible_webhooks"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False, index=True)
    url = Column(String(1000), nullable=False)
    events = Column(JSON, nullable=True)  # List of events to trigger on
    secret = Column(String(255), nullable=True)  # HMAC secret for verification

    # Configuration
    retry_count = Column(Integer, nullable=False, default=3)
    timeout = Column(Integer, nullable=False, default=30)
    custom_headers = Column(JSON, nullable=True)
    payload_template = Column(Text, nullable=True)  # Custom payload template

    # State
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    last_triggered = Column(DateTime(timezone=True), nullable=True)
    trigger_count = Column(Integer, nullable=False, default=0)
    last_error = Column(Text, nullable=True)

    # Metadata
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.now(dt_timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.now(dt_timezone.utc), onupdate=datetime.now(dt_timezone.utc))
    created_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    updated_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    def __repr__(self):
        return f"<AnsibleWebhook(id={self.id}, name='{self.name}', url='{self.url}')>"


class AnsibleWebhookEvent(Base):
    """Webhook event log for tracking webhook deliveries"""
    __tablename__ = "ansible_webhook_events"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    webhook_id = Column(PG_UUID(as_uuid=True), ForeignKey("ansible_webhooks.id"), nullable=False, index=True)
    event_type = Column(String(100), nullable=False, index=True)
    execution_id = Column(PG_UUID(as_uuid=True), ForeignKey("ansible_executions.id"), nullable=True, index=True)

    # Delivery details
    status = Column(String(50), nullable=False, index=True)  # pending, delivered, failed
    attempt_count = Column(Integer, nullable=False, default=1)
    response_status = Column(Integer, nullable=True)
    response_body = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)

    # Timing
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.now(dt_timezone.utc))
    delivered_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    webhook = relationship("AnsibleWebhook")
    execution = relationship("AnsibleExecution")

    def __repr__(self):
        return f"<AnsibleWebhookEvent(id={self.id}, webhook_id='{self.webhook_id}', status='{self.status}')>"


class AnsibleRole(Base):
    """Ansible role model for managing reusable roles"""
    __tablename__ = "ansible_roles"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    category = Column(String(100), nullable=False, index=True)

    # Role content
    tasks_content = Column(Text, nullable=True)
    handlers_content = Column(Text, nullable=True)
    vars_content = Column(Text, nullable=True)
    defaults_content = Column(Text, nullable=True)
    meta_content = Column(Text, nullable=True)

    # Dependencies
    dependencies = Column(JSON, nullable=True, default=list)
    galaxy_info = Column(JSON, nullable=True)

    # State
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    is_builtin = Column(Boolean, nullable=False, default=False)
    version = Column(String(50), nullable=False, default="1.0.0")
    download_count = Column(Integer, nullable=False, default=0)

    # Metadata
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.now(dt_timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.now(dt_timezone.utc), onupdate=datetime.now(dt_timezone.utc))
    created_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    updated_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    def __repr__(self):
        return f"<AnsibleRole(id={self.id}, name='{self.name}', version='{self.version}')>"


class InfrastructureMetric(Base):
    """Infrastructure metrics model for tracking performance and usage"""
    __tablename__ = "infrastructure_metrics"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    resource_id = Column(PG_UUID(as_uuid=True), ForeignKey("infrastructure_resources.id"), nullable=True, index=True)
    execution_id = Column(PG_UUID(as_uuid=True), ForeignKey("ansible_executions.id"), nullable=True, index=True)
    metric_type = Column(String(100), nullable=False, index=True)  # cpu, memory, network, disk, etc.
    metric_name = Column(String(255), nullable=False, index=True)

    # Metric values
    value = Column(Float, nullable=False)
    unit = Column(String(50), nullable=True)  # percent, mb, gb, etc.
    tags = Column(JSON, nullable=True, default=list)

    # Timestamps
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)
    collected_at = Column(DateTime(timezone=True), nullable=False, default=datetime.now(dt_timezone.utc))

    # Relationships
    resource = relationship("InfrastructureResource")
    execution = relationship("AnsibleExecution")

    def __repr__(self):
        return f"<InfrastructureMetric(id={self.id}, type='{self.metric_type}', name='{self.metric_name}', value={self.value})>"