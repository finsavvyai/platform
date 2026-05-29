# Security Implementation Guide - SDLC.ai Database

## Overview

This document provides a comprehensive overview of the security implementation in the SDLC.ai database system. The security model is designed around the principles of zero-trust architecture, defense in depth, and comprehensive auditability.

## Security Architecture

### 1. Multi-Layer Security Model

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                        │
├─────────────────────────────────────────────────────────────┤
│                    Connection Security                      │
│  • TLS/SSL Encryption                                      │
│  • Connection Pooling (pgBouncer)                          │
│  • IP Whitelisting                                         │
├─────────────────────────────────────────────────────────────┤
│                   Authentication Layer                      │
│  • Multi-Factor Authentication (MFA)                        │
│  • API Key Management                                      │
│  • Session Management                                      │
├─────────────────────────────────────────────────────────────┤
│                 Authorization Layer                         │
│  • Row-Level Security (RLS)                               │
│  • Role-Based Access Control (RBAC)                       │
│  • Attribute-Based Access Control (ABAC)                   │
├─────────────────────────────────────────────────────────────┤
│                    Data Layer                               │
│  • Encryption at Rest                                      │
│  • Encryption in Transit                                   │
│  • Data Masking                                           │
├─────────────────────────────────────────────────────────────┤
│                    Audit Layer                              │
│  • Comprehensive Logging                                   │
│  • Real-time Monitoring                                    │
│  • Compliance Reporting                                    │
└─────────────────────────────────────────────────────────────┘
```

## 1. Row-Level Security (RLS) Implementation

### Tenant Isolation

All tenant-scoped tables implement strict tenant isolation:

```sql
-- Enable RLS on all tenant tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE policies ENABLE ROW LEVEL SECURITY;
-- ... and all other tenant tables

