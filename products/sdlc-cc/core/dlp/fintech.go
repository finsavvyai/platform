package dlp

// MaskFintechPII applies all fintech-specific redactions in one pass.
// Order matters: PAN first because IBAN can contain digit runs that
// the PAN regex is too greedy on; once PANs are masked, the remaining
// IBAN candidates are unambiguous. BIC and Israeli ID are independent.
//
// This is the function AML / KYC pipelines should call before
// shipping free text to an LLM. The base MaskPII handles email +
// phone (per pii_mask.go); MaskFintechPII layers on top so callers
// can opt in to the heavier identifier set without changing existing
// audit-log redaction behaviour.
func MaskFintechPII(s string) string {
	s = MaskPAN(s)
	s = MaskIBAN(s)
	s = MaskBIC(s)
	s = MaskILID(s)
	return s
}

// MaskAML is the canonical pre-LLM redactor for general privacy:
// universal PII (email, phone), fintech identifiers (PAN, IBAN,
// BIC, Israeli ID), government IDs (US SSN, UK NI), credentials
// + secrets, and IPs. The function name is historical (originally
// AML-only); kept for compatibility while the catalogue grew.
//
// Every add-on (web app, browser ext, Office add-ins, Cowork MCP)
// hits this through /v1/dlp/scrub and gets the same semantics.
//
// Order matters. Each masker is a regex sweep; once a string region
// is replaced with placeholder text, downstream maskers won't see
// the original digits. The chain runs from most-specific-shape to
// most-permissive so a string belongs to the masker that most
// precisely identifies it:
//
//   1. Credentials  — high-confidence prefixed tokens (sk-ant-*, AKIA*)
//   2. IPs          — dotted-quad / colon-hex shapes catch first so
//                     phone regex can't grab their digit runs as
//                     "phone-shaped"
//   3. Fintech      — PAN/IBAN/BIC/IL ID — check-digit-validated
//   4. Gov IDs      — SSN, UK NI
//   5. Universal    — email, phone — last so they only fire on
//                     residual generic shapes
func MaskAML(s string) string {
	s = MaskCredentials(s)    // API keys, JWTs, private keys
	s = MaskIP(s)             // IPv4 + IPv6 — before phone
	s = MaskFintechPII(s)     // PAN, IBAN, BIC, IL ID
	// Government IDs — hyphenated/letter-prefixed shapes first so
	// they catch their narrow patterns before the wider all-digit
	// regexes (BSN/SteuerID/NPI) sweep.
	s = MaskSSN(s)            // US SSN (hyphen-shaped)
	s = MaskUKNI(s)           // UK National Insurance (letter-prefixed)
	s = MaskSIN(s)            // Canadian SIN (hyphen/space)
	s = MaskTFN(s)            // Australian TFN (hyphen/space)
	s = MaskNPI(s)            // US NPI (10 digits)
	s = MaskSteuerID(s)       // German Steuer-ID (11 digits)
	s = MaskBSN(s)            // Dutch BSN (9 digits)
	s = MaskPII(s)            // email, phone (last — generic shapes)
	return s
}
