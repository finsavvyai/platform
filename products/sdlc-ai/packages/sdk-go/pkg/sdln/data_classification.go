package sdln

import (
	"fmt"
	"regexp"
	"strings"
	"time"
)

// DataClassifier provides data classification and governance capabilities
type DataClassifier struct {
	classificationRules map[string]*ClassificationRule
	sensitivePatterns   map[string]*regexp.Regexp
	consentTracker      *ConsentTracker
	lineageTracker      *DataLineageTracker
}

// NewDataClassifier creates a new data classifier
func NewDataClassifier() *DataClassifier {
	classifier := &DataClassifier{
		classificationRules: make(map[string]*ClassificationRule),
		sensitivePatterns:   make(map[string]*regexp.Regexp),
		consentTracker:      NewConsentTracker(),
		lineageTracker:      NewDataLineageTracker(),
	}

	classifier.initializeClassificationRules()
	classifier.initializeSensitivePatterns()

	return classifier
}

// ClassificationRule represents a rule for classifying data
type ClassificationRule struct {
	ID             string                    `json:"id"`
	Name           string                    `json:"name"`
	Description    string                    `json:"description"`
	Category       string                    `json:"category"` // personal, financial, health, business, public
	Level          string                    `json:"level"`    // unrestricted, internal, confidential, restricted
	Patterns       []string                  `json:"patterns,omitempty"`
	Keywords       []string                  `json:"keywords,omitempty"`
	Conditions     []ClassificationCondition `json:"conditions,omitempty"`
	RetentionDays  int                       `json:"retention_days"`
	ComplianceTags []string                  `json:"compliance_tags"`
	Enabled        bool                      `json:"enabled"`
	Priority       int                       `json:"priority"`
	CreatedAt      Timestamp                 `json:"created_at"`
	UpdatedAt      Timestamp                 `json:"updated_at"`
}

// ClassificationCondition represents a condition for classification
type ClassificationCondition struct {
	Field    string      `json:"field"`
	Operator string      `json:"operator"` // equals, contains, matches, greater_than, less_than
	Value    interface{} `json:"value"`
	Required bool        `json:"required"`
}

// ClassifiedData represents data that has been classified
type ClassifiedData struct {
	ID              string                 `json:"id"`
	DataID          string                 `json:"data_id"`
	DataType        string                 `json:"data_type"`
	Category        string                 `json:"category"`
	Level           string                 `json:"level"`
	RiskScore       float64                `json:"risk_score"`
	Classification  ClassificationResult   `json:"classification"`
	ConsentStatus   ConsentStatus          `json:"consent_status"`
	Lineage         DataLineage            `json:"lineage"`
	RetentionPeriod int                    `json:"retention_period"`
	ComplianceTags  []string               `json:"compliance_tags"`
	ClassifiedAt    Timestamp              `json:"classified_at"`
	ClassifiedBy    string                 `json:"classified_by"`
	Metadata        map[string]interface{} `json:"metadata,omitempty"`
}

// ClassificationResult represents the result of data classification
type ClassificationResult struct {
	Confidence      float64  `json:"confidence"`
	MatchedRules    []string `json:"matched_rules"`
	AppliedPolicies []string `json:"applied_policies"`
	Sensitivity     string   `json:"sensitivity"` // low, medium, high, very_high
	Recommendations []string `json:"recommendations"`
	Justification   string   `json:"justification"`
}

// ConsentStatus represents consent status for data processing
type ConsentStatus struct {
	ConsentID        string                 `json:"consent_id"`
	DataSubjectID    string                 `json:"data_subject_id"`
	DataType         string                 `json:"data_type"`
	Purpose          string                 `json:"purpose"`
	Status           string                 `json:"status"` // granted, denied, expired, withdrawn
	GrantedAt        *Timestamp             `json:"granted_at,omitempty"`
	ExpiresAt        *Timestamp             `json:"expires_at,omitempty"`
	WithdrawnAt      *Timestamp             `json:"withdrawn_at,omitempty"`
	WithdrawalReason string                 `json:"withdrawal_reason,omitempty"`
	ConsentText      string                 `json:"consent_text"`
	Version          string                 `json:"version"`
	IPAddress        string                 `json:"ip_address,omitempty"`
	UserAgent        string                 `json:"user_agent,omitempty"`
	Metadata         map[string]interface{} `json:"metadata,omitempty"`
}

