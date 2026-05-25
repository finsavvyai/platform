// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Finance-vertical DLP preset: IBAN, BIC/SWIFT, Israeli national
// ID, US ABA routing number. PAN (credit card) is intentionally
// NOT duplicated here — it is already covered by the built-in pack
// in dlp.go with Luhn validation.
//
// The preset is opt-in per tenant via `tenant_dlp_policy.finance_preset`
// (migration 033). Default action follows the tenant's per-tenant
// DLP action enum (allow | mask | redact | block | tokenize).
//
// IMPORTANT — this preset is a HEURISTIC. Detection of a string
// that looks like an IBAN does NOT establish that the value is a
// real bank account; absence of detection does NOT mean no
// financial PII is present. Treat as defense-in-depth, not as a
// compliance-evidence engine. AMLIQ ships these patterns in
// production against AML traffic; this is the same pattern set
// ported back into the gateway for cross-product consistency.
//
// Citations:
//
//   - IBAN format: ISO 13616-1:2020, ECBS TR 201 (registry):
//     https://www.swift.com/standards/data-standards/iban-international-bank-account-number
//   - BIC format: ISO 9362:2014:
//     https://www.swift.com/standards/data-standards/bic-business-identifier-code
//   - Israeli ID format: Israel Ministry of Interior, 9 digits
//     with a Luhn-like checksum (verification implemented
//     downstream via the same luhnValid helper as credit_card).
//   - US ABA routing number: ABA "Routing Number Policy":
//     https://www.aba.com/about-us/routing-number

package middleware

// FinancePatterns returns the full finance-vertical preset as a
// slice the existing detector can merge in via DetectWith /
// ApplyWith. Patterns are compiled at package init.
//
// Ordering matters because rewrite() is first-match-wins per span:
// the more specific patterns (Israeli-ID, IBAN with country prefix)
// come before generic 9-digit ones.
func FinancePatterns() []pattern {
	return financePatterns
}

// FinancePatternNames returns the stable detection-class names this
// preset emits, in the order FinancePatterns() returns them.
func FinancePatternNames() []string {
	names := make([]string, 0, len(financePatterns))
	for _, p := range financePatterns {
		names = append(names, p.name)
	}
	return names
}

// DetectFinance runs the built-in pattern pack PLUS the finance
// preset. Convenience wrapper.
func (d *Detector) DetectFinance(input string) []Match {
	return d.DetectWith(input, financePatterns)
}

// ApplyFinance runs Apply with the finance preset merged in. Same
// semantics as ApplyWith. Tokenize is supported because AML
// analysts often want the LLM to see <IBAN_001> in a case summary
// and to see the original restored in the response.
func (d *Detector) ApplyFinance(input string, action Action) (string, []Match, error) {
	return d.ApplyWith(input, action, financePatterns)
}

// financePatterns lists the regexes that fire under the finance
// preset. Each entry calls out its format source.
var financePatterns = []pattern{
	// Israeli national ID. Format: 9 digits, ninth being a Luhn-like
	// check digit. Comes first because the bare 9-digit form would
	// otherwise be captured by aba_routing below.
	// Source: Israel Ministry of Interior public spec.
	{"israeli_id", mustCompile(`\b(?:IL[-\s]?)?\d{9}\b`)},

	// IBAN — International Bank Account Number. Format per ISO
	// 13616-1: two-letter country code, two check digits, then 11-30
	// alphanumeric (varies by country). Allow optional spaces every
	// four characters because banks print them that way and users
	// paste them that way.
	// Source: SWIFT IBAN registry.
	{"iban", mustCompile(`\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){2,7}(?:[ ]?[A-Z0-9]{1,4})?\b`)},

	// BIC / SWIFT code. Format per ISO 9362: 8 or 11 alphanumeric:
	// 4-letter bank, 2-letter country, 2-char location, optional
	// 3-char branch. Allow upper- and lower-case because some
	// publications lowercase them.
	// Source: SWIFT BIC registry.
	{"bic", mustCompile(`\b[A-Za-z]{4}[A-Za-z]{2}[A-Za-z0-9]{2}(?:[A-Za-z0-9]{3})?\b`)},

	// US ABA routing number — 9 digits. False positives on bare
	// 9-digit strings are real; this lives in the finance preset
	// (off by default) precisely so generic chats don't trip it. A
	// downstream Luhn / ABA-checksum validation step would be a good
	// future enhancement; for now we accept the false-positive
	// probability that the firm has agreed to by opting into the
	// preset.
	// Source: ABA "Routing Number Policy".
	{"aba_routing", mustCompile(`\b(?:RTN|ABA|Routing)\s*[:#]?\s*\d{9}\b`)},
}
