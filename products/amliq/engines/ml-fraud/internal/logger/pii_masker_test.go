package logger

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestMaskCreditCard(t *testing.T) {
	m := NewPIIMasker("test-salt")

	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{"visa", "4111111111111111", "****-****-****-1111"},
		{"amex with dashes", "3714-4963-5398-431", "****-****-****-8431"},
		{"short", "1234", "1234"},
		{"empty", "", ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expected, m.MaskCreditCard(tt.input))
		})
	}
}

func TestMaskSSN(t *testing.T) {
	m := NewPIIMasker("test-salt")

	assert.Equal(t, "***-**-6789", m.MaskSSN("123-45-6789"))
	assert.Equal(t, "short", m.MaskSSN("short"))
	assert.Equal(t, "", m.MaskSSN(""))
}

func TestMaskEmail(t *testing.T) {
	m := NewPIIMasker("test-salt")

	assert.Equal(t, "u***@example.com", m.MaskEmail("user@example.com"))
	assert.Equal(t, "a***@test.io", m.MaskEmail("admin@test.io"))
	assert.Equal(t, "noemail", m.MaskEmail("noemail"))
	assert.Equal(t, "", m.MaskEmail(""))
}

func TestMaskAPIKey(t *testing.T) {
	m := NewPIIMasker("test-salt")

	assert.Equal(t, "qb_a***...", m.MaskAPIKey("qb_abc123456"))
	assert.Equal(t, "sk_x***...", m.MaskAPIKey("sk_xyzdef789"))
	assert.Equal(t, "****", m.MaskAPIKey("abc"))
}

func TestMaskJWT(t *testing.T) {
	m := NewPIIMasker("test-salt")

	token := "eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyIjoiMSJ9.sig"
	assert.Equal(t, "Bearer [REDACTED]", m.MaskJWT(token))
}

func TestHashIP(t *testing.T) {
	m := NewPIIMasker("test-salt")

	hash1 := m.HashIP("192.168.1.1")
	hash2 := m.HashIP("192.168.1.1")
	hash3 := m.HashIP("10.0.0.1")

	assert.Equal(t, hash1, hash2, "same IP should produce same hash")
	assert.NotEqual(t, hash1, hash3, "different IPs should produce different hashes")
	assert.Len(t, hash1, 16)
}

func TestScanAndMask_CreditCard(t *testing.T) {
	m := NewPIIMasker("test-salt")

	input := "Payment with card 4111111111111111 was processed"
	result := m.ScanAndMask(input)
	assert.Contains(t, result, "****-****-****-1111")
	assert.NotContains(t, result, "4111111111111111")
}

func TestScanAndMask_SSN(t *testing.T) {
	m := NewPIIMasker("test-salt")

	input := "User SSN is 123-45-6789 on file"
	result := m.ScanAndMask(input)
	assert.Contains(t, result, "***-**-6789")
	assert.NotContains(t, result, "123-45-6789")
}

func TestScanAndMask_Email(t *testing.T) {
	m := NewPIIMasker("test-salt")

	input := "Sent to user@example.com successfully"
	result := m.ScanAndMask(input)
	assert.Contains(t, result, "u***@example.com")
	assert.NotContains(t, result, "user@example.com")
}

func TestScanAndMask_BearerToken(t *testing.T) {
	m := NewPIIMasker("test-salt")

	input := "Auth header: Bearer eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyIjoiMSJ9.dGVzdA"
	result := m.ScanAndMask(input)
	assert.Contains(t, result, "Bearer [REDACTED]")
	assert.NotContains(t, result, "eyJhbGciOiJIUzI1NiJ9")
}

func TestScanAndMask_APIKey(t *testing.T) {
	m := NewPIIMasker("test-salt")

	input := "Using API key qb_abc123xyz456 for auth"
	result := m.ScanAndMask(input)
	assert.Contains(t, result, "qb_a***...")
	assert.NotContains(t, result, "qb_abc123xyz456")
}

func TestScanAndMask_MixedContent(t *testing.T) {
	m := NewPIIMasker("test-salt")

	input := "User admin@example.com with card 4111111111111111 and SSN 123-45-6789"
	result := m.ScanAndMask(input)
	assert.NotContains(t, result, "admin@example.com")
	assert.NotContains(t, result, "4111111111111111")
	assert.NotContains(t, result, "123-45-6789")
}

func TestScanAndMask_NoMatch(t *testing.T) {
	m := NewPIIMasker("test-salt")

	input := "This is a normal log message without PII"
	result := m.ScanAndMask(input)
	assert.Equal(t, input, result)
}

func TestScanAndMask_EmptyString(t *testing.T) {
	m := NewPIIMasker("test-salt")
	assert.Equal(t, "", m.ScanAndMask(""))
}
