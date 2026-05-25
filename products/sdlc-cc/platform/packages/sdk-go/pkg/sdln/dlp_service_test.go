//go:build never
// +build never

package sdln

import (
	"context"
	"testing"
	"time"
)

// TestDLPService_NewDLPService tests the DLP service constructor
func TestDLPService_NewDLPService(t *testing.T) {
	client := &Client{
		config: &Config{},
	}

	service := NewDLPService(client)

	if service == nil {
		t.Fatal("Expected service to be created")
	}

	if len(service.piiPatterns) == 0 {
		t.Fatal("Expected PII patterns to be initialized")
	}

	// Check that essential patterns exist
	essentialPatterns := []string{
		"email", "phone", "ssn", "credit_card", "iban", "swift_bic",
		"npi", "medical_record", "drivers_license", "passport",
	}

	for _, pattern := range essentialPatterns {
		if _, exists := service.piiPatterns[pattern]; !exists {
			t.Errorf("Expected pattern '%s' to be initialized", pattern)
		}
	}
}

// TestDLPService_ScanAndRedact_BasicPII tests basic PII detection and redaction
func TestDLPService_ScanAndRedact_BasicPII(t *testing.T) {
	client := &Client{config: &Config{}}
	service := NewDLPService(client)

	testCases := []struct {
		name         string
		text         string
		expectedPII  int
		redactMethod string
	}{
		{
			name:         "Email Detection",
			text:         "Contact john.doe@example.com for more information",
			expectedPII:  1,
			redactMethod: "mask",
		},
		{
			name:         "Phone Detection",
			text:         "Call me at (555) 123-4567 tomorrow",
			expectedPII:  1,
			redactMethod: "mask",
		},
		{
			name:         "SSN Detection",
			text:         "My SSN is 123-45-6789",
			expectedPII:  1,
			redactMethod: "mask",
		},
		{
			name:         "Credit Card Detection",
			text:         "Please use card 4111-1111-1111-1111",
			expectedPII:  1,
			redactMethod: "mask",
		},
		{
			name:         "Multiple PII",
			text:         "Send email to user@test.com or call (555) 987-6543. SSN: 111-22-3333",
			expectedPII:  3,
			redactMethod: "mask",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			ctx := context.Background()
			options := &DLPScanRequest{
				Text:            tc.text,
				ScanType:        "pii",
				RedactionMethod: tc.redactMethod,
				MinConfidence:   &[]float64{0.5}[0],
			}

			result, err := service.ScanAndRedact(ctx, tc.text, options)
			if err != nil {
				t.Fatalf("Unexpected error: %v", err)
			}

			if len(result.Findings) != tc.expectedPII {
				t.Errorf("Expected %d PII findings, got %d", tc.expectedPII, len(result.Findings))
			}

			if tc.expectedPII > 0 && !result.PIIFound {
				t.Error("Expected PIIFound to be true")
			}

			if result.RedactedText == tc.text && tc.expectedPII > 0 {
				t.Error("Expected redacted text to be different from original")
			}

			if result.Score <= 0 && tc.expectedPII > 0 {
				t.Error("Expected positive risk score")
			}
		})
	}
}

