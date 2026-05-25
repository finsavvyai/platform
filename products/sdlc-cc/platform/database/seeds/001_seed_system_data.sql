-- System Data Seeding Script
-- Initial data required for SDLC.ai platform operation

BEGIN;

-- Insert default system tenant
INSERT INTO tenants (
    id,
    name,
    domain,
    status,
    config,
    settings,
    subscription_tier,
    data_region,
    contact_email,
    billing_info,
    metadata,
    retention_policy,
    resource_limits,
    compliance_requirements
) VALUES (
    uuid_generate_v4(),
    'System Tenant',
    'system.sdlc.cc',
    'active',
    '{"auto_approve_policies": true, "system_tenant": true}',
    '{"maintenance_mode": false, "debug_mode": false}',
    'enterprise',
    'us-east-1',
    'system@sdlc.cc',
    '{"billing_method": "internal", "no_charge": true}',
    '{"description": "System tenant for internal operations", "priority": "highest"}',
    '{"documents": -1, "audit_logs": -1, "sessions": -1}',
    '{"users": -1, "documents": -1, "storage_gb": -1, "tokens_per_month": -1}',
    '["system", "internal"]'
) ON CONFLICT (domain) DO NOTHING;

-- Get system tenant ID
DO $$
DECLARE
    system_tenant_uuid UUID;
BEGIN
    SELECT id INTO system_tenant_uuid FROM tenants WHERE domain = 'system.sdlc.cc';

    -- Insert system user
    INSERT INTO users (
        id,
        tenant_id,
        email,
        encrypted_password,
        password_hash,
        role,
        permissions,
        metadata,
        is_active,
        email_verified,
        profile,
        preferences
    ) VALUES (
        uuid_generate_v4(),
        system_tenant_uuid,
        'system@sdlc.cc',
        pgp_sym_encrypt('system_password_2024_secure_change_me', 'system_key'),
        '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.s5uO8G', -- bcrypt hash of 'system_password_2024_secure_change_me'
        'super_admin',
        '["all_permissions", "system_management", "tenant_management", "user_management"]',
        '{"description": "System administrator account", "auto_created": true}',
        true,
        true,
        '{"first_name": "System", "last_name": "Administrator", "department": "IT"}',
        '{"theme": "system", "notifications": false}'
    ) ON CONFLICT (tenant_id, email) DO NOTHING;

    -- Get system user ID
    INSERT INTO api_keys (
        id,
        tenant_id,
        user_id,
        name,
        key_hash,
        permissions,
        rate_limit,
        is_active,
        metadata
    ) VALUES (
        uuid_generate_v4(),
        system_tenant_uuid,
        (SELECT id FROM users WHERE tenant_id = system_tenant_uuid AND email = 'system@sdlc.cc'),
        'System API Key',
        crypt('system_api_key_2024_secure_change_me', gen_salt('md5')),
        '{"all_permissions": true, "system_access": true}',
        10000,
        true,
        '{"description": "System-wide API key for internal operations", "internal": true}'
    ) ON CONFLICT (key_hash) DO NOTHING;
END $$;

-- Insert sample tenant for demonstration
INSERT INTO tenants (
    id,
    name,
    domain,
    status,
    config,
    settings,
    subscription_tier,
    data_region,
    contact_email,
    billing_info,
    metadata,
    retention_policy,
    resource_limits,
    compliance_requirements
) VALUES (
    uuid_generate_v4(),
    'Demo Corporation',
    'demo.sdlc.cc',
    'active',
    '{"auto_approve_policies": false, "require_mfa": true}',
    '{"theme": "corporate", "notifications": true}',
    'professional',
    'us-east-1',
    'admin@demo.sdlc.cc',
    '{"billing_method": "credit_card", "payment_method_id": "pm_demo_123"}',
    '{"description": "Demo tenant for testing and demonstration", "trial": false}',
    '{"documents": 365, "audit_logs": 2555, "sessions": 30}',
    '{"users": 50, "documents": 10000, "storage_gb": 100, "tokens_per_month": 1000000}',
    '["gdpr", "soc2", "hipaa"]
) ON CONFLICT (domain) DO NOTHING;

-- Get demo tenant ID and insert demo users
DO $$
DECLARE
    demo_tenant_uuid UUID;
    admin_user_uuid UUID;
