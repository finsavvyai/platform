-- DB_COMPLIANCE Database Schema
-- Contains: compliance_us_*, compliance_eu_*, cases_*, evidence_* tables

-- KYC/Identity Verification tables for US region
CREATE TABLE IF NOT EXISTS compliance_us_customers (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    customer_type TEXT CHECK(customer_type IN ('individual', 'business')) NOT NULL,
    legal_name TEXT NOT NULL,
    trade_name TEXT,
    registration_number TEXT,
    tax_id TEXT,
    date_of_birth DATE,
    nationality TEXT,
    residency TEXT CHECK(residency IN ('resident', 'non_resident', 'dual')) DEFAULT 'resident',
    risk_level TEXT CHECK(risk_level IN ('low', 'medium', 'high')) DEFAULT 'medium',
    status TEXT CHECK(status IN ('pending', 'under_review', 'verified', 'rejected', 'suspended')) DEFAULT 'pending',
    kyc_level INTEGER CHECK(kyc_level >= 1 AND kyc_level <= 4) DEFAULT 1,
    last_screening DATETIME,
    next_screening_due DATETIME,
    metadata TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Indexes
    INDEX idx_compliance_us_customers_org (organization_id),
    INDEX idx_compliance_us_customers_type (customer_type),
    INDEX idx_compliance_us_customers_risk (risk_level),
    INDEX idx_compliance_us_customers_status (status),
    INDEX idx_compliance_us_customers_kyc (kyc_level),
    INDEX idx_compliance_us_customers_screening (next_screening_due)
);

CREATE TABLE IF NOT EXISTS compliance_us_addresses (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    address_type TEXT CHECK(address_type IN ('registered', 'mailing', 'residential', 'business')) NOT NULL,
    address_line_1 TEXT NOT NULL,
    address_line_2 TEXT,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    postal_code TEXT NOT NULL,
    country TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT false,
    verified BOOLEAN DEFAULT false,
    verification_method TEXT,
    verified_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Foreign keys
    FOREIGN KEY (customer_id) REFERENCES compliance_us_customers(id) ON DELETE CASCADE,

    -- Indexes
    INDEX idx_compliance_us_addresses_customer (customer_id),
    INDEX idx_compliance_us_addresses_type (address_type),
    INDEX idx_compliance_us_addresses_primary (is_primary),
    INDEX idx_compliance_us_addresses_verified (verified)
);

CREATE TABLE IF NOT EXISTS compliance_us_documents (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    document_type TEXT CHECK(document_type IN ('passport', 'driver_license', 'national_id', 'utility_bill', 'bank_statement', 'incorporation_docs', 'articles_of_association', 'proof_of_address', 'other')) NOT NULL,
    document_number TEXT,
    issuing_country TEXT,
    issue_date DATE,
    expiry_date DATE,
    file_url TEXT, -- R2 URL
    file_hash TEXT,
    verification_status TEXT CHECK(verification_status IN ('pending', 'verified', 'rejected', 'expired')) DEFAULT 'pending',
    verification_details TEXT, -- JSON
    extracted_data TEXT, -- JSON with OCR results
    ai_analysis TEXT, -- JSON with AI-powered analysis
    reviewed_by TEXT,
    reviewed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Foreign keys
    FOREIGN KEY (customer_id) REFERENCES compliance_us_customers(id) ON DELETE CASCADE,

    -- Indexes
    INDEX idx_compliance_us_documents_customer (customer_id),
    INDEX idx_compliance_us_documents_type (document_type),
    INDEX idx_compliance_us_documents_status (verification_status),
    INDEX idx_compliance_us_documents_expiry (expiry_date)
);

