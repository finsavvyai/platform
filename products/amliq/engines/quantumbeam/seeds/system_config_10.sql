-- System Configuration Seed Data
-- Environment: all
-- Order: 10
-- Required: true

INSERT INTO system_config (key, value, description, category, is_public) VALUES
('app.name', '"QuantumBeam"', 'Application name', 'general', true),
('app.version', '"1.0.0"', 'Application version', 'general', true),
('app.environment', '"development"', 'Application environment', 'general', true),
('app.support_email', '"support@quantumbeam.io"', 'Support email address', 'general', true),
('app.max_file_upload_size', '10485760', 'Maximum file upload size in bytes', 'general', false),
('app.session_timeout', '86400', 'Session timeout in seconds', 'general', false);

-- Fraud detection configuration
INSERT INTO system_config (key, value, description, category, is_public) VALUES
('fraud.default_risk_threshold', '0.7', 'Default fraud risk threshold', 'fraud', false),
('fraud.confidence_threshold', '0.5', 'Minimum confidence for fraud detection', 'fraud', false),
('fraud.auto_block_high_risk', 'true', 'Auto-block high risk transactions', 'fraud', false),
('fraud.quantum_enabled', 'true', 'Enable quantum computing analysis', 'fraud', false),
('fraud.ai_enabled', 'true', 'Enable AI/ML analysis', 'fraud', false);

-- AI/ML configuration
INSERT INTO system_config (key, value, description, category, is_public) VALUES
('ai.model_version', '"v1.0"', 'Current AI model version', 'ai', false),
('ai.confidence_threshold', '0.8', 'AI confidence threshold', 'ai', false),
('ai.max_concurrent_requests', '100', 'Maximum concurrent AI requests', 'ai', false),
('ai.timeout_seconds', '30', 'AI request timeout in seconds', 'ai', false),
('ai.retry_attempts', '3', 'AI retry attempts on failure', 'ai', false);

-- Rate limiting configuration
INSERT INTO system_config (key, value, description, category, is_public) VALUES
('rate_limiting.default_requests_per_minute', '1000', 'Default requests per minute', 'rate_limiting', false),
('rate_limiting.default_requests_per_hour', '100000', 'Default requests per hour', 'rate_limiting', false),
('rate_limiting.burst_size', '100', 'Burst size for rate limiting', 'rate_limiting', false),
('rate_limiting.cleanup_interval', '3600', 'Rate limit cleanup interval in seconds', 'rate_limiting', false);

-- Security configuration
INSERT INTO system_config (key, value, description, category, is_public) VALUES
('security.jwt_secret_expiration', '86400', 'JWT secret expiration time in seconds', 'security', false),
('security.password_min_length', '8', 'Minimum password length', 'security', false),
('security.password_require_special_chars', 'true', 'Require special characters in passwords', 'security', false),
('security.max_login_attempts', '5', 'Maximum login attempts before lockout', 'security', false),
('security.lockout_duration', '900', 'Account lockout duration in seconds', 'security', false);

-- Monitoring configuration
INSERT INTO system_config (key, value, description, category, is_public) VALUES
('monitoring.metrics_retention_days', '30', 'Metrics retention period in days', 'monitoring', false),
('monitoring.logs_retention_days', '90', 'Logs retention period in days', 'monitoring', false),
('monitoring.alert_webhook_url', '""', 'Alert webhook URL', 'monitoring', false),
('monitoring.health_check_interval', '60', 'Health check interval in seconds', 'monitoring', false);

-- Database configuration
INSERT INTO system_config (key, value, description, category, is_public) VALUES
('database.max_connections', '100', 'Maximum database connections', 'database', false),
('database.idle_timeout', '300', 'Database idle timeout in seconds', 'database', false),
('database.max_lifetime', '3600', 'Database connection max lifetime in seconds', 'database', false);
-- Database backup configuration
INSERT INTO system_config (key, value, description, category, is_public) VALUES
('backup.enabled', 'true', 'Enable automatic backups', 'backup', false),
('backup.retention_days', '30', 'Backup retention period in days', 'backup', false),
('backup.frequency_hours', '24', 'Backup frequency in hours', 'backup', false),
('backup.encryption_enabled', 'true', 'Enable backup encryption', 'backup', false);

-- Notification configuration
INSERT INTO system_config (key, value, description, category, is_public) VALUES
('notifications.email_enabled', 'true', 'Enable email notifications', 'notifications', false),
('notifications.sms_enabled', 'false', 'Enable SMS notifications', 'notifications', false),
('notifications.push_enabled', 'true', 'Enable push notifications', 'notifications', false),
('notifications.webhook_enabled', 'true', 'Enable webhook notifications', 'notifications', false);

-- Feature flags
INSERT INTO system_config (key, value, description, category, is_public) VALUES
('features.quantum_analysis', 'true', 'Enable quantum computing analysis', 'features', false),
('features.ai_enhanced_detection', 'true', 'Enable AI-enhanced fraud detection', 'features', false),
('features.real_time_monitoring', 'true', 'Enable real-time monitoring', 'features', false),
('features.advanced_analytics', 'true', 'Enable advanced analytics', 'features', false),
('features.multi_currency', 'true', 'Enable multi-currency support', 'features', false),
('features.webhooks', 'true', 'Enable webhook integrations', 'features', false);