-- Tenant isolation policy
CREATE POLICY tenant_isolation ON documents
    FOR ALL TO app_user
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);
```

### Context Management

```sql
-- Set security context for user session
CREATE OR REPLACE FUNCTION set_tenant_context(tenant_uuid UUID, user_uuid UUID, user_role TEXT)
RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.current_tenant_id', tenant_uuid::TEXT, true);
    PERFORM set_config('app.current_user_id', user_uuid::TEXT, true);
    PERFORM set_config('app.current_user_role', user_role, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Clear context on logout
CREATE OR REPLACE FUNCTION clear_tenant_context()
RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.current_tenant_id', '', true);
    PERFORM set_config('app.current_user_id', '', true);
    PERFORM set_config('app.current_user_role', '', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Role-Based Access Control

**Hierarchy of Access:**

1. **Super Admin**: System-wide access to all tenants
2. **Tenant Admin**: Full access within their tenant
3. **Data Scientist**: Access to documents and models within tenant
4. **Analyst**: Read-only access to analytics and reports
5. **Viewer**: Basic read access within tenant
6. **User**: Standard user access to own resources

```sql
-- Super admin policy (can access any tenant)
CREATE POLICY admin_full_access ON tenants FOR ALL TO app_user
    USING (current_setting('app.current_user_role', true) IN ('super_admin'));

-- Tenant admin policy (can access all within tenant)
CREATE POLICY tenant_admin_full_access ON users FOR ALL TO app_user
    USING (
        tenant_id = current_setting('app.current_tenant_id', true)::UUID
        AND current_setting('app.current_user_role', true) IN ('tenant_admin')
    );

-- User self-access policy
CREATE POLICY user_self_access ON users
    FOR SELECT TO app_user
    USING (
        tenant_id = current_setting('app.current_tenant_id', true)::UUID
        AND id = current_setting('app.current_user_id', true)::UUID
    );
```

## 2. Data Encryption

### Encryption at Rest

**Column-Level Encryption:**
```sql
-- Encryption functions
CREATE OR REPLACE FUNCTION encrypt_sensitive_data(data TEXT, key_id TEXT)
RETURNS BYTEA AS $$
BEGIN
    RETURN pgp_sym_encrypt(data, key_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrypt_sensitive_data(encrypted_data BYTEA, key_id TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN pgp_sym_decrypt(encrypted_data, key_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Document Storage Encryption:**
```sql
CREATE TABLE documents (
    -- ... other fields
    encryption_key_id VARCHAR(255),
    encryption_algorithm encryption_algorithm DEFAULT 'aes-256-gcm',
    -- ... other fields
);
```

### Encryption in Transit

**Database Connection Security:**
- Force SSL connections: `sslmode=require`
- Certificate validation
- TLS 1.2+ minimum version

**API Communication:**
- HTTPS only for all endpoints
- Certificate pinning for sensitive operations
- Short-lived tokens for API access

## 3. Authentication & Authorization

### Multi-Factor Authentication (MFA)

```sql
CREATE TABLE users (
    -- ... other fields
    mfa_enabled BOOLEAN DEFAULT false,
    mfa_secret BYTEA,
    -- ... other fields
);
```

**MFA Implementation:**
- TOTP (Time-based One-Time Password) support
- Backup codes for recovery
- SMS/Email verification options
- Hardware token support (YubiKey, etc.)

### API Key Management

```sql
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    key_hash VARCHAR(255) UNIQUE NOT NULL,
    key_prefix VARCHAR(20) NOT NULL,
    permissions JSONB NOT NULL DEFAULT '{}',
    rate_limit INTEGER NOT NULL DEFAULT 1000,
    rate_window INTEGER NOT NULL DEFAULT 3600,
    expires_at TIMESTAMPTZ,
    allowed_origins JSONB NOT NULL DEFAULT '[]',
    scopes JSONB NOT NULL DEFAULT '[]',
    -- ... security fields
);
```

**API Key Security Features:**
- SHA-256 hashing of keys
- Prefix-based identification
- Rate limiting per key
- Expiration time enforcement
- Origin restrictions
- Scope-based permissions

### Session Management

```sql
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    refresh_token VARCHAR(255) UNIQUE,
    ip_address INET,
    user_agent TEXT,
    device_fingerprint VARCHAR(255),
    expires_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT true,
    security_flags JSONB NOT NULL DEFAULT '{}',
    -- ... tracking fields
);
```

**Session Security Features:**
- Device fingerprinting
- IP address tracking
- Automatic expiration
- Secure token generation
- Session invalidation on security events

## 4. Audit & Compliance

### Comprehensive Audit Logging

```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action audit_action NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id UUID,
    details JSONB NOT NULL DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    risk_level VARCHAR(20) DEFAULT 'low',
    correlation_id UUID,
    compliance_tags JSONB NOT NULL DEFAULT '[]',
    -- ... additional fields
);
```

**Automated Audit Triggers:**
```sql
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
    -- Log all data modifications
    PERFORM log_audit_event(
        NEW.tenant_id,
        current_setting('app.current_user_id', true)::UUID,
        CASE TG_OP
            WHEN 'INSERT' THEN 'create'
            WHEN 'UPDATE' THEN 'update'
            WHEN 'DELETE' THEN 'delete'
        END,
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        jsonb_build_object('operation', TG_OP, 'data', to_jsonb(COALESCE(NEW, OLD)))
    );
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Compliance Features

**GDPR Compliance:**
- Right to access: Complete data export
- Right to rectification: Data correction capabilities
- Right to erasure: Secure data deletion
- Right to portability: Data export in standard formats
- Privacy by design: Built-in data minimization

**HIPAA Compliance:**
- PHI identification and labeling
- Access logging and monitoring
- Data encryption requirements
- Business associate agreements support
- Audit trail maintenance

**SOC 2 Compliance:**
- Security controls implementation
- Availability monitoring
- Processing integrity validation
- Confidentiality measures
- Privacy controls

## 5. Data Classification & Protection

### Data Classification Levels

```sql
CREATE TYPE data_classification AS ENUM (
    'public',        -- No restrictions
    'internal',      -- Company internal only
    'confidential',  -- Sensitive company data
    'restricted'     -- Highly sensitive, need-to-know basis
);
```

**Classification Implementation:**
```sql
CREATE TABLE documents (
    -- ... other fields
    classification data_classification NOT NULL DEFAULT 'internal',
    access_level VARCHAR(50) NOT NULL DEFAULT 'private',
    -- ... other fields
);
```

### Data Loss Prevention (DLP)

```sql
CREATE TABLE dlp_scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    content_id UUID NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    scan_results JSONB NOT NULL,
    risk_score DECIMAL(3, 2) NOT NULL CHECK (risk_score >= 0 AND risk_score <= 1),
    action_taken VARCHAR(100) NOT NULL,
    scan_duration_ms INTEGER NOT NULL,
    pii_entities JSONB NOT NULL DEFAULT '[]',
    scan_confidence DECIMAL(3, 2),
    -- ... additional fields
);
```