BEGIN
    SELECT id INTO demo_tenant_uuid FROM tenants WHERE domain = 'demo.sdlc.cc';

    IF demo_tenant_uuid IS NOT NULL THEN
        -- Insert demo admin user
        INSERT INTO users (
            id,
            tenant_id,
            email,
            encrypted_password,
            password_hash,
            role,
            permissions,
            metadata,
            is_active,
            email_verified,
            profile,
            preferences
        ) VALUES (
            uuid_generate_v4(),
            demo_tenant_uuid,
            'admin@demo.sdlc.cc',
            pgp_sym_encrypt('demo_admin_password_2024', 'demo_key'),
            '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.s5uO8G', -- bcrypt hash
            'tenant_admin',
            '["user_management", "document_management", "policy_management", "view_analytics"]',
            '{"description": "Demo tenant administrator"}',
            true,
            true,
            '{"first_name": "Demo", "last_name": "Administrator", "department": "IT", "phone": "+1-555-0101"}',
            '{"theme": "light", "notifications": true, "language": "en"}'
        ) ON CONFLICT (tenant_id, email) DO NOTHING;

        -- Get admin user ID
        SELECT id INTO admin_user_uuid FROM users WHERE tenant_id = demo_tenant_uuid AND email = 'admin@demo.sdlc.cc';

        -- Insert demo data scientist user
        INSERT INTO users (
            id,
            tenant_id,
            email,
            encrypted_password,
            password_hash,
            role,
            permissions,
            metadata,
            is_active,
            email_verified,
            profile,
            preferences
        ) VALUES (
            uuid_generate_v4(),
            demo_tenant_uuid,
            'data.scientist@demo.sdlc.cc',
            pgp_sym_encrypt('demo_user_password_2024', 'demo_key'),
            '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.s5uO8G', -- bcrypt hash
            'data_scientist',
            '["document_access", "ai_query", "view_analytics"]',
            '{"description": "Demo data scientist"}',
            true,
            true,
            '{"first_name": "Data", "last_name": "Scientist", "department": "Analytics", "phone": "+1-555-0102"}',
            '{"theme": "dark", "notifications": false, "language": "en"}'
        ) ON CONFLICT (tenant_id, email) DO NOTHING;

        -- Insert demo business analyst user
        INSERT INTO users (
            id,
            tenant_id,
            email,
            encrypted_password,
            password_hash,
            role,
            permissions,
            metadata,
            is_active,
            email_verified,
            profile,
            preferences
        ) VALUES (
            uuid_generate_v4(),
            demo_tenant_uuid,
            'analyst@demo.sdlc.cc',
            pgp_sym_encrypt('demo_user_password_2024', 'demo_key'),
            '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.s5uO8G', -- bcrypt hash
            'analyst',
            '["document_access", "read_only", "view_analytics"]',
            '{"description": "Demo business analyst"}',
            true,
            true,
            '{"first_name": "Business", "last_name": "Analyst", "department": "Finance", "phone": "+1-555-0103"}',
            '{"theme": "light", "notifications": true, "language": "en"}'
        ) ON CONFLICT (tenant_id, email) DO NOTHING;

        -- Insert demo API key for admin user
        INSERT INTO api_keys (
            id,
            tenant_id,
            user_id,
            name,
            key_hash,
            permissions,
            rate_limit,
            is_active,
            metadata
        ) VALUES (
            uuid_generate_v4(),
            demo_tenant_uuid,
            admin_user_uuid,
            'Demo Admin API Key',
            crypt('demo_api_key_2024_secure_change_me', gen_salt('md5')),
            '{"user_management": true, "document_management": true, "policy_management": true}',
            5000,
            true,
            '{"description": "Demo API key for admin operations"}'
        ) ON CONFLICT (key_hash) DO NOTHING;
    END IF;
END $$;

-- Insert default policies for demo tenant
DO $$
DECLARE
    demo_tenant_uuid UUID;
    demo_admin_uuid UUID;
