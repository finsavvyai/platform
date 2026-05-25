package sdln

import (
	"context"
	"fmt"
	"math"
	"regexp"
	"strings"
	"time"
)

// DLPMLService provides ML-based PII detection and advanced analysis
type DLPMLService struct {
	*DLPService
	contextAnalyzer *ContextAnalyzer
	anomalyDetector *DLPAnomalyDetector
}

// NewDLPMLService creates a new DLP ML service
func NewDLPMLService(client *Client) *DLPMLService {
	baseService := NewDLPService(client)
	return &DLPMLService{
		DLPService:      baseService,
		contextAnalyzer: NewContextAnalyzer(),
		anomalyDetector: NewDLPAnomalyDetector(),
	}
}

// ContextAnalyzer provides context-aware PII detection
type ContextAnalyzer struct {
	// Context patterns that indicate PII presence
	contextPatterns map[string][]string
	// Semantic patterns for identifying sensitive content
	semanticPatterns map[string]*regexp.Regexp
}

// NewContextAnalyzer creates a new context analyzer
func NewContextAnalyzer() *ContextAnalyzer {
	analyzer := &ContextAnalyzer{
		contextPatterns:  make(map[string][]string),
		semanticPatterns: make(map[string]*regexp.Regexp),
	}

	analyzer.initializeContextPatterns()
	analyzer.initializeSemanticPatterns()

	return analyzer
}

// initializeContextPatterns initializes context patterns for PII detection
func (c *ContextAnalyzer) initializeContextPatterns() {
	c.contextPatterns = map[string][]string{
		"financial": {
			"account", "bank", "routing", "aba", "swift", "iban", "wire", "transfer",
			"payment", "invoice", "receipt", "transaction", "deposit", "withdrawal",
			"credit card", "debit card", "card number", "cvv", "expiry", "billing",
			"paypal", "venmo", "zelle", "cash app", "money", "dollar", "currency",
		},
		"healthcare": {
			"patient", "doctor", "nurse", "hospital", "clinic", "medical", "health",
			"diagnosis", "prescription", "medication", "treatment", "therapy",
			"insurance", "coverage", "claim", "copay", "deductible", "premium",
			"blood type", "allergy", "condition", "symptom", "vital signs",
		},
		"identity": {
			"social security", "ssn", "tax id", "ein", "passport", "driver license",
			"identification", "id number", "personal id", "national id",
			"birth certificate", "marriage certificate", "legal name",
		},
		"contact": {
			"phone", "mobile", "cell", "telephone", "fax", "email", "address",
			"zip code", "postal code", "state", "city", "country", "location",
			"home", "work", "office", "mailing", "shipping", "billing address",
		},
		"technical": {
			"password", "pin", "access", "login", "username", "credential",
			"api key", "secret", "token", "certificate", "private key",
			"database", "server", "ip address", "mac address", "hostname",
		},
		"legal": {
			"contract", "agreement", "legal", "attorney", "lawyer", "court",
			"case number", "docket", "plaintiff", "defendant", "judge",
			"lawsuit", "litigation", "settlement", "verdict", "ruling",
		},
	}
}

// initializeSemanticPatterns initializes semantic patterns for context analysis
func (c *ContextAnalyzer) initializeSemanticPatterns() {
	c.semanticPatterns = map[string]*regexp.Regexp{
		"age_mention":     regexp.MustCompile(`(?i)\b(age|years old|y/o|born|birthday|date of birth)\b`),
		"family_relation": regexp.MustCompile(`(?i)\b(mother|father|parent|child|son|daughter|sibling|spouse|husband|wife|family)\b`),
		"employment":      regexp.MustCompile(`(?i)\b(employee|employer|work|job|salary|wage|income|payroll|hr|human resources)\b`),
		"education":       regexp.MustCompile(`(?i)\b(school|university|college|degree|diploma|student|teacher|professor|education)\b`),
		"emergency":       regexp.MustCompile(`(?i)\b(emergency|urgent|immediate|asap|911|police|fire|ambulance)\b`),
		"confidential":    regexp.MustCompile(`(?i)\b(confidential|secret|private|sensitive|proprietary|internal only|do not distribute)\b`),
	}
}

