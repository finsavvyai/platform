-- Seed Data for QuantumBeam.io
-- Initial data for development and testing

-- Insert sample organizations
INSERT INTO organizations (id, name, slug, description, industry, website, timezone, currency, is_active) VALUES
('00000000-0000-0000-0000-000000000001', 'QuantumBeam Inc', 'quantumbeam', 'Leading fraud detection platform', 'Financial Technology', 'https://quantumbeam.io', 'UTC', 'USD', true),
('00000000-0000-0000-0000-000000000002', 'Acme Corp', 'acme-corp', 'E-commerce platform', 'Retail', 'https://acme.com', 'America/New_York', 'USD', true),
('00000000-0000-0000-0000-000000000003', 'Global Payments', 'global-payments', 'Payment processor', 'Financial Services', 'https://globalpay.com', 'Europe/London', 'EUR', true),
('00000000-0000-0000-0000-000000000004', 'TechStart Solutions', 'techstart', 'SaaS provider', 'Technology', 'https://techstart.io', 'America/Los_Angeles', 'USD', true),
('00000000-0000-0000-0000-000000000005', 'SecureBank', 'securebank', 'Digital banking platform', 'Banking', 'https://securebank.com', 'Asia/Tokyo', 'JPY', true)
ON CONFLICT (id) DO NOTHING;