BEGIN
    SELECT id INTO demo_tenant_uuid FROM tenants WHERE domain = 'demo.sdlc.cc';
    SELECT id INTO demo_admin_uuid FROM users WHERE tenant_id = demo_tenant_uuid AND email = 'admin@demo.sdlc.cc';

    IF demo_tenant_uuid IS NOT NULL AND demo_admin_uuid IS NOT NULL THEN
        -- Basic data access policy
        INSERT INTO policies (
            id,
            tenant_id,
            name,
            description,
            type,
            rego_policy,
            version,
            is_active,
            created_by,
            metadata,
            tags
        ) VALUES (
            uuid_generate_v4(),
            demo_tenant_uuid,
            'Basic Document Access',
            'Allow users to access documents they created or have been granted access to',
            'data_access',
            $policy$
package sdlc.data_access

default allow = false

allow {
    input.user.id == input.resource.owner_id
}

allow {
    input.resource.access_level == "public"
}

allow {
    input.user.role == "tenant_admin"
}

allow {
    input.user.role == "data_scientist"
    input.resource.classification != "restricted"
}
            $policy$,
            1,
            true,
            demo_admin_uuid,
            '{"description": "Basic document access control"}',
            '["document_access", "rbac"]'
        ) ON CONFLICT DO NOTHING;

        -- DLP policy for PII detection
        INSERT INTO policies (
            id,
            tenant_id,
            name,
            description,
            type,
            rego_policy,
            version,
            is_active,
            created_by,
            metadata,
            tags
        ) VALUES (
            uuid_generate_v4(),
            demo_tenant_uuid,
            'PII Detection and Redaction',
            'Detect and redact personally identifiable information',
            'dlp',
            $policy$
package sdlc.dlp

default action = "allow"

action = "redact" {
    count(violations) > 0
}

violations [type] {
    is_pii(type)
    contains_pii(input.content, type)
}

is_pii("ssn")
is_pii("email")
is_pii("phone")
is_pii("credit_card")

contains_pii(content, type) {
    regex[type] ~= content
}

regex = {
    "ssn": "\b\d{3}-\d{2}-\d{4}\b",
    "email": "\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b",
    "phone": "\b\d{3}-\d{3}-\d{4}\b",
    "credit_card": "\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b"
}
            $policy$,
            1,
            true,
            demo_admin_uuid,
            '{"description": "PII detection and redaction policy"}',
            '["dlp", "pii", "compliance"]'
        ) ON CONFLICT DO NOTHING;

        -- Cost control policy
        INSERT INTO policies (
            id,
            tenant_id,
            name,
            description,
            type,
            rego_policy,
            version,
            is_active,
            created_by,
            metadata,
            tags
        ) VALUES (
            uuid_generate_v4(),
            demo_tenant_uuid,
            'Token Usage Limits',
            'Enforce monthly token usage limits per user',
            'cost',
            $policy$
package sdlc.cost

default allow = true

allow = false {
    usage_exceeds_limit
}

usage_exceeds_limit {
    input.monthly_usage > input.user.monthly_limit
}

usage_exceeds_limit {
    input.tenant_usage > input.tenant.monthly_limit
}
            $policy$,
            1,
            true,
            demo_admin_uuid,
            '{"description": "Token usage cost control policy"}',
            '["cost_control", "quotas"]'
        ) ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- Insert sample documents for demo tenant
DO $$
DECLARE
    demo_tenant_uuid UUID;
    demo_admin_uuid UUID;
    sample_doc_uuid UUID;
