package auth

import (
	"regexp"
	"strings"
)

var bearerTokenPattern = regexp.MustCompile(`(?i)bearer\s+[a-z0-9\-._~+/]+=*`)
var apiKeyPattern = regexp.MustCompile(`(?i)(x-api-key[:=\s]+)([a-z0-9\-._~+/=]+)`)

func sanitizeAuditDetail(detail string) string {
	if strings.TrimSpace(detail) == "" {
		return ""
	}
	sanitized := bearerTokenPattern.ReplaceAllString(detail, "bearer [redacted]")
	sanitized = apiKeyPattern.ReplaceAllString(sanitized, "$1[redacted]")
	return sanitized
}

