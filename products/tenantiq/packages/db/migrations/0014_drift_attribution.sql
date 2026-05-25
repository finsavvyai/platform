-- Drift change attribution.
--
-- Adds three columns to config_drifts so each detected change can be
-- cross-referenced against the M365 audit log entry that caused it.
--
-- attributed_to   = userPrincipalName / appDisplayName from auditLogs/directoryAudits
-- attributed_at   = activityDateTime of the matched audit entry (ISO 8601)
-- audit_log_id    = directoryAudit.id; lets the UI deep-link to the original event
--
-- Attribution is best-effort. M365 directoryAudits typically lag 30–60 minutes,
-- so a freshly-detected drift may have these columns NULL until the next
-- attribution sweep runs.

ALTER TABLE config_drifts ADD COLUMN attributed_to TEXT;
ALTER TABLE config_drifts ADD COLUMN attributed_at TEXT;
ALTER TABLE config_drifts ADD COLUMN audit_log_id TEXT;

CREATE INDEX IF NOT EXISTS idx_config_drifts_audit_log ON config_drifts(audit_log_id);