**DLP Integration:**
- Real-time content scanning
- PII (Personally Identifiable Information) detection
- Custom policy enforcement
- Automated redaction capabilities
- Risk scoring and handling

## 6. Advanced Security Features

### Attribute-Based Access Control (ABAC)

```sql
-- Dynamic permission checking based on attributes
CREATE OR REPLACE FUNCTION check_document_access(document_uuid UUID, tenant_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    current_tenant UUID;
    current_user UUID;
    current_role TEXT;
    doc_classification data_classification;
    user_clearance_level data_classification;
    doc_access_level VARCHAR(50);
BEGIN
    current_tenant := current_setting('app.current_tenant_id', true)::UUID;
    current_user := current_setting('app.current_user_id', true)::UUID;
    current_role := current_setting('app.current_user_role', true);

    -- Get document attributes
    SELECT classification, access_level INTO doc_classification, doc_access_level
    FROM documents
    WHERE id = document_uuid AND tenant_id = tenant_uuid;

    IF NOT FOUND THEN
        RETURN false;
    END IF;

    -- Super admin bypass
    IF current_role = 'super_admin' THEN
        RETURN true;
    END IF;

    -- Tenant access check
    IF current_tenant != tenant_uuid THEN
        RETURN false;
    END IF;

    -- Classification-based access
    SELECT clearance_level INTO user_clearance_level
    FROM users
    WHERE id = current_user;

    IF user_clearance_level < doc_classification THEN
        RETURN false;
    END IF;

    -- Role-based additional checks
    IF current_role = 'viewer' AND doc_access_level = 'restricted' THEN
        RETURN false;
    END IF;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Security Event Monitoring

```sql
-- Real-time security monitoring view
CREATE VIEW security_dashboard AS
SELECT 
    'failed_logins' as event_type,
    COUNT(*) as event_count,
    MAX(created_at) as last_occurrence,
    array_agg(DISTINCT ip_address) as source_ips
FROM audit_logs 
WHERE action = 'login' 
AND details->>'success' = 'false'
AND created_at > NOW() - INTERVAL '24 hours'

UNION ALL

SELECT 
    'access_denied' as event_type,
    COUNT(*) as event_count,
    MAX(created_at) as last_occurrence,
    array_agg(DISTINCT ip_address) as source_ips
FROM audit_logs 
WHERE action = 'access_denied'
AND created_at > NOW() - INTERVAL '24 hours'

UNION ALL

SELECT 
    'high_risk_operations' as event_type,
    COUNT(*) as event_count,
    MAX(created_at) as last_occurrence,
    array_agg(DISTINCT user_id) as affected_users
FROM audit_logs 
WHERE risk_level IN ('high', 'critical')
AND created_at > NOW() - INTERVAL '24 hours';
```

### Automated Security Responses

```sql
-- Automated security response function
CREATE OR REPLACE FUNCTION security_response_handler()
RETURNS JSONB AS $$
DECLARE
    response_actions JSONB := '[]'::JSONB;
    failed_login_count INTEGER;
    suspicious_access_count INTEGER;
