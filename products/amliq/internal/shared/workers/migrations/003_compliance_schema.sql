-- Compliance Platform Schema
-- Enterprise Compliance Platform database tables

-- KYC Requests Table
CREATE TABLE IF NOT EXISTS kyc_requests (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('individual', 'business')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'approved', 'rejected', 'requires_more_info')),
  risk_level TEXT NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  documents TEXT NOT NULL DEFAULT '[]',
  screenings TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- KYC Documents Table
CREATE TABLE IF NOT EXISTS kyc_documents (
  id TEXT PRIMARY KEY,
  kyc_request_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('passport', 'id_card', 'driving_license', 'proof_of_address', 'business_document')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
  url TEXT NOT NULL,
  checksum TEXT NOT NULL,
  extracted_data TEXT NOT NULL DEFAULT '{}',
  ai_analysis TEXT NOT NULL DEFAULT '{}',
  uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  verified_at TEXT,
  FOREIGN KEY (kyc_request_id) REFERENCES kyc_requests(id) ON DELETE CASCADE
);

-- Screening Requests Table
CREATE TABLE IF NOT EXISTS screening_requests (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  provider TEXT NOT NULL DEFAULT 'complyadvantage' CHECK (provider IN ('complyadvantage', 'opensanctions', 'internal')),
  search_type TEXT NOT NULL DEFAULT 'all',
  results TEXT NOT NULL DEFAULT '{}',
  ai_analysis TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Screening Matches Table
CREATE TABLE IF NOT EXISTS screening_matches (
  id TEXT PRIMARY KEY,
  screening_request_id TEXT NOT NULL,
  name TEXT NOT NULL,
  match_score REAL NOT NULL,
  source TEXT NOT NULL,
  reason TEXT,
  details TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (screening_request_id) REFERENCES screening_requests(id) ON DELETE CASCADE
);

-- Compliance Cases Table
CREATE TABLE IF NOT EXISTS compliance_cases (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('kyc', 'screening', 'adverse_media', 'transaction_monitoring')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_review', 'escalated', 'closed', 'dismissed')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  assignee_id TEXT,
  creator_id TEXT NOT NULL,
  evidence TEXT NOT NULL DEFAULT '[]',
  tags TEXT NOT NULL DEFAULT '[]',
  ai_insights TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  due_date TEXT,
  resolved_at TEXT,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Evidence Table
CREATE TABLE IF NOT EXISTS evidence (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('document', 'screenshot', 'transaction_record', 'correspondence', 'ai_analysis')),
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT,
  file_checksum TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  uploaded_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES compliance_cases(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Adverse Media Monitoring Table
CREATE TABLE IF NOT EXISTS adverse_media_monitoring (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('person', 'entity')),
  search_term TEXT NOT NULL,
  source TEXT NOT NULL,
  url TEXT,
  content_snippet TEXT,
  risk_score REAL NOT NULL DEFAULT 0,
  category TEXT,
  discovered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Compliance Policies Table
CREATE TABLE IF NOT EXISTS compliance_policies (
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

-- Create indexes for performance
CREATE INDEX idx_kyc_requests_org_id ON kyc_requests(organization_id);
CREATE INDEX idx_kyc_requests_customer_id ON kyc_requests(customer_id);
CREATE INDEX idx_kyc_requests_status ON kyc_requests(status);
CREATE INDEX idx_kyc_documents_request_id ON kyc_documents(kyc_request_id);
CREATE INDEX idx_screening_requests_org_id ON screening_requests(organization_id);
CREATE INDEX idx_screening_matches_request_id ON screening_matches(screening_request_id);
CREATE INDEX idx_compliance_cases_org_id ON compliance_cases(organization_id);
CREATE INDEX idx_compliance_cases_status ON compliance_cases(status);
CREATE INDEX idx_compliance_cases_priority ON compliance_cases(priority);
CREATE INDEX idx_evidence_case_id ON evidence(case_id);
CREATE INDEX idx_adverse_media_org_id ON adverse_media_monitoring(organization_id);
CREATE INDEX idx_compliance_policies_org_id ON compliance_policies(organization_id);