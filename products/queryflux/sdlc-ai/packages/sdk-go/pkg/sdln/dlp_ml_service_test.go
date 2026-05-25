package sdln

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDLPMLService_NewDLPMLService(t *testing.T) {
	client := &Client{}
	service := NewDLPMLService(client)

	assert.NotNil(t, service)
	assert.NotNil(t, service.DLPService)
	assert.NotNil(t, service.contextAnalyzer)
	assert.NotNil(t, service.anomalyDetector)
}

func TestContextAnalyzer_NewContextAnalyzer(t *testing.T) {
	analyzer := NewContextAnalyzer()

	assert.NotNil(t, analyzer)
	assert.NotEmpty(t, analyzer.contextPatterns)
	assert.NotEmpty(t, analyzer.semanticPatterns)

	// Check context patterns
	assert.Contains(t, analyzer.contextPatterns, "financial")
	assert.Contains(t, analyzer.contextPatterns, "healthcare")
	assert.Contains(t, analyzer.contextPatterns, "identity")
	assert.Contains(t, analyzer.contextPatterns, "contact")
	assert.Contains(t, analyzer.contextPatterns, "technical")
	assert.Contains(t, analyzer.contextPatterns, "legal")

	// Check semantic patterns
	assert.Contains(t, analyzer.semanticPatterns, "age_mention")
	assert.Contains(t, analyzer.semanticPatterns, "family_relation")
	assert.Contains(t, analyzer.semanticPatterns, "employment")
}

func TestContextAnalyzer_AnalyzeContext(t *testing.T) {
	analyzer := NewContextAnalyzer()

	// Test financial context
	text := "Please send the payment to my bank account 123456789 for the invoice."
	findings := []PIIFinding{
		{
			Type:          "bank_account",
			Value:         "123456789",
			StartPosition: 42,
			EndPosition:   51,
			Confidence:    0.75,
		},
	}

	enhanced := analyzer.AnalyzeContext(text, findings)
	assert.Len(t, enhanced, 1)
	assert.Greater(t, enhanced[0].Confidence, findings[0].Confidence) // Should be enhanced by context
	assert.Contains(t, enhanced[0].Context, "payment")
	assert.Contains(t, enhanced[0].Context, "bank account")

	// Test healthcare context
	text = "Patient John Doe's medical record MR123456 shows his blood type is O+."
	findings = []PIIFinding{
		{
			Type:          "medical_record",
			Value:         "MR123456",
			StartPosition: 23,
			EndPosition:   31,
			Confidence:    0.6,
		},
	}

	enhanced = analyzer.AnalyzeContext(text, findings)
	assert.Greater(t, enhanced[0].Confidence, findings[0].Confidence)
	assert.Contains(t, enhanced[0].Context, "Patient")
	assert.Contains(t, enhanced[0].Context, "medical record")
}

func TestContextAnalyzer_CalculateContextScore(t *testing.T) {
	analyzer := NewContextAnalyzer()

	// Test financial context for credit card
	context := "Please use credit card 4111111111111111 for payment"
	score := analyzer.calculateContextScore("credit_card", context)
	assert.Greater(t, score, 0.5)

	// Test healthcare context for medical record
	context = "Patient ID: MR123456, diagnosis confirmed"
	score = analyzer.calculateContextScore("medical_record", context)
	assert.Greater(t, score, 0.5)

	// Test weak context
	context = "The weather is nice today"
	score = analyzer.calculateContextScore("email", context)
	assert.Less(t, score, 0.1)
}

func TestContextAnalyzer_GetCategoryWeight(t *testing.T) {
	analyzer := NewContextAnalyzer()

	// Test high weight combinations
	weight := analyzer.getCategoryWeight("credit_card", "financial")
	assert.Equal(t, 1.0, weight)

	weight = analyzer.getCategoryWeight("npi", "healthcare")
	assert.Equal(t, 1.0, weight)

	weight = analyzer.getCategoryWeight("ssn", "identity")
	assert.Equal(t, 1.0, weight)

	// Test low weight combinations
	weight = analyzer.getCategoryWeight("email", "financial")
	assert.Equal(t, 0.3, weight)

	// Test default weight
	weight = analyzer.getCategoryWeight("unknown_type", "unknown_category")
	assert.Equal(t, 0.2, weight)
}