BEGIN
    -- Check for repeated failed logins
    SELECT COUNT(*) INTO failed_login_count
    FROM audit_logs 
    WHERE action = 'login' 
    AND details->>'success' = 'false'
    AND created_at > NOW() - INTERVAL '1 hour';

    IF failed_login_count > 10 THEN
        -- Implement account lockout or rate limiting
        response_actions := response_actions || jsonb_build_object(
            'action', 'account_lockout_triggered',
            'reason', 'excessive_failed_logins',
            'count', failed_login_count,
            'timestamp', NOW()
        );
    END IF;

    -- Check for suspicious access patterns
    SELECT COUNT(*) INTO suspicious_access_count
    FROM audit_logs 
    WHERE action = 'access_denied'
    AND created_at > NOW() - INTERVAL '1 hour';

    IF suspicious_access_count > 20 THEN
        -- Implement IP blocking or alerting
        response_actions := response_actions || jsonb_build_object(
            'action', 'suspicious_activity_detected',
            'reason', 'excessive_access_denials',
            'count', suspicious_access_count,
            'timestamp', NOW()
        );
    END IF;

    RETURN jsonb_build_object(
        'responses', response_actions,
        'timestamp', NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## 7. Performance & Security Optimization

### Security-Aware Query Optimization

```sql
-- Efficient security checks
CREATE INDEX idx_users_tenant_role_active ON users(tenant_id, role, is_active) 
WHERE is_active = true;

-- Optimized audit log queries
CREATE INDEX idx_audit_logs_tenant_action_risk ON audit_logs(tenant_id, action, risk_level, created_at);

-- Vector search with security filtering
CREATE OR REPLACE FUNCTION secure_vector_search(
    query_vector VECTOR,
    tenant_id_param UUID,
    user_id_param UUID,
    similarity_threshold REAL DEFAULT 0.7,
    max_results INTEGER DEFAULT 10
) RETURNS TABLE(...) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dc.id,
        dc.document_id,
        dc.content,
        1 - (dc.embedding <=> query_vector) as similarity_score
    FROM document_chunks dc
    JOIN documents d ON dc.document_id = d.id
    WHERE d.tenant_id = tenant_id_param
    AND (d.created_by = user_id_param OR d.access_level = 'public')
    AND d.classification <= (SELECT clearance_level FROM users WHERE id = user_id_param)
    AND dc.embedding IS NOT NULL
    AND 1 - (dc.embedding <=> query_vector) >= similarity_threshold
    ORDER BY dc.embedding <=> query_vector
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Connection Security

**pgBouncer Configuration for Security:**
```ini
[pgbouncer]
# Security settings
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt
server_reset_query = DISCARD ALL
ignore_startup_parameters = extra_float_digits

# TLS settings
client_tls_sslmode = require
client_tls_ca_file = /etc/ssl/certs/ca-certificates.crt
client_tls_key_file = /etc/ssl/private/pgbouncer.key
client_tls_cert_file = /etc/ssl/certs/pgbouncer.crt

# Connection limits
max_client_conn = 100
default_pool_size = 20
min_pool_size = 5
```

## 8. Security Best Practices

### Database Configuration

**Secure PostgreSQL Settings:**
```sql
-- Require SSL for all connections
ALTER SYSTEM SET ssl = on;
ALTER SYSTEM SET ssl_cert_file = '/etc/ssl/certs/server.crt';
ALTER SYSTEM SET ssl_key_file = '/etc/ssl/private/server.key';

-- Password security
ALTER SYSTEM SET password_encryption = 'scram-sha-256';

-- Connection security
ALTER SYSTEM SET log_connections = on;
ALTER SYSTEM SET log_disconnections = on;
ALTER SYSTEM SET log_hostname = on;
```

### Application Security

**Secure Connection Examples:**
```python
# Python - Secure database connection
import psycopg2
from psycopg2.extras import execute_values

conn = psycopg2.connect(
    host="localhost",
    port="6432",
    database="sdlc",
    user="app_user",
    password="secure_password",
    sslmode="require",
    sslrootcert="/path/to/ca.crt"
)

# Set security context
with conn.cursor() as cur:
    cur.execute("SELECT set_tenant_context(%s, %s, %s)", 
               (tenant_id, user_id, user_role))
    conn.commit()
```

### Regular Security Maintenance

**Daily Security Tasks:**
```sql
-- Review security events
SELECT * FROM security_dashboard;

-- Check for unusual access patterns
SELECT * FROM audit_logs 
WHERE risk_level = 'high' 
AND created_at > NOW() - INTERVAL '24 hours';

-- Review failed login attempts
SELECT 
    ip_address,
    COUNT(*) as failed_attempts,
    array_agg(DISTINCT email) as attempted_accounts
FROM audit_logs 
WHERE action = 'login' 
AND details->>'success' = 'false'
AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY ip_address
HAVING COUNT(*) > 5;
```

**Weekly Security Reviews:**
```sql
-- User access review
SELECT 
    u.email,
    u.role,
    u.last_login,
    COUNT(DISTINCT al.id) as total_actions
FROM users u
LEFT JOIN audit_logs al ON u.id = al.user_id 
    AND al.created_at > NOW() - INTERVAL '7 days'
WHERE u.is_active = true
GROUP BY u.id, u.email, u.role, u.last_login
ORDER BY u.last_login DESC NULLS LAST;

-- API key usage review
SELECT 
    ak.name,
    ak.last_used,
    ak.usage_count,
    COUNT(tu.id) as api_calls
FROM api_keys ak
LEFT JOIN token_usage tu ON ak.id = tu.api_key_id 
    AND tu.created_at > NOW() - INTERVAL '7 days'
WHERE ak.is_active = true
GROUP BY ak.id, ak.name, ak.last_used, ak.usage_count;
```

This comprehensive security implementation ensures that the SDLC.ai database maintains the highest standards of data protection, compliance, and operational security while supporting the needs of a multi-tenant AI platform.