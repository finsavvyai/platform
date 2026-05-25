-- Fraud Detection Rules Seed Data
-- Environment: all
-- Order: 10
-- Required: true

INSERT INTO fraud_rules (name, description, rule_type, conditions, actions, priority, is_active, created_by) VALUES
('High Transaction Amount Alert', 'Alert on unusually high transaction amounts', 'threshold',
'{"field": "amount", "operator": ">", "value": 10000, "currency": "USD"}',
'{"action": "alert", "severity": "high", "message": "High value transaction detected", "auto_block": false}',
90, true, (SELECT id FROM users WHERE username = 'system'));

INSERT INTO fraud_rules (name, description, rule_type, conditions, actions, priority, is_active, created_by) VALUES
('Rapid Transaction Velocity', 'Alert on rapid transaction patterns', 'pattern',
'{"field": "transaction_count", "operator": ">", "value": 10, "time_window": "5m"}',
'{"action": "alert", "severity": "medium", "message": "High transaction velocity detected", "investigation_required": true}',
80, true, (SELECT id FROM users WHERE username = 'system'));

INSERT INTO fraud_rules (name, description, rule_type, conditions, actions, priority, is_active, created_by) VALUES
('Unusual Location', 'Alert on transactions from unusual locations', 'custom',
'{"field": "location_risk_score", "operator": ">", "value": 0.8}',
'{"action": "alert", "severity": "medium", "message": "Transaction from high-risk location", "manual_review": true}',
70, true, (SELECT id FROM users WHERE username = 'system'));

INSERT INTO fraud_rules (name, description, rule_type, conditions, actions, priority, is_active, created_by) VALUES
('Suspicious Device Fingerprint', 'Alert on known malicious device fingerprints', 'custom',
'{"field": "device_fingerprint", "operator": "in", "value": ["blacklisted_fp1", "blacklisted_fp2", "blacklisted_fp3"]}',
'{"action": "block", "severity": "high", "message": "Transaction from blacklisted device", "auto_block": true}',
95, true, (SELECT id FROM users WHERE username = 'system'));

INSERT INTO fraud_rules (name, description, rule_type, conditions, actions, priority, is_active, created_by) VALUES
('AI High Risk Alert', 'Alert on AI-detected high risk transactions', 'ml_model',
'{"field": "ai_risk_score", "operator": ">", "value": 0.85}',
'{"action": "investigate", "severity": "high", "message": "AI model indicates high fraud risk", "escalate": true}',
85, true, (SELECT id FROM users WHERE username = 'system'));

INSERT INTO fraud_rules (name, description, rule_type, conditions, actions, priority, is_active, created_by) VALUES
('Quantum Anomaly Detection', 'Alert on quantum computing anomalies', 'quantum',
'{"field": "quantum_anomaly_score", "operator": ">", "value": 0.9}',
'{"action": "alert", "severity": "high", "message": "Quantum anomaly detected", "detailed_analysis": true}',
88, true, (SELECT id FROM users WHERE username = 'system'));

INSERT INTO fraud_rules (name, description, rule_type, conditions, actions, priority, is_active, created_by) VALUES
('Off-Hours Transactions', 'Alert on transactions during unusual hours', 'custom',
'{"field": "hour", "operator": "not_in", "value": [9, 10, 11, 12, 13, 14, 15, 16, 17]},
'{"action": "alert", "severity": "low", "message": "Transaction during unusual hours"}',
60, true, (SELECT id FROM users WHERE username = 'system'));

INSERT INTO fraud_rules (name, description, rule_type, conditions, actions, priority, is_active, created_by) VALUES
('New Device Pattern', 'Alert on transactions from new devices', 'custom',
'{"field": "device_age_days", "operator": "<", "value": 1}',
'{"action": "alert", "severity": "low", "message": "Transaction from new device", "verification_required": true}',
50, true, (SELECT id FROM users WHERE username = 'system'));

INSERT INTO fraud_rules (name, description, rule_type, conditions, actions, priority, is_active, created_by) VALUES
('Cross-Border Amount Mismatch', 'Alert on amount differences between orders', 'custom',
'{"field": "amount_variance", "operator": ">", "value": 0.5}',
'{"action": "alert", "severity": "medium", "message": "Unusual amount variance detected"}',
65, true, (SELECT id FROM users WHERE username = 'system'));

