CREATE TABLE IF NOT EXISTS country_risk_scores (
    country_code CHAR(2) PRIMARY KEY,
    country_name TEXT NOT NULL,
    risk_score NUMERIC(4,3) NOT NULL CHECK (risk_score >= 0 AND risk_score <= 1),
    risk_level TEXT NOT NULL,
    sources TEXT[] NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS country_risk_overrides (
    tenant_id TEXT NOT NULL,
    country_code CHAR(2) NOT NULL,
    risk_score NUMERIC(4,3) NOT NULL CHECK (risk_score >= 0 AND risk_score <= 1),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, country_code)
);

CREATE INDEX idx_country_risk_level ON country_risk_scores(risk_level);
CREATE INDEX idx_country_risk_updated ON country_risk_scores(updated_at);
CREATE INDEX idx_country_risk_overrides_tenant ON country_risk_overrides(tenant_id);