// DataLineage represents the lineage of data
type DataLineage struct {
	ID             string                 `json:"id"`
	DataID         string                 `json:"data_id"`
	SourceSystem   string                 `json:"source_system"`
	SourceID       string                 `json:"source_id,omitempty"`
	Transformation []DataTransformation   `json:"transformations"`
	Destinations   []DataDestination      `json:"destinations"`
	AccessLog      []DataAccess           `json:"access_log"`
	CreatedAt      Timestamp              `json:"created_at"`
	LastModified   Timestamp              `json:"last_modified"`
	Metadata       map[string]interface{} `json:"metadata,omitempty"`
}

// DataTransformation represents a data transformation
type DataTransformation struct {
	ID            string                 `json:"id"`
	Type          string                 `json:"type"` // aggregation, masking, encryption, deletion, modification
	Description   string                 `json:"description"`
	TransformedAt Timestamp              `json:"transformed_at"`
	TransformedBy string                 `json:"transformed_by"`
	OldValue      interface{}            `json:"old_value,omitempty"`
	NewValue      interface{}            `json:"new_value,omitempty"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
}

// DataDestination represents where data was sent
type DataDestination struct {
	ID              string                 `json:"id"`
	System          string                 `json:"system"`
	Purpose         string                 `json:"purpose"`
	SentAt          Timestamp              `json:"sent_at"`
	SentBy          string                 `json:"sent_by"`
	ConsentVerified bool                   `json:"consent_verified"`
	Format          string                 `json:"format"`
	Metadata        map[string]interface{} `json:"metadata,omitempty"`
}

// DataAccess represents access to data
type DataAccess struct {
	ID            string                 `json:"id"`
	UserID        string                 `json:"user_id"`
	AccessType    string                 `json:"access_type"` // read, write, delete, export
	Purpose       string                 `json:"purpose"`
	AccessedAt    Timestamp              `json:"accessed_at"`
	IPAddress     string                 `json:"ip_address"`
	UserAgent     string                 `json:"user_agent"`
	Authorized    bool                   `json:"authorized"`
	ConsentStatus string                 `json:"consent_status"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
}

// initializeClassificationRules initializes built-in classification rules
func (dc *DataClassifier) initializeClassificationRules() {
	rules := []ClassificationRule{
		{
			ID:             "rule_pii_email",
			Name:           "Email Address",
			Description:    "Personal email addresses",
			Category:       "personal",
			Level:          "confidential",
			Patterns:       []string{`\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b`},
			Keywords:       []string{"email", "mail"},
			RetentionDays:  2555, // 7 years
			ComplianceTags: []string{"gdpr_pii", "ccpa_personal_info"},
			Priority:       1,
		},
		{
			ID:             "rule_pii_ssn",
			Name:           "Social Security Number",
			Description:    "US Social Security Numbers",
			Category:       "personal",
			Level:          "restricted",
			Patterns:       []string{`\b\d{3}-\d{2}-\d{4}\b`},
			Keywords:       []string{"ssn", "social security"},
			RetentionDays:  2555,
			ComplianceTags: []string{"gdpr_pii", "hipaa_phi"},
			Priority:       1,
		},
		{
			ID:             "rule_financial_credit_card",
			Name:           "Credit Card Number",
			Description:    "Credit and debit card numbers",
			Category:       "financial",
			Level:          "restricted",
			Patterns:       []string{`\b(?:\d{4}[-\s]?){3}\d{4}\b`},
			Keywords:       []string{"credit card", "card number", "visa", "mastercard"},
			RetentionDays:  2555,
			ComplianceTags: []string{"pci_dss", "gdpr_financial"},
			Priority:       1,
		},
		{
			ID:             "rule_health_medical_record",
			Name:           "Medical Record Number",
			Description:    "Patient medical record numbers",
			Category:       "health",
			Level:          "restricted",
			Patterns:       []string{`\bMR[0-9]{4,12}\b`},
			Keywords:       []string{"medical record", "patient", "mrn"},
			RetentionDays:  2555,
			ComplianceTags: []string{"hipaa_phi", "gdpr_health"},
			Priority:       1,
		},
		{
			ID:             "rule_business_internal",
			Name:           "Internal Business Documents",
			Description:    "Internal business communications and documents",
			Category:       "business",
			Level:          "internal",
			Keywords:       []string{"internal", "confidential", "company"},
			RetentionDays:  2555,
			ComplianceTags: []string{"company_policy"},
			Priority:       3,
		},
	}

	for _, rule := range rules {
		rule.CreatedAt = NewTimestamp(time.Now().UTC())
		rule.UpdatedAt = NewTimestamp(time.Now().UTC())
		dc.classificationRules[rule.ID] = &rule
	}
}

