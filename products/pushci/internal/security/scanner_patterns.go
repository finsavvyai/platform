package security

import "regexp"

// SecretPatterns detects hardcoded secrets in source code and pipeline
// configs. Each pattern is annotated with what it matches.
//
// When adding a pattern, add a fixture case in
// internal/security/pipeline_scanner_extended_test.go.
var SecretPatterns = []*regexp.Regexp{
	// Generic api_key / api-key assignments with a >=16 char value.
	regexp.MustCompile(`(?i)api[_-]?key\s*[:=]\s*["'][A-Za-z0-9]{16,}`),

	// GitHub PATs (ghp_), OAuth (gho_), server (ghs_), refresh (ghr_), user (ghu_).
	regexp.MustCompile(`(?:ghp|gho|ghs|ghr|ghu)_[A-Za-z0-9]{10,}`),
	regexp.MustCompile(`github_pat_[A-Za-z0-9_]{10,}`),

	// AWS access key (AKIA + 16 A-Z0-9) and temporary access key (ASIA).
	regexp.MustCompile(`(?:AKIA|ASIA)[0-9A-Z]{16}`),

	// AWS secret access keys — anchored on the label.
	regexp.MustCompile(`(?i)aws[_-]?secret[_-]?access[_-]?key\s*[:=]\s*["']?[A-Za-z0-9/+=]{20,}`),

	// GitLab personal access tokens.
	regexp.MustCompile(`glpat-[A-Za-z0-9_\-]{20,}`),

	// Slack webhook URLs + bot/user/app/refresh tokens.
	regexp.MustCompile(`https://hooks\.slack\.com/services/T[A-Z0-9]+/B[A-Z0-9]+/[A-Za-z0-9]+`),
	regexp.MustCompile(`xox[bpras]-[A-Za-z0-9\-]+`),

	// Stripe live + test secret keys.
	regexp.MustCompile(`sk_(?:live|test)_[A-Za-z0-9]{10,}`),

	// OpenAI / Anthropic style keys (sk- prefix + >=32 chars).
	regexp.MustCompile(`sk-[A-Za-z0-9_\-]{32,}`),

	// Private keys of any PEM flavour.
	regexp.MustCompile(`-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----`),
}
