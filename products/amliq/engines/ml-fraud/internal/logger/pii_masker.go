package logger

import (
	"crypto/sha256"
	"encoding/hex"
	"regexp"
	"strings"
)

// PIIMasker provides methods to mask personally identifiable information
// in log messages and structured fields, following GDPR and OWASP A09:2021.
type PIIMasker struct {
	hashSalt string
}

// NewPIIMasker creates a PIIMasker. The salt is used when hashing values
// like IP addresses.
func NewPIIMasker(salt string) *PIIMasker {
	return &PIIMasker{hashSalt: salt}
}

// Compiled patterns for PII detection.
var (
	// Credit card: 13-19 digit sequences, optionally separated by dashes/spaces
	creditCardRe = regexp.MustCompile(`\b(?:\d[ -]*?){13,19}\b`)
	// SSN: 3-2-4 pattern
	ssnRe = regexp.MustCompile(`\b\d{3}-\d{2}-\d{4}\b`)
	// Email: simple pattern
	emailRe = regexp.MustCompile(`\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b`)
	// JWT / Bearer token in a string
	bearerRe = regexp.MustCompile(`(?i)Bearer\s+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+`)
	// API key patterns (e.g., qb_xxxx, sk_xxxx, pk_xxxx)
	apiKeyRe = regexp.MustCompile(`\b(?:qb|sk|pk|api)_[A-Za-z0-9]{4,}\b`)
)

// MaskCreditCard masks a credit card number showing only the last 4 digits.
func (m *PIIMasker) MaskCreditCard(cc string) string {
	digits := extractDigits(cc)
	if len(digits) < 13 {
		return cc
	}
	last4 := digits[len(digits)-4:]
	return "****-****-****-" + last4
}

// MaskSSN masks a Social Security Number showing only the last 4 digits.
func (m *PIIMasker) MaskSSN(ssn string) string {
	digits := extractDigits(ssn)
	if len(digits) != 9 {
		return ssn
	}
	return "***-**-" + digits[5:]
}

// MaskEmail masks an email address showing only the first character and domain.
func (m *PIIMasker) MaskEmail(email string) string {
	parts := strings.SplitN(email, "@", 2)
	if len(parts) != 2 || len(parts[0]) == 0 {
		return email
	}
	return string(parts[0][0]) + "***@" + parts[1]
}

// MaskAPIKey masks an API key showing only the prefix and first 4 characters.
func (m *PIIMasker) MaskAPIKey(key string) string {
	if len(key) <= 4 {
		return "****"
	}
	return key[:4] + "***..."
}

// MaskJWT replaces a JWT token string with a redacted placeholder.
func (m *PIIMasker) MaskJWT(token string) string {
	return "Bearer [REDACTED]"
}

// HashIP hashes an IP address using SHA-256 with the configured salt.
func (m *PIIMasker) HashIP(ip string) string {
	h := sha256.New()
	h.Write([]byte(m.hashSalt + ip))
	return hex.EncodeToString(h.Sum(nil))[:16]
}

// ScanAndMask scans a free-text log message and replaces any detected PII
// patterns with masked versions.
func (m *PIIMasker) ScanAndMask(text string) string {
	// Order matters: mask Bearer tokens before generic patterns.
	text = bearerRe.ReplaceAllString(text, "Bearer [REDACTED]")
	text = apiKeyRe.ReplaceAllStringFunc(text, m.MaskAPIKey)
	text = creditCardRe.ReplaceAllStringFunc(text, m.MaskCreditCard)
	text = ssnRe.ReplaceAllStringFunc(text, m.MaskSSN)
	text = emailRe.ReplaceAllStringFunc(text, m.MaskEmail)
	return text
}

// extractDigits returns only the digit characters from a string.
func extractDigits(s string) string {
	var b strings.Builder
	for _, r := range s {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return b.String()
}
