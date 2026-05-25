package security

import "github.com/finsavvyai/sdlc-core/dlp"

// Re-exports of the fintech DLP primitives that now live in
// github.com/finsavvyai/sdlc-core/dlp. Existing aegis call sites
// (handler_v1_messages_*, handler_ai_prepare, gdpr/erasure) keep
// using `security.MaskAML`, `security.MaskPII`, etc. unchanged —
// the source of truth has just moved one repo over.
//
// Aegis-specific security helpers (SanitizeName, MaxLength, audit
// logger, evidence collector, ip_policy) stay in this package.

var (
	MaskEmail      = dlp.MaskEmail
	MaskPhone      = dlp.MaskPhone
	MaskPII        = dlp.MaskPII
	MaskPAN        = dlp.MaskPAN
	MaskIBAN       = dlp.MaskIBAN
	MaskBIC        = dlp.MaskBIC
	MaskILID       = dlp.MaskILID
	MaskFintechPII = dlp.MaskFintechPII
	MaskAML        = dlp.MaskAML
)
