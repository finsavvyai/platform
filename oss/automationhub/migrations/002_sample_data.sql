-- UPM.Plus Sample Data
-- Initial data for production deployment

-- Insert default tenant
INSERT OR IGNORE INTO tenants (id, name, slug, plan, status, settings) VALUES
(1, 'Default Organization', 'default-org', 'enterprise', 'active', '{"analytics_enabled": true, "multi_cloud_enabled": true, "agents_enabled": true, "advanced_analytics_enabled": true}');

-- Insert sample users
INSERT OR IGNORE INTO users (tenant_id, email, username, first_name, last_name, role, status) VALUES
(1, 'admin@upm.plus', 'admin', 'System', 'Administrator', 'admin', 'active'),
(1, 'demo@upm.plus', 'demo', 'Demo', 'User', 'user', 'active');

-- Insert sample multi-cloud providers
INSERT OR IGNORE INTO multi_cloud_providers (tenant_id, provider_name, provider_type, credentials, configuration, status) VALUES
(1, 'AWS', 'cloud', '{"access_key": "demo", "region": "us-east-1"}', '{"services": ["EC2", "S3", "RDS", "Lambda"]}', 'active'),
(1, 'Azure', 'cloud', '{"subscription_id": "demo", "resource_group": "upm-plus"}', '{"services": ["VMs", "Storage", "SQL Database"]}', 'active'),
(1, 'Google Cloud', 'cloud', '{"project_id": "upm-plus-demo", "zone": "us-central1-a"}', '{"services": ["Compute Engine", "Cloud Storage"]}', 'active'),
(1, 'Cloudflare', 'edge', '{"api_token": "demo", "zone_id": "upm-plus"}', '{"services": ["Workers", "Pages", "R2", "D1"]}', 'active');

-- Insert sample resources
INSERT OR IGNORE INTO multi_cloud_resources (tenant_id, provider_id, resource_id, resource_name, resource_type, resource_region, resource_status, configuration, tags) VALUES
(1, 1, 'i-1234567890abcdef0', 'web-server-01', 'virtual_machine', 'us-east-1', 'running', '{"instance_type": "t3.medium", "cpu": 2, "memory": 4096}', '{"environment": "production", "tier": "web"}'),
(1, 1, 'i-1234567890abcdef1', 'app-server-01', 'virtual_machine', 'us-east-1', 'running', '{"instance_type": "t3.large", "cpu": 4, "memory": 8192}', '{"environment": "production", "tier": "application"}'),
(1, 2, 'vm-upm-plus-web-01', 'web-server-azure', 'virtual_machine', 'East US', 'running', '{"vm_size": "Standard_D2s_v3", "cpu": 2, "memory": 8192}', '{"environment": "production", "provider": "azure"}'),
(1, 4, 'upm-plus-gateway', 'gateway-worker', 'worker', 'global', 'active', '{"routes": ["upm.plus/*"], "binding": "UPM_PLUS_DB"}', '{"service": "api-gateway", "edge": true}');

-- Insert sample analytics metrics
INSERT OR IGNORE INTO analytics_metrics (tenant_id, provider_id, resource_id, resource_type, metric_name, metric_type, value, unit, timestamp, collected_at, tags) VALUES
(1, 1, 'i-1234567890abcdef0', 'virtual_machine', 'cpu_utilization', 'performance', 65.5, 'percentage', datetime('now', '-5 minutes'), datetime('now', '-5 minutes'), '{"provider": "aws", "region": "us-east-1", "instance_type": "t3.medium"}'),
(1, 1, 'i-1234567890abcdef0', 'virtual_machine', 'memory_usage', 'resource', 3072, 'bytes', datetime('now', '-5 minutes'), datetime('now', '-5 minutes'), '{"provider": "aws", "region": "us-east-1", "instance_type": "t3.medium"}'),
(1, 1, 'i-1234567890abcdef1', 'virtual_machine', 'cpu_utilization', 'performance', 45.2, 'percentage', datetime('now', '-5 minutes'), datetime('now', '-5 minutes'), '{"provider": "aws", "region": "us-east-1", "instance_type": "t3.large"}'),
(1, 4, 'upm-plus-gateway', 'worker', 'request_count', 'traffic', 1250, 'count', datetime('now', '-1 minute'), datetime('now', '-1 minute'), '{"provider": "cloudflare", "service": "workers", "route": "upm.plus/*"}'),
(1, 4, 'upm-plus-gateway', 'worker', 'response_time', 'performance', 45.8, 'milliseconds', datetime('now', '-1 minute'), datetime('now', '-1 minute'), '{"provider": "cloudflare", "service": "workers", "route": "upm.plus/*"}');

