package security

import (
	"errors"
	"regexp"
	"strings"
	"unicode"
)

var (
	ErrInvalidEmail   = errors.New("invalid email address")
	ErrInvalidCountry = errors.New("invalid ISO 3166 country code")
)

var (
	htmlTagRE    = regexp.MustCompile(`<[^>]*>`)
	sqlPatternRE = regexp.MustCompile(
		`(?i)(--|;|'|"|union\s+select|drop\s+table|insert\s+into|delete\s+from|update\s+\w+\s+set)`)
	xssPatternRE = regexp.MustCompile(
		`(?i)(<script|javascript:|on\w+\s*=|<iframe|<object|<embed|<svg\s+on)`)
	emailRE = regexp.MustCompile(
		`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)
	countryCodeRE = regexp.MustCompile(`^[A-Z]{2,3}$`)
)

// SanitizeName strips HTML, SQL injection patterns, null bytes,
// and control characters from a name string.
func SanitizeName(name string) string {
	name = strings.ReplaceAll(name, "\x00", "")
	name = stripControlChars(name)
	name = htmlTagRE.ReplaceAllString(name, "")
	name = sqlPatternRE.ReplaceAllString(name, "")
	return strings.TrimSpace(name)
}

// SanitizeEmail validates and normalizes an email address.
func SanitizeEmail(email string) (string, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	email = strings.ReplaceAll(email, "\x00", "")
	if !emailRE.MatchString(email) {
		return "", ErrInvalidEmail
	}
	return email, nil
}

// SanitizeCountryCode validates an ISO 3166 alpha-2 or alpha-3 code.
func SanitizeCountryCode(code string) (string, error) {
	code = strings.TrimSpace(strings.ToUpper(code))
	if !countryCodeRE.MatchString(code) {
		return "", ErrInvalidCountry
	}
	return code, nil
}

// MaxLength truncates s to max characters.
func MaxLength(s string, max int) string {
	runes := []rune(s)
	if len(runes) > max {
		return string(runes[:max])
	}
	return s
}

// ContainsSQLInjection detects common SQL injection patterns.
func ContainsSQLInjection(s string) bool {
	return sqlPatternRE.MatchString(s)
}

// ContainsXSS detects script tags and event handlers.
func ContainsXSS(s string) bool {
	return xssPatternRE.MatchString(s)
}

func stripControlChars(s string) string {
	return strings.Map(func(r rune) rune {
		if unicode.IsControl(r) && r != '\n' && r != '\t' {
			return -1
		}
		return r
	}, s)
}
