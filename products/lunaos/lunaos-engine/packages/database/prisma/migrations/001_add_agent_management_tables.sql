-- Migration: Add Agent Management Tables
-- Version: 20241102000000
-- Description: Add comprehensive agent management tables including versions, executions, and enhanced monitoring

-- Add Agent Version table for version management and rollback
CREATE TABLE IF NOT EXISTS agent_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version VARCHAR(255) NOT NULL,
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    config JSONB NOT NULL,
    changelog TEXT,
    is_active BOOLEAN DEFAULT false,
    deployment_status VARCHAR(50) DEFAULT 'draft',
    deployment_metadata JSONB,
    is_stable BOOLEAN DEFAULT false,
    is_production_ready BOOLEAN DEFAULT false,
    backup_path VARCHAR(1000),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deployed_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT agent_versions_version_agent_id_unique UNIQUE(version, agent_id)
);

-- Add Agent Execution table for detailed execution tracking
CREATE TABLE IF NOT EXISTS agent_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    instance_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    duration INTEGER, -- Duration in milliseconds
    result JSONB,
    error TEXT,
    logs TEXT,
    metrics JSONB,
    resource_usage JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Performance metrics
    cpu_time INTEGER DEFAULT 0,
    memory_usage INTEGER DEFAULT 0,
    disk_usage INTEGER DEFAULT 0,
    network_io INTEGER DEFAULT 0,
    tokens_used INTEGER DEFAULT 0,
    requests_processed INTEGER DEFAULT 0,
    errors_encountered INTEGER DEFAULT 0
);

-- Add Agent Lifecycle State table for state tracking
CREATE TABLE IF NOT EXISTS agent_lifecycle_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL,
    pid INTEGER,
    start_time TIMESTAMP WITH TIME ZONE,
    last_health_check TIMESTAMP WITH TIME ZONE,
    restart_count INTEGER DEFAULT 0,
    max_restarts INTEGER DEFAULT 3,
    restart_delay INTEGER DEFAULT 5000,
    is_shutting_down BOOLEAN DEFAULT false,
    shutdown_timeout_id VARCHAR(255),
    startup_timeout_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT agent_lifecycle_states_agent_id_unique UNIQUE(agent_id)
);

-- Add Agent Status Transitions table for audit trail
CREATE TABLE IF NOT EXISTS agent_status_transitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    from_status VARCHAR(50),
    to_status VARCHAR(50) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reason TEXT,
    triggered_by VARCHAR(255) NOT NULL DEFAULT 'system',
    metadata JSONB,
    execution_id UUID REFERENCES agent_executions(id) ON DELETE SET NULL
);

-- Add Agent Health Check History table for detailed health tracking
CREATE TABLE IF NOT EXISTS agent_health_check_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    check_name VARCHAR(255) NOT NULL,
    check_type VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL,
    message TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    timeout INTEGER NOT NULL,
    interval INTEGER DEFAULT 0,
    details JSONB,
    execution_id UUID REFERENCES agent_executions(id) ON DELETE SET NULL
);

-- Add Resource Usage History table for resource tracking
CREATE TABLE IF NOT EXISTS resource_usage_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- CPU metrics
    cpu_usage DECIMAL(5,2),
    cpu_cores INTEGER,
    cpu_load_1m DECIMAL(5,2),
    cpu_load_5m DECIMAL(5,2),
    cpu_load_15m DECIMAL(5,2),

    -- Memory metrics
    memory_used INTEGER,
    memory_total INTEGER,
    memory_percentage DECIMAL(5,2),
    memory_heap_used INTEGER,
    memory_heap_total INTEGER,

    -- Disk metrics
    disk_used INTEGER,
    disk_total INTEGER,
    disk_percentage DECIMAL(5,2),
    disk_read_ops INTEGER,
    disk_write_ops INTEGER,

    -- Network metrics
    network_bytes_in BIGINT,
    network_bytes_out BIGINT,
    network_connections INTEGER,
    network_requests INTEGER,

    -- Task metrics
    tasks_running INTEGER,
    tasks_queued INTEGER,
    tasks_completed INTEGER,
    tasks_failed INTEGER,
    tasks_avg_duration INTEGER,

    -- Token metrics
    tokens_used INTEGER,
    tokens_limit INTEGER,
    tokens_remaining INTEGER,
    tokens_cost DECIMAL(10,6),

    -- Performance metrics
    performance_response_time INTEGER,
    performance_throughput INTEGER,
    performance_error_rate DECIMAL(5,4)
);

-- Add Agent Metrics Summary table for performance analytics
CREATE TABLE IF NOT EXISTS agent_metrics_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    period_type VARCHAR(20) NOT NULL, -- 'hourly', 'daily', 'weekly', 'monthly'
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,

    -- Aggregated metrics
    total_executions INTEGER DEFAULT 0,
    successful_executions INTEGER DEFAULT 0,
    failed_executions INTEGER DEFAULT 0,
    success_rate DECIMAL(5,4) DEFAULT 1.0,

    avg_duration INTEGER DEFAULT 0,
    max_duration INTEGER DEFAULT 0,
    min_duration INTEGER DEFAULT 0,

    avg_cpu_usage DECIMAL(5,2) DEFAULT 0,
    max_cpu_usage DECIMAL(5,2) DEFAULT 0,
    avg_memory_usage INTEGER DEFAULT 0,
    max_memory_usage INTEGER DEFAULT 0,

    total_tokens_used INTEGER DEFAULT 0,
    total_cost DECIMAL(10,6) DEFAULT 0,

    uptime_seconds INTEGER DEFAULT 0,
    downtime_seconds INTEGER DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT agent_metrics_summary_agent_period_unique UNIQUE(agent_id, period_type, period_start)
);