-- Insert sample anomaly detection
INSERT OR IGNORE INTO anomaly_detection (tenant_id, metric_id, provider_id, resource_id, anomaly_type, severity, score, threshold, metric_value, expected_value, deviation, confidence, status, description, first_detected_at, last_detected_at) VALUES
(1, 1, 1, 'i-1234567890abcdef0', 'cpu_spike', 'medium', 0.75, 0.7, 65.5, 45.0, 20.5, 0.85, 'open', 'CPU utilization spike detected on web server', datetime('now', '-10 minutes'), datetime('now', '-5 minutes'));

-- Insert sample predictive model
INSERT OR IGNORE INTO predictive_models (tenant_id, provider_id, model_name, model_type, target_metric, algorithm, parameters, features, accuracy, mae, rmse, training_data_points, last_trained_at, status) VALUES
(1, 4, 'CPU_Forecast_Model_v1', 'time_series', 'cpu_utilization', 'random_forest', '{"n_estimators": 100, "max_depth": 10}', '["hour_of_day", "day_of_week", "cpu_lag_1h", "cpu_lag_24h"]', 0.87, 4.2, 6.1, 1000, datetime('now', '-2 hours'), 'trained');

-- Insert sample performance forecast
INSERT OR IGNORE INTO performance_forecasts (tenant_id, provider_id, model_id, resource_id, metric_name, forecast_type, forecast_horizon, forecast_values, confidence_intervals, forecast_start_at, forecast_end_at, accuracy, status) VALUES
(1, 4, 1, 'upm-plus-gateway', 'response_time', 'time_series', 24, '{"next_24h": [45.0, 47.5, 50.2, 48.8, 46.5]}', '{"next_24h": [[40.0, 50.0], [42.5, 52.5], [45.2, 55.2], [43.8, 53.8], [41.5, 51.5]]}', datetime('now'), datetime('now', '+24 hours'), 0.85, 'active');

-- Insert sample intelligence report
INSERT OR IGNORE INTO intelligence_reports (tenant_id, provider_id, report_name, report_type, description, executive_summary, analysis_period_start, analysis_period_end, total_metrics_analyzed, anomalies_detected, predictions_generated, key_insights, charts_data, recommendations, status, generated_at) VALUES
(1, 4, 'Daily Performance Analysis', 'performance', 'Comprehensive analysis of system performance and metrics', 'Overall system performance is stable with minor optimization opportunities identified in database query patterns.', datetime('now', '-24 hours'), datetime('now'), 5000, 2, 150, '[{"title": "Response Time Trend", "description": "Average response time decreased by 15% over the past 24 hours", "significance": 0.8}]', '{"performance_chart": {"type": "line", "data": []}, "anomaly_distribution": {"type": "pie", "data": []}}', '[{"action": "Optimize database queries", "priority": "medium", "impact": "Improve response times by 15%"}]', 'completed', datetime('now'));

-- Insert sample insight pattern
INSERT OR IGNORE INTO insight_patterns (tenant_id, provider_id, pattern_name, pattern_type, description, pattern_data, frequency, confidence, significance, recommendations, last_seen_at, times_detected, status) VALUES
(1, 4, 'Peak_Traffic_Pattern', 'seasonal', 'Consistent traffic peak during business hours', '{"peak_hours": [9, 10, 14, 15, 16], "avg_increase": 45, "pattern": "business_hours"}', 15, 0.92, 0.78, '[{"action": "Increase capacity during peak hours", "priority": "medium"}]', datetime('now', '-1 hour'), 15, 'active');

-- Insert sample anomaly alert
INSERT OR IGNORE INTO anomaly_alerts (tenant_id, anomaly_id, provider_id, resource_id, alert_type, severity, title, message, description, action_required, recommendations, threshold_value, actual_value, status) VALUES
(1, 1, 1, 'i-1234567890abcdef0', 'cpu_high', 'medium', 'CPU Usage Alert', 'CPU utilization on web-server-01 is above threshold', 'CPU utilization has exceeded the defined threshold of 70%', 'Investigate cause and optimize if necessary', '[{"action": "Check running processes", "priority": "high"}, {"action": "Consider scaling if trend continues", "priority": "medium"}]', 70.0, 65.5, 'open');