CREATE TABLE IF NOT EXISTS compliance_us_beneficial_owners (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    name TEXT NOT NULL,
    date_of_birth DATE,
    nationality TEXT,
    ownership_percentage REAL CHECK(ownership_percentage >= 0 AND ownership_percentage <= 100),
    role TEXT CHECK(role IN ('director', 'shareholder', 'beneficial_owner', 'authorized_signatory', 'other')),
    control_type TEXT CHECK(control_type IN ('direct', 'indirect', 'beneficial')),
    is_politically_exposed BOOLEAN DEFAULT false,
    pep_details TEXT, -- JSON with PEP information
    verification_status TEXT CHECK(verification_status IN ('pending', 'verified', 'rejected')) DEFAULT 'pending',
    documents TEXT, -- JSON array of document IDs
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Foreign keys
    FOREIGN KEY (customer_id) REFERENCES compliance_us_customers(id) ON DELETE CASCADE,

    -- Indexes
    INDEX idx_compliance_us_beneficial_owners_customer (customer_id),
    INDEX idx_compliance_us_beneficial_owners_pep (is_politically_exposed),
    INDEX idx_compliance_us_beneficial_owners_role (role),
    INDEX idx_compliance_us_beneficial_owners_ownership (ownership_percentage)
);

-- KYC/Identity Verification tables for EU region
CREATE TABLE IF NOT EXISTS compliance_eu_customers (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    customer_type TEXT CHECK(customer_type IN ('individual', 'business')) NOT NULL,
    legal_name TEXT NOT NULL,
    trade_name TEXT,
    registration_number TEXT,
    vat_number TEXT,
    tax_id TEXT,
    date_of_birth DATE,
    nationality TEXT,
    residency TEXT CHECK(residency IN ('resident', 'non_resident', 'dual')) DEFAULT 'resident',
    risk_level TEXT CHECK(risk_level IN ('low', 'medium', 'high')) DEFAULT 'medium',
    status TEXT CHECK(status IN ('pending', 'under_review', 'verified', 'rejected', 'suspended')) DEFAULT 'pending',
    kyc_level INTEGER CHECK(kyc_level >= 1 AND kyc_level <= 4) DEFAULT 1,
    last_screening DATETIME,
    next_screening_due DATETIME,
    gdpr_consent TEXT, -- JSON with consent details
    data_retention_until DATETIME,
    metadata TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Indexes
    INDEX idx_compliance_eu_customers_org (organization_id),
    INDEX idx_compliance_eu_customers_type (customer_type),
    INDEX idx_compliance_eu_customers_risk (risk_level),
    INDEX idx_compliance_eu_customers_status (status),
    INDEX idx_compliance_eu_customers_kyc (kyc_level),
    INDEX idx_compliance_eu_customers_screening (next_screening_due),
    INDEX idx_compliance_eu_customers_retention (data_retention_until)
);

CREATE TABLE IF NOT EXISTS compliance_eu_addresses (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    address_type TEXT CHECK(address_type IN ('registered', 'mailing', 'residential', 'business')) NOT NULL,
    address_line_1 TEXT NOT NULL,
    address_line_2 TEXT,
    city TEXT NOT NULL,
    state TEXT,
    postal_code TEXT NOT NULL,
    country TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT false,
    verified BOOLEAN DEFAULT false,
    verification_method TEXT,
    verified_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Foreign keys
    FOREIGN KEY (customer_id) REFERENCES compliance_eu_customers(id) ON DELETE CASCADE,

    -- Indexes
    INDEX idx_compliance_eu_addresses_customer (customer_id),
    INDEX idx_compliance_eu_addresses_type (address_type),
    INDEX idx_compliance_eu_addresses_primary (is_primary),
    INDEX idx_compliance_eu_addresses_verified (verified)
);

