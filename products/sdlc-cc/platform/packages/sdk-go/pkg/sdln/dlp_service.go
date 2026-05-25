package sdln

import (
	"context"
	"fmt"
	"regexp"
	"strings"
	"time"
)

// DLPService handles Data Loss Prevention operations including PII detection and redaction
type DLPService struct {
	*BaseService
	piiPatterns map[string]*regexp.Regexp
}

// NewDLPService creates a new DLP service
func NewDLPService(client *Client) *DLPService {
	service := &DLPService{
		BaseService: NewBaseService(client, "dlp", "api/v1/dlp"),
		piiPatterns: make(map[string]*regexp.Regexp),
	}

	// Initialize PII patterns
	service.initializePIIPatterns()

	// Initialize advanced DLP features
	service.initializeAdvancedPatterns()
	service.initializeCustomPatterns()

	return service
}

// PIIFinding represents a detected PII entity
type PIIFinding struct {
	Type          string  `json:"type"`     // email, phone, ssn, credit_card, etc.
	Value         string  `json:"value"`    // The original PII value
	Redacted      string  `json:"redacted"` // The redacted value
	StartPosition int     `json:"start_position"`
	EndPosition   int     `json:"end_position"`
	Confidence    float64 `json:"confidence"` // 0.0-1.0
	Context       string  `json:"context"`    // Surrounding text for context
}

// DLPScanResult represents the result of DLP scanning
type DLPScanResult struct {
	ID           string                 `json:"id"`
	ScanID       string                 `json:"scan_id"`
	PIIFound     bool                   `json:"pii_found"`
	Findings     []PIIFinding           `json:"findings"`
	RedactedText string                 `json:"redacted_text,omitempty"`
	OriginalText string                 `json:"original_text,omitempty"`
	RiskLevel    string                 `json:"risk_level"` // low, medium, high, critical
	Score        float64                `json:"score"`      // Overall risk score 0.0-1.0
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
	ScannedAt    Timestamp              `json:"scanned_at"`
	Duration     time.Duration          `json:"duration"`
}

// DLPScanRequest represents a DLP scan request
type DLPScanRequest struct {
	Text            string                 `json:"text"`
	TenantID        string                 `json:"tenant_id"`
	UserID          *string                `json:"user_id,omitempty"`
	ScanType        string                 `json:"scan_type"`        // pii, financial, health, custom
	RedactionMethod string                 `json:"redaction_method"` // mask, tokenize, encrypt
	IncludeContext  bool                   `json:"include_context,omitempty"`
	MinConfidence   *float64               `json:"min_confidence,omitempty"`
	CustomPatterns  map[string]string      `json:"custom_patterns,omitempty"`
	Metadata        map[string]interface{} `json:"metadata,omitempty"`
}

// DLPPolicy represents a DLP policy
type DLPPolicy struct {
	ID            string         `json:"id"`
	TenantID      string         `json:"tenant_id"`
	Name          string         `json:"name"`
	Description   string         `json:"description"`
	Enabled       bool           `json:"enabled"`
	Rules         []DLPRule      `json:"rules"`
	Actions       []DLPAction    `json:"actions"`
	Exceptions    []DLPException `json:"exceptions"`
	MinConfidence float64        `json:"min_confidence"`
	RiskThreshold float64        `json:"risk_threshold"`
	CreatedBy     string         `json:"created_by"`
	CreatedAt     Timestamp      `json:"created_at"`
	UpdatedAt     Timestamp      `json:"updated_at"`
}

// DLPRule represents a DLP rule
type DLPRule struct {
	ID         string                 `json:"id"`
	Name       string                 `json:"name"`
	Type       string                 `json:"type"` // regex, ml, keyword, dictionary
	Pattern    string                 `json:"pattern,omitempty"`
	Category   string                 `json:"category"` // pii, financial, health, custom
	Severity   string                 `json:"severity"` // low, medium, high, critical
	Enabled    bool                   `json:"enabled"`
	Confidence float64                `json:"confidence"`
	Metadata   map[string]interface{} `json:"metadata,omitempty"`
}

// DLPAction represents an action to take when DLP rules are triggered
type DLPAction struct {
	ID         string                 `json:"id"`
	Type       string                 `json:"type"` // redact, block, alert, encrypt, quarantine
	Parameters map[string]interface{} `json:"parameters"`
	Enabled    bool                   `json:"enabled"`
	Order      int                    `json:"order"`
}

