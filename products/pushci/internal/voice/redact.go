package voice

import "regexp"

// Redact replaces high-risk substrings (secrets, account IDs, ARNs,
// JWTs, internal hostnames, IPs) with safe placeholders so the
// spoken / shared text doesn't leak production identifiers.
// Applied to every utterance — both pre-canned phrases (cheap, no
// effect) and AI-generated commentary (where prompt injection or
// model leakage are real risks).
func Redact(s string) string {
	for _, r := range redactRules {
		s = r.re.ReplaceAllString(s, r.replacement)
	}
	return s
}

type redactRule struct {
	re          *regexp.Regexp
	replacement string
}

// Order matters: longer/more-specific patterns first so a JWT
// isn't partially matched as a generic token.
var redactRules = []redactRule{
	// JWT (3 base64url segments separated by dots)
	{regexp.MustCompile(`eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+`), "[redacted-jwt]"},
	// AWS ARN — covers most service forms
	{regexp.MustCompile(`arn:aws[a-z-]*:[a-zA-Z0-9-]*:[a-z0-9-]*:\d{12}:[A-Za-z0-9._/:-]+`), "[redacted-arn]"},
	// Bearer / Authorization header tokens
	{regexp.MustCompile(`(?i)bearer\s+[A-Za-z0-9._~+/-]{16,}=*`), "[redacted-bearer]"},
	// Stripe / GitHub / Google / AWS access-key prefixes
	{regexp.MustCompile(`\b(?:sk|pk|ghp|ghu|gho|ghs|github_pat)_[A-Za-z0-9_]{16,}\b`), "[redacted-key]"},
	{regexp.MustCompile(`\bAKIA[0-9A-Z]{16}\b`), "[redacted-aws-access-key]"},
	{regexp.MustCompile(`\bAIza[0-9A-Za-z_-]{35}\b`), "[redacted-google-key]"},
	// Long hex tokens (>=40 chars) often == access keys / digests
	{regexp.MustCompile(`\b[a-f0-9]{40,}\b`), "[redacted-hex]"},
	// 12-digit AWS account ids when adjacent to AWS context words
	{regexp.MustCompile(`(?i)(account|aws|ecr|arn)[^\d]{0,8}\d{12}\b`), "$1 [redacted-account-id]"},
	// IPv4 (skip 0.0.0.0 / 127.* loopback to avoid false positives)
	{regexp.MustCompile(`\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b`), "[redacted-ip]"},
	// Internal hostnames (.internal / .corp / .local TLDs are RFC-reserved)
	{regexp.MustCompile(`\b[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.(?:internal|corp|local)\b`), "[redacted-host]"},
	// Email
	{regexp.MustCompile(`\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b`), "[redacted-email]"},
}
