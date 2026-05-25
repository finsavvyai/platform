// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Legal-vertical DLP preset: regex patterns that detect markers of
// attorney-client privilege, work-product doctrine, discovery
// protective orders, NDAs, and litigation identifiers. The preset
// is opt-in per tenant via the `tenant_dlp_policy.legal_preset`
// boolean (migration lands separately).
//
// IMPORTANT — this preset is a HEURISTIC. Detection of the phrase
// "Privileged & Confidential" does NOT establish privilege under
// ABA Model Rule 1.6 or any state analogue; absence of the phrase
// does NOT waive it. The preset reduces obvious LLM-paste mistakes
// (an associate dropping a memo header into a public chat) but is
// not a substitute for outside-counsel review or an information
// governance program. Treat it as defense-in-depth, not as a
// privilege determination engine.
//
// Default action is `mask`, configurable per tenant via the action
// enum already in `tenant_dlp_policy` (allow | mask | redact |
// block | tokenize). Firms should NOT default to `block` because a
// false positive can wedge legitimate intake / matter-management
// flows; mask preserves the audit trail without dropping content.
//
// Citations are inline at each pattern. Authoritative sources:
//
//   - ABA Model Rules of Professional Conduct:
//     https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/
//   - ABA Formal Opinion 512 (Generative AI Tools, 2024):
//     https://www.americanbar.org/groups/professional_responsibility/aba-formal-opinion-512/
//   - Federal Rules of Civil Procedure (Rule 26 incl. (b)(3)
//     work-product doctrine):
//     https://www.law.cornell.edu/rules/frcp/rule_26
//
// State-bar formal opinions on attorney use of generative AI cited
// per-pattern below: CA Bar Standing Committee on Professional
// Responsibility and Conduct (2023), Florida Bar Ethics Opinion
// 24-1 (2024), NY State Bar Task Force on AI (2024), Illinois State
// Bar Association Opinion 24-01 (2024).
package middleware

import "regexp"

// LegalPatterns returns the full legal-vertical preset as a slice
// the existing detector can merge in via DetectWith / ApplyWith.
// Patterns are compiled once at package init and reused per request.
//
// Pattern ordering matters: more specific patterns precede more
// general ones because the underlying rewrite() is first-match-wins
// per span. Bar-number patterns, for example, come before the
// generic docket-number pattern so a CA bar number doesn't get
// classified as a docket number.
func LegalPatterns() []pattern {
	out := make([]pattern, 0,
		len(legalPrivilegePatterns)+
			len(legalWorkProductPatterns)+
			len(legalDiscoveryPatterns)+
			len(legalIdentifierPatterns)+
			len(legalNDAPatterns))
	out = append(out, legalPrivilegePatterns...)
	out = append(out, legalWorkProductPatterns...)
	out = append(out, legalDiscoveryPatterns...)
	out = append(out, legalIdentifierPatterns...)
	out = append(out, legalNDAPatterns...)
	return out
}

// LegalPatternNames returns the stable detection-class names this
// preset can emit, in the order LegalPatterns() returns them. The
// admin UI uses this to render the per-tenant policy editor
// (checkbox per class, action per class). Names are lowercase
// snake_case to match the existing built-in pack convention; the
// redact placeholder uppercases them (so `attorney_client_privilege`
// renders as `<ATTORNEY_CLIENT_PRIVILEGE>`).
func LegalPatternNames() []string {
	names := make([]string, 0, len(LegalPatterns()))
	for _, p := range LegalPatterns() {
		names = append(names, p.name)
	}
	return names
}

// DetectLegal runs the built-in pattern pack PLUS the legal preset.
// Convenience wrapper for callers that want the preset without
// hand-passing the slice; equivalent to
// d.DetectWith(input, LegalPatterns()).
func (d *Detector) DetectLegal(input string) []Match {
	return d.DetectWith(input, LegalPatterns())
}

// ApplyLegal runs Apply with the legal preset merged in. Same
// semantics as ApplyWith — block returns ErrBlocked, mask preserves
// length, redact substitutes <UPPER_TYPE>. Tokenize is intentionally
// supported because law firms often want the LLM to see
// <CASE_CAPTION_001> instead of "Smith v. Jones" and to see the
// original restored in the response.
func (d *Detector) ApplyLegal(input string, action Action) (string, []Match, error) {
	return d.ApplyWith(input, action, LegalPatterns())
}

// mustCompile is a local alias for regexp.MustCompile so the
// per-category files read cleanly. Patterns are constants of the
// process — a compile failure here is a programmer error, not a
// runtime condition, so panicking at init is correct.
func mustCompile(expr string) *regexp.Regexp { return regexp.MustCompile(expr) }