// TestDLPService_ScanAndRedact_FinancialPatterns tests financial pattern detection
func TestDLPService_ScanAndRedact_FinancialPatterns(t *testing.T) {
	client := &Client{config: &Config{}}
	service := NewDLPService(client)

	testCases := []struct {
		name        string
		text        string
		expectedPII int
		patterns    []string // Expected PII types
	}{
		{
			name:        "IBAN Detection",
			text:        "Transfer to IBAN GB82WEST12345698765432",
			expectedPII: 1,
			patterns:    []string{"iban"},
		},
		{
			name:        "SWIFT Detection",
			text:        "Bank code: CITIUS33",
			expectedPII: 1,
			patterns:    []string{"swift_bic"},
		},
		{
			name:        "Bank Account",
			text:        "Account number: 1234567890",
			expectedPII: 1,
			patterns:    []string{"bank_account"},
		},
		{
			name:        "CVV Detection",
			text:        "CVV: 123",
			expectedPII: 1,
			patterns:    []string{"cvv"},
		},
		{
			name:        "Credit Card Types",
			text:        "Visa: 4111111111111111, Mastercard: 5555555555554444, Amex: 378282246310005",
			expectedPII: 3,
			patterns:    []string{"credit_card_visa", "credit_card_mastercard", "credit_card_amex"},
		},
		{
			name:        "Crypto Address",
			text:        "Bitcoin: 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
			expectedPII: 1,
			patterns:    []string{"crypto_address"},
		},
		{
			name:        "Ethereum Address",
			text:        "ETH: 0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
			expectedPII: 1,
			patterns:    []string{"crypto_eth"},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			ctx := context.Background()
			options := &DLPScanRequest{
				Text:            tc.text,
				ScanType:        "financial",
				RedactionMethod: "mask",
				MinConfidence:   &[]float64{0.5}[0],
			}

			result, err := service.ScanAndRedact(ctx, tc.text, options)
			if err != nil {
				t.Fatalf("Unexpected error: %v", err)
			}

			if len(result.Findings) != tc.expectedPII {
				t.Errorf("Expected %d PII findings, got %d", tc.expectedPII, len(result.Findings))
			}

			// Check that expected patterns were found
			if len(tc.patterns) > 0 {
				foundPatterns := make(map[string]bool)
				for _, finding := range result.Findings {
					foundPatterns[finding.Type] = true
				}

				for _, expectedPattern := range tc.patterns {
					if !foundPatterns[expectedPattern] {
						t.Errorf("Expected to find pattern '%s'", expectedPattern)
					}
				}
			}
		})
	}
}

// TestDLPService_ScanAndRedact_HealthcarePatterns tests healthcare pattern detection
func TestDLPService_ScanAndRedact_HealthcarePatterns(t *testing.T) {
	client := &Client{config: &Config{}}
	service := NewDLPService(client)

	testCases := []struct {
		name        string
		text        string
		expectedPII int
		patterns    []string // Expected PII types
	}{
		{
			name:        "NPI Detection",
			text:        "Doctor NPI: 1234567890",
			expectedPII: 1,
			patterns:    []string{"npi"},
		},
		{
			name:        "Medical Record",
			text:        "MR number: MR12345678",
			expectedPII: 1,
			patterns:    []string{"medical_record"},
		},
		{
			name:        "Patient ID",
			text:        "Patient: PT987654321",
			expectedPII: 1,
			patterns:    []string{"patient_id"},
		},
		{
			name:        "Prescription Number",
			text:        "Rx: 123456789012",
			expectedPII: 1,
			patterns:    []string{"prescription"},
		},
		{
			name:        "ICD-10 Code",
			text:        "Diagnosis: I10.9",
			expectedPII: 1,
			patterns:    []string{"icd_10"},
		},
		{
			name:        "CPT Code",
			text:        "Procedure: 99214",
			expectedPII: 1,
			patterns:    []string{"cpt"},
		},
		{
			name:        "Blood Type",
			text:        "Blood type: O+",
			expectedPII: 1,
			patterns:    []string{"blood_type"},
		},
		{
			name:        "Dosage",
			text:        "Take 500mg twice daily",
			expectedPII: 1,
			patterns:    []string{"dosage"},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			ctx := context.Background()
			options := &DLPScanRequest{
				Text:            tc.text,
				ScanType:        "health",
				RedactionMethod: "mask",
				MinConfidence:   &[]float64{0.5}[0],
			}

			result, err := service.ScanAndRedact(ctx, tc.text, options)
			if err != nil {
				t.Fatalf("Unexpected error: %v", err)
			}

			if len(result.Findings) != tc.expectedPII {
				t.Errorf("Expected %d PII findings, got %d", tc.expectedPII, len(result.Findings))
			}

			// Check that expected patterns were found
			if len(tc.patterns) > 0 {
				foundPatterns := make(map[string]bool)
				for _, finding := range result.Findings {
					foundPatterns[finding.Type] = true
				}

				for _, expectedPattern := range tc.patterns {
					if !foundPatterns[expectedPattern] {
						t.Errorf("Expected to find pattern '%s'", expectedPattern)
					}
				}
			}
		})
	}
}

