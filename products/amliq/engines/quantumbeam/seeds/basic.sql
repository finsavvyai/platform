-- QuantumBeam.io - Basic Seed Data
-- This file contains essential seed data for the QuantumBeam fraud detection platform

-- Insert test organization
INSERT INTO organizations (id, name, slug, plan_type, settings, is_active, created_at, updated_at) VALUES
('00000000-0000-0000-0000-000000000001', 'QuantumBeam Test Org', 'quantumbeam-test', 'developer', '{"features": ["fraud_detection", "analytics", "ml_models"], "limits": {"transactions_per_month": 10000, "api_calls_per_day": 1000}}', true, NOW(), NOW()) ON CONFLICT (id) DO NOTHING;

-- Insert test users
INSERT INTO users (id, organization_id, email, password_hash, first_name, last_name, role, is_active, created_at, updated_at, last_login) VALUES
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'admin@quantumbeam.io', '$2b$12$LQv3cWDY6nR3dNjLmPqE5Yjzq8Y5w8Xq7vK9zLmPqE5Yjzq8Y5w8Xq7vK9zLmPqE5Yjzq8Y5w8Xq7vK9zLmPqE5Yjzq8Y5w8Xq7vK9zLmPqE5Yjzq8Y5w8Xq7vK9z', 'Admin', 'User', 'admin', true, NOW(), NOW(), NOW()),
('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'analyst@quantbeam.io', '$2b$12$LQv3cWDY6nR3dNjLmPqE5Yjzq8Y5w8Xq7vK9zLmPqE5Yjzq8Y5w8Xq7vK9zLmPqE5Yjzq8Y5w8Xq7vK9z', 'Analyst', 'User', 'analyst', true, NOW(), NOW(), NOW()),
('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'user@quantbeam.io', '$2b$12$LQv3cWDY6nR3dNjLmPqE5Yjzq8Y5w8Xq7vK9zLmPqE5Yjzq8Y5w8Xq7vK9zLmPqE5Yjzq8Y5w8Xq7vK9z', 'Regular', 'User', 'user', true, NOW(), NOW(), NOW()) ON CONFLICT (email) DO NOTHING;

-- Insert API keys
INSERT INTO api_keys (id, organization_id, name, key_hash, key_prefix, permissions, is_active, created_at, updated_at, last_used) VALUES
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Development API Key', 'hashed_key_1', 'qb_dev_', '["read", "write", "admin"]', true, NOW(), NOW(), NOW()),
('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Testing API Key', 'hashed_key_2', 'qb_test_', '["read", "write"]', true, NOW(), NOW(), NOW()) ON CONFLICT (key_hash) DO NOTHING;

-- Insert sample merchants
INSERT INTO merchants (id, organization_id, name, category, risk_score, is_active, metadata, created_at, updated_at) VALUES
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Test Electronics Store', 'electronics', 0.2, true, '{"location": "US", "average_transaction": 150.00, "customer_count": 500}', NOW(), NOW()),
('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Test Fashion Store', 'fashion', 0.3, true, '{"location": "US", "average_transaction": 75.00, "customer_count": 200}', NOW(), NOW()),
('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Test Restaurant', 'restaurant', 0.1, true, '{"location": "US", "average_transaction": 50.00, "customer_count": 100}', NOW(), NOW()) ON CONFLICT (name) DO NOTHING;

-- Insert sample transactions (for testing)
INSERT INTO transactions (
    organization_id, transaction_id, amount, currency, timestamp, merchant_id, customer_id,
    payment_method, device_id, ip_address, location_country, location_city,
    risk_score, risk_level, fraud_score, ml_score, quantum_score, status,
    is_fraud, is_flagged, metadata, created_at, updated_at
) VALUES
-- Legitimate transactions
('00000000-0000-0000-0000-000000000001', 'txn_001', 25.50, 'USD', NOW() - interval '1 day', '00000000-0000-0000-0000-000000000001', 'cust_001', 'credit_card', 'device_001', '192.168.1.100', 'US', 'New York', 0.05, 'LOW', 0.02, 0.03, 0.01, 'approved', false, false, '{"category": "electronics", "device_type": "mobile", "user_agent": "Mozilla/5.0"}', NOW() - interval '1 day', NOW() - interval '1 day'),
('00000000-0000-0000-0000-000000000001', 'txn_002', 125.00, 'USD', NOW() - interval '2 days', '00000000-0000-0000-0000-000000001', 'cust_001', 'credit_card', 'device_001', '192.168.1.100', 'US', 'New York', 0.08, 'LOW', 0.05, 0.07, 0.02, 'approved', false, false, '{"category": "electronics", "device_type": "mobile", "user_agent": "Mozilla/5.0"}', NOW() - interval '2 days', NOW() - interval '2 days'),
('00000-0000-0000-0000-000000000001', 'txn_003', 75.25, 'USD', NOW() - interval '3 days', '00000000-0000-0000-0000-000000001', 'cust_002', 'debit_card', 'device_002', '192.168.1.101', 'US', 'Los Angeles', 0.12, 'LOW', 0.08, 0.10, 0.03, 'approved', false, false, '{"category": "fashion", "device_type": "desktop", "user_agent": "Chrome"}', NOW() - interval '3 days', NOW() - interval '3 days'),

-- Suspicious transactions
('00000000-0000-0000-0000-000000000001', 'txn_004', 2500.00, 'USD', NOW() - interval '4 days', '00000000-0000-0000-0000-000000003', 'cust_003', 'credit_card', 'device_003', '192.168.1.102', 'CN', 'Beijing', 0.75, 'HIGH', 0.65, 0.70, 0.85, 'investigation', true, true, '{"category": "electronics", "device_type": "mobile", "user_agent": "Custom Bot", "suspicious_indicators": ["vpn_usage", "unusual_device"]}', NOW() - interval '4 days', NOW() - interval '4 days'),
('00000-00000-0000-0000-000000000001', 'txn_005', 5000.00, 'USD', NOW() - interval '5 days', '00000-0000-0000-0000-000000003', 'cust_003', 'credit_card', 'device_003', '192.168.1.102', 'CN', 'Beijing', 0.85, 'HIGH', 0.80, 0.82, 0.90, 'fraud_detected', true, true, '{"category": "electronics", "device_type": "mobile", "user_agent": "Custom Bot", "suspicious_indicators": ["vpn_usage", "unusual_device", "high_value_transaction"]}', NOW() - interval '5 days', NOW() - interval '5 days') ON CONFLICT (organization_id, transaction_id, timestamp) DO NOTHING;

-- Insert fraud events
INSERT INTO fraud_events (
    organization_id, transaction_id, event_type, severity, description, confidence, model_version, features,
    is_true_positive, reviewed_by, reviewed_at, created_at
) VALUES
('00000-0000-0000-0000-000000000001', (SELECT id FROM transactions WHERE transaction_id = 'txn_004'), 'high_risk_detected', 'high', 'Unusual transaction pattern detected', 0.85, 'v1.0', '{"amount_zscore": 2.5, "location_anomaly": true, "device_fingerprint": "suspicious"}', null, null, null, NOW()),
('00000-0000-0000-0000-000000000001', (SELECT id FROM transactions WHERE transaction_id = 'txn_005'), 'high_risk_detected', 'critical', 'Very high-value transaction from suspicious location', 0.92, 'v1.1', '{"amount_zscore": 3.8, "location_anomaly": true, "device_fingerprint": "suspicious", "velocity_indicator": true}', null, null, null, NOW()) ON CONFLICT (transaction_id) DO NOTHING;

-- Insert audit logs
INSERT INTO audit_logs (
    organization_id, user_id, action, resource_type, resource_id, old_values, new_values, ip_address,
    user_agent, metadata, timestamp
) VALUES
('00000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'login', 'user', '00000000-0000-0000-0000-000000000001', null, '{"last_login": null}', '{"timestamp": "' || NOW()::text || '"}', '192.168.1.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', '{"login_method": "password"}', NOW()),
('0000000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'view_transactions', 'transactions', null, null, null, '{"filters": {"date_range": "7_days"}}', '{"limit": 100, "page": 1}', '192.168.1.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', '{"ui_version": "1.0.0"}', NOW()),
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'flag_transaction', 'transaction', (SELECT id FROM transactions WHERE transaction_id = 'txn_004'), null, '{"is_flagged": false}', '{"is_flagged": true, "reason": "High fraud score"}', '192.168.1.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', '{"action": "manual_flag"}', NOW()) ON CONFLICT (id) DO NOTHING;

-- Insert configuration data
INSERT INTO system_configurations (organization_id, key, value, description, category, is_encrypted, updated_at, updated_by) VALUES
('00000000-0000-0000-0000-000000000001', 'fraud_threshold', '0.7', 'Default fraud detection threshold', 'fraud_detection', false, NOW(), '00000000-0000-0000-0000-000000000001'),
('0000000-0000-0000-0000-000000000001', 'max_transaction_amount', '10000.00', 'Maximum transaction amount for auto-approval', 'fraud_detection', false, NOW(), '00000000-0000-0000-0000-000000000001'),
('0000000-0000-0000-0000-000000000001', 'notification_webhook_url', 'https://hooks.slack.com/webhook', 'Slack webhook for notifications', 'notifications', true, NOW(), '00000-0000-0000-0000-000000000001'),
('00000000-0000-0000-0000-000000000001', 'data_retention_days', '2555', 'Data retention period in days', 'compliance', false, NOW(), '0000000-0000-0000-0000-000000000001') ON CONFLICT (key) DO NOTHING;

-- Insert sample machine learning models
INSERT INTO ml_models (organization_id, name, version, algorithm, accuracy, precision, recall, f1_score, is_active, hyperparameters, training_data_stats, created_at, updated_at) VALUES
('00000000-0000-0000-0000-000000000001', 'Fraud Detection Random Forest', '1.0.0', 'random_forest', 0.94, 0.95, 0.93, 0.94, true, '{"n_estimators": 100, "max_depth": 10, "random_state": 42}', '{"samples": 10000, "features": 50, "training_time": "2h", "validation_split": 0.2}', NOW(), NOW()),
('00000000-0000-0000-0000-000000000001', 'Fraud Detection XGBoost', '1.1.0', 'xgboost', 0.96, 0.97, 0.95, 0.96, true, '{"n_estimators": 200, "learning_rate": 0.1, "max_depth": 6, "random_state": 123}', '{"samples": 15000, "features": 50, "training_time": "3h", "validation_split": 0.2}', NOW(), NOW()),
('00000000-0000-0000-0000-000000000001', 'Quantum Fraud Detection VQC', '1.0.0', 'quantum_circuit', 0.91, 0.92, 0.90, 0.91', false, '{"qubits": 20, "layers": 3, "iterations": 100, "backend": "ibm_quantum"}', '{"samples": 5000, "features": 30, "training_time": "1h", "validation_split": 0.2}', NOW(), NOW()) ON CONFLICT (name) DO NOTHING;

-- Log the seeding completion
INSERT INTO audit_logs (organization_id, action, resource_type, description, timestamp)
SELECT id, 'database_seeding', 'system', 'Basic seed data inserted successfully' FROM organizations WHERE is_active = true;