// initializeSensitivePatterns initializes patterns for sensitive data detection
func (dc *DataClassifier) initializeSensitivePatterns() {
	patterns := map[string]string{
		"phone_number":     `\b(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b`,
		"drivers_license":  `\b[A-Z][0-9]{7,10}\b`,
		"passport":         `\b[A-Z][0-9]{8}\b`,
		"bank_account":     `\b\d{8,17}\b`,
		"routing_number":   `\b\d{9}\b`,
		"iban":             `\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b`,
		"swift_bic":        `\b[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?\b`,
		"npi":              `\b\d{10}\b`, // National Provider Identifier
		"insurance_number": `\bINS[0-9]{8,12}\b`,
		"prescription":     `\b[0-9A-Z]{10,15}\b`,
	}

	for name, pattern := range patterns {
		dc.sensitivePatterns[name] = regexp.MustCompile(pattern)
	}
}

// ClassifyEvent classifies an audit event
func (dc *DataClassifier) ClassifyEvent(event *AuditEvent) string {
	// High-level classification based on event type
	switch event.EventType {
	case "user_login", "user_logout", "user_registration":
		return "personal"
	case "data_access", "data_export", "data_share":
		return dc.classifyDataAccess(event)
	case "payment", "transaction", "billing":
		return "financial"
	case "medical_record", "health_data", "prescription":
		return "health"
	case "admin_action", "system_config":
		return "business"
	default:
		return dc.classifyByContent(event)
	}
}

// classifyDataAccess classifies data access events
func (dc *DataClassifier) classifyDataAccess(event *AuditEvent) string {
	if event.NewValue != nil {
		if str, ok := event.NewValue.(string); ok {
			return dc.classifyTextContent(str)
		}
	}
	return "personal"
}

// classifyByContent classifies events based on their content
func (dc *DataClassifier) classifyByContent(event *AuditEvent) string {
	text := event.Description + " " + event.Action

	// Check for sensitive patterns
	for patternName, pattern := range dc.sensitivePatterns {
		if pattern.MatchString(text) {
			switch patternName {
			case "phone_number", "drivers_license", "passport":
				return "personal"
			case "bank_account", "routing_number", "iban", "swift_bic":
				return "financial"
			case "npi", "insurance_number", "prescription":
				return "health"
			}
		}
	}

	// Check for business indicators
	businessKeywords := []string{"company", "internal", "corporate", "business"}
	for _, keyword := range businessKeywords {
		if strings.Contains(strings.ToLower(text), keyword) {
			return "business"
		}
	}

	return "personal"
}

// classifyTextContent classifies text content
func (dc *DataClassifier) classifyTextContent(text string) string {
	for patternName, pattern := range dc.sensitivePatterns {
		if pattern.MatchString(text) {
			switch patternName {
			case "phone_number", "drivers_license", "passport":
				return "personal"
			case "bank_account", "routing_number", "iban", "swift_bic":
				return "financial"
			case "npi", "insurance_number", "prescription":
				return "health"
			}
		}
	}
	return "personal"
}

// GetClassificationRule returns a classification rule by ID
func (dc *DataClassifier) GetClassificationRule(ruleID string) (*ClassificationRule, error) {
	if rule, exists := dc.classificationRules[ruleID]; exists {
		return rule, nil
	}
	return nil, fmt.Errorf("classification rule not found: %s", ruleID)
}

// AddClassificationRule adds a new classification rule
func (dc *DataClassifier) AddClassificationRule(rule *ClassificationRule) error {
	rule.CreatedAt = NewTimestamp(time.Now().UTC())
	rule.UpdatedAt = NewTimestamp(time.Now().UTC())
	dc.classificationRules[rule.ID] = rule
	return nil
}

// UpdateClassificationRule updates an existing classification rule
func (dc *DataClassifier) UpdateClassificationRule(rule *ClassificationRule) error {
	if _, exists := dc.classificationRules[rule.ID]; !exists {
		return fmt.Errorf("classification rule not found: %s", rule.ID)
	}
	rule.UpdatedAt = NewTimestamp(time.Now().UTC())
	dc.classificationRules[rule.ID] = rule
	return nil
}

// DeleteClassificationRule deletes a classification rule
func (dc *DataClassifier) DeleteClassificationRule(ruleID string) error {
	if _, exists := dc.classificationRules[ruleID]; !exists {
		return fmt.Errorf("classification rule not found: %s", ruleID)
	}
	delete(dc.classificationRules, ruleID)
	return nil
}

// ListClassificationRules returns all classification rules
func (dc *DataClassifier) ListClassificationRules() []*ClassificationRule {
	rules := make([]*ClassificationRule, 0, len(dc.classificationRules))
	for _, rule := range dc.classificationRules {
		rules = append(rules, rule)
	}
	return rules
}