INSERT INTO fraud_rules (name, description, rule_type, conditions, actions, priority, is_active, created_by) VALUES
('Multiple Payment Methods', 'Alert on use of multiple payment methods', 'custom',
'{"field": "payment_method_changes", "operator": ">", "value": 3, "time_window": "1h"},
'{"action": "alert", "severity": "medium", "message": "Multiple payment method changes detected", "pattern_analysis": true}',
75, true, (SELECT id FROM users WHERE username = 'system'));

INSERT INTO fraud_rules (name, description, rule_type, conditions, actions, priority, is_active, created_by) VALUES
('Geographic Impossibility', 'Alert on transactions from geographically impossible locations', 'custom',
'{"field": "location_velocity", "operator": ">", "value": 1000, "unit": "km/h"},
'{"action": "block", "severity": "high", "message": "Geographically impossible transaction detected", "auto_block": true}',
98, true, (SELECT id FROM users WHERE username = 'system'));

INSERT INTO fraud_rules (name, description, rule_type, conditions, actions, priority, is_active, created_by) VALUES
('Card Testing Pattern', 'Alert on card testing behavior patterns', 'pattern',
'{"pattern": "card_testing", "features": ["small_amounts", "sequential_numbers", "rapid_attempts"]}',
'{"action": "investigate", "severity": "medium", "message": "Card testing pattern detected", "temporary_block": true},
85, true, (SELECT id FROM users WHERE username = 'system'));

INSERT INTO fraud_rules (name, description, rule_type, conditions, actions, priority, is_active, created_by) VALUES
('BIN Mismatch Alert', 'Alert when Bank Identification Number doesn''t match card type', 'custom',
'{"field": "bin_mismatch", "operator": "true", "card_type": "credit", "bin_pattern": "debit"}',
'{"action": "alert", "severity": "medium", "message": "BIN mismatch detected between card type and BIN pattern"}',
72, true, (SELECT id FROM users WHERE username = 'system'));

INSERT INTO fraud_rules (name, description, rule_type, conditions, actions, priority, is_active, created_by) VALUES
('Suspicious Transaction Description', 'Alert on suspicious transaction descriptions', 'custom',
'{"field": "description_keywords", "operator": "contains_any", "value": ["test", "demo", "sample", "fake"]}',
'{"action": "alert", "severity": "medium", "message": "Suspicious transaction description detected"}',
55, true, (SELECT id FROM users WHERE username = 'system'));

INSERT INTO fraud_rules (name, description, rule_type, conditions, actions, priority, is_active, created_by) VALUES
('Round Number Alert', 'Alert on exact round numbers', 'custom',
'{"field": "amount", "operator": "mod", "value": 1.00, "tolerance": 0.01}',
'{"action": "alert", "severity": "low", "message": "Round number transaction amount detected"}',
45, true, (SELECT id FROM users WHERE username = 'system'));

INSERT INTO fraud_rules (name, description, rule_type, conditions, actions, priority, is_active, created_by) VALUES
('Email Domain Mismatch', 'Alert when email domain doesn''t match user profile', 'custom',
'{"field": "email_domain_mismatch", "operator": "true"}',
'{"action": "alert", "severity": "low", "message": "Email domain mismatch detected"}',
40, true, (SELECT id FROM users WHERE username = 'system'));

INSERT INTO fraud_rules (name, description, rule_type, conditions, actions, priority, is_active, created_by) VALUES
('IP Address Mismatch', 'Alert when IP doesn''t match usual user location', 'custom',
'{"field": "ip_location_mismatch", "operator": "true"}',
'{"action": "alert", "severity": "medium", "message": "IP address location mismatch detected", "verification_required": true}',
68, true, (SELECT id FROM users WHERE username = 'system'));

INSERT INTO fraud_rules (name, description, rule_type, conditions, actions, priority, is_active, created_by) VALUES
('User Behavior Anomaly', 'Alert when user behavior deviates from normal patterns', 'ml_model',
'{"field": "behavior_anomaly_score", "operator": ">", "value": 0.75}',
'{"action": "investigate", "severity": "medium", "message": "User behavior anomaly detected", "behavior_analysis": true}',
82, true, (SELECT id FROM users WHERE username = 'system'));

