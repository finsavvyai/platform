package sdln

import (
	"encoding/json"
	"regexp"
	"strings"
	"time"
)

// DataClassifier provides data classification for compliance
type DataClassifier struct {
	classificationRules map[string]*ClassificationRule
	sensitivePatterns   map[string]*regexp.Regexp
}

// ClassificationRule represents a rule for classifying data
type ClassificationRule struct {
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	Category    string                 `json:"category"`
	Pattern     string                 `json:"pattern"`
	Sensitivity string                 `json:"sensitivity"` // public, internal, confidential, restricted
	Retention   int                    `json:"retention"`   // days
	Compliance  []string               `json:"compliance"`  // gdpr, hipaa, sox, etc.
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// NewDataClassifier creates a new data classifier
func NewDataClassifier() *DataClassifier {
	classifier := &DataClassifier{
		classificationRules: make(map[string]*ClassificationRule),
		sensitivePatterns:   make(map[string]*regexp.Regexp),
	}

	classifier.initializeRules()
	classifier.initializePatterns()

	return classifier
}

// initializeRules initializes classification rules
func (dc *DataClassifier) initializeRules() {
	rules := []*ClassificationRule{
		{
			ID:          "pii_email",
			Name:        "Email Address",
			Category:    "personal_information",
			Sensitivity: "confidential",
			Retention:   2555, // 7 years
			Compliance:  []string{"gdpr", "ccpa"},
		},
		{
			ID:          "pii_ssn",
			Name:        "Social Security Number",
			Category:    "personal_identifier",
			Sensitivity: "restricted",
			Retention:   2555, // 7 years
			Compliance:  []string{"gdpr", "hipaa", "sox"},
		},
		{
			ID:          "financial_account",
			Name:        "Bank Account Number",
			Category:    "financial_information",
			Sensitivity: "restricted",
			Retention:   2555, // 7 years
			Compliance:  []string{"gdpr", "pci_dss", "sox"},
		},
		{
			ID:          "health_record",
			Name:        "Medical Record",
			Category:    "health_information",
			Sensitivity: "restricted",
			Retention:   3650, // 10 years
			Compliance:  []string{"gdpr", "hipaa"},
		},
		{
			ID:          "authentication_log",
			Name:        "Authentication Event",
			Category:    "security_event",
			Sensitivity: "confidential",
			Retention:   365, // 1 year
			Compliance:  []string{"sox", "iso27001"},
		},
		{
			ID:          "data_access",
			Name:        "Data Access Event",
			Category:    "access_event",
			Sensitivity: "internal",
			Retention:   1095, // 3 years
			Compliance:  []string{"gdpr", "sox"},
		},
		{
			ID:          "admin_action",
			Name:        "Administrative Action",
			Category:    "administrative_event",
			Sensitivity: "confidential",
			Retention:   2555, // 7 years
			Compliance:  []string{"sox", "iso27001"},
		},
		{
			ID:          "system_event",
			Name:        "System Event",
			Category:    "system_event",
			Sensitivity: "internal",
			Retention:   90, // 3 months
			Compliance:  []string{},
		},
	}

	for _, rule := range rules {
		dc.classificationRules[rule.ID] = rule
	}
}

// initializePatterns initializes sensitive data patterns
func (dc *DataClassifier) initializePatterns() {
	patterns := map[string]string{
		"email_pattern":  `(?i)\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b`,
		"ssn_pattern":    `\b\d{3}-\d{2}-\d{4}\b`,
		"credit_card":    `\b(?:\d{4}[-\s]?){3}\d{4}\b`,
		"bank_account":   `\b\d{8,17}\b`,
		"medical_record": `\bMR[0-9]{4,12}\b`,
		"npi_pattern":    `\b\d{10}\b`,
		"api_key":        `\b[A-Za-z0-9_-]{20,60}\b`,
		"password":       `(?i)\bpassword\s*[:=]\s*[^\s<>"{}|\\^` + "`" + `\[\]]+\b`,
		"private_key":    `-----BEGIN.*PRIVATE KEY-----`,
		"ip_address":     `\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b`,
		"phone":          `\b(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b`,
		"address":        `\b\d+\s+[A-Z][a-z]+\s+(?:St|Ave|Rd|Blvd|Dr|Ln|Way|Ct)\b`,
	}

	for name, pattern := range patterns {
		dc.sensitivePatterns[name] = regexp.MustCompile(pattern)
	}
}

// ClassifyEvent classifies an audit event for compliance purposes
func (dc *DataClassifier) ClassifyEvent(event *AuditEvent) string {
	// Classify based on event type and content
	classification := dc.classifyByEventType(event.EventType)

	// Enhance classification based on content analysis
	contentClassification := dc.classifyByContent(event)

	// Return the higher sensitivity classification
	if dc.compareSensitivity(classification, contentClassification) < 0 {
		classification = contentClassification
	}

	return classification
}

// classifyByEventType classifies based on event type
func (dc *DataClassifier) classifyByEventType(eventType string) string {
	classifications := map[string]string{
		"user_login":            "confidential",
		"user_logout":           "confidential",
		"authentication_failed": "confidential",
		"password_change":       "confidential",
		"password_reset":        "confidential",
		"mfa_verification":      "confidential",
		"data_access":           "internal",
		"data_create":           "internal",
		"data_update":           "internal",
		"data_delete":           "confidential",
		"data_export":           "confidential",
		"permission_change":     "confidential",
		"role_change":           "confidential",
		"admin_action":          "confidential",
		"system_config":         "internal",
		"api_access":            "confidential",
		"file_access":           "confidential",
		"financial_access":      "restricted",
		"health_access":         "restricted",
		"pii_access":            "restricted",
		"compliance_audit":      "confidential",
		"security_incident":     "restricted",
		"data_breach":           "restricted",
	}

	if classification, exists := classifications[eventType]; exists {
		return classification
	}

	return "internal"
}

// classifyByContent classifies based on event content
func (dc *DataClassifier) classifyByContent(event *AuditEvent) string {
	content := event.Description

	if event.OldValue != nil {
		if str, ok := event.OldValue.(string); ok {
			content += " " + str
		}
	}

	if event.NewValue != nil {
		if str, ok := event.NewValue.(string); ok {
			content += " " + str
		}
	}

	// Check for sensitive patterns
	for patternName, pattern := range dc.sensitivePatterns {
		if pattern.MatchString(content) {
			return dc.getSensitivityByPattern(patternName)
		}
	}

	// Check for keywords indicating sensitive data
	sensitiveKeywords := []string{
		"ssn", "social security", "credit card", "bank account",
		"medical record", "patient", "diagnosis", "treatment",
		"password", "secret", "key", "token", "confidential",
	}

	contentLower := strings.ToLower(content)
	for _, keyword := range sensitiveKeywords {
		if strings.Contains(contentLower, keyword) {
			return "restricted"
		}
	}

	return "internal"
}

// getSensitivityByPattern returns sensitivity level based on pattern
func (dc *DataClassifier) getSensitivityByPattern(patternName string) string {
	sensitivities := map[string]string{
		"email_pattern":  "confidential",
		"ssn_pattern":    "restricted",
		"credit_card":    "restricted",
		"bank_account":   "restricted",
		"medical_record": "restricted",
		"npi_pattern":    "restricted",
		"api_key":        "restricted",
		"password":       "restricted",
		"private_key":    "restricted",
		"ip_address":     "confidential",
		"phone":          "confidential",
		"address":        "confidential",
	}

	if sensitivity, exists := sensitivities[patternName]; exists {
		return sensitivity
	}

	return "confidential"
}

// compareSensitivity compares two sensitivity levels
func (dc *DataClassifier) compareSensitivity(a, b string) int {
	sensitivityOrder := map[string]int{
		"public":       0,
		"internal":     1,
		"confidential": 2,
		"restricted":   3,
	}

	orderA := sensitivityOrder[a]
	orderB := sensitivityOrder[b]

	if orderA < orderB {
		return -1
	} else if orderA > orderB {
		return 1
	}

	return 0
}

// ClassifyData classifies raw data for compliance purposes
func (dc *DataClassifier) ClassifyData(data interface{}) *DataClassification {
	classification := &DataClassification{
		ID:           generateID(),
		ClassifiedAt: NewTimestamp(time.Now().UTC()),
		Categories:   make(map[string]int),
		Patterns:     make([]string, 0),
		Confidence:   0.0,
	}

	// Convert data to string for analysis
	var content string
	if str, ok := data.(string); ok {
		content = str
	} else {
		jsonBytes, err := json.Marshal(data)
		if err == nil {
			content = string(jsonBytes)
		}
	}

	// Analyze for patterns
	for patternName, pattern := range dc.sensitivePatterns {
		matches := pattern.FindAllString(content, -1)
		if len(matches) > 0 {
			classification.Patterns = append(classification.Patterns, patternName)

			// Get rule for this pattern
			if rule := dc.getRuleByPattern(patternName); rule != nil {
				classification.Categories[rule.Category] += len(matches)
				if rule.Sensitivity != classification.Sensitivity {
					if dc.compareSensitivity(rule.Sensitivity, classification.Sensitivity) > 0 {
						classification.Sensitivity = rule.Sensitivity
					}
				}
			}
		}
	}

	// Calculate confidence based on pattern matches
	totalMatches := len(classification.Patterns)
	if totalMatches > 0 {
		classification.Confidence = float64(totalMatches) / float64(len(dc.sensitivePatterns))
	} else {
		classification.Sensitivity = "internal"
	}

	return classification
}

// getRuleByPattern finds a classification rule by pattern name
func (dc *DataClassifier) getRuleByPattern(patternName string) *ClassificationRule {
	patternRuleMap := map[string]string{
		"email_pattern":  "pii_email",
		"ssn_pattern":    "pii_ssn",
		"credit_card":    "financial_account",
		"bank_account":   "financial_account",
		"medical_record": "health_record",
		"npi_pattern":    "health_record",
		"api_key":        "authentication_log",
		"password":       "authentication_log",
		"private_key":    "authentication_log",
		"ip_address":     "data_access",
		"phone":          "pii_email",
		"address":        "pii_email",
	}

	if ruleID, exists := patternRuleMap[patternName]; exists {
		return dc.classificationRules[ruleID]
	}

	return nil
}

// DataClassification represents the classification of data
type DataClassification struct {
	ID           string                 `json:"id"`
	Sensitivity  string                 `json:"sensitivity"`
	Categories   map[string]int         `json:"categories"`
	Patterns     []string               `json:"patterns"`
	Confidence   float64                `json:"confidence"`
	ClassifiedAt Timestamp              `json:"classified_at"`
	Retention    int                    `json:"retention_days"`
	Compliance   []string               `json:"compliance_frameworks"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
}

// GetRetentionPeriod returns retention period for a classification
func (dc *DataClassifier) GetRetentionPeriod(classification string) int {
	retentionPeriods := map[string]int{
		"public":       30,   // 30 days
		"internal":     365,  // 1 year
		"confidential": 2555, // 7 years
		"restricted":   3650, // 10 years
	}

	if period, exists := retentionPeriods[classification]; exists {
		return period
	}

	return 365 // Default 1 year
}
