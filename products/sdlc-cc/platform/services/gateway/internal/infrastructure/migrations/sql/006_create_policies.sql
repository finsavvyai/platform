-- Migration: 006_create_policies
-- Description: Create OPA policy storage and evaluation tracking

CREATE TABLE IF NOT EXISTS policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    policy_type VARCHAR(50) NOT NULL,
    rego_code TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    priority INTEGER NOT NULL DEFAULT 0,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(tenant_id, name, version)
);

CREATE INDEX idx_policies_tenant_id ON policies(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_policies_type ON policies(tenant_id, policy_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_policies_status ON policies(tenant_id, status) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS policy_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    policy_id UUID NOT NULL REFERENCES policies(id),
    user_id UUID REFERENCES users(id),
    request_id VARCHAR(255),
    decision VARCHAR(20) NOT NULL,
    input JSONB NOT NULL DEFAULT '{}',
    output JSONB NOT NULL DEFAULT '{}',
    duration_ms DOUBLE PRECISION,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_policy_evaluations_tenant_id ON policy_evaluations(tenant_id, created_at DESC);
CREATE INDEX idx_policy_evaluations_policy_id ON policy_evaluations(policy_id, created_at DESC);
CREATE INDEX idx_policy_evaluations_decision ON policy_evaluations(tenant_id, decision);

ALTER TABLE policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policies ON policies
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_policy_evaluations ON policy_evaluations
    FOR SELECT
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