func TestAnomalyDetector_NewAnomalyDetector(t *testing.T) {
	detector := NewAnomalyDetector()

	assert.NotNil(t, detector)
	assert.NotEmpty(t, detector.anomalyIndicators)

	// Check anomaly indicators
	assert.Contains(t, detector.anomalyIndicators, "obfuscated_email")
	assert.Contains(t, detector.anomalyIndicators, "spaced_ssn")
	assert.Contains(t, detector.anomalyIndicators, "partial_credit")
	assert.Contains(t, detector.anomalyIndicators, "reversed_format")
}

func TestAnomalyDetector_DetectAnomalies(t *testing.T) {
	detector := NewAnomalyDetector()

	// Test obfuscated email
	text := "Contact me at john [at] example [dot] com for more information"
	findings := detector.DetectAnomalies(text)
	assert.Len(t, findings, 1)
	assert.Equal(t, "anomaly_obfuscated_email", findings[0].Type)
	assert.Contains(t, findings[0].Value, "john [at] example [dot] com")
	assert.Greater(t, findings[0].Confidence, 0.8)

	// Test spaced SSN
	text = "My social security number is 123 - 45 - 6789"
	findings = detector.DetectAnomalies(text)
	assert.Len(t, findings, 1)
	assert.Equal(t, "anomaly_spaced_ssn", findings[0].Type)
	assert.Greater(t, findings[0].Confidence, 0.8)

	// Test partial credit card
	text = "Credit card ending in 1234****5678"
	findings = detector.DetectAnomalies(text)
	assert.Len(t, findings, 1)
	assert.Equal(t, "anomaly_partial_credit", findings[0].Type)
	assert.Greater(t, findings[0].Confidence, 0.7)

	// Test reversed email
	text = "moc.elpmaxe@nhoj"
	findings = detector.DetectAnomalies(text)
	assert.Len(t, findings, 1)
	assert.Equal(t, "anomaly_reversed_format", findings[0].Type)
	assert.Greater(t, findings[0].Confidence, 0.9)
}

func TestAnomalyDetector_CalculateAnomalyConfidence(t *testing.T) {
	detector := NewAnomalyDetector()

	// Test high confidence anomalies
	confidence := detector.calculateAnomalyConfidence("obfuscated_email", "john [at] example [dot] com")
	assert.Greater(t, confidence, 0.8)

	confidence = detector.calculateAnomalyConfidence("spaced_ssn", "123 - 45 - 6789")
	assert.Greater(t, confidence, 0.8)

	// Test lower confidence anomalies
	confidence = detector.calculateAnomalyConfidence("word_number_mix", "test123")
	assert.Greater(t, confidence, 0.2)
	assert.Less(t, confidence, 0.5)

	// Test unknown anomaly type
	confidence = detector.calculateAnomalyConfidence("unknown", "test")
	assert.Equal(t, 0.5, confidence)
}

func TestDLPMLService_ScanWithML(t *testing.T) {
	client := &Client{}
	service := NewDLPMLService(client)

	// Test with financial text
	text := "Please send payment to account 123456789 using credit card 4111111111111111. Bank routing: 021000021"
	options := &DLPScanRequest{
		Text:            text,
		RedactionMethod: "mask",
		MinConfidence:   &[]float64{0.6}[0],
	}

	result, err := service.ScanWithML(context.Background(), text, options)
	require.NoError(t, err)
	assert.NotNil(t, result)
	assert.True(t, result.PIIFound)
	assert.Greater(t, len(result.Findings), 0)
	assert.NotEqual(t, text, result.RedactedText)
	assert.Greater(t, result.Score, 0.0)

	// Check ML metadata
	assert.True(t, result.Metadata["ml_enhanced"].(bool))
	assert.NotNil(t, result.Metadata["anomaly_count"])
	assert.NotNil(t, result.Metadata["context_enhanced"])
}

