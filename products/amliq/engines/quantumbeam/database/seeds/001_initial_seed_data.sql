-- Seed Data for QuantumBeam.io
-- Initial data for testing and development

-- =================================
-- INSERT DEFAULT ORGANIZATION
-- =================================
INSERT INTO organizations (
    id,
    name,
    slug,
    description,
    industry,
    website,
    timezone,
    currency,
    settings,
    is_active
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    'QuantumBeam Demo',
    'quantumbeam-demo',
    'Demo organization for QuantumBeam.io platform',
    'Financial Technology',
    'https://quantumbeam.io',
    'UTC',
    'USD',
    '{
        "features": {
            "quantum_processing": true,
            "advanced_analytics": true,
            "api_access": true,
            "webhooks": true
        },
        "limits": {
            "transactions_per_month": 100000,
            "api_calls_per_minute": 1000,
            "retention_days": 365
        },
        "notifications": {
            "email": true,
            "sms": false,
            "webhook": true
        }
    }',
    true
) ON CONFLICT (id) DO NOTHING;

-- =================================
-- INSERT TEST USERS
-- =================================
-- Admin user
INSERT INTO users (
    id,
    organization_id,
    email,
    username,
    password_hash,
    first_name,
    last_name,
    phone,
    timezone,
    language,
    is_active,
    is_email_verified,
    is_phone_verified,
    two_factor_enabled,
    settings
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'admin@quantumbeam.io',
    'admin',
    '$2a$10$EblZqNptyYvcLm/VwDCVAuBjzZOI7khzdyGPBr08PpIi0na624b8.', -- secret123
    'Admin',
    'User',
    '+1-555-0001',
    'UTC',
    'en',
    true,
    true,
    true,
    false,
    '{
        "theme": "dark",
        "notifications": {
            "email": true,
            "browser": true,
            "fraud_alerts": true
        },
        "dashboard": {
            "default_view": "overview",
            "refresh_interval": 30
        }
    }'
) ON CONFLICT (email) DO NOTHING;

-- Regular user
INSERT INTO users (
    id,
    organization_id,
    email,
    username,
    password_hash,
    first_name,
    last_name,
    phone,
    timezone,
    language,
    is_active,
    is_email_verified,
    is_phone_verified,
    two_factor_enabled,
    settings
) VALUES (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'analyst@quantumbeam.io',
    'analyst',
    '$2a$10$EblZqNptyYvcLm/VwDCVAuBjzZOI7khzdyGPBr08PpIi0na624b8.', -- secret123
    'Analyst',
    'User',
    '+1-555-0002',
    'UTC',
    'en',
    true,
    true,
    true,
    false,
    '{
        "theme": "light",
        "notifications": {
            "email": true,
            "browser": true,
            "fraud_alerts": true
        },
        "dashboard": {
            "default_view": "transactions",
            "refresh_interval": 60
        }
    }'
) ON CONFLICT (email) DO NOTHING;

-- =================================
-- INSERT API KEYS
-- =================================
-- Production API key
INSERT INTO api_keys (
    id,
    organization_id,
    user_id,
    name,
    key_hash,
    key_prefix,
    permissions,
    rate_limit_per_minute,
    rate_limit_per_hour,
    is_active
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'Production API Key',
    '$2a$10$rOzJqQZQZQZQZQZQZQZQZOzJqQZQZQZQZQZQZQZQZOzJqQZQZQZQZQ', -- qsk_prod_1234567890abcdef
    'qsk_prod_',
    '["transactions:read", "transactions:write", "fraud:read", "analytics:read"]',
    1000,
    100000,
    true
) ON CONFLICT (key_hash) DO NOTHING;

-- Test API key
INSERT INTO api_keys (
    id,
    organization_id,
    user_id,
    name,
    key_hash,
    key_prefix,
    permissions,
    rate_limit_per_minute,
    rate_limit_per_hour,
    is_active
) VALUES (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'Test API Key',
    '$2a$10$rOzJqQZQZQZQZQZQZQZQZOzJqQZQZQZQZQZQZQZQZOzJqQZQZQZQZQ', -- qsk_test_1234567890abcdef
    'qsk_test_',
    '["transactions:read", "transactions:write", "fraud:read"]',
    100,
    10000,
    true
) ON CONFLICT (key_hash) DO NOTHING;

