// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Healthcare-vertical DLP preset: NPI (US National Provider
// Identifier), DEA registration number, ICD-10 diagnosis codes,
// and free-text PHI confidentiality markers ("PHI", "protected
// health information"). MRN is intentionally NOT duplicated here —
// the built-in pack in dlp.go already covers it.
//
// The preset is opt-in per tenant via
// `tenant_dlp_policy.healthcare_preset` (migration 033). Default
// action follows the tenant's per-tenant DLP action enum.
//
// IMPORTANT — this preset is a HEURISTIC. The presence of an
// ICD-10 code does NOT establish that the surrounding text
// constitutes PHI under 45 CFR 160.103; absence does NOT mean PHI
// is absent. Treat as defense-in-depth, not as a HIPAA-evidence
// engine. A 2026 SOC 2 + HIPAA audit (year 2) is the formal
// attestation path; this preset reduces obvious paste mistakes in
// the meantime.
//
// Citations:
//
//   - NPI format: CMS "National Provider Identifier Standard"
//     (45 CFR 162.406). 10-digit identifier, first digit 1 or 2,
//     Luhn check (mod 10) on positions 1-9 with prefix 80840:
//     https://www.cms.gov/Regulations-and-Guidance/Administrative-Simplification/NationalProvIdentStand
//   - DEA registration: DEA Office of Diversion Control, 21 CFR
//     §1301.35. Format: 2 letters + 7 digits, last digit checksum:
//     https://www.deadiversion.usdoj.gov/drugreg/index.html
//   - ICD-10-CM (US clinical modification): NCHS. Letter + 2
//     digits + optional .[0-9A-Z]{1,4}:
//     https://www.cdc.gov/nchs/icd/icd10cm.htm
//   - HIPAA confidentiality marker convention is informal — many
//     EHRs prepend "PHI:" or "Protected Health Information" to
//     reports; we match the literal phrase as a hint.

package middleware

// HealthcarePatterns returns the full healthcare-vertical preset
// as a slice the existing detector can merge in via DetectWith /
// ApplyWith. Patterns are compiled at package init.
func HealthcarePatterns() []pattern {
	return healthcarePatterns
}

// HealthcarePatternNames returns the stable detection-class names
// this preset emits, in the order HealthcarePatterns() returns
// them.
func HealthcarePatternNames() []string {
	names := make([]string, 0, len(healthcarePatterns))
	for _, p := range healthcarePatterns {
		names = append(names, p.name)
	}
	return names
}

// DetectHealthcare runs the built-in pattern pack PLUS the
// healthcare preset.
func (d *Detector) DetectHealthcare(input string) []Match {
	return d.DetectWith(input, healthcarePatterns)
}

// ApplyHealthcare runs Apply with the healthcare preset merged in.
// Same semantics as ApplyWith. Tokenize is supported because
// clinical-summary use cases often want the LLM to see <NPI_001>
// and recover the original on response.
func (d *Detector) ApplyHealthcare(input string, action Action) (string, []Match, error) {
	return d.ApplyWith(input, action, healthcarePatterns)
}

// healthcarePatterns lists the regexes that fire under the
// healthcare preset.
var healthcarePatterns = []pattern{
	// PHI confidentiality marker — free-text phrase commonly
	// prepended by EHRs to clinical reports. Matches both the
	// abbreviation and the full phrase, case-insensitive.
	{"phi_marker", mustCompile(`(?i)\b(?:PHI|protected\s+health\s+information)\b`)},

	// NPI — National Provider Identifier. 10 digits, first being 1
	// (individual) or 2 (organisation). Only match the explicit
	// "NPI: 1234567890" form — Go's RE2 has no lookahead so we
	// cannot match bare 10-digit IDs followed by a "(NPI)" tag
	// without over-matching. Conservative form is acceptable v0;
	// false negatives are caller-controllable via CustomPatternSpec.
	// Source: CMS NPI standard.
	{"npi", mustCompile(`\bNPI[:#]?\s*[12]\d{9}\b`)},

	// DEA number — 2 letters + 7 digits. First letter is the
	// registrant type (A/B/C/F/G/H/J/K/L/M/P/R/S/T/U/X), second
	// letter is the first letter of the registrant's last name (or
	// 9 for substitution). Match conservatively.
	// Source: DEA Office of Diversion Control.
	{"dea", mustCompile(`\bDEA[:#]?\s*[A-Z]{2}\d{7}\b`)},

	// ICD-10-CM diagnosis code. Format: letter + 2 digits +
	// optional .[0-9A-Z]{1,4}. Examples: E11.9 (Type 2 diabetes),
	// I10 (essential hypertension), F33.0 (recurrent major
	// depressive disorder, mild).
	// Source: NCHS ICD-10-CM.
	{"icd10", mustCompile(`\b[A-TV-Z]\d{2}(?:\.[0-9A-Z]{1,4})?\b`)},
}