// AnalyzeContext analyzes the context around potential PII to improve detection accuracy
func (c *ContextAnalyzer) AnalyzeContext(text string, findings []PIIFinding) []PIIFinding {
	enhancedFindings := make([]PIIFinding, len(findings))
	copy(enhancedFindings, findings)

	for i, finding := range findings {
		// Extract larger context window
		contextStart := max(0, finding.StartPosition-100)
		contextEnd := min(len(text), finding.EndPosition+100)
		context := text[contextStart:contextEnd]

		// Analyze context for semantic clues
		contextScore := c.calculateContextScore(finding.Type, context)

		// Update confidence based on context
		newConfidence := finding.Confidence + (contextScore * 0.2) // Context contributes 20% to confidence
		if newConfidence > 1.0 {
			newConfidence = 1.0
		}

		enhancedFindings[i].Confidence = newConfidence
		enhancedFindings[i].Context = context
	}

	return enhancedFindings
}

// calculateContextScore calculates a context relevance score
func (c *ContextAnalyzer) calculateContextScore(piiType, context string) float64 {
	context = strings.ToLower(context)
	score := 0.0

	// Check against context patterns
	for category, patterns := range c.contextPatterns {
		categoryScore := 0.0
		for _, pattern := range patterns {
			if strings.Contains(context, pattern) {
				categoryScore += 0.1
			}
		}

		// Weight score based on category relevance to PII type
		weight := c.getCategoryWeight(piiType, category)
		score += categoryScore * weight
	}

	// Check semantic patterns
	for patternName, pattern := range c.semanticPatterns {
		if pattern.MatchString(context) {
			score += c.getSemanticWeight(piiType, patternName)
		}
	}

	return math.Min(score, 1.0)
}

// getCategoryWeight returns the weight of a context category for a PII type
func (c *ContextAnalyzer) getCategoryWeight(piiType, category string) float64 {
	weights := map[string]map[string]float64{
		"credit_card":    {"financial": 1.0, "contact": 0.3, "technical": 0.2},
		"ssn":            {"identity": 1.0, "financial": 0.8, "contact": 0.5},
		"email":          {"contact": 1.0, "technical": 0.4, "financial": 0.3},
		"phone":          {"contact": 1.0, "emergency": 0.7, "financial": 0.4},
		"npi":            {"healthcare": 1.0, "contact": 0.6, "employment": 0.4},
		"medical_record": {"healthcare": 1.0, "emergency": 0.8, "family_relation": 0.5},
		"bank_account":   {"financial": 1.0, "contact": 0.3, "employment": 0.4},
		"password":       {"technical": 1.0, "confidential": 0.9, "contact": 0.3},
		"address":        {"contact": 1.0, "financial": 0.5, "family_relation": 0.4},
	}

	if categoryWeights, exists := weights[piiType]; exists {
		if weight, exists := categoryWeights[category]; exists {
			return weight
		}
	}

	// Default weight
	return 0.2
}

// getSemanticWeight returns the weight of a semantic pattern for a PII type
func (c *ContextAnalyzer) getSemanticWeight(piiType, patternName string) float64 {
	weights := map[string]map[string]float64{
		"age_mention":     {"medical_record": 0.4, "ssn": 0.3, "insurance_id": 0.3},
		"family_relation": {"medical_record": 0.5, "emergency": 0.6, "insurance_id": 0.3},
		"employment":      {"ssn": 0.4, "bank_account": 0.3, "email": 0.2},
		"education":       {"email": 0.2, "phone": 0.2, "address": 0.3},
		"emergency":       {"phone": 0.6, "medical_record": 0.7, "insurance_id": 0.5},
		"confidential":    {"password": 0.5, "api_key": 0.5, "private_key": 0.5},
	}

	if semanticWeights, exists := weights[piiType]; exists {
		if weight, exists := semanticWeights[patternName]; exists {
			return weight
		}
	}

	return 0.1
}

// DLPAnomalyDetector detects anomalous patterns that might indicate hidden PII
type DLPAnomalyDetector struct {
	// Baseline patterns for normal text
	baselinePatterns map[string]*regexp.Regexp
	// Anomaly indicators
	anomalyIndicators map[string]*regexp.Regexp
}

