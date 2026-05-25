package analysis

import (
	"regexp"
)

// sensitivePattern defines a regex pattern for detecting secrets.
type sensitivePattern struct {
	name       string
	regex      *regexp.Regexp
	severity   Severity
	category   Category
	confidence float64
}

// NewDLPScanner creates a scanner with built-in secret detection patterns.
func NewDLPScanner() *DLPScanner {
	scanner := &DLPScanner{
		patterns: []sensitivePattern{
			// AWS credentials
			{
				name:       "AWS Access Key",
				regex:      regexp.MustCompile(`AKIA[0-9A-Z]{16}`),
				severity:   SeverityCritical,
				category:   CategorySecrets,
				confidence: 0.99,
			},
			{
				name:       "AWS Secret Key",
				regex:      regexp.MustCompile(`aws_secret_access_key\s*=\s*[A-Za-z0-9/+=]{40}`),
				severity:   SeverityCritical,
				category:   CategorySecrets,
				confidence: 0.98,
			},
			// GitHub tokens
			{
				name:       "GitHub Personal Access Token",
				regex:      regexp.MustCompile(`ghp_[A-Za-z0-9_]{36,255}`),
				severity:   SeverityCritical,
				category:   CategorySecrets,
				confidence: 0.99,
			},
			{
				name:       "GitHub OAuth Token",
				regex:      regexp.MustCompile(`gho_[A-Za-z0-9_]{36,255}`),
				severity:   SeverityCritical,
				category:   CategorySecrets,
				confidence: 0.99,
			},
			{
				name:       "GitHub App Token",
				regex:      regexp.MustCompile(`ghs_[A-Za-z0-9_]{36,255}`),
				severity:   SeverityCritical,
				category:   CategorySecrets,
				confidence: 0.99,
			},
			// GitLab tokens
			{
				name:       "GitLab Personal Access Token",
				regex:      regexp.MustCompile(`glpat-[A-Za-z0-9_\-]{20,}`),
				severity:   SeverityCritical,
				category:   CategorySecrets,
				confidence: 0.99,
			},
			// Slack tokens
			{
				name:       "Slack Bot Token",
				regex:      regexp.MustCompile(`xoxb-[0-9]{10,13}-[0-9]{10,13}-[A-Za-z0-9]{24,34}`),
				severity:   SeverityHigh,
				category:   CategorySecrets,
				confidence: 0.95,
			},
			{
				name:       "Slack User Token",
				regex:      regexp.MustCompile(`xoxp-[0-9]{10,13}-[0-9]{10,13}-[0-9]{10,13}-[A-Za-z0-9]{32}`),
				severity:   SeverityHigh,
				category:   CategorySecrets,
				confidence: 0.95,
			},
			// SSH private keys
			{
				name:       "SSH Private Key",
				regex:      regexp.MustCompile(`-----BEGIN (?:RSA|DSA|EC|OPENSSH) PRIVATE KEY`),
				severity:   SeverityCritical,
				category:   CategorySecrets,
				confidence: 0.99,
			},
			// Generic API keys
			{
				name:       "Generic API Key",
				regex:      regexp.MustCompile(`(?i)(api[_-]?key|apikey)\s*[=:]\s*[A-Za-z0-9_\-]{20,}`),
				severity:   SeverityHigh,
				category:   CategorySecrets,
				confidence: 0.75,
			},
			// Database URLs with credentials
			{
				name:       "Database URL with Credentials",
				regex:      regexp.MustCompile(`(?:postgres|mysql|mongodb)://[A-Za-z0-9_\-]+:[A-Za-z0-9_\-!@#$%^&*()]+@`),
				severity:   SeverityCritical,
				category:   CategorySecrets,
				confidence: 0.95,
			},
			// JWT tokens
			{
				name:       "JWT Token",
				regex:      regexp.MustCompile(`eyJ[A-Za-z0-9_\-]+\.eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+`),
				severity:   SeverityHigh,
				category:   CategorySecrets,
				confidence: 0.85,
			},
			// Basic auth in URLs
			{
				name:       "Basic Auth Credentials",
				regex:      regexp.MustCompile(`https?://[A-Za-z0-9_\-]+:[A-Za-z0-9_\-!@#$%^&*()]+@`),
				severity:   SeverityHigh,
				category:   CategorySecrets,
				confidence: 0.9,
			},
			// Anthropic API keys
			{
				name:       "Anthropic API Key",
				regex:      regexp.MustCompile(`sk-ant-(?:api[0-9]{2}-)?[A-Za-z0-9_\-]{40,}`),
				severity:   SeverityCritical,
				category:   CategorySecrets,
				confidence: 0.99,
			},
			// OpenAI API keys — modern (sk-proj-, sk-svcacct-) and legacy (sk-T3Blbk...).
			// RE2 has no negative lookahead, so we use explicit prefixes to avoid
			// colliding with sk-ant- (Anthropic) and sk_live_/sk_test_ (Stripe).
			{
				name:       "OpenAI API Key",
				regex:      regexp.MustCompile(`sk-(?:proj-|svcacct-|T3Blbk)[A-Za-z0-9_\-]{20,}`),
				severity:   SeverityCritical,
				category:   CategorySecrets,
				confidence: 0.95,
			},
			// Stripe live + test keys
			{
				name:       "Stripe Secret Key",
				regex:      regexp.MustCompile(`(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{20,}`),
				severity:   SeverityCritical,
				category:   CategorySecrets,
				confidence: 0.99,
			},
			// Cloudflare API token (40-char hex-friendly format)
			{
				name:       "Cloudflare API Token",
				regex:      regexp.MustCompile(`(?i)cloudflare[_-]?(?:api[_-]?)?token\s*[=:]\s*[A-Za-z0-9_\-]{40}`),
				severity:   SeverityCritical,
				category:   CategorySecrets,
				confidence: 0.95,
			},
			// Google API key (AIza prefix, 39 chars)
			{
				name:       "Google API Key",
				regex:      regexp.MustCompile(`AIza[0-9A-Za-z_\-]{35}`),
				severity:   SeverityCritical,
				category:   CategorySecrets,
				confidence: 0.99,
			},
			// npm registry tokens (legacy + automation/granular)
			{
				name:       "npm Token",
				regex:      regexp.MustCompile(`npm_[A-Za-z0-9]{36}`),
				severity:   SeverityCritical,
				category:   CategorySecrets,
				confidence: 0.99,
			},
			// Generic high-entropy long secret in *_KEY|_TOKEN|_SECRET assignments.
			// Lower confidence than typed patterns to reduce false positives.
			{
				name:       "Generic Secret Assignment",
				regex:      regexp.MustCompile(`(?i)(?:secret|token|password|passwd|key)\s*[=:]\s*['"]?[A-Za-z0-9_\-+/=]{32,}['"]?`),
				severity:   SeverityMedium,
				category:   CategorySecrets,
				confidence: 0.6,
			},
		},
	}
	return scanner
}