// DLPException represents an exception to DLP rules
type DLPException struct {
	ID          string     `json:"id"`
	Description string     `json:"description"`
	Pattern     string     `json:"pattern"`
	Reason      string     `json:"reason"`
	ExpiresAt   *Timestamp `json:"expires_at,omitempty"`
	CreatedBy   string     `json:"created_by"`
	CreatedAt   Timestamp  `json:"created_at"`
}

// initializePIIPatterns initializes common PII detection patterns
func (s *DLPService) initializePIIPatterns() {
	patterns := map[string]string{
		// Basic PII Patterns
		"email":          `\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b`,
		"phone":          `\b(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b`,
		"ssn":            `\b\d{3}-\d{2}-\d{4}\b`,
		"credit_card":    `\b(?:\d{4}[-\s]?){3}\d{4}\b`,
		"ip_address":     `\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b`,
		"url":            `https?://(?:[-\w.])+(?:[:\d]+)?(?:/(?:[\w/_.])*(?:\?(?:[\w&=%.])*)?(?:#(?:\w*))?)?`,
		"date":           `\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b\d{4}[/-]\d{1,2}[/-]\d{1,2}\b`,
		"money":          `\$\s*\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\d{1,3}(?:,\d{3})*(?:\.\d{2})?\s*(?:USD|EUR|GBP|CAD)`,
		"license_plate":  `\b[A-Z]{2,3}[ -]?[A-Z0-9]{3,6}\b`,
		"vin":            `\b[A-HJ-NPR-Z0-9]{17}\b`,
		"passport":       `\b[A-Z][0-9]{8}\b`,
		"routing_number": `\b\d{9}\b`,
		"account_number": `\b\d{8,17}\b`,

		// Financial Patterns (NEW)
		"iban":                   `\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b`,
		"swift_bic":              `\b[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?\b`,
		"bank_account":           `\b(?:[A-Z]{2}\d{2})?\s?\d{4,20}\b`,
		"aba_routing":            `\b\d{9}\b`,
		"ach_routing":            `\b\d{9}\b`,
		"wire_routing":           `\b\d{9}\b`,
		"check_number":           `\b(?:\d{4,8})\b`,
		"debit_card":             `\b(?:\d{4}[-\s]?){3}\d{4}\b`,
		"credit_card_visa":       `\b4\d{3}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b`,
		"credit_card_mastercard": `\b5[1-5]\d{2}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b`,
		"credit_card_amex":       `\b3[47]\d{2}[-\s]?\d{6}[-\s]?\d{5}\b`,
		"credit_card_discover":   `\b6(?:011|5\d{2})[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b`,
		"cvv":                    `\b\d{3,4}\b`,
		"expiry_date":            `\b(?:0[1-9]|1[0-2])\/\d{2,4}\b`,
		"transaction_id":         `\b[A-Z0-9]{8,20}\b`,
		"stock_symbol":           `\b[A-Z]{1,5}\b`,
		"cusip":                  `\b[A-Z0-9]{9}\b`,
		"isin":                   `\b[A-Z]{2}[A-Z0-9]{9}\d\b`,
		"ticker":                 `\b[A-Z]{1,4}\b`,
		"crypto_address":         `\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b`,
		"crypto_eth":             `\b0x[a-fA-F0-9]{40}\b`,

		// Healthcare Patterns (NEW)
		"npi":            `\b\d{10}\b`,
		"medical_record": `\bMR[0-9]{4,12}\b`,
		"patient_id":     `\bPT[0-9]{4,12}\b`,
		"insurance_id":   `\b[A-Z0-9]{6,20}\b`,
		"medicare":       `\b[0-9A-Z]{9,12}\b`,
		"medicaid":       `\b[0-9A-Z]{8,15}\b`,
		"health_plan":    `\b[A-Z0-9]{8,15}\b`,
		"prescription":   `\b[0-9A-Z]{10,15}\b`,
		"rx_number":      `\b[0-9]{7,12}\b`,
		"pharmacy_npi":   `\b\d{10}\b`,
		"doctor_npi":     `\b\d{10}\b`,
		"hospital_id":    `\b[H0-9]{6,12}\b`,
		"diagnosis_code": `\b[A-Z0-9]{3,7}\b`,
		"procedure_code": `\b\d{4,5}\b`,
		"icd_10":         `\b[A-Z][0-9]{2}(\.[A-Z0-9]{1,3})?\b`,
		"cpt":            `\b\d{5}\b`,
		"hcpcs":          `\b[A-Z0-9]{5}\b`,
		"dosage":         `\b\d+(?:\.\d+)?(?:mg|ml|g|mcg|IU|units?)\b`,
		"lab_result":     `\b[0-9A-Z]{8,15}\b`,
		"biometric_id":   `\b[0-9A-F]{8,32}\b`,
		"blood_type":     `\b(A|B|AB|O)[+-]\b`,
		"allergy_code":   `\b[A-Z0-9]{5,10}\b`,

		// Government ID Patterns (Enhanced)
		"drivers_license":  `\b[A-Z][0-9]{7,10}\b`,
		"state_id":         `\b[A-Z]{2}\d{6,9}\b`,
		"military_id":      `\b[0-9A-Z]{8,12}\b`,
		"passport_us":      `\b\d{9}\b`,
		"passport_foreign": `\b[A-Z0-9]{6,12}\b`,
		"tax_id":           `\b\d{3}-\d{2}-\d{4}\b`,
		"ein":              `\b\d{2}-\d{7}\b`,
		"itn":              `\b\d{9}\b`,
		"social_insurance": `\b\d{3}-\d{3}-\d{3}\b`,

		// Location Patterns
		"address":         `\b\d+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:St|Ave|Rd|Blvd|Dr|Ln|Way|Ct|Cir|Pl|Sq|Terr|Pkwy|Hwy|Ct)\.?\b`,
		"zip_code":        `\b\d{5}(?:-\d{4})?\b`,
		"zip_code_canada": `\b[A-Z][0-9][A-Z]\s?[0-9][A-Z][0-9]\b`,
		"postal_code_uk":  `\b[A-Z]{2}[0-9]{2}[A-Z]{2}\b`,
		"coordinates":     `\b-?\d+\.?\d*,\s*-?\d+\.?\d*\b`,

		// Communication Patterns
		"imei":          `\b\d{15,17}\b`,
		"imsi":          `\b\d{15}\b`,
		"iccid":         `\b\d{19,20}\b`,
		"mac_address":   `\b(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\b`,
		"serial_number": `\b[A-Z0-9]{8,20}\b`,
		"device_id":     `\b[A-Z0-9-]{10,30}\b`,
		"session_id":    `\b[a-fA-F0-9-]{32,64}\b`,
		"api_key":       `\b[A-Za-z0-9_-]{20,60}\b`,
		"jwt_token":     `\b[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b`,
		"password_hash": `\b[A-Za-z0-9+/]{20,100}={0,2}\b`,
		"private_key":   `\b-----BEGIN[A-Z\s]+KEY-----[\s\S]+?-----END[A-Z\s]+KEY-----\b`,
	}

	for name, pattern := range patterns {
		s.piiPatterns[name] = regexp.MustCompile(pattern)
	}
}