INSERT INTO fraud_rules (name, description, rule_type, conditions, actions, priority, is_active, created_by) VALUES
('Merchant Risk Escalation', 'Alert on transactions with high-risk merchants', 'custom',
'{"field": "merchant_risk_score", "operator": ">", "value": 0.8}',
'{"action": "escalate", "severity": "high", "message": "High-risk merchant transaction", "manual_review": true, "escalation_team": "fraud_team"}',
93, true, (SELECT id FROM users WHERE username = 'system'));

INSERT INTO fraud_rules (name, description, rule_type, conditions, actions, priority, is_active, created_by) VALUES
('Transaction Chain Analysis', 'Alert on suspicious transaction chains', 'custom',
'{"field": "chain_risk_score", "operator": ">", "value": 0.7},
'{"action": "investigate", "severity": "medium", "message": "Suspicious transaction chain detected", "chain_analysis": true},
79, true, (SELECT id FROM users WHERE username = 'system'));

INSERT INTO fraud_rules (name, description, rule_type, conditions, actions, priority, is_active, created_by) VALUES
('Frequency Anomaly Detection', 'Alert when transaction frequency deviates from normal', 'ml_model',
'{"field": "frequency_anomaly_score", "operator": ">", "value": 0.8}',
'{"action": "alert", "severity": "medium", "message": "Transaction frequency anomaly detected", "frequency_analysis": true},
76, true, (SELECT id FROM users WHERE username = 'system'));

INSERT INTO fraud_rules (name, description, rule_type, conditions, actions, priority, is_active, created_by) VALUES
('Amount Pattern Analysis', 'Alert on unusual spending patterns', 'ml_model',
'{"field": "spending_anomaly_score", "operator": ">", "value": 0.7}',
'{"action": "alert", "severity": "medium", "message": "Unusual spending pattern detected", "pattern_analysis": true},
74, true, (SELECT id FROM users WHERE username = 'system'));

INSERT INTO fraud_rules (name, description, rule_type, conditions, actions, priority, is_active, created_by) VALUES
('Time-Based Fraud Pattern', 'Alert on time-based fraud patterns', 'custom',
'{"field": "time_pattern_risk", "operator": ">", "value": 0.6}',
'{"action": "alert", "severity": "medium", "message": "Time-based fraud pattern detected", "temporal_analysis": true},
71, true, (SELECT id FROM users WHERE username = 'system'));

INSERT INTO fraud_rules (name, description, rule_type, conditions, actions, priority, is_active, created_by) VALUES
('Social Engineering Detection', 'Alert on potential social engineering attempts', 'custom',
'{"field": "social_engineering_score", "operator": ">", "value": 0.8}',
'{"action": "investigate", "severity": "high", "message": "Social engineering attempt detected", "human_review_required": true, "security_team_alert": true},
92, true, (SELECT id FROM users WHERE username = 'system'));

INSERT INTO fraud_rules (name, description, rule_type, conditions, actions, priority, is_active, created_by) VALUES
('Velocity Burst Detection', 'Alert on sudden velocity bursts', 'custom',
'{"field": "velocity_burst_score", "operator": ">", "value": 0.9},
'{"action": "alert", "severity": "high", "message": "Velocity burst detected", "immediate_action": true, "temporary_block": true},
96, true, (SELECT id FROM users WHERE username = 'system'));

INSERT INTO fraud_rules (name, description, rule_type, conditions, actions, priority, is_active, created_by) VALUES
('Cross-Platform Coordination', 'Alert on coordinated attacks across platforms', 'custom',
'{"field": "cross_platform_coordination", "operator": "true", "platforms": ["web", "mobile", "api"]}',
'{"action": "investigate", "severity": "critical", "message": "Cross-platform coordination detected", "security_team_alert": true, "immediate_response": true},
99, true, (SELECT id FROM WHERE users WHERE username = 'system'));

INSERT INTO fraud_rules (name, description, rule_type, conditions, actions, priority, is_active, created_by) VALUES
('Synthetic Identity Detection', 'Alert on likely synthetic identities', 'ml_model',
'{"field": "synthetic_identity_score", "operator": ">", "value": 0.85},
'{"action": "investigate", "severity": "high", "message": "Synthetic identity detected", "identity_verification": true, "enhanced_diligence": true},
91, true, (SELECT id FROM users WHERE username = 'system'));