-- =================================
-- INSERT FRAUD RULES
-- =================================
INSERT INTO fraud_rules (
    id,
    organization_id,
    name,
    description,
    rule_type,
    conditions,
    actions,
    weight,
    is_active,
    priority
) VALUES
-- High amount rule
(
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'High Transaction Amount',
    'Flag transactions over $10,000',
    'amount_threshold',
    '{"amount": {"gt": 10000}, "currency": "USD"}',
    '{"flag": true, "require_review": true, "add_to_fraud_list": false}',
    0.7,
    true,
    10
),
-- Velocity check
(
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'High Velocity Transactions',
    'Multiple transactions in short time',
    'velocity_check',
    '{"count": {"gt": 5}, "timeframe": "5m", "same_user": true}',
    '{"flag": true, "require_review": true, "add_to_fraud_list": false}',
    0.6,
    true,
    20
),
-- Geographic anomaly
(
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    'Impossible Geography',
    'Transactions from impossible locations',
    'geographic_anomaly',
    '{"country_change": true, "timeframe": "1h", "min_distance": 1000}',
    '{"flag": true, "require_review": true, "add_to_fraud_list": false}',
    0.9,
    true,
    5
),
-- Card testing
(
    '00000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000001',
    'Card Testing Pattern',
    'Multiple small transactions with different cards',
    'pattern_detection',
    '{"amount": {"lt": 5}, "count": {"gt": 10}, "timeframe": "10m", "unique_cards": true}',
    '{"block": true, "require_review": true, "add_to_fraud_list": true}',
    0.8,
    true,
    15
),
-- Suspicious hour
(
    '00000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000001',
    'Unusual Transaction Hours',
    'Transactions during unusual hours (2-5 AM)',
    'time_based',
    '{"hour": {"in": [2, 3, 4, 5]}, "timezone": "UTC"}',
    '{"flag": true, "require_review": false, "add_to_fraud_list": false}',
    0.3,
    true,
    50
)
ON CONFLICT (id) DO NOTHING;

-- =================================
-- INSERT SAMPLE TRANSACTIONS
-- =================================
INSERT INTO transactions (
    id,
    transaction_id,
    organization_id,
    user_id,
    amount,
    currency,
    merchant_name,
    merchant_category_code,
    merchant_id,
    payment_method_type,
    card_last_four,
    card_brand,
    ip_address,
    country_code,
    city,
    status,
    fraud_score,
    fraud_risk_level,
    is_fraudulent,
    quantum_processing_status,
    processing_duration_ms,
    metadata,
    custom_fields
) VALUES
-- Legitimate transactions
(
    gen_random_uuid(),
    'QB20240101120001123456',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    150.00,
    'USD',
    'Amazon',
    '5311',
    'amazon_001',
    'credit_card',
    '1234',
    'Visa',
    '192.168.1.100'::inet,
    'US',
    'Seattle',
    'approved',
    0.05,
    'low',
    false,
    'completed',
    45,
    '{"device_trust": "high", "ip_risk": "low"}',
    '{"order_id": "123-4567890"}'
),
(
    gen_random_uuid(),
    'QB20240101120002234567',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    75.50,
    'USD',
    'Starbucks',
    '5814',
    'starbucks_001',
    'credit_card',
    '5678',
    'Mastercard',
    '192.168.1.100'::inet,
    'US',
    'Seattle',
    'approved',
    0.02,
    'low',
    false,
    'completed',
    35,
    '{"device_trust": "high", "ip_risk": "low"}',
    '{"store_id": "12345"}'
),
-- Suspicious transaction
(
    gen_random_uuid(),
    'QB20240101130003345678',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    15000.00,
    'USD',
    'Luxury Watches',
    '5231',
    'luxury_001',
    'credit_card',
    '9999',
    'Amex',
    '203.0.113.1'::inet,
    'CN',
    'Beijing',
    'pending',
    0.85,
    'high',
    false,
    'processing',
    120,
    '{"device_trust": "low", "ip_risk": "high"}',
    '{"rush_order": true}'
),
-- Fraudulent transaction
(
    gen_random_uuid(),
    'QB20240101140004456789',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    2500.00,
    'USD',
    'Electronics Store',
    '5732',
    'electronics_001',
    'credit_card',
    '1111',
    'Visa',
    '198.51.100.1'::inet,
    'NG',
    'Lagos',
    'declined',
    0.95,
    'critical',
    true,
    'completed',
    85,
    '{"device_trust": "unknown", "ip_risk": "critical"}',
    '{"shipping_address": "drop_location"}'
),
-- Another legitimate transaction
(
    gen_random_uuid(),
    'QB20240101150005567890',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    45.00,
    'USD',
    'Netflix',
    '7841',
    'netflix_001',
    'credit_card',
    '4321',
    'Visa',
    '192.168.1.101'::inet,
    'US',
    'San Francisco',
    'approved',
    0.01,
    'low',
    false,
    'completed',
    30,
    '{"device_trust": "high", "ip_risk": "low", "recurring": true}',
    '{"subscription_id": "sub_12345"}'
);