// initializeMLDetection initializes ML-based PII detection capabilities
func (s *DLPService) initializeMLDetection() {
	// This would initialize ML models for PII detection
	// For now, we'll use rule-based context analysis
}

// initializeAdvancedRedaction initializes advanced redaction methods
func (s *DLPService) initializeAdvancedRedaction() {
	// Initialize different redaction strategies
}

// ScanAndRedact scans text for PII and returns redacted version
func (s *DLPService) ScanAndRedact(ctx context.Context, text string, options *DLPScanRequest) (*DLPScanResult, error) {
	if options == nil {
		options = &DLPScanRequest{
			Text:            text,
			ScanType:        "pii",
			RedactionMethod: "mask",
			IncludeContext:  true,
			MinConfidence:   &[]float64{0.5}[0],
		}
	}

	startTime := time.Now()

	// Detect PII patterns
	findings := s.detectPII(text, options)

	// Calculate overall risk score
	riskScore := s.calculateRiskScore(findings)
	riskLevel := s.determineRiskLevel(riskScore)

	// Apply redaction if requested
	redactedText := text
	if options.RedactionMethod != "" {
		redactedText = s.applyRedaction(text, findings, options.RedactionMethod)
	}

	result := &DLPScanResult{
		ID:           generateID(),
		ScanID:       generateID(),
		PIIFound:     len(findings) > 0,
		Findings:     findings,
		RedactedText: redactedText,
		OriginalText: text,
		RiskLevel:    riskLevel,
		Score:        riskScore,
		Metadata:     options.Metadata,
		ScannedAt:    NewTimestamp(time.Now().UTC()),
		Duration:     time.Since(startTime),
	}

	return result, nil
}