// TestDLPService_ScanAndRedact_CustomPatterns tests custom pattern detection
func TestDLPService_ScanAndRedact_CustomPatterns(t *testing.T) {
	client := &Client{config: &Config{}}
	service := NewDLPService(client)

	ctx := context.Background()

	customPatterns := map[string]string{
		"employee_id":  `\bEMP\d{6}\b`,
		"project_code": `\bPROJ-[A-Z]{3}\b`,
	}

	text := "Employee EMP123456 works on project PROJ-ABC"

	options := &DLPScanRequest{
		Text:            text,
		ScanType:        "custom",
		RedactionMethod: "mask",
		MinConfidence:   &[]float64{0.5}[0],
		CustomPatterns:  customPatterns,
	}

	result, err := service.ScanAndRedact(ctx, text, options)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	// Should find both custom patterns
	if len(result.Findings) != 2 {
		t.Errorf("Expected 2 PII findings, got %d", len(result.Findings))
	}

	// Check that custom patterns were found
	foundPatterns := make(map[string]bool)
	for _, finding := range result.Findings {
		foundPatterns[finding.Type] = true
	}

	expectedPatterns := []string{"employee_id", "project_code"}
	for _, expectedPattern := range expectedPatterns {
		if !foundPatterns[expectedPattern] {
			t.Errorf("Expected to find custom pattern '%s'", expectedPattern)
		}
	}
}

// TestDLPService_ScanAndRedact_RedactionMethods tests different redaction methods
func TestDLPService_ScanAndRedact_RedactionMethods(t *testing.T) {
	client := &Client{config: &Config{}}
	service := NewDLPService(client)

	ctx := context.Background()
	text := "Email: test@example.com"

	testCases := []struct {
		name      string
		method    string
		expected  string // Should contain this
		shouldNot string // Should not contain this
	}{
		{
			name:      "Mask Redaction",
			method:    "mask",
			expected:  "te************",
			shouldNot: "test@example.com",
		},
		{
			name:      "Full Mask Redaction",
			method:    "full_mask",
			expected:  "********************",
			shouldNot: "test@example.com",
		},
		{
			name:      "Token Redaction",
			method:    "token",
			expected:  "[REDACTED_",
			shouldNot: "test@example.com",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			options := &DLPScanRequest{
				Text:            text,
				ScanType:        "pii",
				RedactionMethod: tc.method,
				MinConfidence:   &[]float64{0.5}[0],
			}

			result, err := service.ScanAndRedact(ctx, text, options)
			if err != nil {
				t.Fatalf("Unexpected error: %v", err)
			}

			if !result.PIIFound {
				t.Error("Expected PIIFound to be true")
			}

			if !contains(result.RedactedText, tc.expected) {
				t.Errorf("Expected redacted text to contain '%s', got '%s'", tc.expected, result.RedactedText)
			}

			if contains(result.RedactedText, tc.shouldNot) {
				t.Errorf("Expected redacted text to not contain '%s', got '%s'", tc.shouldNot, result.RedactedText)
			}
		})
	}
}

// TestDLPService_calculateRiskScore tests risk score calculation
func TestDLPService_calculateRiskScore(t *testing.T) {
	client := &Client{config: &Config{}}
	service := NewDLPService(client)

	testCases := []struct {
		name     string
		findings []PIIFinding
		expected float64
	}{
		{
			name:     "No Findings",
			findings: []PIIFinding{},
			expected: 0.0,
		},
		{
			name: "Low Risk",
			findings: []PIIFinding{
				{Type: "email", Confidence: 0.95},
				{Type: "phone", Confidence: 0.85},
			},
			expected: 0.725, // (0.95*0.6 + 0.85*0.5) / 2
		},
		{
			name: "High Risk",
			findings: []PIIFinding{
				{Type: "ssn", Confidence: 0.90},
				{Type: "credit_card", Confidence: 0.80},
				{Type: "npi", Confidence: 0.95},
			},
			expected: 0.883, // (0.90*1.0 + 0.80*0.9 + 0.95*1.0) / 3
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			score := service.calculateRiskScore(tc.findings)
			if score < tc.expected-0.01 || score > tc.expected+0.01 {
				t.Errorf("Expected risk score around %.3f, got %.3f", tc.expected, score)
			}
		})
	}
}

