ALTER TABLE compliance_cases DROP COLUMN IF EXISTS due_at;
ALTER TABLE compliance_cases DROP COLUMN IF EXISTS escalated_at;
ALTER TABLE compliance_cases DROP COLUMN IF EXISTS sla_breached;
ALTER TABLE compliance_cases DROP COLUMN IF EXISTS assigned_to;
ALTER TABLE compliance_cases DROP COLUMN IF EXISTS priority;