// detectPII detects PII in text using pattern matching
func (s *DLPService) detectPII(text string, options *DLPScanRequest) []PIIFinding {
	var findings []PIIFinding

	minConfidence := 0.5
	if options.MinConfidence != nil {
		minConfidence = *options.MinConfidence
	}

	for piiType, pattern := range s.piiPatterns {
		matches := pattern.FindAllStringSubmatchIndex(text, -1)

		for _, match := range matches {
			start := match[0]
			end := match[1]
			value := text[start:end]

			// Calculate confidence based on pattern specificity
			confidence := s.calculateConfidence(piiType, value)
			if confidence < minConfidence {
				continue
			}

			// Extract context
			contextStart := max(0, start-50)
			contextEnd := min(len(text), end+50)
			context := text[contextStart:contextEnd]

			finding := PIIFinding{
				Type:          piiType,
				Value:         value,
				Redacted:      s.redactValue(value, options.RedactionMethod),
				StartPosition: start,
				EndPosition:   end,
				Confidence:    confidence,
				Context:       context,
			}

			findings = append(findings, finding)
		}
	}

	// Apply custom patterns if provided
	if options.CustomPatterns != nil {
		customFindings := s.applyCustomPatterns(text, options.CustomPatterns, minConfidence)
		findings = append(findings, customFindings...)
	}

	return findings
}

// calculateConfidence calculates confidence score for a PII finding
func (s *DLPService) calculateConfidence(piiType, value string) float64 {
	// Base confidence by type
	baseConfidence := map[string]float64{
		// Basic PII
		"email":          0.95,
		"phone":          0.85,
		"ssn":            0.90,
		"credit_card":    0.80,
		"ip_address":     0.90,
		"url":            0.85,
		"date":           0.60,
		"money":          0.70,
		"license_plate":  0.75,
		"vin":            0.95,
		"passport":       0.85,
		"routing_number": 0.80,
		"account_number": 0.65,

		// Financial Patterns
		"iban":                   0.90,
		"swift_bic":              0.95,
		"bank_account":           0.75,
		"aba_routing":            0.85,
		"ach_routing":            0.85,
		"wire_routing":           0.85,
		"check_number":           0.70,
		"debit_card":             0.80,
		"credit_card_visa":       0.85,
		"credit_card_mastercard": 0.85,
		"credit_card_amex":       0.85,
		"credit_card_discover":   0.85,
		"cvv":                    0.90,
		"expiry_date":            0.75,
		"transaction_id":         0.70,
		"stock_symbol":           0.75,
		"cusip":                  0.90,
		"isin":                   0.90,
		"ticker":                 0.70,
		"crypto_address":         0.85,
		"crypto_eth":             0.90,

		// Healthcare Patterns
		"npi":            0.95,
		"medical_record": 0.85,
		"patient_id":     0.85,
		"insurance_id":   0.80,
		"medicare":       0.90,
		"medicaid":       0.90,
		"health_plan":    0.80,
		"prescription":   0.85,
		"rx_number":      0.85,
		"pharmacy_npi":   0.95,
		"doctor_npi":     0.95,
		"hospital_id":    0.85,
		"diagnosis_code": 0.80,
		"procedure_code": 0.80,
		"icd_10":         0.85,
		"cpt":            0.85,
		"hcpcs":          0.85,
		"dosage":         0.70,
		"lab_result":     0.80,
		"biometric_id":   0.90,
		"blood_type":     0.75,
		"allergy_code":   0.75,

		// Government IDs
		"drivers_license":  0.85,
		"state_id":         0.80,
		"military_id":      0.85,
		"passport_us":      0.95,
		"passport_foreign": 0.85,
		"tax_id":           0.90,
		"ein":              0.90,
		"itn":              0.90,
		"social_insurance": 0.90,

		// Location & Communication
		"address":         0.75,
		"zip_code":        0.80,
		"zip_code_canada": 0.85,
		"postal_code_uk":  0.85,
		"coordinates":     0.70,
		"imei":            0.90,
		"imsi":            0.90,
		"iccid":           0.90,
		"mac_address":     0.95,
		"serial_number":   0.70,
		"device_id":       0.70,
		"session_id":      0.80,
		"api_key":         0.85,
		"jwt_token":       0.90,
		"password_hash":   0.85,
		"private_key":     0.95,
	}

	confidence, exists := baseConfidence[piiType]
	if !exists {
		confidence = 0.5
	}

	// Adjust confidence based on format and patterns
	if piiType == "ssn" && regexp.MustCompile(`^\d{3}-\d{2}-\d{4}$`).MatchString(value) {
		confidence = min(1.0, confidence+0.1)
	}

	if piiType == "credit_card" && s.isValidLuhn(value) {
		confidence = min(1.0, confidence+0.15)
	}

	// Enhanced validation for financial patterns
	if piiType == "iban" && s.isValidIBAN(value) {
		confidence = min(1.0, confidence+0.1)
	}

	if piiType == "swift_bic" && s.isValidSWIFT(value) {
		confidence = min(1.0, confidence+0.05)
	}

	// Enhanced validation for healthcare patterns
	if piiType == "npi" && s.isValidNPI(value) {
		confidence = min(1.0, confidence+0.05)
	}

	if piiType == "icd_10" && s.isValidICD10(value) {
		confidence = min(1.0, confidence+0.1)
	}

	return confidence
}