CREATE TABLE IF NOT EXISTS compliance_eu_documents (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    document_type TEXT CHECK(document_type IN ('passport', 'national_id', 'driver_license', 'utility_bill', 'bank_statement', 'incorporation_docs', 'articles_of_association', 'proof_of_address', 'other')) NOT NULL,
    document_number TEXT,
    issuing_country TEXT,
    issue_date DATE,
    expiry_date DATE,
    file_url TEXT, -- R2 URL
    file_hash TEXT,
    verification_status TEXT CHECK(verification_status IN ('pending', 'verified', 'rejected', 'expired')) DEFAULT 'pending',
    verification_details TEXT, -- JSON
    extracted_data TEXT, -- JSON with OCR results
    ai_analysis TEXT, -- JSON with AI-powered analysis
    gdpr_processed BOOLEAN DEFAULT false,
    data_subject_request_id TEXT,
    reviewed_by TEXT,
    reviewed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Foreign keys
    FOREIGN KEY (customer_id) REFERENCES compliance_eu_customers(id) ON DELETE CASCADE,

    -- Indexes
    INDEX idx_compliance_eu_documents_customer (customer_id),
    INDEX idx_compliance_eu_documents_type (document_type),
    INDEX idx_compliance_eu_documents_status (verification_status),
    INDEX idx_compliance_eu_documents_expiry (expiry_date),
    INDEX idx_compliance_eu_documents_gdpr (gdpr_processed)
);

CREATE TABLE IF NOT EXISTS compliance_eu_beneficial_owners (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    name TEXT NOT NULL,
    date_of_birth DATE,
    nationality TEXT,
    ownership_percentage REAL CHECK(ownership_percentage >= 0 AND ownership_percentage <= 100),
    role TEXT CHECK(role IN ('director', 'shareholder', 'beneficial_owner', 'authorized_signatory', 'ultimate_beneficial_owner', 'other')),
    control_type TEXT CHECK(control_type IN ('direct', 'indirect', 'beneficial')),
    is_politically_exposed BOOLEAN DEFAULT false,
    pep_details TEXT, -- JSON with PEP information
    verification_status TEXT CHECK(verification_status IN ('pending', 'verified', 'rejected')) DEFAULT 'pending',
    documents TEXT, -- JSON array of document IDs
    gdpr_consent TEXT, -- JSON with specific consent
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Foreign keys
    FOREIGN KEY (customer_id) REFERENCES compliance_eu_customers(id) ON DELETE CASCADE,

    -- Indexes
    INDEX idx_compliance_eu_beneficial_owners_customer (customer_id),
    INDEX idx_compliance_eu_beneficial_owners_pep (is_politically_exposed),
    INDEX idx_compliance_eu_beneficial_owners_role (role),
    INDEX idx_compliance_eu_beneficial_owners_ownership (ownership_percentage)
);

-- Sanctions Screening tables
CREATE TABLE IF NOT EXISTS sanctions_screenings (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    customer_id TEXT,
    screening_type TEXT CHECK(screening_type IN ('initial', 'periodic', 'event_driven', 'ad_hoc')) NOT NULL,
    screening_scope TEXT CHECK(screening_scope IN ('individual', 'business', 'beneficial_owners', 'all')) NOT NULL,
    search_criteria TEXT NOT NULL, -- JSON with search parameters
    screening_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT CHECK(status IN ('pending', 'in_progress', 'completed', 'failed')) DEFAULT 'pending',
    total_hits INTEGER DEFAULT 0,
    high_risk_hits INTEGER DEFAULT 0,
    medium_risk_hits INTEGER DEFAULT 0,
    low_risk_hits INTEGER DEFAULT 0,
    requires_review BOOLEAN DEFAULT false,
    reviewed_by TEXT,
    reviewed_at DATETIME,
    review_notes TEXT,
    metadata TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Indexes
    INDEX idx_sanctions_screenings_org (organization_id),
    INDEX idx_sanctions_screenings_customer (customer_id),
    INDEX idx_sanctions_screenings_type (screening_type),
    INDEX idx_sanctions_screenings_date (screening_date),
    INDEX idx_sanctions_screenings_status (status),
    INDEX idx_sanctions_screenings_review (requires_review)
);

