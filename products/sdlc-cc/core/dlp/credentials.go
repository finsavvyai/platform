package dlp

import "regexp"

// piiCredentialREs is the catalogue of API-key / token shapes we
// scrub by default. Each entry is (label, regex). Order matters
// only for documentation; replacement is one-pass per regex.
//
// Scope: high-confidence prefix-and-length patterns where a false
// positive is rare. We deliberately don't try to catch arbitrary
// "20+ random chars" — too many false positives in code/comments.
//
// Add new patterns here as new providers introduce keys; the per-
// provider validators tend to be a known prefix + a known length.
var piiCredentialREs = []struct {
	Label string
	RE    *regexp.Regexp
}{
	{"anthropic", regexp.MustCompile(`\bsk-ant-[a-zA-Z0-9_-]{32,}\b`)},
	{"openai_user", regexp.MustCompile(`\bsk-(?:proj-)?[a-zA-Z0-9_-]{20,}\b`)},
	{"github_pat", regexp.MustCompile(`\bghp_[A-Za-z0-9]{36,}\b`)},
	{"github_pat_fine", regexp.MustCompile(`\bgithub_pat_[A-Za-z0-9_]{60,}\b`)},
	{"aws_access_key", regexp.MustCompile(`\bAKIA[0-9A-Z]{16}\b`)},
	{"aws_temp_key", regexp.MustCompile(`\bASIA[0-9A-Z]{16}\b`)},
	{"slack_xoxb", regexp.MustCompile(`\bxox[baprs]-[A-Za-z0-9-]{10,}\b`)},
	{"stripe_live", regexp.MustCompile(`\bsk_live_[A-Za-z0-9]{24,}\b`)},
	{"stripe_test", regexp.MustCompile(`\bsk_test_[A-Za-z0-9]{24,}\b`)},
	{"google_api", regexp.MustCompile(`\bAIza[0-9A-Za-z_-]{35}\b`)},
	{"jwt", regexp.MustCompile(`\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b`)},
	{"private_key_block", regexp.MustCompile(`-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]+?-----END [A-Z ]*PRIVATE KEY-----`)},
	// Added in v0.2 — providers customers actually use day-to-day.
	{"twilio", regexp.MustCompile(`\bAC[a-f0-9]{32}\b`)},
	{"twilio_auth", regexp.MustCompile(`\bSK[a-f0-9]{32}\b`)},
	{"sendgrid", regexp.MustCompile(`\bSG\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{40,}\b`)},
	{"mailgun", regexp.MustCompile(`\bkey-[a-f0-9]{32}\b`)},
	{"discord_webhook", regexp.MustCompile(`https://discord(?:app)?\.com/api/webhooks/\d+/[A-Za-z0-9_-]+`)},
	{"slack_webhook", regexp.MustCompile(`https://hooks\.slack\.com/services/T[A-Za-z0-9]+/B[A-Za-z0-9]+/[A-Za-z0-9]+`)},
	{"openai_org", regexp.MustCompile(`\borg-[A-Za-z0-9]{20,}\b`)},
	{"cloudflare_api", regexp.MustCompile(`\b(?:cf-|cfat_)[A-Za-z0-9_-]{32,}\b`)},
	{"supabase", regexp.MustCompile(`\bsbp_[a-z0-9]{40,}\b`)},
	{"vercel", regexp.MustCompile(`\bvercel_(?:blob|edge)_[A-Za-z0-9_-]{32,}\b`)},
	{"notion", regexp.MustCompile(`\b(?:secret|ntn)_[A-Za-z0-9]{40,}\b`)},
	{"openai_session", regexp.MustCompile(`\bsess-[A-Za-z0-9]{40,}\b`)},
	{"linear", regexp.MustCompile(`\blin_(?:api|oauth)_[A-Za-z0-9]{40,}\b`)},
	{"mongodb_atlas", regexp.MustCompile(`mongodb\+srv://[^:]+:[^@]+@[a-z0-9.-]+\.mongodb\.net`)},
	{"postgres_url", regexp.MustCompile(`postgres(?:ql)?://[^:]+:[^@]+@[a-zA-Z0-9.-]+`)},
}

// MaskCredentials replaces every recognised credential pattern with
// "[CRED:<label>]" so audit readers know *what kind* of secret leaked
// without seeing the secret. Labelled redaction beats a generic
// "[REDACTED]" for forensics — a SAR investigator wants to know
// the user dropped an AWS key vs. a GitHub PAT.
func MaskCredentials(s string) string {
	for _, p := range piiCredentialREs {
		s = p.RE.ReplaceAllString(s, "[CRED:"+p.Label+"]")
	}
	return s
}

// countCredentials totals how many credential patterns matched in
// the original string. Used by MaskAMLWithCounts to fill the
// Counts.Credentials field without re-scanning the masked output.
func countCredentials(s string) int {
	n := 0
	for _, p := range piiCredentialREs {
		n += len(p.RE.FindAllString(s, -1))
	}
	return n
}