// isValidLuhn validates a credit card number using Luhn algorithm
func (s *DLPService) isValidLuhn(number string) bool {
	// Remove spaces and dashes
	number = regexp.MustCompile(`[\s-]`).ReplaceAllString(number, "")

	if len(number) < 13 || len(number) > 19 {
		return false
	}

	sum := 0
	double := false

	for i := len(number) - 1; i >= 0; i-- {
		digit := int(number[i] - '0')

		if double {
			digit *= 2
			if digit > 9 {
				digit -= 9
			}
		}

		sum += digit
		double = !double
	}

	return sum%10 == 0
}

// calculateRiskScore calculates overall risk score from findings
func (s *DLPService) calculateRiskScore(findings []PIIFinding) float64 {
	if len(findings) == 0 {
		return 0.0
	}

	// Weight by sensitivity
	sensitivityWeights := map[string]float64{
		"ssn":            1.0,
		"credit_card":    0.9,
		"account_number": 0.8,
		"routing_number": 0.8,
		"email":          0.6,
		"phone":          0.5,
		"ip_address":     0.7,
		"passport":       1.0,
		"vin":            0.8,
	}

	totalScore := 0.0
	for _, finding := range findings {
		weight := sensitivityWeights[finding.Type]
		if weight == 0 {
			weight = 0.5
		}
		totalScore += finding.Confidence * weight
	}

	// Normalize by maximum possible score
	maxScore := float64(len(findings)) * 1.0
	if maxScore > 0 {
		return totalScore / maxScore
	}
	return 0.0
}

// determineRiskLevel determines risk level from score
func (s *DLPService) determineRiskLevel(score float64) string {
	switch {
	case score >= 0.8:
		return "critical"
	case score >= 0.6:
		return "high"
	case score >= 0.4:
		return "medium"
	default:
		return "low"
	}
}

// applyRedaction applies redaction to the original text
func (s *DLPService) applyRedaction(text string, findings []PIIFinding, method string) string {
	if method == "" || len(findings) == 0 {
		return text
	}

	redacted := text

	// Sort findings by position in reverse order to avoid offset issues
	for i := len(findings) - 1; i >= 0; i-- {
		finding := findings[i]
		replacement := s.redactValue(finding.Value, method)
		redacted = redacted[:finding.StartPosition] + replacement + redacted[finding.EndPosition:]
	}

	return redacted
}

// redactValue redacts a single PII value
func (s *DLPService) redactValue(value, method string) string {
	switch method {
	case "mask":
		if len(value) <= 4 {
			return strings.Repeat("*", len(value))
		}
		return value[:2] + strings.Repeat("*", len(value)-2)
	case "full_mask":
		return strings.Repeat("*", len(value))
	case "token":
		return "[REDACTED_" + generateID()[:8] + "]"
	case "encrypt":
		// This would integrate with the crypto manager
		return "[ENCRYPTED]"
	default:
		return "[REDACTED]"
	}
}

