// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Litigation identifiers: case captions, docket numbers, state-bar
// numbers, EIN. SSN is intentionally NOT duplicated here — it is
// already covered by the built-in pack in dlp.go and adding it here
// would double-count matches.
//
// Attorney *names* are deliberately omitted. The policy choice of
// whether to redact attorney names belongs to the firm: many firms
// want names preserved so the LLM can answer "who is handling the
// Smith matter?" — others want them redacted to prevent shadow-
// attribution. We leave that decision to the tenant's custom
// pattern pack (CustomPatternSpec) rather than baking it into the
// preset.
//
// Rule citations:
//   - ABA Model Rule 1.6 (Confidentiality):
//     https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/rule_1_6_confidentiality_of_information/
//   - ABA Model Rule 5.5 (Unauthorized Practice of Law) — bar
//     numbers establish authorization to practice:
//     https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/rule_5_5_unauthorized_practice_of_law_multijurisdictional_practice_of_law/
//   - State-bar number formats:
//     - California State Bar — 5-7 digit attorney number,
//       published on the State Bar's member roll:
//       https://www.calbar.ca.gov/Attorneys/Member-Records
//     - New York State Bar — registration number, 7 digits, see
//       NY Judiciary Law §468-a:
//       https://www.nycourts.gov/attorneys/registration/
//     - Texas State Bar — bar card number, 8 digits, see Texas
//       Government Code §81.114:
//       https://www.texasbar.com/AM/Template.cfm?Section=Find_A_Lawyer
//     - Florida Bar — 6 or 7 digit number, see Rule 1-3.2,
//       Rules Regulating The Florida Bar:
//       https://www.floridabar.org/directories/find-mbr/

package middleware

// legalIdentifierPatterns matches docket numbers, case captions,
// and state-bar numbers in published formats. Each entry calls out
// the format source so a maintainer can update if a bar changes
// its numbering scheme (rare but it happens — Florida added the
// 7-digit form in the 2010s).
var legalIdentifierPatterns = []pattern{
	// Federal civil docket number: "1:24-cv-01234" or
	// "1:24-cv-01234-ABC". Format: district number, two-digit year,
	// case type code (cv/cr/mj/md/bk), 5-digit sequence, optional
	// judge initials. PACER documents and most federal-court orders
	// use this exact pattern. See JCUS Information Technology
	// Committee guidance.
	{
		name: "federal_docket_number",
		re:   mustCompile(`\b\d{1,2}:\d{2}-(?:cv|cr|mj|md|bk|mc)-\d{4,6}(?:-[A-Z]{2,4})?\b`),
	},
	// State court docket prefix variants. Common forms: "CV-2024-
	// 001234" (Arizona), "24CV12345" (Ohio), "BC-24-12345" (Texas
	// civil). Conservative: requires a two-letter prefix + dashes
	// + 4+ digits. Tighter than the federal pattern because state
	// formats vary so widely.
	{
		name: "state_docket_number",
		re:   mustCompile(`\b(?:CV|CR|FA|PR|JV|BC|SC|MC)[-\s]?\d{2,4}[-\s]?\d{4,7}\b`),
	},
	// Case caption "In re X" — the standard form for bankruptcy
	// and probate proceedings. Conservative: requires "In re"
	// followed by a capitalized noun phrase of 2-50 chars; longer
	// matches are likely paragraphs, not captions.
	{
		name: "case_caption",
		re:   mustCompile(`\bIn\s+re\s+[A-Z][A-Za-z0-9.,&'\- ]{1,50}\b`),
	},
	// Case caption "X v. Y" or "X vs. Y" — the standard adversarial
	// caption. Allows initials and "et al." Conservative on length
	// so we don't match arbitrary sentences containing "v.".
	{
		name: "case_caption",
		re:   mustCompile(`\b[A-Z][A-Za-z0-9.&'\- ]{1,40}\s+v(?:s)?\.\s+[A-Z][A-Za-z0-9.&'\- ]{1,40}(?:,?\s+et\s+al\.?)?`),
	},
	// California State Bar number: "SBN 123456" or "Bar No. 123456"
	// or "Cal. Bar No. 123456". CA bar numbers are 5-7 digits per
	// the State Bar's member-records page (cited in file header).
	{
		name: "ca_bar_number",
		re:   mustCompile(`(?i)\b(?:Cal\.?\s+)?(?:State\s+)?Bar\s+(?:No\.?|Number|#)\s*\d{5,7}\b|\bSBN\s*#?\s*\d{5,7}\b`),
	},
	// New York attorney registration number: "Reg. No. 1234567" or
	// "NY Att'y Reg. No. 1234567". 7 digits per NY Judiciary Law
	// §468-a (cited in file header).
	{
		name: "ny_bar_number",
		re:   mustCompile(`(?i)\b(?:NY\s+)?(?:Att(?:'|y)?\.?\s+)?Reg(?:istration)?\.?\s+(?:No\.?|Number|#)\s*\d{7}\b`),
	},
	// Texas bar card number: "Texas Bar No. 12345678" — 8 digits per
	// Texas Government Code §81.114 (cited in file header).
	{
		name: "tx_bar_number",
		re:   mustCompile(`(?i)\bTexas\s+(?:State\s+)?Bar\s+(?:No\.?|Number|Card\s+(?:No\.?|Number)|#)\s*\d{8}\b`),
	},
	// Florida Bar number: "FL Bar No. 123456" — 6 or 7 digits per
	// Rule 1-3.2 (cited in file header).
	{
		name: "fl_bar_number",
		re:   mustCompile(`(?i)\b(?:FL|Florida)\s+Bar\s+(?:No\.?|Number|#)\s*\d{6,7}\b`),
	},
	// EIN (Employer Identification Number): "XX-XXXXXXX". IRS
	// format per Publication 1635. Often appears on retainer
	// agreements and trust accounting under ABA Model Rule 1.15
	// (Safekeeping Property).
	{
		name: "ein",
		re:   mustCompile(`\b\d{2}-\d{7}\b`),
	},
}