BEGIN
    SELECT id INTO demo_tenant_uuid FROM tenants WHERE domain = 'demo.sdlc.cc';
    SELECT id INTO demo_admin_uuid FROM users WHERE tenant_id = demo_tenant_uuid AND email = 'admin@demo.sdlc.cc';

    IF demo_tenant_uuid IS NOT NULL AND demo_admin_uuid IS NOT NULL THEN
        -- Insert sample document
        INSERT INTO documents (
            id,
            tenant_id,
            filename,
            original_filename,
            content_type,
            file_size,
            checksum,
            storage_path,
            storage_bucket,
            storage_provider,
            metadata,
            extraction_status,
            processing_status,
            dlp_status,
            created_by,
            encryption_key_id,
            retention_policy,
            access_level,
            tags,
            classification,
            language
        ) VALUES (
            uuid_generate_v4(),
            demo_tenant_uuid,
            'sample_document_001.pdf',
            'Annual Report 2024.pdf',
            'application/pdf',
            2048576,
            'sha256:abc123def456789',
            'documents/2024/sample_document_001.pdf',
            'sdlc-documents',
            'r2',
            '{"title": "Annual Report 2024", "department": "Finance", "year": 2024}',
            'completed',
            'completed',
            'completed',
            demo_admin_uuid,
            'key_001',
            '{"retention_days": 2555}',
            'internal',
            '["finance", "annual_report", "2024"]',
            'confidential',
            'en'
        ) RETURNING id INTO sample_doc_uuid;

        -- Insert sample document chunks
        IF sample_doc_uuid IS NOT NULL THEN
            INSERT INTO document_chunks (
                id,
                document_id,
                tenant_id,
                chunk_index,
                content,
                content_length,
                chunk_type,
                embedding_status,
                metadata,
                checksum,
                token_count,
                source_page_number
            ) VALUES
            (
                uuid_generate_v4(),
                sample_doc_uuid,
                demo_tenant_uuid,
                1,
                'This is the executive summary of the Annual Report 2024. Our company has achieved remarkable growth this year, with revenue increasing by 25% compared to the previous year. The key highlights include expansion into new markets, successful product launches, and improved operational efficiency.',
                285,
                'text',
                'completed',
                '{"section": "executive_summary", "page": 1}',
                'sha256:chunk001',
                72,
                1
            ),
            (
                uuid_generate_v4(),
                sample_doc_uuid,
                demo_tenant_uuid,
                2,
                'Financial Performance: Total revenue reached $125 million, representing a 25% year-over-year increase. Net income improved by 30% to $18.7 million. Operating margins expanded to 15% from 12% in the previous year.',
                224,
                'text',
                'completed',
                '{"section": "financial_performance", "page": 2}',
                'sha256:chunk002',
                56,
                2
            ),
            (
                uuid_generate_v4(),
                sample_doc_uuid,
                demo_tenant_uuid,
                3,
                'Market Analysis: The company successfully entered three new geographic markets, contributing $15 million to total revenue. Market share in existing markets increased by an average of 3.5 percentage points.',
                197,
                'text',
                'completed',
                '{"section": "market_analysis", "page": 3}',
                'sha256:chunk003',
                49,
                3
            );
        END IF;
    END IF;
END $$;

-- Insert sample audit logs for demo tenant
DO $$
DECLARE
    demo_tenant_uuid UUID;
    demo_admin_uuid UUID;
BEGIN
    SELECT id INTO demo_tenant_uuid FROM tenants WHERE domain = 'demo.sdlc.cc';
    SELECT id INTO demo_admin_uuid FROM users WHERE tenant_id = demo_tenant_uuid AND email = 'admin@demo.sdlc.cc';

    IF demo_tenant_uuid IS NOT NULL AND demo_admin_uuid IS NOT NULL THEN
        -- Sample audit logs
        INSERT INTO audit_logs (
            id,
            tenant_id,
            user_id,
            action,
            resource_type,
            resource_id,
            details,
            ip_address,
            user_agent,
            created_at,
            request_id,
            response_status,
            processing_time_ms,
            compliance_tags
        ) VALUES
        (
            uuid_generate_v4(),
            demo_tenant_uuid,
            demo_admin_uuid,
            'login',
            'user',
            demo_admin_uuid,
            '{"login_method": "password", "mfa_verified": false}',
            '192.168.1.100'::INET,
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            NOW() - INTERVAL '2 hours',
            uuid_generate_v4(),
            200,
            150,
            '["security", "authentication"]'
        ),
        (
            uuid_generate_v4(),
            demo_tenant_uuid,
            demo_admin_uuid,
            'create',
            'document',
            (SELECT id FROM documents WHERE tenant_id = demo_tenant_uuid AND original_filename = 'Annual Report 2024.pdf' LIMIT 1),
            '{"filename": "Annual Report 2024.pdf", "file_size": 2048576}',
            '192.168.1.100'::INET,
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            NOW() - INTERVAL '1 hour',
            uuid_generate_v4(),
            201,
            450,
            '["data_management", "gdpr"]'
        );
    END IF;
END $$;

-- Refresh materialized views to include seeded data
PERFORM refresh_materialized_views();

COMMIT;
