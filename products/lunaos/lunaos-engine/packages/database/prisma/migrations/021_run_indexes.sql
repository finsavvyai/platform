-- Migration: 021_run_indexes
-- Purpose: Add hot-path indexes for runs / run_steps / run_logs equivalent tables
-- Targets: agent_executions (runs), task_executions (run_steps),
--          health_checks / agent_health_check_history (run_logs),
--          agent_status_transitions, resource_usage_history, tasks
-- Compatible with: PostgreSQL and SQLite (Cloudflare D1)
-- Author: agent-1a-2 (race branch)

-- ----------------------------------------------------------------------------
-- agent_executions (run-level)
-- Common queries:
--   1) WHERE "agentId" = ? AND status = ? ORDER BY "createdAt" DESC
--   2) WHERE "taskId"  = ? AND status = ?
--   3) WHERE status   = ? ORDER BY "createdAt" DESC
--   4) WHERE "instanceId" = ?
--   5) Time-window scans: WHERE "startTime" BETWEEN ? AND ?
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "idx_agent_executions_agent_status_created"
    ON "agent_executions" ("agentId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "idx_agent_executions_task_status"
    ON "agent_executions" ("taskId", "status");
CREATE INDEX IF NOT EXISTS "idx_agent_executions_status_created"
    ON "agent_executions" ("status", "createdAt");
CREATE INDEX IF NOT EXISTS "idx_agent_executions_instance"
    ON "agent_executions" ("instanceId");
CREATE INDEX IF NOT EXISTS "idx_agent_executions_time_window"
    ON "agent_executions" ("startTime", "endTime");

-- ----------------------------------------------------------------------------
-- task_executions (run-step level)
-- Common queries:
--   1) WHERE "taskId" = ? ORDER BY attempt ASC
--   2) WHERE "taskId" = ? AND status = ? ORDER BY "createdAt" DESC
--   3) WHERE status = ? ORDER BY "createdAt" DESC  (queue scans)
--   4) Time-window: WHERE "startTime" BETWEEN ? AND ?
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "idx_task_executions_task_attempt"
    ON "task_executions" ("taskId", "attempt");
CREATE INDEX IF NOT EXISTS "idx_task_executions_task_status_created"
    ON "task_executions" ("taskId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "idx_task_executions_status_created"
    ON "task_executions" ("status", "createdAt");
CREATE INDEX IF NOT EXISTS "idx_task_executions_time_window"
    ON "task_executions" ("startTime", "endTime");

-- ----------------------------------------------------------------------------
-- health_checks (run-log style: agent timeline)
-- Common queries:
--   1) WHERE "agentId" = ? ORDER BY timestamp DESC
--   2) WHERE status = ? ORDER BY timestamp DESC  (alerting scans)
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "idx_health_checks_agent_ts"
    ON "health_checks" ("agentId", "timestamp");
CREATE INDEX IF NOT EXISTS "idx_health_checks_status_ts"
    ON "health_checks" ("status", "timestamp");

-- ----------------------------------------------------------------------------
-- agent_status_transitions (run-step state changes)
-- Common queries:
--   1) WHERE "agentId" = ? ORDER BY timestamp DESC
--   2) WHERE "executionId" = ? ORDER BY timestamp ASC
--   3) WHERE "toStatus" = ? ORDER BY timestamp DESC
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "idx_agent_status_transitions_agent_ts"
    ON "agent_status_transitions" ("agentId", "timestamp");
CREATE INDEX IF NOT EXISTS "idx_agent_status_transitions_exec_ts"
    ON "agent_status_transitions" ("executionId", "timestamp");
CREATE INDEX IF NOT EXISTS "idx_agent_status_transitions_to_status_ts"
    ON "agent_status_transitions" ("toStatus", "timestamp");

-- ----------------------------------------------------------------------------
-- agent_health_check_history (detailed run-log style)
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "idx_agent_health_history_agent_ts"
    ON "agent_health_check_history" ("agentId", "timestamp");
CREATE INDEX IF NOT EXISTS "idx_agent_health_history_exec_ts"
    ON "agent_health_check_history" ("executionId", "timestamp");
CREATE INDEX IF NOT EXISTS "idx_agent_health_history_status_ts"
    ON "agent_health_check_history" ("status", "timestamp");

-- ----------------------------------------------------------------------------
-- resource_usage_history (run-resource time series)
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "idx_resource_usage_history_agent_ts"
    ON "resource_usage_history" ("agentId", "timestamp");

-- ----------------------------------------------------------------------------
-- tasks (workflow scoping by tenant/project)
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "idx_tasks_project_created"
    ON "tasks" ("projectId", "createdAt");
CREATE INDEX IF NOT EXISTS "idx_tasks_project_status_created"
    ON "tasks" ("projectId", "status", "createdAt");
