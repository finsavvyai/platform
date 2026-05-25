CREATE TABLE security_logs (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    method TEXT NOT NULL,
    path TEXT NOT NULL,
    tenant_id TEXT,
    ip_address TEXT,
    status_code INT,
    duration_ms INT,
    user_agent TEXT
);

CREATE INDEX idx_seclog_timestamp ON security_logs(timestamp);
CREATE INDEX idx_seclog_tenant ON security_logs(tenant_id);
CREATE INDEX idx_seclog_ip ON security_logs(ip_address);