// NewDLPAnomalyDetector creates a new anomaly detector
func NewDLPAnomalyDetector() *DLPAnomalyDetector {
	detector := &DLPAnomalyDetector{
		baselinePatterns:  make(map[string]*regexp.Regexp),
		anomalyIndicators: make(map[string]*regexp.Regexp),
	}

	detector.initializeAnomalyIndicators()

	return detector
}

// initializeAnomalyIndicators initializes patterns that might indicate hidden PII
func (d *DLPAnomalyDetector) initializeAnomalyIndicators() {
	d.anomalyIndicators = map[string]*regexp.Regexp{
		"obfuscated_email":   regexp.MustCompile(`\b[A-Za-z0-9._%+-]+\s*(?:\[at\]|\(at\)|@)\s*[A-Za-z0-9.-]+\s*(?:\[dot\]|\(dot\)|\.)\s*[A-Z|a-z]{2,}\b`),
		"spaced_ssn":         regexp.MustCompile(`\b\d{3}\s*-\s*\d{2}\s*-\s*\d{4}\b`),
		"partial_credit":     regexp.MustCompile(`\b\d{4}[*]{4,8}\d{4}\b|\b\d{4}[*]{4,12}\b`),
		"encoded_phone":      regexp.MustCompile(`\b\(\d{3}\)\s*\d{3}[-.\s]?\d{4}\b`),
		"reversed_format":    regexp.MustCompile(`\b[moc\.\w&]+(?:@|;|:)[\w\.]+\b`), // Reversed emails
		"base64_suspicious":  regexp.MustCompile(`[A-Za-z0-9+/]{20,}={0,2}`),
		"hex_encoded":        regexp.MustCompile(`(?:0x)?[0-9A-Fa-f]{8,}`),
		"leetspeak":          regexp.MustCompile(`\b[A-Za-z0-9]{4,}\s*(?:\(\w+\)|\[\w+\]|\{\w+\})`),
		"word_number_mix":    regexp.MustCompile(`\b[A-Za-z]+\d+[A-Za-z]*\d*[A-Za-z]*\b`),
		"suspicious_spacing": regexp.MustCompile(`\b[A-Za-z0-9]\s+[A-Za-z0-9]\s+[A-Za-z0-9]\s+[A-Za-z0-9]+\b`),
	}
}

// DetectAnomalies detects anomalous patterns that might indicate obfuscated PII
func (d *DLPAnomalyDetector) DetectAnomalies(text string) []PIIFinding {
	var findings []PIIFinding

	for anomalyType, pattern := range d.anomalyIndicators {
		matches := pattern.FindAllStringSubmatchIndex(text, -1)

		for _, match := range matches {
			start := match[0]
			end := match[1]
			value := text[start:end]

			// Calculate confidence for anomaly
			confidence := d.calculateAnomalyConfidence(anomalyType, value)
			if confidence < 0.3 { // Lower threshold for anomalies
				continue
			}

			// Extract context
			contextStart := max(0, start-50)
			contextEnd := min(len(text), end+50)
			context := text[contextStart:contextEnd]

			finding := PIIFinding{
				Type:          fmt.Sprintf("anomaly_%s", anomalyType),
				Value:         value,
				Redacted:      "[ANOMALY_DETECTED]",
				StartPosition: start,
				EndPosition:   end,
				Confidence:    confidence,
				Context:       context,
			}

			findings = append(findings, finding)
		}
	}

	return findings
}

// calculateAnomalyConfidence calculates confidence for anomaly detection
func (d *DLPAnomalyDetector) calculateAnomalyConfidence(anomalyType, value string) float64 {
	// Base confidence by anomaly type
	baseConfidence := map[string]float64{
		"obfuscated_email":   0.85,
		"spaced_ssn":         0.90,
		"partial_credit":     0.75,
		"encoded_phone":      0.80,
		"reversed_format":    0.95,
		"base64_suspicious":  0.60,
		"hex_encoded":        0.50,
		"leetspeak":          0.40,
		"word_number_mix":    0.30,
		"suspicious_spacing": 0.45,
	}

	confidence := baseConfidence[anomalyType]
	if confidence == 0 {
		confidence = 0.5
	}

	// Adjust based on characteristics
	if len(value) > 20 {
		confidence += 0.1 // Longer values are more suspicious
	}

	if strings.Contains(value, "...") || strings.Contains(value, "***") {
		confidence += 0.1 // Obfuscation indicators
	}

	return math.Min(confidence, 1.0)
}