// applyCustomPatterns applies custom regex patterns
func (s *DLPService) applyCustomPatterns(text string, patterns map[string]string, minConfidence float64) []PIIFinding {
	var findings []PIIFinding

	for name, pattern := range patterns {
		re, err := regexp.Compile(pattern)
		if err != nil {
			continue
		}

		matches := re.FindAllStringSubmatchIndex(text, -1)
		for _, match := range matches {
			start := match[0]
			end := match[1]
			value := text[start:end]

			finding := PIIFinding{
				Type:          name,
				Value:         value,
				Redacted:      s.redactValue(value, "mask"),
				StartPosition: start,
				EndPosition:   end,
				Confidence:    minConfidence, // Custom patterns get minimum confidence
			}

			findings = append(findings, finding)
		}
	}

	return findings
}

// CreatePolicy creates a new DLP policy
func (s *DLPService) CreatePolicy(ctx context.Context, tenantID string, policy *DLPPolicy) (*DLPPolicy, error) {
	var result DLPPolicy
	err := s.doPost(ctx, fmt.Sprintf("/tenants/%s/policies", tenantID), policy, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to create DLP policy: %w", err)
	}
	return &result, nil
}

// GetPolicy retrieves a DLP policy
func (s *DLPService) GetPolicy(ctx context.Context, tenantID, policyID string) (*DLPPolicy, error) {
	var policy DLPPolicy
	err := s.doGet(ctx, fmt.Sprintf("/tenants/%s/policies/%s", tenantID, policyID), &policy)
	if err != nil {
		return nil, fmt.Errorf("failed to get DLP policy: %w", err)
	}
	return &policy, nil
}

// ListPolicies retrieves DLP policies for a tenant
func (s *DLPService) ListPolicies(ctx context.Context, tenantID string, opts *ListOptions) (*PaginatedResponse[DLPPolicy], error) {
	path := fmt.Sprintf("/tenants/%s/policies", tenantID)
	if opts != nil {
		path += s.buildQuery(map[string]interface{}{
			"page":      opts.Page,
			"page_size": opts.PageSize,
			"sort_by":   opts.SortBy,
			"sort_desc": opts.SortDesc,
		})
	}

	var response PaginatedResponse[DLPPolicy]
	err := s.doGet(ctx, path, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to list DLP policies: %w", err)
	}
	return &response, nil
}

// ScanDocument scans a document for PII
func (s *DLPService) ScanDocument(ctx context.Context, tenantID, documentID string, options *DLPScanRequest) (*DLPScanResult, error) {
	req := map[string]interface{}{
		"document_id": documentID,
		"options":     options,
	}

	var result DLPScanResult
	err := s.doPost(ctx, fmt.Sprintf("/tenants/%s/documents/scan", tenantID), req, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to scan document: %w", err)
	}
	return &result, nil
}

// GetMetrics retrieves DLP scanning metrics
func (s *DLPService) GetMetrics(ctx context.Context, tenantID string, timeRange *TimestampRange) (*DLPMetrics, error) {
	path := fmt.Sprintf("/tenants/%s/metrics", tenantID)
	if timeRange != nil {
		path += s.buildQuery(map[string]interface{}{
			"from": timeRange.From,
			"to":   timeRange.To,
		})
	}

	var metrics DLPMetrics
	err := s.doGet(ctx, path, &metrics)
	if err != nil {
		return nil, fmt.Errorf("failed to get DLP metrics: %w", err)
	}
	return &metrics, nil
}

// DLPMetrics represents DLP scanning metrics
type DLPMetrics struct {
	TenantID         string           `json:"tenant_id"`
	TotalScans       int64            `json:"total_scans"`
	PIIDetections    int64            `json:"pii_detections"`
	Redactions       int64            `json:"redactions"`
	BlockedRequests  int64            `json:"blocked_requests"`
	TopPIITypes      []PIITypeMetric  `json:"top_pii_types"`
	RiskDistribution map[string]int64 `json:"risk_distribution"`
	AvgScanTime      time.Duration    `json:"avg_scan_time"`
	TimeRange        TimeRange        `json:"time_range"`
}

// PIITypeMetric represents metrics for a PII type
type PIITypeMetric struct {
	Type       string  `json:"type"`
	Count      int64   `json:"count"`
	Confidence float64 `json:"avg_confidence"`
}