CREATE TABLE IF NOT EXISTS sanctions_hits (
    id TEXT PRIMARY KEY,
    screening_id TEXT NOT NULL,
    list_name TEXT NOT NULL, -- 'OFAC', 'UN', 'EU', 'HMT', etc.
    list_version TEXT,
    record_id TEXT NOT NULL, -- ID from the sanctions list
    match_score REAL CHECK(match_score >= 0 AND match_score <= 1),
    confidence_level TEXT CHECK(confidence_level IN ('high', 'medium', 'low')),
    match_details TEXT NOT NULL, -- JSON with match details
    entity_data TEXT, -- JSON with original entity data from the list
    risk_level TEXT CHECK(risk_level IN ('low', 'medium', 'high', 'critical')),
    is_false_positive BOOLEAN DEFAULT false,
    false_positive_reason TEXT,
    requires_escalation BOOLEAN DEFAULT false,
    escalated_to TEXT,
    escalated_at DATETIME,
    resolution TEXT,
    resolved_by TEXT,
    resolved_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Foreign keys
    FOREIGN KEY (screening_id) REFERENCES sanctions_screenings(id) ON DELETE CASCADE,

    -- Indexes
    INDEX idx_sanctions_hits_screening (screening_id),
    INDEX idx_sanctions_hits_list (list_name),
    INDEX idx_sanctions_hits_score (match_score),
    INDEX idx_sanctions_hits_risk (risk_level),
    INDEX idx_sanctions_hits_false_positive (is_false_positive),
    INDEX idx_sanctions_hits_escalation (requires_escalation)
);

-- Case Management tables
CREATE TABLE IF NOT EXISTS cases (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    case_number TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    case_type TEXT CHECK(case_type IN ('kyc_review', 'aml_investigation', 'sanctions_review', 'compliance_breach', 'data_subject_request', 'other')) NOT NULL,
    severity TEXT CHECK(severity IN ('low', 'medium', 'high', 'critical')) NOT NULL,
    status TEXT CHECK(status IN ('open', 'under_investigation', 'awaiting_information', 'escalated', 'resolved', 'closed')) DEFAULT 'open',
    priority INTEGER CHECK(priority >= 1 AND priority <= 5) DEFAULT 3,
    customer_id TEXT,
    assigned_to TEXT,
    reported_by TEXT NOT NULL,
    source_type TEXT CHECK(source_type IN ('automated', 'manual', 'external', 'regulatory')) NOT NULL,
    source_reference TEXT,
    risk_assessment TEXT, -- JSON
    regulatory_requirements TEXT, -- JSON
    metadata TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    due_date DATETIME,
    resolved_at DATETIME,
    resolution_summary TEXT,
    lessons_learned TEXT,

    -- Indexes
    INDEX idx_cases_org (organization_id),
    INDEX idx_cases_number (case_number),
    INDEX idx_cases_type (case_type),
    INDEX idx_cases_severity (severity),
    INDEX idx_cases_status (status),
    INDEX idx_cases_priority (priority),
    INDEX idx_cases_customer (customer_id),
    INDEX idx_cases_assigned (assigned_to),
    INDEX idx_cases_created (created_at),
    INDEX idx_cases_due (due_date)
);

CREATE TABLE IF NOT EXISTS case_evidence (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    evidence_type TEXT CHECK(evidence_type IN ('document', 'screenshot', 'log_file', 'communication', 'transaction_record', 'system_output', 'testimony', 'other')) NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    file_url TEXT, -- R2 URL
    file_hash TEXT,
    file_metadata TEXT, -- JSON with file details
    source_system TEXT,
    collection_method TEXT CHECK(collection_method IN ('upload', 'api_import', 'system_capture', 'manual_entry')),
    collector_name TEXT,
    collection_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    relevance_level TEXT CHECK(relevance_level IN ('critical', 'high', 'medium', 'low')) DEFAULT 'medium',
    is_confidential BOOLEAN DEFAULT false,
    access_restrictions TEXT, -- JSON
    verified BOOLEAN DEFAULT false,
    verified_by TEXT,
    verified_at DATETIME,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Foreign keys
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,

    -- Indexes
    INDEX idx_case_evidence_case (case_id),
    INDEX idx_case_evidence_type (evidence_type),
    INDEX idx_case_evidence_relevance (relevance_level),
    INDEX idx_case_evidence_confidential (is_confidential),
    INDEX idx_case_evidence_collected (collection_date),
    INDEX idx_case_evidence_verified (verified)
);