INSERT INTO fraud_rules (name, description, rule_type, conditions, actions, priority, is_active, created_by) VALUES
('Network Anomaly Detection', 'Alert on network-level anomalies', 'custom',
'{"field": "network_anomaly_score", "operator": ">", "value": 0.7}',
'{"action": "investigate", "severity": "medium", "message": "Network anomaly detected", "network_analysis": true},
73, true, (SELECT id FROM users WHERE username = 'system'));

INSERT INTO fraud_rules (name, description, rule_type, conditions, actions, priority, is_active, created_by) VALUES
('Merchant Category Risk', 'Dynamic risk scoring based on merchant category', 'ml_model',
'{"field": "category_risk_multiplier", "operator": ">", "value": 1.5}',
'{"action": "adjust_risk", "severity": "low", "message": "High-risk merchant category detected", "risk_adjustment": true},
52, true, (SELECT id FROM users WHERE username = 'system'));

INSERT INTO fraud_rules (name, description, rule_type, conditions, actions, priority, is_active, created_by) VALUES
('User Relationship Graph Analysis', 'Analyze user relationships for fraud rings', 'graph_analysis',
'{"field": "suspicious_connections", "operator": ">", "value": 3, "relationship_type": "shared_device"},
'{"action": "investigate", "severity": "high", "message": "Suspicious user relationships detected", "graph_analysis": true, "network_investigation": true},
87, true, (SELECT id FROM users WHERE username = 'system'));

INSERT INTO fraud_rules (name, description, rule_type, conditions, actions, priority, is_active, created_by) VALUES
('Device Behavior Fingerprinting', 'Analyze device behavior patterns', 'behavioral_analysis',
'{"field": "behavior_anomaly_score", "operator": ">", "value": 0.7},
'{"action": "alert", "severity": "medium", "message": "Device behavior anomaly detected", "behavioral_analysis": true},
66, true, (SELECT id FROM users WHERE username = 'system'));

INSERT INTO fraud_rules (name, description, rule_type, conditions, actions, priority, is_active, created_by) VALUES
('Payment Method Risk Scoring', 'Dynamic risk scoring for payment methods', 'risk_scoring',
'{"field": "payment_method_risk_score", "operator": ">", "value": 0.7},
'{"action": "adjust_risk", "severity": "low", "message": "High-risk payment method detected", "risk_adjustment": true},
58, true, (SELECT id FROM users WHERE username = 'system'));

INSERT INTO fraud_rules (name, description, rule_type, conditions, actions, priority, is_active, created_by) VALUES
('Historical Pattern Matching', 'Match against known fraud patterns', 'pattern_matching',
'{"field": "pattern_match_score", "operator": ">", "value": 0.8},
'{"action": "alert", "severity": "medium", "message": "Known fraud pattern matched", "pattern_reference": true},
77, true, (SELECT id FROM users WHERE username = 'system'));

INSERT INTO fraud_rules (name, description, rule_type, conditions, actions, priority, is_active, created_by) VALUES
('Real-Time Risk Assessment', 'Continuous real-time risk monitoring', 'real_time',
'{"field": "real_time_risk_trend", "operator": "increasing", "threshold": 0.1},
'{"action": "monitor", "severity": "low", "message": "Real-time risk trend increasing", "continuous_monitoring": true},
61, true, (SELECT id FROM users WHERE username = 'system'));

INSERT INTO fraud_rules (name, description, rule_type, conditions, actions, priority, is_active, created_by) VALUES
('Machine Learning Ensemble', 'Combine multiple ML models for better accuracy', 'ensemble',
'{"field": "ensemble_confidence", "operator": "<", "value": 0.5},
'{"action": "investigate", "severity": "medium", "message": "Low ensemble confidence detected", "manual_review": true},
69, true, (SELECT id FROM users WHERE username = 'system'));

INSERT INTO fraud_rules (name, description, rule_type, conditions, actions, priority, is_active, created_by) VALUES
('Contextual Risk Analysis', 'Analyze transaction context for risk', 'contextual_analysis',
'{"field": "contextual_risk_score", "operator": ">", "value": 0.6},
'{"action": "adjust_risk", "severity": "low", "message": "Contextual risk factors detected", "context_adjustment": true},
57, true, (SELECT id FROM users WHERE username = 'system'));