func TestDLPMLService_FilterAndDeduplicateFindings(t *testing.T) {
	client := &Client{}
	service := NewDLPMLService(client)

	// Create duplicate findings
	findings := []PIIFinding{
		{StartPosition: 10, EndPosition: 20, Type: "email"},
		{StartPosition: 10, EndPosition: 20, Type: "email"}, // Duplicate
		{StartPosition: 30, EndPosition: 40, Type: "phone"},
		{StartPosition: 50, EndPosition: 60, Type: "email"},
	}

	filtered := service.filterAndDeduplicateFindings(findings)
	assert.Len(t, filtered, 3) // Should remove one duplicate
}

func TestDLPMLService_CalculateMLRiskScore(t *testing.T) {
	client := &Client{}
	service := NewDLPMLService(client)

	// Test high risk findings
	highRiskFindings := []PIIFinding{
		{Type: "ssn", Confidence: 0.9},
		{Type: "credit_card", Confidence: 0.85},
	}

	score := service.calculateMLRiskScore(highRiskFindings, "short text")
	assert.Greater(t, score, 0.5)

	// Test low risk findings
	lowRiskFindings := []PIIFinding{
		{Type: "date", Confidence: 0.8},
		{Type: "url", Confidence: 0.7},
	}

	score = service.calculateMLRiskScore(lowRiskFindings, "longer text with more content to normalize score")
	assert.Less(t, score, 0.3)

	// Test empty findings
	score = service.calculateMLRiskScore([]PIIFinding{}, "any text")
	assert.Equal(t, 0.0, score)
}

func TestDLPMLService_CalculateTextComplexity(t *testing.T) {
	client := &Client{}
	service := NewDLPMLService(client)

	// Simple text
	simpleText := "Hello world this is simple"
	complexity := service.calculateTextComplexity(simpleText)
	assert.Greater(t, complexity, 1.0)
	assert.Less(t, complexity, 1.5)

	// Complex text with numbers and special chars
	complexText := "User123@site.com Password: $ecret#123 SSN: 123-45-6789!"
	complexity = service.calculateTextComplexity(complexText)
	assert.Greater(t, complexity, 1.5)
	assert.LessOrEqual(t, complexity, 2.0)
}

func TestDLPMLService_ApplyAdvancedRedaction(t *testing.T) {
	client := &Client{}
	service := NewDLPMLService(client)

	text := "Contact john.doe@example.com or 555-123-4567"
	findings := []PIIFinding{
		{StartPosition: 8, EndPosition: 26, Type: "email", Value: "john.doe@example.com"},
		{StartPosition: 30, EndPosition: 42, Type: "phone", Value: "555-123-4567"},
	}

	// Test mask method
	redacted := service.applyAdvancedRedaction(text, findings, "mask")
	assert.Contains(t, redacted, "***@example.com")
	assert.Contains(t, redacted, "555-***-4567")
	assert.NotContains(t, redacted, "john.doe@example.com")

	// Test tokenize method
	redacted = service.applyAdvancedRedaction(text, findings, "tokenize")
	assert.Contains(t, redacted, "[EMAIL_8]")
	assert.Contains(t, redacted, "[PHONE_30]")
}

func TestDLPMLService_GetAdvancedRedaction(t *testing.T) {
	client := &Client{}
	service := NewDLPMLService(client)

	// Test email masking
	finding := PIIFinding{Type: "email", Value: "john.doe@example.com"}
	redacted := service.getAdvancedRedaction(finding, "mask")
	assert.Equal(t, "jo***@example.com", redacted)

	// Test phone masking
	finding = PIIFinding{Type: "phone", Value: "555-123-4567"}
	redacted = service.getAdvancedRedaction(finding, "mask")
	assert.Equal(t, "555-***-4567", redacted)

	// Test credit card masking
	finding = PIIFinding{Type: "credit_card", Value: "4111111111111111"}
	redacted = service.getAdvancedRedaction(finding, "mask")
	assert.Equal(t, "****-****-****-1111", redacted)

	// Test SSN masking
	finding = PIIFinding{Type: "ssn", Value: "123-45-6789"}
	redacted = service.getAdvancedRedaction(finding, "mask")
	assert.Equal(t, "***-**-6789", redacted)

	// Test tokenize
	finding = PIIFinding{Type: "email", Value: "test@example.com", StartPosition: 10}
	redacted = service.getAdvancedRedaction(finding, "tokenize")
	assert.Equal(t, "[EMAIL_10]", redacted)

	// Test hash
	finding = PIIFinding{Type: "email", Value: "test@example.com", StartPosition: 10}
	redacted = service.getAdvancedRedaction(finding, "hash")
	assert.Contains(t, redacted, "[HASH:")

	// Test encrypt
	finding = PIIFinding{Type: "email", Value: "test@example.com"}
	redacted = service.getAdvancedRedaction(finding, "encrypt")
	assert.Equal(t, "[ENC:email]", redacted)

	// Test default redaction
	finding = PIIFinding{Type: "unknown", Value: "test"}
	redacted = service.getAdvancedRedaction(finding, "unknown")
	assert.Equal(t, "[REDACTED]", redacted)
}

