"""Create infrastructure automation tables

Revision ID: 005_create_infrastructure_tables
Revises: 004_create_tenant_admin_tables
Create Date: 2024-11-10 18:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '005_create_infrastructure_tables'
down_revision = '004_create_tenant_admin_tables'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create infrastructure automation and Ansible integration tables"""

    # Create ansible_playbooks table
    op.create_table(
        'ansible_playbooks',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('category', sa.String(length=100), nullable=False),
        sa.Column('tags', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('variables_schema', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('execution_count', sa.Integer(), nullable=False),
        sa.Column('last_executed', sa.DateTime(timezone=True), nullable=True),
        sa.Column('average_execution_time', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint('execution_count >= 0', name='ck_playbook_execution_count'),
        sa.CheckConstraint('average_execution_time >= 0', name='ck_playbook_avg_exec_time'),
        comment='Ansible playbooks for infrastructure automation'
    )
    op.create_index(op.f('ix_ansible_playbooks_name'), 'ansible_playbooks', ['name'], unique=False)
    op.create_index(op.f('ix_ansible_playbooks_category'), 'ansible_playbooks', ['category'], unique=False)
    op.create_index(op.f('ix_ansible_playbooks_is_active'), 'ansible_playbooks', ['is_active'], unique=False)

    # Create ansible_inventories table
    op.create_table(
        'ansible_inventories',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('inventory_type', sa.String(length=50), nullable=False),
        sa.Column('content', sa.Text(), nullable=True),
        sa.Column('script_content', sa.Text(), nullable=True),
        sa.Column('variables', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('host_count', sa.Integer(), nullable=False),
        sa.Column('group_count', sa.Integer(), nullable=False),
        sa.Column('last_synced', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint('inventory_type IN (\'static\', \'dynamic\', \'hybrid\')', name='ck_inventory_type'),
        sa.CheckConstraint('host_count >= 0', name='ck_inventory_host_count'),
        sa.CheckConstraint('group_count >= 0', name='ck_inventory_group_count'),
        comment='Ansible inventories for host management'
    )
    op.create_index(op.f('ix_ansible_inventories_name'), 'ansible_inventories', ['name'], unique=False)
    op.create_index(op.f('ix_ansible_inventories_inventory_type'), 'ansible_inventories', ['inventory_type'], unique=False)
    op.create_index(op.f('ix_ansible_inventories_is_active'), 'ansible_inventories', ['is_active'], unique=False)

    # Create ansible_executions table
    op.create_table(
        'ansible_executions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('playbook_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('inventory_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('return_code', sa.Integer(), nullable=True),
        sa.Column('extra_vars', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('tags', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('skip_tags', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('limit', sa.String(length=255), nullable=True),
        sa.Column('forks', sa.Integer(), nullable=False),
        sa.Column('timeout', sa.Integer(), nullable=False),
        sa.Column('stdout', sa.Text(), nullable=True),
        sa.Column('stderr', sa.Text(), nullable=True),
        sa.Column('execution_time', sa.Float(), nullable=True),
        sa.Column('stats', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('host_results', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('finished_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['inventory_id'], ['ansible_inventories.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['playbook_id'], ['ansible_playbooks.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint('status IN (\'pending\', \'running\', \'success\', \'failed\', \'cancelled\', \'timeout\')', name='ck_execution_status'),
        sa.CheckConstraint('forks >= 1 AND forks <= 100', name='ck_execution_forks'),
        sa.CheckConstraint('timeout >= 60 AND timeout <= 86400', name='ck_execution_timeout'),
        sa.CheckConstraint('execution_time >= 0', name='ck_execution_time'),
        comment='Ansible playbook execution records'
    )
    op.create_index(op.f('ix_ansible_executions_playbook_id'), 'ansible_executions', ['playbook_id'], unique=False)
    op.create_index(op.f('ix_ansible_executions_inventory_id'), 'ansible_executions', ['inventory_id'], unique=False)
    op.create_index(op.f('ix_ansible_executions_status'), 'ansible_executions', ['status'], unique=False)
    op.create_index(op.f('ix_ansible_executions_created_at'), 'ansible_executions', ['created_at'], unique=False)

    # Create scheduled_executions table
    op.create_table(
        'scheduled_executions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('playbook_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('inventory_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('schedule', sa.String(length=255), nullable=False),
        sa.Column('timezone', sa.String(length=50), nullable=False),
        sa.Column('extra_vars', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('tags', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('skip_tags', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('limit', sa.String(length=255), nullable=True),
        sa.Column('forks', sa.Integer(), nullable=False),
        sa.Column('timeout', sa.Integer(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('last_run', sa.DateTime(timezone=True), nullable=True),
        sa.Column('next_run', sa.DateTime(timezone=True), nullable=True),
        sa.Column('run_count', sa.Integer(), nullable=False),
        sa.Column('success_count', sa.Integer(), nullable=False),
        sa.Column('failure_count', sa.Integer(), nullable=False),
        sa.Column('last_execution_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['inventory_id'], ['ansible_inventories.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['playbook_id'], ['ansible_playbooks.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint('forks >= 1 AND forks <= 100', name='ck_scheduled_forks'),
        sa.CheckConstraint('timeout >= 60 AND timeout <= 86400', name='ck_scheduled_timeout'),
        sa.CheckConstraint('run_count >= 0', name='ck_scheduled_run_count'),
        sa.CheckConstraint('success_count >= 0', name='ck_scheduled_success_count'),
        sa.CheckConstraint('failure_count >= 0', name='ck_scheduled_failure_count'),
        comment='Scheduled Ansible playbook executions'
    )
    op.create_index(op.f('ix_scheduled_executions_name'), 'scheduled_executions', ['name'], unique=False)
    op.create_index(op.f('ix_scheduled_executions_playbook_id'), 'scheduled_executions', ['playbook_id'], unique=False)
    op.create_index(op.f('ix_scheduled_executions_inventory_id'), 'scheduled_executions', ['inventory_id'], unique=False)
    op.create_index(op.f('ix_scheduled_executions_is_active'), 'scheduled_executions', ['is_active'], unique=False)
    op.create_index(op.f('ix_scheduled_executions_next_run'), 'scheduled_executions', ['next_run'], unique=False)

    # Create infrastructure_providers table
    op.create_table(
        'infrastructure_providers',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('provider_type', sa.String(length=50), nullable=False),
        sa.Column('region', sa.String(length=100), nullable=True),
        sa.Column('endpoint', sa.String(length=500), nullable=True),
        sa.Column('credentials', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('configuration', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('capabilities', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('is_connected', sa.Boolean(), nullable=False),
        sa.Column('last_verified', sa.DateTime(timezone=True), nullable=True),
        sa.Column('verification_error', sa.Text(), nullable=True),
        sa.Column('resource_count', sa.Integer(), nullable=False),
        sa.Column('last_sync', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint('provider_type IN (\'aws\', \'azure\', \'gcp\', \'digitalocean\', \'linode\', \'onpremise\')', name='ck_provider_type'),
        sa.CheckConstraint('resource_count >= 0', name='ck_provider_resource_count'),
        comment='Infrastructure providers (cloud and on-premise)'
    )
    op.create_index(op.f('ix_infrastructure_providers_name'), 'infrastructure_providers', ['name'], unique=False)
    op.create_index(op.f('ix_infrastructure_providers_provider_type'), 'infrastructure_providers', ['provider_type'], unique=False)
    op.create_index(op.f('ix_infrastructure_providers_is_active'), 'infrastructure_providers', ['is_active'], unique=False)

    # Create infrastructure_resources table
    op.create_table(
        'infrastructure_resources',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('provider_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('resource_type', sa.String(length=100), nullable=False),
        sa.Column('resource_id', sa.String(length=255), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('specifications', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('configuration', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('tags', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('health', sa.String(length=50), nullable=True),
        sa.Column('last_seen', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at_provider', sa.DateTime(timezone=True), nullable=True),
        sa.Column('cost_per_hour', sa.Float(), nullable=True),
        sa.Column('total_cost', sa.Float(), nullable=True),
        sa.Column('uptime_percentage', sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(['provider_id'], ['infrastructure_providers.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint('resource_type IN (\'vm\', \'container\', \'network\', \'storage\', \'database\', \'load_balancer\', \'security_group\')', name='ck_resource_type'),
        sa.CheckConstraint('status IN (\'running\', \'stopped\', \'terminated\', \'pending\', \'error\', \'unknown\')', name='ck_resource_status'),
        sa.CheckConstraint('health IN (\'healthy\', \'unhealthy\', \'unknown\')', name='ck_resource_health'),
        sa.CheckConstraint('cost_per_hour >= 0', name='ck_resource_cost_per_hour'),
        sa.CheckConstraint('total_cost >= 0', name='ck_resource_total_cost'),
        sa.CheckConstraint('uptime_percentage >= 0 AND uptime_percentage <= 100', name='ck_resource_uptime'),
        comment='Infrastructure resources across providers'
    )
    op.create_index(op.f('ix_infrastructure_resources_provider_id'), 'infrastructure_resources', ['provider_id'], unique=False)
    op.create_index(op.f('ix_infrastructure_resources_resource_type'), 'infrastructure_resources', ['resource_type'], unique=False)
    op.create_index(op.f('ix_infrastructure_resources_resource_id'), 'infrastructure_resources', ['resource_id'], unique=False)
    op.create_index(op.f('ix_infrastructure_resources_name'), 'infrastructure_resources', ['name'], unique=False)
    op.create_index(op.f('ix_infrastructure_resources_status'), 'infrastructure_resources', ['status'], unique=False)

    # Create ansible_webhooks table
    op.create_table(
        'ansible_webhooks',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('url', sa.String(length=1000), nullable=False),
        sa.Column('events', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('secret', sa.String(length=255), nullable=True),
        sa.Column('retry_count', sa.Integer(), nullable=False),
        sa.Column('timeout', sa.Integer(), nullable=False),
        sa.Column('custom_headers', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('payload_template', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('last_triggered', sa.DateTime(timezone=True), nullable=True),
        sa.Column('trigger_count', sa.Integer(), nullable=False),
        sa.Column('last_error', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint('retry_count >= 0 AND retry_count <= 10', name='ck_webhook_retry_count'),
        sa.CheckConstraint('timeout >= 5 AND timeout <= 300', name='ck_webhook_timeout'),
        sa.CheckConstraint('trigger_count >= 0', name='ck_webhook_trigger_count'),
        comment='Webhooks for Ansible event notifications'
    )
    op.create_index(op.f('ix_ansible_webhooks_name'), 'ansible_webhooks', ['name'], unique=False)
    op.create_index(op.f('ix_ansible_webhooks_is_active'), 'ansible_webhooks', ['is_active'], unique=False)

    # Create ansible_webhook_events table
    op.create_table(
        'ansible_webhook_events',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('webhook_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('event_type', sa.String(length=100), nullable=False),
        sa.Column('execution_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('attempt_count', sa.Integer(), nullable=False),
        sa.Column('response_status', sa.Integer(), nullable=True),
        sa.Column('response_body', sa.Text(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('delivered_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['execution_id'], ['ansible_executions.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['webhook_id'], ['ansible_webhooks.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint('status IN (\'pending\', \'delivered\', \'failed\')', name='ck_webhook_event_status'),
        sa.CheckConstraint('attempt_count >= 1 AND attempt_count <= 10', name='ck_webhook_event_attempts'),
        sa.CheckConstraint('response_status >= 100 AND response_status <= 599', name='ck_webhook_event_response'),
        comment='Webhook event delivery logs'
    )
    op.create_index(op.f('ix_ansible_webhook_events_webhook_id'), 'ansible_webhook_events', ['webhook_id'], unique=False)
    op.create_index(op.f('ix_ansible_webhook_events_event_type'), 'ansible_webhook_events', ['event_type'], unique=False)
    op.create_index(op.f('ix_ansible_webhook_events_execution_id'), 'ansible_webhook_events', ['execution_id'], unique=False)
    op.create_index(op.f('ix_ansible_webhook_events_status'), 'ansible_webhook_events', ['status'], unique=False)
    op.create_index(op.f('ix_ansible_webhook_events_created_at'), 'ansible_webhook_events', ['created_at'], unique=False)

    # Create ansible_roles table
    op.create_table(
        'ansible_roles',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('category', sa.String(length=100), nullable=False),
        sa.Column('tasks_content', sa.Text(), nullable=True),
        sa.Column('handlers_content', sa.Text(), nullable=True),
        sa.Column('vars_content', sa.Text(), nullable=True),
        sa.Column('defaults_content', sa.Text(), nullable=True),
        sa.Column('meta_content', sa.Text(), nullable=True),
        sa.Column('dependencies', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('galaxy_info', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('is_builtin', sa.Boolean(), nullable=False),
        sa.Column('version', sa.String(length=50), nullable=False),
        sa.Column('download_count', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint('download_count >= 0', name='ck_role_download_count'),
        comment='Ansible roles for reusable automation'
    )
    op.create_index(op.f('ix_ansible_roles_name'), 'ansible_roles', ['name'], unique=False)
    op.create_index(op.f('ix_ansible_roles_category'), 'ansible_roles', ['category'], unique=False)
    op.create_index(op.f('ix_ansible_roles_is_active'), 'ansible_roles', ['is_active'], unique=False)
    op.create_index(op.f('ix_ansible_roles_is_builtin'), 'ansible_roles', ['is_builtin'], unique=False)

    # Create infrastructure_metrics table
    op.create_table(
        'infrastructure_metrics',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('resource_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('execution_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('metric_type', sa.String(length=100), nullable=False),
        sa.Column('metric_name', sa.String(length=255), nullable=False),
        sa.Column('value', sa.Float(), nullable=False),
        sa.Column('unit', sa.String(length=50), nullable=True),
        sa.Column('tags', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False),
        sa.Column('collected_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['execution_id'], ['ansible_executions.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['resource_id'], ['infrastructure_resources.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint('metric_type IN (\'cpu\', \'memory\', \'network\', \'disk\', \'custom\')', name='ck_metric_type'),
        comment='Infrastructure performance and usage metrics'
    )
    op.create_index(op.f('ix_infrastructure_metrics_resource_id'), 'infrastructure_metrics', ['resource_id'], unique=False)
    op.create_index(op.f('ix_infrastructure_metrics_execution_id'), 'infrastructure_metrics', ['execution_id'], unique=False)
    op.create_index(op.f('ix_infrastructure_metrics_metric_type'), 'infrastructure_metrics', ['metric_type'], unique=False)
    op.create_index(op.f('ix_infrastructure_metrics_metric_name'), 'infrastructure_metrics', ['metric_name'], unique=False)
    op.create_index(op.f('ix_infrastructure_metrics_timestamp'), 'infrastructure_metrics', ['timestamp'], unique=False)

    # Create composite indexes for performance
    op.execute("CREATE INDEX idx_ansible_executions_playbook_status ON ansible_executions (playbook_id, status)")
    op.execute("CREATE INDEX idx_ansible_executions_created_status ON ansible_executions (created_at DESC, status)")
    op.execute("CREATE INDEX idx_infrastructure_resources_provider_status ON infrastructure_resources (provider_id, status)")
    op.execute("CREATE INDEX idx_infrastructure_metrics_resource_timestamp ON infrastructure_metrics (resource_id, timestamp DESC)")

    # Insert built-in Ansible roles
    op.execute("""
        INSERT INTO ansible_roles (name, description, category, tasks_content, meta_content, is_builtin, version)
        VALUES
            ('common', 'Common system tasks for all servers', 'system',
            '---
- name: Update package cache
  package:
    update_cache: yes
  when: ansible_os_family == "Debian"

- name: Install common packages
  package:
    name: "{{ common_packages }}"
    state: present',
            'galaxy_info:
  author: UPM.Plus
  description: Common role for basic server setup
  license: MIT
  min_ansible_version: 2.9',
            true, '1.0.0'),
            ('security', 'Security hardening tasks', 'security',
            '---
- name: Configure firewall
  ufw:
    state: enabled

- name: Disable root login
  lineinfile:
    path: /etc/ssh/sshd_config
    regexp: '^PermitRootLogin'
    line: 'PermitRootLogin no'
  notify: restart ssh',
            'galaxy_info:
  author: UPM.Plus
  description: Security hardening role
  license: MIT
  min_ansible_version: 2.9',
            true, '1.0.0'),
            ('docker', 'Docker installation and configuration', 'container',
            '---
- name: Install Docker
  package:
    name: docker-ce
    state: present

- name: Start Docker service
  service:
    name: docker
    state: started
    enabled: yes',
            'galaxy_info:
  author: UPM.Plus
  description: Docker installation role
  license: MIT
  min_ansible_version: 2.9',
            true, '1.0.0');
    """)


def downgrade() -> None:
    """Remove infrastructure automation tables"""

    # Drop composite indexes
    op.execute("DROP INDEX IF EXISTS idx_infrastructure_metrics_resource_timestamp")
    op.execute("DROP INDEX IF EXISTS idx_infrastructure_metrics_resource_type")
    op.execute("DROP INDEX IF EXISTS idx_infrastructure_resources_provider_status")
    op.execute("DROP INDEX IF EXISTS idx_ansible_executions_created_status")
    op.execute("DROP INDEX IF EXISTS idx_ansible_executions_playbook_status")

    # Drop indexes and tables
    op.drop_index(op.f('ix_infrastructure_metrics_timestamp'), table_name='infrastructure_metrics')
    op.drop_index(op.f('ix_infrastructure_metrics_metric_name'), table_name='infrastructure_metrics')
    op.drop_index(op.f('ix_infrastructure_metrics_metric_type'), table_name='infrastructure_metrics')
    op.drop_index(op.f('ix_infrastructure_metrics_execution_id'), table_name='infrastructure_metrics')
    op.drop_index(op.f('ix_infrastructure_metrics_resource_id'), table_name='infrastructure_metrics')
    op.drop_table('infrastructure_metrics')

    op.drop_index(op.f('ix_ansible_roles_is_builtin'), table_name='ansible_roles')
    op.drop_index(op.f('ix_ansible_roles_is_active'), table_name='ansible_roles')
    op.drop_index(op.f('ix_ansible_roles_category'), table_name='ansible_roles')
    op.drop_index(op.f('ix_ansible_roles_name'), table_name='ansible_roles')
    op.drop_table('ansible_roles')

    op.drop_index(op.f('ix_ansible_webhook_events_created_at'), table_name='ansible_webhook_events')
    op.drop_index(op.f('ix_ansible_webhook_events_status'), table_name='ansible_webhook_events')
    op.drop_index(op.f('ix_ansible_webhook_events_execution_id'), table_name='ansible_webhook_events')
    op.drop_index(op.f('ix_ansible_webhook_events_event_type'), table_name='ansible_webhook_events')
    op.drop_index(op.f('ix_ansible_webhook_events_webhook_id'), table_name='ansible_webhook_events')
    op.drop_table('ansible_webhook_events')

    op.drop_index(op.f('ix_ansible_webhooks_is_active'), table_name='ansible_webhooks')
    op.drop_index(op.f('ix_ansible_webhooks_name'), table_name='ansible_webhooks')
    op.drop_table('ansible_webhooks')

    op.drop_index(op.f('ix_infrastructure_resources_status'), table_name='infrastructure_resources')
    op.drop_index(op.f('ix_infrastructure_resources_name'), table_name='infrastructure_resources')
    op.drop_index(op.f('ix_infrastructure_resources_resource_id'), table_name='infrastructure_resources')
    op.drop_index(op.f('ix_infrastructure_resources_resource_type'), table_name='infrastructure_resources')
    op.drop_index(op.f('ix_infrastructure_resources_provider_id'), table_name='infrastructure_resources')
    op.drop_table('infrastructure_resources')

    op.drop_index(op.f('ix_infrastructure_providers_is_active'), table_name='infrastructure_providers')
    op.drop_index(op.f('ix_infrastructure_providers_provider_type'), table_name='infrastructure_providers')
    op.drop_index(op.f('ix_infrastructure_providers_name'), table_name='infrastructure_providers')
    op.drop_table('infrastructure_providers')

    op.drop_index(op.f('ix_scheduled_executions_next_run'), table_name='scheduled_executions')
    op.drop_index(op.f('ix_scheduled_executions_is_active'), table_name='scheduled_executions')
    op.drop_index(op.f('ix_scheduled_executions_inventory_id'), table_name='scheduled_executions')
    op.drop_index(op.f('ix_scheduled_executions_playbook_id'), table_name='scheduled_executions')
    op.drop_index(op.f('ix_scheduled_executions_name'), table_name='scheduled_executions')
    op.drop_table('scheduled_executions')

    op.drop_index(op.f('ix_ansible_executions_created_at'), table_name='ansible_executions')
    op.drop_index(op.f('ix_ansible_executions_status'), table_name='ansible_executions')
    op.drop_index(op.f('ix_ansible_executions_inventory_id'), table_name='ansible_executions')
    op.drop_index(op.f('ix_ansible_executions_playbook_id'), table_name='ansible_executions')
    op.drop_table('ansible_executions')

    op.drop_index(op.f('ix_ansible_inventories_is_active'), table_name='ansible_inventories')
    op.drop_index(op.f('ix_ansible_inventories_inventory_type'), table_name='ansible_inventories')
    op.drop_index(op.f('ix_ansible_inventories_name'), table_name='ansible_inventories')
    op.drop_table('ansible_inventories')

    op.drop_index(op.f('ix_ansible_playbooks_is_active'), table_name='ansible_playbooks')
    op.drop_index(op.f('ix_ansible_playbooks_category'), table_name='ansible_playbooks')
    op.drop_index(op.f('ix_ansible_playbooks_name'), table_name='ansible_playbooks')
    op.drop_table('ansible_playbooks')