// ScanWithML performs advanced DLP scanning with ML-enhanced detection
func (s *DLPMLService) ScanWithML(ctx context.Context, text string, options *DLPScanRequest) (*DLPScanResult, error) {
	startTime := time.Now()

	// Perform standard PII detection
	standardFindings := s.detectPII(text, options)

	// Apply context analysis
	enhancedFindings := s.contextAnalyzer.AnalyzeContext(text, standardFindings)

	// Detect anomalies
	anomalyFindings := s.anomalyDetector.DetectAnomalies(text)

	// Combine all findings
	allFindings := append(enhancedFindings, anomalyFindings...)

	// Remove duplicates and apply advanced filtering
	filteredFindings := s.filterAndDeduplicateFindings(allFindings)

	// Calculate risk score with ML enhancement
	riskScore := s.calculateMLRiskScore(filteredFindings, text)
	riskLevel := s.determineRiskLevel(riskScore)

	// Apply advanced redaction
	redactedText := text
	if options.RedactionMethod != "" {
		redactedText = s.applyAdvancedRedaction(text, filteredFindings, options.RedactionMethod)
	}

	result := &DLPScanResult{
		ID:           generateID(),
		ScanID:       generateID(),
		PIIFound:     len(filteredFindings) > 0,
		Findings:     filteredFindings,
		RedactedText: redactedText,
		OriginalText: text,
		RiskLevel:    riskLevel,
		Score:        riskScore,
		ScannedAt:    NewTimestamp(time.Now().UTC()),
		Duration:     time.Since(startTime),
	}

	// Add ML-specific metadata
	if result.Metadata == nil {
		result.Metadata = make(map[string]interface{})
	}
	result.Metadata["ml_enhanced"] = true
	result.Metadata["anomaly_count"] = len(anomalyFindings)
	result.Metadata["context_enhanced"] = len(enhancedFindings) > len(standardFindings)

	return result, nil
}

// filterAndDeduplicateFindings removes duplicate findings and applies advanced filtering
func (s *DLPMLService) filterAndDeduplicateFindings(findings []PIIFinding) []PIIFinding {
	seen := make(map[string]bool)
	var filtered []PIIFinding

	for _, finding := range findings {
		key := fmt.Sprintf("%d-%d-%s", finding.StartPosition, finding.EndPosition, finding.Type)
		if !seen[key] {
			seen[key] = true
			filtered = append(filtered, finding)
		}
	}

	return filtered
}

// calculateMLRiskScore calculates risk score using ML-enhanced methods
func (s *DLPMLService) calculateMLRiskScore(findings []PIIFinding, text string) float64 {
	if len(findings) == 0 {
		return 0.0
	}

	riskScore := 0.0
	typeWeights := map[string]float64{
		// High risk
		"ssn":            0.9,
		"credit_card":    0.85,
		"bank_account":   0.8,
		"medical_record": 0.9,
		"npi":            0.85,
		"password":       0.95,
		"private_key":    0.95,
		"api_key":        0.9,

		// Medium risk
		"email":     0.6,
		"phone":     0.5,
		"address":   0.6,
		"iban":      0.75,
		"swift_bic": 0.7,

		// Low risk
		"date":     0.2,
		"url":      0.3,
		"zip_code": 0.25,
	}

	for _, finding := range findings {
		weight := 0.5 // Default weight
		if w, exists := typeWeights[finding.Type]; exists {
			weight = w
		}

		// Apply confidence weighting
		weightedScore := weight * finding.Confidence
		riskScore += weightedScore
	}

	// Normalize by text length
	textLength := len(text)
	if textLength > 0 {
		riskScore = riskScore / float64(textLength) * 100
	}

	// Apply text complexity factor
	complexityFactor := s.calculateTextComplexity(text)
	riskScore *= complexityFactor

	return math.Min(riskScore, 1.0)
}