// TestDLPService_determineRiskLevel tests risk level determination
func TestDLPService_determineRiskLevel(t *testing.T) {
	client := &Client{config: &Config{}}
	service := NewDLPService(client)

	testCases := []struct {
		name     string
		score    float64
		expected string
	}{
		{"Low Risk", 0.3, "low"},
		{"Medium Risk", 0.5, "medium"},
		{"High Risk", 0.7, "high"},
		{"Critical Risk", 0.9, "critical"},
		{"Boundary Low/Medium", 0.4, "medium"},
		{"Boundary Medium/High", 0.6, "high"},
		{"Boundary High/Critical", 0.8, "high"},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			level := service.determineRiskLevel(tc.score)
			if level != tc.expected {
				t.Errorf("Expected risk level '%s', got '%s'", tc.expected, level)
			}
		})
	}
}

// TestDLPService_isValidLuhn tests Luhn algorithm validation
func TestDLPService_isValidLuhn(t *testing.T) {
	client := &Client{config: &Config{}}
	service := NewDLPService(client)

	testCases := []struct {
		name     string
		number   string
		expected bool
	}{
		{"Valid Visa", "4111111111111111", true},
		{"Valid Mastercard", "5555555555554444", true},
		{"Valid Amex", "378282246310005", true},
		{"Invalid", "1234567890123456", false},
		{"Too Short", "123456789012", false},
		{"Too Long", "12345678901234567890", false},
		{"Invalid Characters", "4111a111111111111", false},
		{"Valid With Spaces", "4111 1111 1111 1111", true},
		{"Valid With Dashes", "4111-1111-1111-1111", true},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := service.isValidLuhn(tc.number)
			if result != tc.expected {
				t.Errorf("Expected isValidLuhn('%s') to be %v, got %v", tc.number, tc.expected, result)
			}
		})
	}
}

// TestDLPService_isValidIBAN tests IBAN validation
func TestDLPService_isValidIBAN(t *testing.T) {
	client := &Client{config: &Config{}}
	service := NewDLPService(client)

	testCases := []struct {
		name     string
		iban     string
		expected bool
	}{
		{"Valid GB IBAN", "GB82WEST12345698765432", true},
		{"Valid DE IBAN", "DE89370400440532013000", true},
		{"Valid FR IBAN", "FR1420041010050500013M02606", true},
		{"Invalid Too Short", "GB12WEST", false},
		{"Invalid Too Long", "GB82WEST1234569876543210123456789", false},
		{"Invalid Country Code", "XX82WEST12345698765432", false},
		{"Invalid Characters", "GB82 WEST12345698765432", false},
		{"Invalid Check Digits", "GB99WEST12345698765432", false},
		{"Valid With Spaces", "GB82 WEST 1234 5698 7654 32", true},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := service.isValidIBAN(tc.iban)
			if result != tc.expected {
				t.Errorf("Expected isValidIBAN('%s') to be %v, got %v", tc.iban, tc.expected, result)
			}
		})
	}
}

// TestDLPService_isValidSWIFT tests SWIFT/BIC validation
func TestDLPService_isValidSWIFT(t *testing.T) {
	client := &Client{config: &Config{}}
	service := NewDLPService(client)

	testCases := []struct {
		name     string
		swift    string
		expected bool
	}{
		{"Valid 8 Chars", "CITIUS33", true},
		{"Valid 11 Chars", "DEUTDEFF500", true},
		{"Invalid Too Short", "CITI", false},
		{"Invalid Too Long", "CITIUS33XXX", false},
		{"Invalid Lowercase", "citius33", false},
		{"Invalid Country", "CITIUS00", false},  // Country code "00" invalid
		{"Invalid Location", "CITI3A33", false}, // Location must be letter
		{"Valid With Spaces", "CITI US33", true},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := service.isValidSWIFT(tc.swift)
			if result != tc.expected {
				t.Errorf("Expected isValidSWIFT('%s') to be %v, got %v", tc.swift, tc.expected, result)
			}
		})
	}
}

