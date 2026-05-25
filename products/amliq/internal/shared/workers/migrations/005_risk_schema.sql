-- Risk Investigator Schema
-- Risk Investigator Engine database tables

-- Risk Events Table
CREATE TABLE IF NOT EXISTS risk_events (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  transaction_id TEXT,
  user_id TEXT,
  type TEXT NOT NULL CHECK (type IN ('transaction', 'user_behavior', 'pattern_anomaly', 'external_threat')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  risk_score REAL NOT NULL DEFAULT 0,
  features TEXT NOT NULL DEFAULT '{}',
  decision TEXT NOT NULL DEFAULT '{}',
  raw_event TEXT NOT NULL,
  processed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Risk Policies Table
CREATE TABLE IF NOT EXISTS risk_policies (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'testing')),
  conditions TEXT NOT NULL DEFAULT '[]',
  actions TEXT NOT NULL DEFAULT '[]',
  model_config TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT NOT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Risk Assessments Table
CREATE TABLE IF NOT EXISTS risk_assessments (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  user_id TEXT,
  risk_score REAL NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  model_version TEXT NOT NULL,
  features_used TEXT NOT NULL DEFAULT '[]',
  shap_values TEXT NOT NULL DEFAULT '{}',
  explanation TEXT,
  recommendation TEXT NOT NULL,
  confidence REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES risk_events(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Risk Patterns Table
CREATE TABLE IF NOT EXISTS risk_patterns (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  pattern_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  conditions TEXT NOT NULL DEFAULT '{}',
  detection_count INTEGER NOT NULL DEFAULT 0,
  false_positive_count INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- User Risk Profiles Table
CREATE TABLE IF NOT EXISTS user_risk_profiles (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  risk_score REAL NOT NULL DEFAULT 0,
  risk_level TEXT NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  behavior_baseline TEXT NOT NULL DEFAULT '{}',
  device_fingerprints TEXT NOT NULL DEFAULT '[]',
  typical_locations TEXT NOT NULL DEFAULT '[]',
  trusted_ips TEXT NOT NULL DEFAULT '[]',
  last_updated TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(organization_id, user_id)
);

-- Risk Incidents Table
CREATE TABLE IF NOT EXISTS risk_incidents (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'closed')),
  assigned_to TEXT,
  reporter_id TEXT,
  affected_users TEXT NOT NULL DEFAULT '[]',
  affected_transactions TEXT NOT NULL DEFAULT '[]',
  evidence TEXT NOT NULL DEFAULT '[]',
  resolution TEXT,
  lessons_learned TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Risk Alerts Table
CREATE TABLE IF NOT EXISTS risk_alerts (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  source_event_id TEXT,
  auto_generated INTEGER NOT NULL DEFAULT 0,
  acknowledged INTEGER NOT NULL DEFAULT 0,
  acknowledged_by TEXT,
  acknowledged_at TEXT,
  resolved INTEGER NOT NULL DEFAULT 0,
  resolved_by TEXT,
  resolved_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (source_event_id) REFERENCES risk_events(id) ON DELETE SET NULL,
  FOREIGN KEY (acknowledged_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Risk Metrics Table
CREATE TABLE IF NOT EXISTS risk_metrics (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  metric_date TEXT NOT NULL,
  total_events INTEGER NOT NULL DEFAULT 0,
  high_risk_events INTEGER NOT NULL DEFAULT 0,
  critical_events INTEGER NOT NULL DEFAULT 0,
  blocked_transactions INTEGER NOT NULL DEFAULT 0,
  average_risk_score REAL NOT NULL DEFAULT 0,
  false_positive_rate REAL NOT NULL DEFAULT 0,
  detection_accuracy REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX idx_risk_events_org_id ON risk_events(organization_id);
CREATE INDEX idx_risk_events_type ON risk_events(type);
CREATE INDEX idx_risk_events_severity ON risk_events(severity);
CREATE INDEX idx_risk_events_created_at ON risk_events(created_at);
CREATE INDEX idx_risk_assessments_event_id ON risk_assessments(event_id);
CREATE INDEX idx_risk_assessments_risk_score ON risk_assessments(risk_score);
CREATE INDEX idx_risk_policies_org_id ON risk_policies(organization_id);
CREATE INDEX idx_risk_policies_status ON risk_policies(status);
CREATE INDEX idx_risk_patterns_org_id ON risk_patterns(organization_id);
CREATE INDEX idx_risk_patterns_active ON risk_patterns(active);
CREATE INDEX idx_user_risk_profiles_org_id ON user_risk_profiles(organization_id);
CREATE INDEX idx_user_risk_profiles_user_id ON user_risk_profiles(user_id);
CREATE INDEX idx_risk_incidents_org_id ON risk_incidents(organization_id);
CREATE INDEX idx_risk_incidents_severity ON risk_incidents(severity);
CREATE INDEX idx_risk_incidents_status ON risk_incidents(status);
CREATE INDEX idx_risk_alerts_org_id ON risk_alerts(organization_id);
CREATE INDEX idx_risk_alerts_severity ON risk_alerts(severity);
CREATE INDEX idx_risk_alerts_status ON risk_alerts(acknowledged, resolved);
CREATE INDEX idx_risk_metrics_org_id_date ON risk_metrics(organization_id, metric_date);