// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Discovery / protective-order markers and Bates-number patterns.
// These are the legends affixed to documents produced in discovery
// under FRCP 26(c) protective orders or 29 / 502(d) agreements.
//
// Bates numbering is the de-facto standard for production document
// identification in U.S. litigation: a prefix unique to the
// producing party plus a zero-padded sequence (e.g., ACME0000123).
// The number itself is not privileged, but the Bates stamp pattern
// is a strong tell that a chunk of text is a produced document,
// which is in turn typically under a protective order. We detect
// the stamp to flag the surrounding content for the configured
// action, not to redact case numbers in routine emails.
//
// Rule citations:
//   - FRCP 26(c) (protective orders):
//     https://www.law.cornell.edu/rules/frcp/rule_26
//   - FRE 502(d) (no-waiver orders):
//     https://www.law.cornell.edu/rules/fre/rule_502
//   - The Sedona Conference Cooperation Proclamation (Bates
//     numbering convention, 2008/2018 updates):
//     https://thesedonaconference.org/publication/Sedona_Conference_Cooperation_Proclamation
//   - ABA Model Rule 3.4(c) (compliance with discovery orders):
//     https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/rule_3_4_fairness_to_opposing_party_counsel/
//   - New York State Bar Association Task Force on AI Report (Apr
//     2024) §IV — duties in discovery using AI:
//     https://nysba.org/app/uploads/2022/03/2024-April-Report-and-Recommendations-of-the-Task-Force-on-Artificial-Intelligence.pdf
//   - Illinois State Bar Association Opinion 24-01 (Apr 2024) —
//     duties when using AI in litigation:
//     https://www.isba.org/sites/default/files/ethicsopinions/24-01.pdf

package middleware

// legalDiscoveryPatterns matches discovery markings:
// confidentiality designations under protective orders, Bates
// stamps, and AEO (attorneys' eyes only) legends. Default action
// is mask (not block) — a paralegal pasting a Bates-stamped doc
// excerpt into Claude for summarization should not have the
// request rejected outright. The audit trail records the action.
var legalDiscoveryPatterns = []pattern{
	// "Stipulated Confidential" — basic protective-order tier.
	// FRCP 26(c). The "Stipulated" prefix distinguishes the tier
	// from the unrelated word "confidential" alone.
	{
		name: "discovery_confidential",
		re:   mustCompile(`(?i)\bStipulated\s+Confidential\b`),
	},
	// Highly Confidential — Attorneys' Eyes Only (HC-AEO). The
	// canonical second tier under most protective orders; restricts
	// access to outside counsel and experts. FRCP 26(c).
	{
		name: "highly_confidential_aeo",
		re:   mustCompile(`(?i)\b(?:Highly\s+Confidential)?\s*[-—]?\s*Attorneys?'?\s+Eyes\s+Only\b`),
	},
	// "HC-AEO" or "AEO" stamp shorthand used on production page
	// headers and footers. Same protective-order rationale.
	{
		name: "highly_confidential_aeo",
		re:   mustCompile(`\b(?:HC[-\s]?AEO|HIGHLY\s+CONFIDENTIAL\s+-\s+AEO)\b`),
	},
	// "Subject to Protective Order" — generic invocation of a FRCP
	// 26(c) order. Often appears on production cover sheets and
	// expert reports.
	{
		name: "protective_order_subject",
		re:   mustCompile(`(?i)\bSubject\s+to\s+(?:the\s+)?Protective\s+Order\b`),
	},
	// "Confidential — Subject to FRE 502(d)" or "Pursuant to FRE
	// 502(d)" — invokes the no-waiver order so an inadvertent
	// disclosure does not waive privilege.
	{
		name: "fre_502d_no_waiver",
		re:   mustCompile(`(?i)\b(?:Subject|Pursuant)\s+to\s+(?:FRE\s+)?(?:Rule\s+)?502\(d\)`),
	},
	// Bates-number stamp: 2-10 uppercase prefix + 4-10 digit zero-
	// padded counter, optionally with a tier suffix (e.g.,
	// ACME0000123, ACME-0000123, ACME_000123, ACME0000123.CONF).
	// The prefix length floor of 2 excludes single-letter false
	// positives like "A0001"; the digit floor of 4 excludes short
	// reference numbers that are not produced-document stamps.
	{
		name: "bates_number",
		re:   mustCompile(`\b[A-Z]{2,10}[-_]?\d{4,10}(?:\.[A-Z]{2,8})?\b`),
	},
	// "Privilege Log Entry" header — appears at the top of FRCP
	// 26(b)(5)(A) privilege logs. The log itself is not privileged,
	// but its contents typically describe privileged communications.
	{
		name: "privilege_log",
		re:   mustCompile(`(?i)\bPrivilege\s+Log(?:\s+Entry)?\b`),
	},
	// "Clawback Notice" / "Notice of Inadvertent Disclosure" — the
	// document a producing party sends to claw back privileged
	// material under FRE 502(b) or an FRE 502(d) order.
	{
		name: "clawback_notice",
		re:   mustCompile(`(?i)\b(?:Clawback\s+Notice|Notice\s+of\s+Inadvertent\s+(?:Production|Disclosure))\b`),
	},
}
