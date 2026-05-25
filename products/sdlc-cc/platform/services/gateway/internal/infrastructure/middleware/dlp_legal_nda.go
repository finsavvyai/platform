// SPDX-License-Identifier: AGPL-3.0-or-later
//
// NDA / MNDA markers and arbitration-clause boilerplate. These are
// not privileged in the ABA Model Rule 1.6 sense — an NDA is a
// contract, not a privileged communication — but they are
// confidential by contract, and pasting NDA text into a third-party
// LLM can breach the contract's flow-down restrictions.
//
// ABA Formal Opinion 512 (Generative AI Tools, §III.B) specifically
// flags that "lawyers must consider whether and how to obtain
// informed consent" when entering client-confidential content into
// a GAI tool. NDA-bound content is a clear case where consent and
// flow-down terms matter, hence inclusion in the legal preset.
//
// Rule citations:
//   - ABA Formal Opinion 512 (Generative AI Tools, 2024):
//     https://www.americanbar.org/groups/professional_responsibility/aba-formal-opinion-512/
//   - ABA Model Rule 1.6(c) (reasonable efforts to prevent
//     inadvertent or unauthorized disclosure):
//     https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/rule_1_6_confidentiality_of_information/
//   - Federal Arbitration Act, 9 U.S.C. §§1-16:
//     https://www.law.cornell.edu/uscode/text/9
//   - Restatement (Second) of Contracts §178 (public-policy review
//     of arbitration and confidentiality clauses):
//     https://www.ali.org/publications/show/contracts/

package middleware

// legalNDAPatterns matches the legends that indicate content is
// subject to a non-disclosure agreement or contains arbitration
// boilerplate. The action is per-tenant; many firms will want
// `mask` (not block) on these because diligence work routinely
// requires summarizing NDA-bound materials and a hard block wedges
// the workflow.
var legalNDAPatterns = []pattern{
	// Generic NDA legend: "Subject to Non-Disclosure Agreement" or
	// "Subject to NDA". Captures the most common header form.
	// ABA Model Rule 1.6(c) — reasonable-efforts duty.
	{
		name: "nda_subject",
		re:   mustCompile(`(?i)\bSubject\s+to\s+(?:a\s+)?(?:Mutual\s+)?(?:Non[-\s]?Disclosure\s+Agreement|NDA)\b`),
	},
	// "Mutual Non-Disclosure Agreement dated <date>" — appears in
	// the recitals of MNDAs. The trailing date pattern is loose
	// (any 4-digit year) so we catch both "dated January 1, 2024"
	// and "dated 2024-01-01".
	{
		name: "mnda_dated",
		re:   mustCompile(`(?i)\bMutual\s+Non[-\s]?Disclosure\s+Agreement(?:\s+dated\s+[^\n,;.]{3,40})?`),
	},
	// "Confidentiality Agreement dated …" — variant common in
	// employment and M&A contexts.
	{
		name: "confidentiality_agreement",
		re:   mustCompile(`(?i)\bConfidentiality\s+Agreement(?:\s+dated\s+[^\n,;.]{3,40})?`),
	},
	// Common NDA flow-down legend: "Confidential Information of
	// [Discloser]" — the formal designation under §1 of most
	// NDA templates (ABA Model NDA, ACC member contract toolkit).
	{
		name: "confidential_information_designation",
		re:   mustCompile(`(?i)\bConfidential\s+Information\s+of\s+(?:the\s+)?(?:Discloser|Disclosing\s+Party|Company)\b`),
	},
	// Arbitration-clause boilerplate phrase: "binding arbitration
	// administered by [AAA|JAMS|ICC]" — invokes the Federal
	// Arbitration Act, 9 U.S.C. §§1-16. We flag the clause because
	// pasting it into a third-party model can leak dispute-
	// resolution strategy (forum selection, governing law).
	{
		name: "arbitration_clause",
		re:   mustCompile(`(?i)\bbinding\s+arbitration\s+administered\s+by\s+(?:the\s+)?(?:AAA|JAMS|ICC|American\s+Arbitration\s+Association|JAMS\s+Mediation,?\s+Arbitration\s+and\s+ADR\s+Services|International\s+Chamber\s+of\s+Commerce)\b`),
	},
	// "Governed by the laws of <jurisdiction>" — choice-of-law
	// clause boilerplate. Not privileged but often correlates with
	// confidential negotiating positions; included for diligence
	// workflows.
	{
		name: "choice_of_law_clause",
		re:   mustCompile(`(?i)\bgoverned\s+by\s+(?:and\s+construed\s+(?:in\s+accordance\s+)?(?:with|under)\s+)?the\s+laws\s+of\s+(?:the\s+)?(?:State|Commonwealth)\s+of\s+[A-Z][A-Za-z]{2,20}\b`),
	},
}
