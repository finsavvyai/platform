// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Attorney-client privilege + work-product doctrine markers. These
// are textual legends commonly affixed to legal documents and email
// signatures to assert privilege or work-product protection. The
// regexes are deliberately case-insensitive ((?i)) because firms
// vary: "Privileged & Confidential", "PRIVILEGED AND CONFIDENTIAL",
// "privileged/confidential" all appear in the wild.
//
// Detecting a marker is NOT a privilege determination — see the
// disclaimer in dlp_legal.go. The marker only flags the content for
// the configured tenant action (default: mask).
//
// Rule citations:
//   - ABA Model Rule 1.6 (Confidentiality of Information):
//     https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/rule_1_6_confidentiality_of_information/
//   - ABA Model Rule 1.18 (Duties to Prospective Client):
//     https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/rule_1_18_duties_of_to_prospective_client/
//   - ABA Model Rule 4.4(b) (Inadvertent Disclosure):
//     https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/rule_4_4_respect_for_rights_of_third_persons/
//   - ABA Formal Opinion 512 (Generative AI Tools, 2024) §III.A —
//     duty of confidentiality when inputting client information
//     into a generative AI tool:
//     https://www.americanbar.org/groups/professional_responsibility/aba-formal-opinion-512/
//   - California Bar Practical Guidance for the Use of Generative
//     AI in the Practice of Law (Nov 2023):
//     https://www.calbar.ca.gov/Portals/0/documents/ethics/Generative-AI-Practical-Guidance.pdf
//   - Florida Bar Ethics Opinion 24-1 (Jan 2024) — Generative AI:
//     https://www.floridabar.org/etopinions/opinion-24-1/
//
// Federal Rule of Civil Procedure 26(b)(3) (work-product doctrine):
//   https://www.law.cornell.edu/rules/frcp/rule_26
//
// Hickman v. Taylor, 329 U.S. 495 (1947) — origin of the work-
// product doctrine in U.S. federal practice.

package middleware

// legalPrivilegePatterns matches the headers, footers, and email
// legends firms use to assert attorney-client privilege. Each entry
// has a comment naming the rule the pattern serves to keep
// confidential. The regex must match a *legend*, not arbitrary use
// of the word "privileged" — otherwise we false-positive on every
// memo that mentions privileged accounts in IT contexts.
var legalPrivilegePatterns = []pattern{
	// "Privileged and Confidential" or "Privileged & Confidential"
	// is the canonical legend used in email banners and the first
	// line of memos. Protected under ABA Model Rule 1.6 — duty of
	// confidentiality. The `(?:and|&)` accepts both forms.
	{
		name: "attorney_client_privilege",
		re:   mustCompile(`(?i)\bPrivileged\s*(?:and|&|/)\s*Confidential\b`),
	},
	// Explicit "Subject to Attorney-Client Privilege" — stronger
	// statement, common on demand letters and litigation holds.
	// ABA Model Rule 1.6.
	{
		name: "attorney_client_privilege",
		re:   mustCompile(`(?i)\bSubject\s+to\s+(?:the\s+)?Attorney[-\s]Client\s+Privilege\b`),
	},
	// "Attorney-Client Communication" header (case-insensitive). Some
	// firms prefer this over "Privileged & Confidential" because it
	// is more precise. ABA Model Rule 1.6.
	{
		name: "attorney_client_privilege",
		re:   mustCompile(`(?i)\bAttorney[-\s]Client\s+Communication\b`),
	},
	// "Do Not Forward / Distribute Outside [Counsel|the Firm]" —
	// supports the duty to prevent inadvertent disclosure under ABA
	// Model Rule 4.4(b) and the work-product doctrine where
	// applicable.
	{
		name: "do_not_forward",
		re:   mustCompile(`(?i)\bDo\s+Not\s+(?:Forward|Distribute|Disseminate)(?:\s+Outside(?:\s+(?:Counsel|the\s+Firm|the\s+Client)))?`),
	},
	// "Pursuant to ER 4.4(b)" or "Pursuant to Model Rule 4.4(b)" —
	// inadvertent-disclosure clawback notice. ABA Model Rule 4.4(b)
	// and parallel state rules (e.g., Arizona ER 4.4(b)).
	{
		name: "inadvertent_disclosure_notice",
		re:   mustCompile(`(?i)\bPursuant\s+to\s+(?:ER|Model\s+Rule|MR|RPC)\s+4\.4\(b\)`),
	},
	// Generic "Privileged Communication" footer used by smaller
	// firms whose template comes from form-book sources. ABA Model
	// Rule 1.6.
	{
		name: "attorney_client_privilege",
		re:   mustCompile(`(?i)\bPrivileged\s+Communication\b`),
	},
	// Prospective-client legend — "Subject to ABA Model Rule 1.18"
	// or "Prospective Client Communication". Triggers the duty of
	// confidentiality even when no engagement has formed.
	{
		name: "prospective_client_communication",
		re:   mustCompile(`(?i)\b(?:Prospective\s+Client\s+Communication|Subject\s+to\s+(?:ABA\s+)?(?:Model\s+)?Rule\s+1\.18)\b`),
	},
}

// legalWorkProductPatterns matches markers that assert protection
// under FRCP 26(b)(3) and the Hickman v. Taylor work-product
// doctrine. These markers are typically applied to memos, witness
// outlines, and case-strategy documents prepared in anticipation of
// litigation. The doctrine protects opinion work product (mental
// impressions) more strongly than fact work product; both share the
// same redaction policy here.
var legalWorkProductPatterns = []pattern{
	// "Attorney Work Product" — the canonical legend. FRCP 26(b)(3).
	{
		name: "attorney_work_product",
		re:   mustCompile(`(?i)\bAttorney\s+Work[-\s]Product\b`),
	},
	// "Prepared in Anticipation of Litigation" — the operative
	// phrase from FRCP 26(b)(3)(A); appears verbatim on memo
	// headers to invoke the protection.
	{
		name: "work_product_anticipation",
		re:   mustCompile(`(?i)\bPrepared\s+in\s+Anticipation\s+of\s+Litigation\b`),
	},
	// "Trial Preparation Material" — FRCP 26(b)(3) phrasing used by
	// firms that quote the rule verbatim on cover sheets.
	{
		name: "trial_preparation_material",
		re:   mustCompile(`(?i)\bTrial\s+Preparation\s+Material(?:s)?\b`),
	},
	// "Attorney Mental Impressions" — protects opinion work product,
	// which receives near-absolute protection under FRCP 26(b)(3)(B)
	// and Hickman v. Taylor, 329 U.S. 495 (1947).
	{
		name: "attorney_mental_impressions",
		re:   mustCompile(`(?i)\bAttorney\s+Mental\s+Impressions\b`),
	},
	// "Work Product — Litigation Strategy" / "Litigation Strategy
	// Memo" — common headers for opinion work product. FRCP
	// 26(b)(3)(B).
	{
		name: "litigation_strategy",
		re:   mustCompile(`(?i)\b(?:Work\s+Product\s*[-—:]\s*)?Litigation\s+Strategy(?:\s+(?:Memo(?:randum)?|Document))?\b`),
	},
}