func minFloat64(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}

// isValidIBAN validates an International Bank Account Number (IBAN)
func (s *DLPService) isValidIBAN(ib string) bool {
	// Remove spaces
	ib = regexp.MustCompile(`\s`).ReplaceAllString(ib, "")

	// Basic length check (15-34 characters)
	if len(ib) < 15 || len(ib) > 34 {
		return false
	}

	// Must start with 2 letters
	if !regexp.MustCompile(`^[A-Z]{2}`).MatchString(ib) {
		return false
	}

	// Move first 4 characters to the end
	rearranged := ib[4:] + ib[:4]

	// Convert letters to numbers
	var numeric strings.Builder
	for _, r := range rearranged {
		if r >= 'A' && r <= 'Z' {
			numeric.WriteString(fmt.Sprintf("%d", int(r-'A')+10))
		} else if r >= '0' && r <= '9' {
			numeric.WriteRune(r)
		} else {
			return false
		}
	}

	// Mod 97 check
	number := numeric.String()
	// Handle large numbers by chunking
	for len(number) > 2 {
		digits := number[:9]
		number = fmt.Sprintf("%d%s", s.mod97(digits), number[9:])
	}

	return s.mod97(number) == 1
}

// mod97 calculates modulo 97 for large numbers represented as strings
func (s *DLPService) mod97(number string) int {
	var remainder int
	for _, digit := range number {
		remainder = (remainder*10 + int(digit-'0')) % 97
	}
	return remainder
}

// isValidSWIFT validates a SWIFT/BIC code
func (s *DLPService) isValidSWIFT(swift string) bool {
	// Remove spaces
	swift = regexp.MustCompile(`\s`).ReplaceAllString(swift, "")

	// Length check (8 or 11 characters)
	if len(swift) != 8 && len(swift) != 11 {
		return false
	}

	// Must be alphanumeric and uppercase
	if !regexp.MustCompile(`^[A-Z0-9]+$`).MatchString(swift) {
		return false
	}

	// First 6 characters: bank code, country code, location code
	if !regexp.MustCompile(`^[A-Z]{6}`).MatchString(swift[:6]) {
		return false
	}

	return true
}

// isValidNPI validates a National Provider Identifier (NPI)
func (s *DLPService) isValidNPI(npi string) bool {
	// Remove spaces and dashes
	npi = regexp.MustCompile(`[\s-]`).ReplaceAllString(npi, "")

	// Must be 10 digits
	if len(npi) != 10 {
		return false
	}

	if !regexp.MustCompile(`^\d{10}$`).MatchString(npi) {
		return false
	}

	// First digit must be 1 or 2 for healthcare NPIs
	if npi[0] != '1' && npi[0] != '2' {
		return false
	}

	// Luhn algorithm for NPI validation (special case with 24 as prefix)
	sum := 0
	double := false

	// Process digits from right to left (starting with check digit)
	for i := len(npi) - 1; i >= 0; i-- {
		digit := int(npi[i] - '0')

		if double {
			digit *= 2
			if digit > 9 {
				digit -= 9
			}
		}

		sum += digit
		double = !double
	}

	// Add 24 (NPI prefix) to the sum
	sum += 24

	return sum%10 == 0
}

// isValidICD10 validates an ICD-10 diagnosis code
func (s *DLPService) isValidICD10(code string) bool {
	// Basic format: A00-Z99, can have .0-.9 extension
	if !regexp.MustCompile(`^[A-Z]\d{2}(\.[A-Z0-9]{1,3})?$`).MatchString(code) {
		return false
	}

	// Valid first letter
	validLetters := "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
	if !strings.Contains(validLetters, string(code[0])) {
		return false
	}

	// Valid range for first two digits (00-99)
	digits := code[1:3]
	if digits > "99" {
		return false
	}

	return true
}

func maxFloat64(a, b float64) float64 {
	if a > b {
		return a
	}
	return b
}

// initializeAdvancedPatterns initializes advanced DLP patterns
func (s *DLPService) initializeAdvancedPatterns() {
	// Stub: advanced patterns initialization
}

// initializeCustomPatterns initializes custom DLP patterns
func (s *DLPService) initializeCustomPatterns() {
	// Stub: custom patterns initialization
}