CREATE TABLE IF NOT EXISTS case_activities (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    activity_type TEXT CHECK(activity_type IN ('note', 'assignment', 'status_change', 'evidence_added', 'communication', 'decision', 'escalation', 'review')) NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    details TEXT, -- JSON with activity-specific details
    performed_by TEXT NOT NULL,
    visibility TEXT CHECK(visibility IN ('public', 'internal', 'confidential', 'restricted')) DEFAULT 'internal',
    attachments TEXT, -- JSON array of evidence IDs
    next_action_date DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Foreign keys
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,

    -- Indexes
    INDEX idx_case_activities_case (case_id),
    INDEX idx_case_activities_type (activity_type),
    INDEX idx_case_activities_performed (performed_by),
    INDEX idx_case_activities_visibility (visibility),
    INDEX idx_case_activities_created (created_at)
);

CREATE TABLE IF NOT EXISTS case_communications (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    communication_type TEXT CHECK(communication_type IN ('email', 'phone_call', 'meeting', 'letter', 'chat', 'other')) NOT NULL,
    direction TEXT CHECK(direction IN ('inbound', 'outbound', 'internal')) NOT NULL,
    participants TEXT NOT NULL, -- JSON array of participant information
    subject TEXT,
    summary TEXT NOT NULL,
    content TEXT, -- Full communication content or summary
    communication_date DATETIME NOT NULL,
    duration_minutes INTEGER,
    recording_url TEXT, -- For calls/meetings
    attachments TEXT, -- JSON array of file URLs
    importance TEXT CHECK(importance IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
    requires_follow_up BOOLEAN DEFAULT false,
    follow_up_date DATETIME,
    created_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Foreign keys
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,

    -- Indexes
    INDEX idx_case_communications_case (case_id),
    INDEX idx_case_communications_type (communication_type),
    INDEX idx_case_communications_direction (direction),
    INDEX idx_case_communications_date (communication_date),
    INDEX idx_case_communications_importance (importance),
    INDEX idx_case_communications_followup (requires_follow_up)
);

-- Regulatory Reporting tables
CREATE TABLE IF NOT EXISTS regulatory_reports (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    report_type TEXT CHECK(report_type IN ('sar', 'ctr', 'cmr', 'annual_report', 'audit_report', 'compliance_certificate', 'other')) NOT NULL,
    jurisdiction TEXT NOT NULL,
    reporting_period_start DATE NOT NULL,
    reporting_period_end DATE NOT NULL,
    report_reference TEXT,
    status TEXT CHECK(status IN ('draft', 'submitted', 'accepted', 'rejected', 'amended')) DEFAULT 'draft',
    submission_method TEXT CHECK(submission_method IN ('electronic', 'manual', 'api', 'other')) NOT NULL,
    submission_date DATETIME,
    acknowledgement_reference TEXT,
    report_data TEXT NOT NULL, -- JSON with report data
    supporting_documents TEXT, -- JSON array of document URLs
    prepared_by TEXT NOT NULL,
    reviewed_by TEXT,
    approved_by TEXT,
    metadata TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Indexes
    INDEX idx_regulatory_reports_org (organization_id),
    INDEX idx_regulatory_reports_type (report_type),
    INDEX idx_regulatory_reports_jurisdiction (jurisdiction),
    INDEX idx_regulatory_reports_period (reporting_period_start, reporting_period_end),
    INDEX idx_regulatory_reports_status (status),
    INDEX idx_regulatory_reports_submission (submission_date)
);

CREATE TABLE IF NOT EXISTS compliance_training (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    training_program TEXT NOT NULL,
    training_type TEXT CHECK(training_type IN ('aml', 'kyc', 'gdpr', 'pci_dss', 'data_protection', 'ethics', 'other')) NOT NULL,
    description TEXT,
    required_for TEXT CHECK(required_for IN ('all_staff', 'compliance_team', 'front_office', 'senior_management', 'board')) NOT NULL,
    completion_deadline DATE,
    duration_minutes INTEGER,
    training_materials TEXT, -- JSON with URLs to materials
    assessment_required BOOLEAN DEFAULT true,
    pass_score INTEGER CHECK(pass_score >= 0 AND pass_score <= 100) DEFAULT 80,
    is_active BOOLEAN DEFAULT true,
    created_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Indexes
    INDEX idx_compliance_training_org (organization_id),
    INDEX idx_compliance_training_type (training_type),
    INDEX idx_compliance_training_required (required_for),
    INDEX idx_compliance_training_active (is_active),
    INDEX idx_compliance_training_deadline (completion_deadline)
);

CREATE TABLE IF NOT EXISTS compliance_training_records (
    id TEXT PRIMARY KEY,
    training_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    completion_status TEXT CHECK(completion_status IN ('not_started', 'in_progress', 'completed', 'failed', 'expired')) DEFAULT 'not_started',
    started_at DATETIME,
    completed_at DATETIME,
    score INTEGER,
    certificate_url TEXT, -- R2 URL
    certificate_id TEXT,
    expires_at DATETIME,
    reminder_sent BOOLEAN DEFAULT false,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Foreign keys
    FOREIGN KEY (training_id) REFERENCES compliance_training(id) ON DELETE CASCADE,

    -- Indexes
    INDEX idx_compliance_training_records_training (training_id),
    INDEX idx_compliance_training_records_user (user_id),
    INDEX idx_compliance_training_records_status (completion_status),
    INDEX idx_compliance_training_records_completed (completed_at),
    INDEX idx_compliance_training_records_expires (expires_at)
);

-- Data Subject Request management (GDPR/CCPA)
CREATE TABLE IF NOT EXISTS data_subject_requests (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    request_type TEXT CHECK(request_type IN ('access', 'rectification', 'erasure', 'portability', 'restriction', 'objection')) NOT NULL,
    subject_identifier TEXT NOT NULL, -- Email, customer ID, etc.
    subject_contact TEXT, -- Contact information for response
    request_details TEXT, -- JSON with specific request details
    status TEXT CHECK(status IN ('received', 'validating', 'processing', 'awaiting_info', 'completed', 'rejected', 'expired')) DEFAULT 'received',
    priority TEXT CHECK(priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
    assigned_to TEXT,
    legal_basis TEXT, -- Legal basis for processing
    deadline DATETIME, -- Regulatory deadline
    response_details TEXT, -- JSON with response information
    response_sent_at DATETIME,
    rejection_reason TEXT,
    metadata TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Indexes
    INDEX idx_data_subject_requests_org (organization_id),
    INDEX idx_data_subject_requests_type (request_type),
    INDEX idx_data_subject_requests_status (status),
    INDEX idx_data_subject_requests_priority (priority),
    INDEX idx_data_subject_requests_deadline (deadline),
    INDEX idx_data_subject_requests_created (created_at)
);

-- Compliance monitoring and metrics
CREATE TABLE IF NOT EXISTS compliance_metrics (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    metric_type TEXT CHECK(metric_type IN ('kyc_completion_rate', 'screening_coverage', 'case_resolution_time', 'training_completion', 'regulatory_filings', 'data_requests')) NOT NULL,
    metric_period DATE NOT NULL,
    metric_value REAL NOT NULL,
    target_value REAL,
    unit TEXT,
    breakdown TEXT, -- JSON with breakdown by category
    calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Indexes
    INDEX idx_compliance_metrics_org (organization_id),
    INDEX idx_compliance_metrics_type (metric_type),
    INDEX idx_compliance_metrics_period (metric_period),
    INDEX idx_compliance_metrics_calculated (calculated_at)
);