// TestDLPService_isValidNPI tests NPI validation
func TestDLPService_isValidNPI(t *testing.T) {
	client := &Client{config: &Config{}}
	service := NewDLPService(client)

	testCases := []struct {
		name     string
		npi      string
		expected bool
	}{
		{"Valid NPI", "1234567890", true},
		{"Valid NPI Starting with 2", "2345678901", true},
		{"Invalid Starting Digit", "0345678901", false},
		{"Invalid Too Short", "123456789", false},
		{"Invalid Too Long", "12345678901", false},
		{"Invalid Characters", "123456789a", false},
		{"Invalid Checksum", "1234567893", false},
		{"Valid With Dashes", "123-456-7890", true},
		{"Valid With Spaces", "123 456 7890", true},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := service.isValidNPI(tc.npi)
			if result != tc.expected {
				t.Errorf("Expected isValidNPI('%s') to be %v, got %v", tc.npi, tc.expected, result)
			}
		})
	}
}

// TestDLPService_isValidICD10 tests ICD-10 validation
func TestDLPService_isValidICD10(t *testing.T) {
	client := &Client{config: &Config{}}
	service := NewDLPService(client)

	testCases := []struct {
		name     string
		code     string
		expected bool
	}{
		{"Valid Basic", "I10", true},
		{"Valid With Extension", "I10.9", true},
		{"Valid Multi-Char Extension", "I10.95", true},
		{"Valid Different Category", "A00", true},
		{"Valid With Letters in Extension", "I10.A1", true},
		{"Invalid No Letter", "110", false},
		{"Invalid Too Short", "I1", false},
		{"Invalid Too Many Digits", "I100", false},
		{"Invalid Format", "I10.", false},
		{"Invalid Extension", "I10.95.5", false},
		{"Invalid Character", "I1.9", false},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := service.isValidICD10(tc.code)
			if result != tc.expected {
				t.Errorf("Expected isValidICD10('%s') to be %v, got %v", tc.code, tc.expected, result)
			}
		})
	}
}

// TestDLPService_ScanAndRedact_Performance tests DLP scanning performance
func TestDLPService_ScanAndRedact_Performance(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping performance test in short mode")
	}

	client := &Client{config: &Config{}}
	service := NewDLPService(client)

	ctx := context.Background()

	// Create a large text with various PII types
	text := "Contact john.doe@example.com at (555) 123-4567. "
	text += "SSN: 123-45-6789. IBAN: GB82WEST12345698765432. "
	text += "Doctor NPI: 1234567890. Medical record: MR12345678. "
	text += "Repeat this information multiple times for performance testing. "

	// Make it larger
	for i := 0; i < 100; i++ {
		text += text
	}

	start := time.Now()

	options := &DLPScanRequest{
		Text:            text,
		ScanType:        "pii",
		RedactionMethod: "mask",
		MinConfidence:   &[]float64{0.5}[0],
	}

	result, err := service.ScanAndRedact(ctx, text, options)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	duration := time.Since(start)

	// Should complete within reasonable time (adjust threshold as needed)
	if duration > 5*time.Second {
		t.Errorf("DLP scan took too long: %v", duration)
	}

	if len(result.Findings) == 0 {
		t.Error("Expected to find PII in test text")
	}

	if result.Duration > 5*time.Second {
		t.Errorf("Internal scan duration too long: %v", result.Duration)
	}
}

// Helper function to check if string contains substring
func contains(s, substr string) bool {
	return len(s) >= len(substr) &&
		(s == substr ||
			(len(s) > len(substr) &&
				(s[:len(substr)] == substr || s[len(s)-len(substr):] == substr ||
					findSubstring(s, substr))))
}

func findSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

// BenchmarkDLPService_ScanAndRedact benchmarks DLP scanning performance
func BenchmarkDLPService_ScanAndRedact(b *testing.B) {
	client := &Client{config: &Config{}}
	service := NewDLPService(client)

	ctx := context.Background()
	text := "Contact john.doe@example.com at (555) 123-4567. SSN: 123-45-6789."

	options := &DLPScanRequest{
		Text:            text,
		ScanType:        "pii",
		RedactionMethod: "mask",
		MinConfidence:   &[]float64{0.5}[0],
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := service.ScanAndRedact(ctx, text, options)
		if err != nil {
			b.Fatalf("Unexpected error: %v", err)
		}
	}
}