// calculateTextComplexity calculates a complexity factor for the text
func (s *DLPMLService) calculateTextComplexity(text string) float64 {
	// Simple complexity calculation based on various factors
	complexity := 1.0

	// Factor in special characters
	specialCharRatio := float64(len(regexp.MustCompile(`[^a-zA-Z0-9\s]`).FindAllStringIndex(text, -1))) / float64(len(text))
	complexity += specialCharRatio * 0.2

	// Factor in numbers
	numberRatio := float64(len(regexp.MustCompile(`\d`).FindAllStringIndex(text, -1))) / float64(len(text))
	complexity += numberRatio * 0.3

	// Factor in mixed case patterns
	if regexp.MustCompile(`[a-z][A-Z]|[A-Z][a-z]`).MatchString(text) {
		complexity += 0.1
	}

	return math.Min(complexity, 2.0)
}

// applyAdvancedRedaction applies advanced redaction techniques
func (s *DLPMLService) applyAdvancedRedaction(text string, findings []PIIFinding, method string) string {
	// Sort findings by position (descending to avoid index shifting)
	sortedFindings := make([]PIIFinding, len(findings))
	copy(sortedFindings, findings)

	// Sort by start position descending
	for i := 0; i < len(sortedFindings)-1; i++ {
		for j := i + 1; j < len(sortedFindings); j++ {
			if sortedFindings[i].StartPosition < sortedFindings[j].StartPosition {
				sortedFindings[i], sortedFindings[j] = sortedFindings[j], sortedFindings[i]
			}
		}
	}

	result := text
	for _, finding := range sortedFindings {
		redacted := s.getAdvancedRedaction(finding, method)
		result = result[:finding.StartPosition] + redacted + result[finding.EndPosition:]
	}

	return result
}

// getAdvancedRedaction generates advanced redaction based on type and method
func (s *DLPMLService) getAdvancedRedaction(finding PIIFinding, method string) string {
	switch method {
	case "mask":
		return s.maskAdvanced(finding)
	case "tokenize":
		return s.tokenizeAdvanced(finding)
	case "hash":
		return s.hashAdvanced(finding)
	case "encrypt":
		return s.encryptAdvanced(finding)
	default:
		return "[REDACTED]"
	}
}

// maskAdvanced applies advanced masking based on PII type
func (s *DLPMLService) maskAdvanced(finding PIIFinding) string {
	value := finding.Value
	length := len(value)

	switch finding.Type {
	case "email":
		if parts := strings.Split(value, "@"); len(parts) == 2 {
			maskedLocal := s.maskString(parts[0], 2, len(parts[0])-2)
			return maskedLocal + "@" + parts[1]
		}
	case "phone":
		if length >= 10 {
			return value[:3] + "-***-" + value[length-4:]
		}
	case "credit_card":
		if length >= 16 {
			return "****-****-****-" + value[length-4:]
		}
	case "ssn":
		if length >= 9 {
			return "***-**-" + value[length-4:]
		}
	}

	// Default masking
	return s.maskString(value, 2, len(value)-2)
}

// tokenizeAdvanced replaces PII with tokens
func (s *DLPMLService) tokenizeAdvanced(finding PIIFinding) string {
	return fmt.Sprintf("[%s_%d]", strings.ToUpper(finding.Type), finding.StartPosition)
}

// hashAdvanced creates a hash of the PII value
func (s *DLPMLService) hashAdvanced(finding PIIFinding) string {
	// Simple hash simulation - in production, use proper cryptographic hashing
	return fmt.Sprintf("[HASH:%x]", len(finding.Value)*7+finding.StartPosition*13)
}

// encryptAdvanced encrypts the PII value
func (s *DLPMLService) encryptAdvanced(finding PIIFinding) string {
	// Simple encryption simulation - in production, use proper encryption
	return fmt.Sprintf("[ENC:%s]", finding.Type)
}

// maskString masks a string preserving first and last n characters
func (s *DLPMLService) maskString(str string, first, last int) string {
	if len(str) <= first+last {
		return strings.Repeat("*", len(str))
	}

	if first > 0 {
		return str[:first] + strings.Repeat("*", len(str)-first-last) + str[len(str)-last:]
	}

	return strings.Repeat("*", len(str)-last) + str[len(str)-last:]
}