// GetClassificationLevel determines the classification level for data
func (dc *DataClassifier) GetClassificationLevel(category string, patterns []string) string {
	// Determine level based on category and patterns
	switch category {
	case "personal":
		if dc.containsSensitivePattern(patterns) {
			return "restricted"
		}
		return "confidential"
	case "financial":
		return "restricted"
	case "health":
		return "restricted"
	case "business":
		return "internal"
	default:
		return "unrestricted"
	}
}

// containsSensitivePattern checks if patterns contain sensitive data
func (dc *DataClassifier) containsSensitivePattern(patterns []string) bool {
	for _, pattern := range patterns {
		for _, sensitivePattern := range dc.sensitivePatterns {
			if sensitivePattern.MatchString(pattern) {
				return true
			}
		}
	}
	return false
}

// ConsentTracker manages consent for data processing
type ConsentTracker struct {
	consentRecords map[string]*ConsentStatus
}

// NewConsentTracker creates a new consent tracker
func NewConsentTracker() *ConsentTracker {
	return &ConsentTracker{
		consentRecords: make(map[string]*ConsentStatus),
	}
}

// DataLineageTracker tracks data lineage
type DataLineageTracker struct {
	lineageRecords map[string]*DataLineage
}

// NewDataLineageTracker creates a new data lineage tracker
func NewDataLineageTracker() *DataLineageTracker {
	return &DataLineageTracker{
		lineageRecords: make(map[string]*DataLineage),
	}
}

// GetConsentStatus returns consent status for data processing
func (dc *DataClassifier) GetConsentStatus(dataSubjectID, dataType string) (*ConsentStatus, error) {
	return dc.consentTracker.GetConsent(dataSubjectID, dataType)
}

// UpdateConsent updates consent for data processing
func (dc *DataClassifier) UpdateConsent(consent *ConsentStatus) error {
	return dc.consentTracker.UpdateConsent(consent)
}

// GetDataLineage returns data lineage information
func (dc *DataClassifier) GetDataLineage(dataID string) (*DataLineage, error) {
	return dc.lineageTracker.GetLineage(dataID)
}

// UpdateDataLineage updates data lineage information
func (dc *DataClassifier) UpdateDataLineage(lineage *DataLineage) error {
	return dc.lineageTracker.UpdateLineage(lineage)
}

// RecordDataAccess records access to data
func (dc *DataClassifier) RecordDataAccess(dataID, userID, accessType, purpose string) error {
	return dc.lineageTracker.RecordAccess(dataID, userID, accessType, purpose)
}

// GetConsent returns consent status
func (ct *ConsentTracker) GetConsent(dataSubjectID, dataType string) (*ConsentStatus, error) {
	consentID := fmt.Sprintf("%s_%s", dataSubjectID, dataType)
	if consent, exists := ct.consentRecords[consentID]; exists {
		return consent, nil
	}
	return nil, fmt.Errorf("consent not found for %s", consentID)
}

// UpdateConsent updates consent record
func (ct *ConsentTracker) UpdateConsent(consent *ConsentStatus) error {
	consentID := fmt.Sprintf("%s_%s", consent.DataSubjectID, consent.DataType)
	ct.consentRecords[consentID] = consent
	return nil
}

// GetLineage returns data lineage
func (dlt *DataLineageTracker) GetLineage(dataID string) (*DataLineage, error) {
	if lineage, exists := dlt.lineageRecords[dataID]; exists {
		return lineage, nil
	}
	return nil, fmt.Errorf("lineage not found for data ID: %s", dataID)
}

// UpdateLineage updates data lineage
func (dlt *DataLineageTracker) UpdateLineage(lineage *DataLineage) error {
	lineage.LastModified = NewTimestamp(time.Now().UTC())
	dlt.lineageRecords[lineage.DataID] = lineage
	return nil
}

// RecordAccess records data access
func (dlt *DataLineageTracker) RecordAccess(dataID, userID, accessType, purpose string) error {
	lineage, err := dlt.GetLineage(dataID)
	if err != nil {
		// Create new lineage record
		lineage = &DataLineage{
			ID:        generateID(),
			DataID:    dataID,
			CreatedAt: NewTimestamp(time.Now().UTC()),
		}
	}

	access := DataAccess{
		ID:            generateID(),
		UserID:        userID,
		AccessType:    accessType,
		Purpose:       purpose,
		AccessedAt:    NewTimestamp(time.Now().UTC()),
		Authorized:    true,      // This should be checked against permissions
		ConsentStatus: "granted", // This should be checked against consent records
	}

	lineage.AccessLog = append(lineage.AccessLog, access)
	return dlt.UpdateLineage(lineage)
}