-- Insert sample users
INSERT INTO users (id, organization_id, email, username, password_hash, first_name, last_name, phone, is_active, is_email_verified, timezone) VALUES
-- QuantumBeam Inc users
('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'admin@quantumbeam.io', 'admin', '$2a$10$N9qo8uLOickgx2ZMRZoMye1cSjX4E4W9XOpD8YQ7W3jX9jW9W9W9W', 'System', 'Administrator', '+1-555-0001', true, true, 'UTC'),
('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'john.doe@quantumbeam.io', 'john.doe', '$2a$10$N9qo8uLOickgx2ZMRZoMye1cSjX4E4W9XOpD8YQ7W3jX9jW9W9W9W', 'John', 'Doe', '+1-555-0002', true, true, 'UTC'),
('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'jane.smith@quantumbeam.io', 'jane.smith', '$2a$10$N9qo8uLOickgx2ZMRZoMye1cSjX4E4W9XOpD8YQ7W3jX9jW9W9W9W', 'Jane', 'Smith', '+1-555-0003', true, true, 'UTC'),

-- Acme Corp users
('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 'ceo@acme.com', 'acme.ceo', '$2a$10$N9qo8uLOickgx2ZMRZoMye1cSjX4E4W9XOpD8YQ7W3jX9jW9W9W9W', 'CEO', 'Acme', '+1-555-0101', true, true, 'America/New_York'),
('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000002', 'fraud.manager@acme.com', 'acme.fraud', '$2a$10$N9qo8uLOickgx2ZMRZoMye1cSjX4E4W9XOpD8YQ7W3jX9jW9W9W9W', 'Fraud', 'Manager', '+1-555-0102', true, true, 'America/New_York'),

-- Global Payments users
('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000003', 'admin@globalpay.com', 'globalpay.admin', '$2a$10$N9qo8uLOickgx2ZMRZoMye1cSjX4E4W9XOpD8YQ7W3jX9jW9W9W9W', 'Global', 'Admin', '+44-20-0001', true, true, 'Europe/London'),

-- TechStart Solutions users
('10000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000004', 'cto@techstart.io', 'techstart.cto', '$2a$10$N9qo8uLOickgx2ZMRZoMye1cSjX4E4W9XOpD8YQ7W3jX9jW9W9W9W', 'CTO', 'TechStart', '+1-555-0201', true, true, 'America/Los_Angeles'),

-- SecureBank users
('10000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000005', 'security@securebank.com', 'securebank.security', '$2a$10$N9qo8uLOickgx2ZMRZoMye1cSjX4E4W9XOpD8YQ7W3jX9jW9W9W9W', 'Security', 'Officer', '+81-3-0001', true, true, 'Asia/Tokyo')
ON CONFLICT (id) DO NOTHING;

-- Insert sample API keys
INSERT INTO api_keys (id, organization_id, user_id, name, key_hash, key_prefix, permissions, rate_limit_per_minute, is_active) VALUES
('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Production API Key', '$2a$10$abc123def456ghi789jkl012mno345pqr678stu901vwx234yz567', 'qb_prod_1', '["transactions:read", "transactions:write", "analytics:read"]', 10000, true),
('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'Development API Key', '$2a$10$def456ghi789jkl012mno345pqr678stu901vwx234yz567abc', 'qb_dev_1', '["transactions:read", "transactions:write", "analytics:read", "debug"]', 1000, true),
('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000004', 'Acme Production Key', '$2a$10$ghi789jkl012mno345pqr678stu901vwx234yz567abc123de', 'acme_prod_1', '["transactions:read", "transactions:write"]', 5000, true),
('20000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000006', 'Global Payments API', '$2a$10$jkl012mno345pqr678stu901vwx234yz567abc123def456gh', 'gp_prod_1', '["transactions:read", "transactions:write", "analytics:read", "risk:read"]', 20000, true)
ON CONFLICT (id) DO NOTHING;

-- Insert sample fraud rules
INSERT INTO fraud_rules (id, organization_id, name, description, rule_type, conditions, actions, weight, is_active, priority) VALUES
('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'High Amount Transaction', 'Flag transactions over $10,000', 'threshold', '{"amount": {"gt": 10000, "currency": "USD"}}', '{"flag": true, "require_review": true, "block": false}', 0.8, true, 100),
('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Suspicious Location', 'Flag transactions from high-risk countries', 'location', '{"country_code": {"in": ["XX", "YY"]}}', '{"flag": true, "require_review": true, "block": false}', 0.7, true, 90),
('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Velocity Check', 'Too many transactions in short time', 'velocity', '{"count": {"gt": 10, "window": "5m"}, "user_id": "same"}}', '{"flag": true, "require_review": true, "block": false}', 0.9, true, 95),
('30000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 'Unusual Time', 'Transactions outside business hours', 'time', '{"hour": {"lt": 6, "gt": 22}, "timezone": "America/New_York"}', '{"flag": true, "require_review": false, "block": false}', 0.5, true, 80),
('30000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000002', 'Card Testing', 'Multiple small transactions from same card', 'pattern', '{"amount": {"lt": 5}, "count": {"gt": 5, "window": "1h"}, "card_token": "same"}}', '{"flag": true, "require_review": true, "block": true}', 0.95, true, 100),
('30000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000003', 'IP Mismatch', 'Shipping IP different from billing IP', 'location', '{"ip_mismatch": true, "distance": {"gt": 1000}}', '{"flag": true, "require_review": false, "block": false}', 0.6, true, 85)
ON CONFLICT (id) DO NOTHING;

-- Insert sample quantum models
INSERT INTO quantum_models (id, name, version, model_type, description, parameters, backend_provider, is_active) VALUES
('40000000-0000-0000-0000-000000000001', 'VQC-Model-v1', '1.0.0', 'VQC', 'Variational Quantum Classifier for transaction fraud detection', '{"qubits": 8, "layers": 3, "learning_rate": 0.01, "iterations": 100}', 'IBM_Quantum', true),
('40000000-0000-0000-0000-000000000002', 'QAOA-Fraud-Rings', '1.0.0', 'QAOA', 'Quantum optimizer for fraud ring detection', '{"qubits": 16, "p_layers": 2, "optimizer": "COBYLA"}', 'D-Wave', true),
('40000000-0000-0000-0000-000000000003', 'Hybrid-Ensemble', '1.0.0', 'HYBRID', 'Hybrid quantum-classical ensemble model', '{"quantum_weight": 0.6, "classical_weight": 0.4, "models": ["VQC", "XGBoost", "RandomForest"]}', 'Amazon_Braket', true),
('40000000-0000-0000-0000-000000000004', 'VQC-Model-v2', '2.0.0', 'VQC', 'Improved VQC with noise mitigation', '{"qubits": 12, "layers": 5, "noise_mitigation": true, "error_correction": true}', 'IBM_Quantum', false),
('40000000-0000-0000-0000-000000000005', 'QAOA-Advanced', '2.0.0', 'QAOA', 'Advanced QAOA with custom mixer', '{"qubits": 32, "p_layers": 3, "custom_mixer": true, "parallel_execution": true}', 'Azure_Quantum', false)
ON CONFLICT (id) DO NOTHING;

-- Create sample transactions (will be distributed across partitions)
-- These will go into the current partition
INSERT INTO transactions (
    id, organization_id, user_id, transaction_id, amount, currency,
    merchant_name, merchant_category_code, ip_address, country_code,
    payment_method_type, card_last_four, card_brand, status,
    fraud_score, fraud_risk_level, is_fraudulent,
    quantum_processing_status, quantum_result, metadata
) VALUES
-- QuantumBeam Inc transactions
('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'QB20241030123456789001', 250.00, 'USD', 'AWS Services', '5737', '52.23.45.67', 'US', 'credit_card', '1234', 'Visa', 'approved', 0.02, 'low', false, 'completed', '{"confidence": 0.95, "features": [0.1, 0.2, 0.3]}', '{"source": "web", "device": "desktop"}'),

('50000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'QB20241030123456789002', 15000.00, 'USD', 'Enterprise Software Purchase', '5734', '52.23.45.67', 'US', 'credit_card', '5678', 'MasterCard', 'pending', 0.85, 'high', false, 'processing', '{"confidence": 0.87, "features": [0.8, 0.9, 0.7]}', '{"source": "api", "priority": "high"}'),

-- Acme Corp transactions
('50000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000004', 'QB20241030123456789003', 89.99, 'USD', 'Electronics Store', '5732', '192.168.1.100', 'US', 'credit_card', '4321', 'Visa', 'approved', 0.15, 'low', false, 'completed', '{"confidence": 0.92, "features": [0.2, 0.1, 0.3]}', '{"source": "pos", "store_id": "NYC-001"}'),

('50000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000005', 'QB20241030123456789004', 2.50, 'USD', 'Test Transaction', '7399', '185.220.101.182', 'DE', 'credit_card', '9999', 'Visa', 'declined', 0.95, 'critical', true, 'failed', '{"error": "Insufficient quantum resources", "fallback": "classical"}', '{"source": "test", "suspicious": true}'),

-- Global Payments transactions
('50000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000006', 'QB20241030123456789005', 5000.00, 'EUR', 'B2B Transfer', '5999', '217.160.0.1', 'DE', 'bank_transfer', NULL, NULL, 'processing', 0.30, 'medium', false, 'queued', '{"queue_position": 42, "estimated_time": 30}', '{"source": "api", "business": true}'),

-- TechStart Solutions transactions
('50000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000007', 'QB20241030123456789006', 99.00, 'USD', 'SaaS Subscription', '7394', '73.45.234.89', 'US', 'credit_card', '1111', 'Amex', 'approved', 0.08, 'low', false, 'completed', '{"confidence": 0.97, "features": [0.05, 0.1, 0.02]}', '{"source": "web", "recurring": true}'),

-- SecureBank transactions
('50000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000008', 'QB20241030123456789007', 150000.00, 'JPY', 'Wire Transfer', '6011', '202.215.0.1', 'JP', 'bank_transfer', NULL, NULL, 'approved', 0.45, 'medium', false, 'completed', '{"confidence": 0.78, "features": [0.4, 0.5, 0.3]}', '{"source": "bank", "verified": true, "kyc_complete": true}'),

-- More sample transactions with various scenarios
('50000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000004', 'QB20241030123456789008', 1.00, 'USD', 'Test Charge', '7399', '185.220.101.182', 'DE', 'credit_card', '9999', 'Visa', 'declined', 0.98, 'critical', true, 'failed', '{"error": "Card testing detected"}', '{"source": "api", "test": true}'),

('50000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'QB20241030123456789009', 75.00, 'USD', 'Restaurant', '5812', '52.23.45.67', 'US', 'credit_card', '8888', 'Discover', 'approved', 0.12, 'low', false, 'completed', '{"confidence": 0.94, "features": [0.1, 0.15, 0.08]}', '{"source": "pos", "merchant_id": "REST-123"}'),

('50000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000006', 'QB20241030123456789010', 25.00, 'EUR', 'Coffee Shop', '5814', '217.160.0.1', 'DE', 'mobile_payment', NULL, NULL, 'approved', 0.05, 'low', false, 'completed', '{"confidence": 0.98, "features": [0.02, 0.03, 0.04]}', '{"source": "mobile", "nfc": true}')
ON CONFLICT (id) DO NOTHING;

-- Insert analytics transaction metrics for past week
INSERT INTO analytics.transaction_metrics (organization_id, metric_date, total_transactions, total_amount, avg_transaction_amount, fraud_rate, avg_fraud_score, quantum_processing_avg_ms) VALUES
('00000000-0000-0000-0000-000000000001', CURRENT_DATE - INTERVAL '7 days', 1250, 456789.50, 365.43, 0.012, 0.08, 45),
('00000000-0000-0000-0000-000000000001', CURRENT_DATE - INTERVAL '6 days', 1180, 423456.78, 358.86, 0.015, 0.09, 42),
('00000000-0000-0000-0000-000000000001', CURRENT_DATE - INTERVAL '5 days', 1320, 512345.67, 388.14, 0.011, 0.07, 48),
('00000000-0000-0000-0000-000000000001', CURRENT_DATE - INTERVAL '4 days', 1290, 489012.34, 379.08, 0.013, 0.08, 44),
('00000000-0000-0000-0000-000000000001', CURRENT_DATE - INTERVAL '3 days', 1350, 523456.78, 387.75, 0.014, 0.09, 46),
('00000000-0000-0000-0000-000000000001', CURRENT_DATE - INTERVAL '2 days', 1420, 567890.12, 399.92, 0.010, 0.06, 43),
('00000000-0000-0000-0000-000000000001', CURRENT_DATE - INTERVAL '1 day', 1380, 545678.90, 395.42, 0.012, 0.08, 47),
('00000000-0000-0000-0000-000000000001', CURRENT_DATE, 890, 345678.90, 388.40, 0.011, 0.07, 45),

-- Acme Corp metrics
('00000000-0000-0000-0000-000000000002', CURRENT_DATE - INTERVAL '7 days', 3450, 1234567.89, 357.85, 0.025, 0.12, 52),
('00000000-0000-0000-0000-000000000002', CURRENT_DATE - INTERVAL '6 days', 3280, 1156789.01, 352.68, 0.028, 0.13, 50),
('00000000-0000-0000-0000-000000000002', CURRENT_DATE - INTERVAL '5 days', 3620, 1345678.90, 371.69, 0.022, 0.11, 54),
('00000000-0000-0000-0000-000000000002', CURRENT_DATE - INTERVAL '4 days', 3550, 1289012.34, 363.11, 0.024, 0.12, 51),
('00000000-0000-0000-0000-000000000002', CURRENT_DATE - INTERVAL '3 days', 3780, 1423456.78, 376.51, 0.023, 0.12, 53),
('00000000-0000-0000-0000-000000000002', CURRENT_DATE - INTERVAL '2 days', 3890, 1489012.34, 382.80, 0.021, 0.11, 49),
('00000000-0000-0000-0000-000000000002', CURRENT_DATE - INTERVAL '1 day', 3750, 1412345.67, 376.62, 0.024, 0.12, 52),
('00000000-0000-0000-0000-000000000002', CURRENT_DATE, 2340, 878901.23, 375.60, 0.023, 0.12, 51),

-- Global Payments metrics
('00000000-0000-0000-0000-000000000003', CURRENT_DATE - INTERVAL '7 days', 890, 2345678.90, 2635.59, 0.008, 0.05, 38),
('00000000-0000-0000-0000-000000000003', CURRENT_DATE - INTERVAL '6 days', 920, 2456789.01, 2670.42, 0.007, 0.04, 35),
('00000000-0000-0000-0000-000000000003', CURRENT_DATE - INTERVAL '5 days', 980, 2567890.12, 2620.30, 0.009, 0.06, 40),
('00000000-0000-0000-0000-000000000003', CURRENT_DATE - INTERVAL '4 days', 910, 2390123.45, 2626.51, 0.008, 0.05, 37),
('00000000-0000-0000-0000-000000000003', CURRENT_DATE - INTERVAL '3 days', 950, 2478901.23, 2609.37, 0.008, 0.05, 39),
('00000000-0000-0000-0000-000000000003', CURRENT_DATE - INTERVAL '2 days', 990, 2590123.45, 2616.28, 0.007, 0.04, 36),
('00000000-0000-0000-0000-000000000003', CURRENT_DATE - INTERVAL '1 day', 930, 2423456.78, 2604.79, 0.008, 0.05, 38),
('00000000-0000-0000-0000-000000000003', CURRENT_DATE, 560, 1456789.01, 2601.41, 0.008, 0.05, 37)
ON CONFLICT DO NOTHING;

-- Create indexes on new data
CREATE INDEX IF NOT EXISTS idx_transaction_metrics_org_date ON analytics.transaction_metrics(organization_id, metric_date);

-- Analyze tables after data load
ANALYZE organizations;
ANALYZE users;
ANALYZE api_keys;
ANALYZE fraud_rules;
ANALYZE quantum_models;
ANALYZE transactions;
ANALYZE analytics.transaction_metrics;

-- Update statistics for better query planning
ALTER TABLE transactions SET (autovacuum_vacuum_scale_factor = 0.1);
ALTER TABLE transactions SET (autovacuum_analyze_scale_factor = 0.05);

-- Create sample views for common queries
CREATE OR REPLACE VIEW sample.high_value_transactions AS
SELECT
    t.*,
    o.name as organization_name,
    u.email as user_email
FROM transactions t
JOIN organizations o ON t.organization_id = o.id
LEFT JOIN users u ON t.user_id = u.id
WHERE t.amount > 1000
AND t.created_at > CURRENT_DATE - INTERVAL '7 days'
ORDER BY t.amount DESC;

CREATE OR REPLACE VIEW sample.recent_fraud_alerts AS
SELECT
    t.*,
    o.name as organization_name,
    u.email as user_email,
    fr.name as rule_name
FROM transactions t
JOIN organizations o ON t.organization_id = o.id
LEFT JOIN users u ON t.user_id = u.id
LEFT JOIN jsonb_array_elements_text(t.fraud_rules_triggered) AS rule_name ON true
LEFT JOIN fraud_rules fr ON fr.name = rule_name
WHERE (t.fraud_risk_level IN ('high', 'critical') OR t.is_fraudulent = true)
AND t.created_at > CURRENT_DATE - INTERVAL '24 hours'
ORDER BY t.fraud_score DESC, t.created_at DESC;

-- Grant permissions on sample views
GRANT SELECT ON sample.high_value_transactions TO quantumbeam_ml;
GRANT SELECT ON sample.high_value_transactions TO quantumbeam_readonly;
GRANT SELECT ON sample.recent_fraud_alerts TO quantumbeam_ml;
GRANT SELECT ON sample.recent_fraud_alerts TO quantumbeam_readonly;

-- Create sample schema for views
CREATE SCHEMA IF NOT EXISTS sample AUTHORIZATION postgres;

COMMIT;
