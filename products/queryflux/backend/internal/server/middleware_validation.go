package server

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/sirupsen/logrus"
)

// validateInput validates and sanitizes input strings
func (s *Server) validateInput(input string, maxLength int) (string, error) {
	if input == "" {
		return input, nil
	}
	if len(input) > maxLength {
		return "", fmt.Errorf("input exceeds maximum length of %d characters", maxLength)
	}
	if strings.Contains(input, "\x00") {
		return "", fmt.Errorf("input contains null bytes")
	}
	charCount := utf8.RuneCountInString(input)
	if charCount > maxLength {
		return "", fmt.Errorf("input exceeds maximum character count of %d", maxLength)
	}

	sanitized := strings.ReplaceAll(input, "\x00", "")
	sanitized = strings.ReplaceAll(sanitized, "\r", "")
	sanitized = strings.ReplaceAll(sanitized, "\n", "")
	return sanitized, nil
}

// validateSQLQuery validates SQL queries for dangerous patterns
func (s *Server) validateSQLQuery(query string) error {
	if query == "" {
		return fmt.Errorf("query cannot be empty")
	}
	if len(query) > 100000 {
		return fmt.Errorf("query too long")
	}

	dangerousPatterns := []string{
		`(?i)(drop\s+database|truncate\s+table|delete\s+from\s+\w+\s+where\s+1\s*=\s*1)`,
		`(?i)(grant|revoke)\s+`,
		`(?i)(create|alter)\s+(user|role|login)`,
		`(?i)(exec\s*\(|execute\s*\(|sp_executesql)`,
		`(?i)(xp_cmdshell|sp_oacreate)`,
		`(?i)(bulk\s+insert|openrowset|opendatasource)`,
		`(?i)(load_file|into\s+outfile|dumpfile)`,
	}
	for _, pattern := range dangerousPatterns {
		if matched, _ := regexp.MatchString(pattern, query); matched {
			logrus.WithField("query", query).Warn("Dangerous SQL pattern detected")
			return fmt.Errorf("query contains potentially dangerous operations")
		}
	}
	return nil
}

// validateEmail validates email format
func (s *Server) validateEmail(email string) error {
	emailRegex := regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)
	if !emailRegex.MatchString(email) {
		return fmt.Errorf("invalid email format")
	}
	if s.containsSuspiciousPatterns(email) {
		return fmt.Errorf("email contains suspicious patterns")
	}
	return nil
}

// sanitizeFileName sanitizes file names to prevent path traversal
func (s *Server) sanitizeFileName(filename string) string {
	filename = strings.ReplaceAll(filename, "..", "")
	filename = strings.ReplaceAll(filename, "/", "_")
	filename = strings.ReplaceAll(filename, "\\", "_")
	dangerousChars := []string{"<", ">", ":", "\"", "|", "?", "*"}
	for _, char := range dangerousChars {
		filename = strings.ReplaceAll(filename, char, "_")
	}
	if len(filename) > 255 {
		filename = filename[:255]
	}
	return filename
}

// isValidJSON checks if a string contains valid JSON
func (s *Server) isValidJSON(str string) bool {
	var js interface{}
	return json.Unmarshal([]byte(str), &js) == nil
}

// checkPasswordStrength validates password strength
func (s *Server) checkPasswordStrength(password string) error {
	if len(password) < 8 {
		return fmt.Errorf("password must be at least 8 characters long")
	}
	if len(password) > 128 {
		return fmt.Errorf("password must be less than 128 characters long")
	}

	var hasUpper, hasLower, hasNumber, hasSpecial bool
	for _, char := range password {
		switch {
		case unicode.IsUpper(char):
			hasUpper = true
		case unicode.IsLower(char):
			hasLower = true
		case unicode.IsNumber(char):
			hasNumber = true
		case unicode.IsPunct(char) || unicode.IsSymbol(char):
			hasSpecial = true
		}
	}
	if !hasUpper {
		return fmt.Errorf("password must contain at least one uppercase letter")
	}
	if !hasLower {
		return fmt.Errorf("password must contain at least one lowercase letter")
	}
	if !hasNumber {
		return fmt.Errorf("password must contain at least one number")
	}
	if !hasSpecial {
		return fmt.Errorf("password must contain at least one special character")
	}
	return nil
}
