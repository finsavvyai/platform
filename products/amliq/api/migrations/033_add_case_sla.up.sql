ALTER TABLE compliance_cases ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ;
ALTER TABLE compliance_cases ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ;
ALTER TABLE compliance_cases ADD COLUMN IF NOT EXISTS sla_breached BOOLEAN DEFAULT FALSE;
ALTER TABLE compliance_cases ADD COLUMN IF NOT EXISTS assigned_to TEXT;
ALTER TABLE compliance_cases ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium';

CREATE INDEX IF NOT EXISTS idx_cases_due ON compliance_cases(due_at) WHERE due_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cases_assigned ON compliance_cases(assigned_to) WHERE assigned_to IS NOT NULL;