func TestDLPMLService_MaskString(t *testing.T) {
	client := &Client{}
	service := NewDLPMLService(client)

	// Test full masking
	masked := service.maskString("hello", 0, 0)
	assert.Equal(t, "*****", masked)

	// Test partial masking
	masked = service.maskString("hello", 2, 2)
	assert.Equal(t, "he**o", masked)

	// Test edge cases
	masked = service.maskString("hi", 0, 0)
	assert.Equal(t, "**", masked)

	masked = service.maskString("a", 1, 0)
	assert.Equal(t, "a", masked)

	masked = service.maskString("a", 0, 1)
	assert.Equal(t, "a", masked)
}

func TestDLPMLService_IntegrationTest(t *testing.T) {
	client := &Client{}
	service := NewDLPMLService(client)

	// Complex text with multiple PII types and obfuscation
	text := `Patient John Doe's medical record MR123456 shows blood type O+.
	Contact his insurance at health@example.com or call 555-123-4567.
	SSN: 123 - 45 - 6789 (please keep confidential).
	Billing: credit card 4111-1111-1111-1111, bank account 987654321.
	For emergencies, contact jane [at] hospital [dot] org.`

	options := &DLPScanRequest{
		Text:            text,
		RedactionMethod: "mask",
		MinConfidence:   &[]float64{0.6}[0],
	}

	result, err := service.ScanWithML(context.Background(), text, options)
	require.NoError(t, err)

	// Verify comprehensive detection
	assert.True(t, result.PIIFound)
	assert.Greater(t, len(result.Findings), 8) // Should detect multiple PII types

	// Check for different PII types
	patterns := map[string]bool{
		"medical_record": false,
		"blood_type":     false,
		"email":          false,
		"phone":          false,
		"ssn":            false,
		"credit_card":    false,
		"bank_account":   false,
	}

	for _, finding := range result.Findings {
		if patternType, exists := patterns[finding.Type]; exists {
			patterns[finding.Type] = true
		}
	}

	assert.True(t, patterns["medical_record"])
	assert.True(t, patterns["email"])
	assert.True(t, patterns["credit_card"])
	assert.True(t, patterns["bank_account"])

	// Verify anomaly detection
	anomalyCount := result.Metadata["anomaly_count"].(int)
	assert.Greater(t, anomalyCount, 0) // Should detect obfuscated email

	// Verify risk level
	assert.Contains(t, []string{"medium", "high", "critical"}, result.RiskLevel)

	// Verify redaction
	assert.NotEqual(t, text, result.RedactedText)
	assert.Contains(t, result.RedactedText, "[REDACTED]")
}

func TestDLPMLService_PerformanceTest(t *testing.T) {
	client := &Client{}
	service := NewDLPMLService(client)

	// Generate large text
	text := ""
	for i := 0; i < 1000; i++ {
		text += "Please contact john.doe@example.com or call 555-123-4567 for account 123456789. "
	}

	options := &DLPScanRequest{
		Text:            text,
		RedactionMethod: "mask",
		MinConfidence:   &[]float64{0.6}[0],
	}

	start := time.Now()
	result, err := service.ScanWithML(context.Background(), text, options)
	duration := time.Since(start)

	require.NoError(t, err)
	assert.NotNil(t, result)
	assert.True(t, result.PIIFound)
	assert.Less(t, duration, 5*time.Second, "ML scan should complete within 5 seconds")
	assert.Greater(t, len(result.Findings), 1000) // Should find many PII instances
}