-- Add Agent Configuration History table for configuration tracking
CREATE TABLE IF NOT EXISTS agent_config_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    version VARCHAR(255) NOT NULL,
    config JSONB NOT NULL,
    changes JSONB, -- Array of changed fields
    changed_by VARCHAR(255) NOT NULL DEFAULT 'system',
    change_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add Agent Dependency Management table
CREATE TABLE IF NOT EXISTS agent_dependencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    dependency_name VARCHAR(255) NOT NULL,
    dependency_type VARCHAR(50) NOT NULL, -- 'agent', 'service', 'package', 'external'
    dependency_version VARCHAR(100),
    is_required BOOLEAN DEFAULT true,
    dependency_config JSONB,
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'resolved', 'failed'
    last_checked TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT agent_dependencies_agent_dependency_unique UNIQUE(agent_id, dependency_name, dependency_type)
);

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_agent_versions_agent_id ON agent_versions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_versions_created_at ON agent_versions(created_at);
CREATE INDEX IF NOT EXISTS idx_agent_versions_deployment_status ON agent_versions(deployment_status);

CREATE INDEX IF NOT EXISTS idx_agent_executions_agent_id ON agent_executions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_executions_status ON agent_executions(status);
CREATE INDEX IF NOT EXISTS idx_agent_executions_start_time ON agent_executions(start_time);
CREATE INDEX IF NOT EXISTS idx_agent_executions_duration ON agent_executions(duration);

CREATE INDEX IF NOT EXISTS idx_agent_lifecycle_states_agent_id ON agent_lifecycle_states(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_lifecycle_states_status ON agent_lifecycle_states(status);

CREATE INDEX IF NOT EXISTS idx_agent_status_transitions_agent_id ON agent_status_transitions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_status_transitions_timestamp ON agent_status_transitions(timestamp);

CREATE INDEX IF NOT EXISTS idx_agent_health_check_history_agent_id ON agent_health_check_history(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_health_check_history_timestamp ON agent_health_check_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_agent_health_check_history_status ON agent_health_check_history(status);

CREATE INDEX IF NOT EXISTS idx_resource_usage_history_agent_id ON resource_usage_history(agent_id);
CREATE INDEX IF NOT EXISTS idx_resource_usage_history_timestamp ON resource_usage_history(timestamp);

CREATE INDEX IF NOT EXISTS idx_agent_metrics_summary_agent_id ON agent_metrics_summary(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_metrics_summary_period_start ON agent_metrics_summary(period_start);
CREATE INDEX IF NOT EXISTS idx_agent_metrics_summary_period_type ON agent_metrics_summary(period_type);

CREATE INDEX IF NOT EXISTS idx_agent_config_history_agent_id ON agent_config_history(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_config_history_created_at ON agent_config_history(created_at);

CREATE INDEX IF NOT EXISTS idx_agent_dependencies_agent_id ON agent_dependencies(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_dependencies_status ON agent_dependencies(status);
CREATE INDEX IF NOT EXISTS idx_agent_dependencies_type ON agent_dependencies(dependency_type);

-- Add comments for documentation
COMMENT ON TABLE agent_versions IS 'Stores version history for agents with deployment and rollback capabilities';
COMMENT ON TABLE agent_executions IS 'Tracks detailed execution information for agent runs';
COMMENT ON TABLE agent_lifecycle_states IS 'Maintains current state information for running agents';
COMMENT ON TABLE agent_status_transitions IS 'Audit trail of all status changes for agents';
COMMENT ON TABLE agent_health_check_history IS 'Historical health check results for agents';
COMMENT ON TABLE resource_usage_history IS 'Time-series resource usage data for agents';
COMMENT ON TABLE agent_metrics_summary IS 'Aggregated performance metrics for analytics';
COMMENT ON TABLE agent_config_history IS 'Historical configuration changes for agents';
COMMENT ON TABLE agent_dependencies IS 'Manages agent dependencies and their resolution status';

-- ROLLBACK
-- Drop tables in reverse order of creation
DROP TABLE IF EXISTS agent_dependencies;
DROP TABLE IF EXISTS agent_config_history;
DROP TABLE IF EXISTS agent_metrics_summary;
DROP TABLE IF EXISTS resource_usage_history;
DROP TABLE IF EXISTS agent_health_check_history;
DROP TABLE IF EXISTS agent_status_transitions;
DROP TABLE IF EXISTS agent_lifecycle_states;
DROP TABLE IF EXISTS agent_executions;
DROP TABLE IF EXISTS agent_versions;