-- =================================
-- INSERT QUANTUM MODEL CONFIGURATIONS
-- =================================
INSERT INTO quantum_models (
    id,
    name,
    version,
    model_type,
    description,
    parameters,
    backend_provider,
    backend_config,
    performance_metrics,
    is_active
) VALUES
(
    '00000000-0000-0000-0000-000000000001',
    'Quantum Fraud Classifier V1',
    'v1.0.0',
    'VQC',
    'Variational Quantum Classifier for fraud detection using 8 qubits',
    '{
        "qubits": 8,
        "layers": 3,
        "encoding": "angle_embedding",
        "measurement": "multi_class",
        "optimizer": "COBYLA",
        "max_iterations": 100,
        "learning_rate": 0.01
    }',
    'IBM Quantum',
    '{
        "backend": "ibmq_quito",
        "shots": 8192,
        "noise_model": true,
        "transpiler": "optimization_level_2"
    }',
    '{
        "accuracy": 0.94,
        "precision": 0.92,
        "recall": 0.95,
        "f1_score": 0.93,
        "auc_roc": 0.96,
        "inference_time_ms": 45
    }',
    true
),
(
    '00000000-0000-0000-0000-000000000002',
    'Quantum Ring Detector V1',
    'v1.0.0',
    'QAOA',
    'Quantum Approximate Optimization for fraud ring detection',
    '{
        "qubits": 16,
        "layers": 2,
        "problem_type": "max_cut",
        "mixer": "standard_mixer",
        "optimizer": "SPSA",
        "max_iterations": 50
    }',
    'Amazon Braket',
    '{
        "device": "ionq_harmony",
        "shots": 1000,
        "polling_interval": 5
    }',
    '{
        "accuracy": 0.88,
        "precision": 0.85,
        "recall": 0.90,
        "community_detection": 0.87,
        "inference_time_ms": 120
    }',
    true
),
(
    '00000000-0000-0000-0000-000000000003',
    'Hybrid Quantum-Classical Model',
    'v1.0.0',
    'HYBRID',
    'Hybrid model combining VQC quantum features with classical ML',
    '{
        "quantum_features": 8,
        "quantum_layers": 2,
        "classical_layers": 3,
        "activation": "relu",
        "dropout": 0.2,
        "batch_size": 32,
        "epochs": 100
    }',
    'Azure Quantum',
    '{
        "quantum_backend": "ionq.simulator",
        "classical_backend": "cpu",
        "shots": 1024,
        "seed": 42
    }',
    '{
        "accuracy": 0.96,
        "precision": 0.94,
        "recall": 0.97,
        "f1_score": 0.95,
        "auc_roc": 0.98,
        "inference_time_ms": 65
    }',
    true
) ON CONFLICT (id) DO NOTHING;

-- =================================
-- INSERT SAMPLE ANALYTICS DATA
-- =================================
-- Insert transaction metrics for the last 30 days
INSERT INTO analytics.transaction_metrics (
    id,
    organization_id,
    metric_date,
    total_transactions,
    total_amount,
    avg_transaction_amount,
    fraud_rate,
    avg_fraud_score,
    quantum_processing_avg_ms
)
SELECT
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000001',
    CURRENT_DATE - (n || ' days')::interval,
    -- Random but realistic data
    floor(random() * 1000 + 500)::INTEGER,  -- 500-1500 transactions
    round((random() * 50000 + 10000)::numeric, 2),  -- $10,000-$60,000
    round((random() * 200 + 50)::numeric, 2),  -- $50-$250 average
    round(random() * 0.05, 4),  -- 0-5% fraud rate
    round(random() * 0.3 + 0.1, 4),  -- 0.1-0.4 avg fraud score
    floor(random() * 100 + 30)::INTEGER  -- 30-130ms processing time
FROM generate_series(0, 29) AS n;

-- Update statistics
ANALYZE organizations;
ANALYZE users;
ANALYZE api_keys;
ANALYZE transactions;
ANALYZE fraud_rules;
ANALYZE quantum_models;
ANALYZE analytics.transaction_metrics;

-- Create indexes on seed data if they don't exist
CREATE INDEX IF NOT EXISTS idx_transactions_created_at_desc ON transactions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fraud_rules_organization_active ON fraud_rules (organization_id, is_active);
CREATE INDEX IF NOT EXISTS idx_quantum_models_active ON quantum_models (is_active);

-- Refresh materialized views
REFRESH MATERIALIZED VIEW transaction_stats;

COMMIT;