INSERT INTO fraud_rules (name, description, rule_type, conditions, actions, priority, is_active, created_by) VALUES
('Adaptive Learning System', 'Self-learning fraud detection system', 'adaptive_learning',
'{"field": "learning_feedback_score", "operator": ">", "value": 0.8},
'{"action": "update_model", "severity": "low", "message": "Model learning feedback received", "model_update": true},
53, true, (SELECT id FROM users WHERE username = 'system'));

INSERT INTO fraud_rules (name, description, rule_type, conditions, actions, priority, is_active, created_by) VALUES
('Multi-Factor Correlation', 'Correlate multiple fraud signals', 'correlation',
'{"field": "correlation_strength", "operator": ">", "value": 0.7},
'{"action": "alert", "severity": "medium", "message": "Multi-factor correlation detected", "correlation_analysis": true},
78, true, (SELECT id FROM users WHERE username = 'system'));

INSERT INTO fraud_rules (name, description, rule_type, conditions, actions, priority, is_active, created_by) VALUES
('Predictive Analytics Model', 'Predictive fraud risk assessment', 'predictive',
'{"field": "predictive_risk_score", "operator": ">", "value": 0.75},
'{"action": "alert", "severity": "medium", "message": "Predictive high risk detected", "prediction_confidence": true},
83, true, (SELECT id FROM users WHERE username = 'system'));

INSERT INTO fraud_rules (name, description, rule_type, conditions, actions, priority, is_active, created_by) VALUES
('Temporal Sequence Analysis', 'Analyze temporal transaction sequences', 'temporal_analysis',
'{"field": "temporal_anomaly_score", "operator": ">", "value": 0.6},
'{"action": "investigate", "severity": "medium", "message": "Temporal sequence anomaly detected", "temporal_analysis": true},
67, true, (SELECT id FROM WHERE users WHERE username = 'system'));

INSERT INTO fraud_rules (name, description, rule_type, conditions, actions, priority, is_active, created_by) VALUES
'Feature Engineering Optimization', 'Optimize ML feature engineering', 'feature_engineering',
'{"field": "feature_importance_score", "operator": "<", "value": 0.3},
'{"action": "update_features", "severity": "low", "message": "Feature optimization needed", "feature_update": true},
48, true, (SELECT id FROM users WHERE username = 'system'));

INSERT INTO fraud_rules (name, description, rule_type, conditions, actions, priority, is_active, created_by) VALUES
('Confidence Calibration', 'Calibrate model confidence scores', 'calibration',
'{"field": "confidence_drift", "operator": ">", "value": 0.2},
'{"action": "recalibrate", "severity": "low", "message": "Model confidence drift detected", "model_recalibration": true},
46, true, (SELECT id FROM users WHERE username = 'system'));

INSERT INTO fraud_rules (name, description, rule_type, conditions, actions, priority, is_active, created_by) VALUES
('Feedback Loop Integration', 'Integrate user feedback into model', 'feedback_loop',
'{"field": "feedback_quality_score", "operator": ">", "value": 0.8},
'{"action": "improve_model", "severity": "low", "message": "High-quality feedback received", "model_improvement": true},
44, true, (SELECT id FROM users WHERE username = 'system'));

INSERT INTO fraud_rules (name, description, rule_type, conditions, actions, priority, is_active, created_by) VALUES
('Edge Case Handling', "Handle rare edge cases and exceptions", 'edge_case',
'{"field": "edge_case_detected", "operator": "true"},
'{"action": "alert", "severity": "low", "message": "Edge case detected", "manual_review": true},
35, true, (SELECT id FROM users WHERE username = 'system'));

INSERT INTO fraud_rules (name, description, rule_type, conditions, actions, priority, is_active, created_by) VALUES
('Data Quality Monitoring', 'Monitor data quality and integrity', 'data_quality',
'{"field": "data_quality_score", "operator": "<", "value": 0.8},
'{"action": "investigate", "severity": "low", "message": "Data quality issue detected", "data_validation": true},
32, true, (SELECT id FROM users WHERE username = 'system'));

INSERT INTO fraud_rules (name, description, rule_type, conditions, actions, priority, is_active, created_by) VALUES
('System Health Monitoring', 'Monitor overall system health', 'system_health',
'{"field": "system_health_score", "operator": "<", "value": 0.9},
'{"action": "alert", "severity": "low", "message": "System health degraded", "system_maintenance": true},
25, true, (ENTITY_EXISTS('users' WHERE username = 'system'));