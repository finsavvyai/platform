// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Per-pattern positive + negative samples for the legal preset.
// Pulled out of dlp_legal_test.go to keep both files under the
// 200-line portfolio cap. Editing this file is how you add a new
// legal pattern to the preset's behavior coverage.
package middleware

// legalCase is one assertion: a pattern name we expect to fire on
// `positive` and a `negative` sample that must NOT fire that
// pattern. Negative samples may legitimately match a different
// preset class (e.g., the email built-in) — the test runner
// asserts only that the *named* class does not fire.
type legalCase struct {
	name     string // detection class we are asserting
	positive string // must produce a Match of `name`
	negative string // must NOT produce a Match of `name`
}

// legalCases is one row per pattern in LegalPatterns(). Grouped by
// source file for ease of cross-referencing the regex definition.
var legalCases = []legalCase{
	// --- Privilege (dlp_legal_privilege.go) ---
	{"attorney_client_privilege",
		"PRIVILEGED & CONFIDENTIAL — Re: Acme matter",
		"This account has privileged access to the database."},
	{"attorney_client_privilege",
		"This memo is Subject to the Attorney-Client Privilege.",
		"Our client portal supports privileged escalation paths."},
	{"attorney_client_privilege",
		"Attorney-Client Communication — please do not share.",
		"The customer-service team handled the communication promptly."},
	{"do_not_forward",
		"Do Not Forward Outside Counsel.",
		"Please forward your timesheet to payroll by Friday."},
	{"inadvertent_disclosure_notice",
		"Pursuant to ER 4.4(b), please return this email.",
		"Pursuant to section 4.4 of the manual, please reboot."},
	{"prospective_client_communication",
		"Prospective Client Communication — no engagement yet.",
		"Our prospective customer asked about pricing tiers."},

	// --- Work product (dlp_legal_privilege.go) ---
	{"attorney_work_product",
		"ATTORNEY WORK PRODUCT — Draft motion to dismiss.",
		"The product attorney reviewed the EULA last week."},
	{"work_product_anticipation",
		"This document was Prepared in Anticipation of Litigation.",
		"The schedule was prepared in anticipation of the next sprint."},
	{"trial_preparation_material",
		"Trial Preparation Materials — Witness outlines attached.",
		"The trial of the new feature is scheduled for Friday."},
	{"attorney_mental_impressions",
		"Section II — Attorney Mental Impressions on key witness.",
		"The candidate gave a strong mental impression in the interview."},
	{"litigation_strategy",
		"Litigation Strategy Memo — Q3 case posture.",
		"The product strategy meeting covered Q3 launches."},

	// --- Discovery (dlp_legal_discovery.go) ---
	{"discovery_confidential",
		"Marked Stipulated Confidential per PO §3.",
		"The agreement is mutually confidential between the parties."},
	{"highly_confidential_aeo",
		"Designated Highly Confidential — Attorneys' Eyes Only.",
		"This is highly confidential material under our NDA, no AEO designation."},
	{"highly_confidential_aeo",
		"HC-AEO stamp on every page.",
		"Our HCM system handles HR onboarding."},
	{"protective_order_subject",
		"This production is Subject to the Protective Order entered 2024-03-12.",
		"This update is subject to the regular change-control process."},
	{"fre_502d_no_waiver",
		"Production subject to FRE 502(d) order.",
		"Per section 502(d) of the company handbook, please RSVP."},
	{"bates_number",
		"See document ACME0000123 for the response.",
		"Order ID 0000123 was shipped yesterday."},
	{"privilege_log",
		"Privilege Log Entry #14 — withheld for AC privilege.",
		"The application log shows 14 errors today."},
	{"clawback_notice",
		"This is a Clawback Notice under FRE 502(b).",
		"Please send a notice of departure two weeks in advance."},

	// --- Identifiers (dlp_legal_identifiers.go) ---
	{"federal_docket_number",
		"Filed in 1:24-cv-01234-ABC (S.D.N.Y.).",
		"Build 1:24 deployed to staging last night."},
	{"state_docket_number",
		"State case CV-2024-001234 pending in Maricopa County.",
		"Customer reference R-2024 was archived."},
	{"case_caption",
		"In re Acme Industries, Inc., Chapter 11 proceedings.",
		"In real life, our customers rely on the SLA."},
	{"case_caption",
		"Smith v. Jones, 123 F.3d 456 (9th Cir. 2024).",
		"We chose option A vs. option B for the launch."},
	{"ca_bar_number",
		"Counsel of record: Jane Doe, SBN 234567.",
		"The bar code on the package is 234567."},
	{"ny_bar_number",
		"John Roe, NY Att'y Reg. No. 1234567.",
		"Our internal reg. number system uses 6-digit codes."},
	{"tx_bar_number",
		"Pat Lee, Texas Bar No. 12345678.",
		"The Texas office handles 12345678 tickets per quarter."},
	{"fl_bar_number",
		"Alex Kim, FL Bar No. 123456.",
		"Our Florida region had 123456 visits last month."},
	{"ein",
		"Trust account EIN 12-3456789.",
		"Version 12-3456789a was released last Tuesday."},

	// --- NDA / arbitration (dlp_legal_nda.go) ---
	{"nda_subject",
		"This deck is Subject to NDA — diligence room only.",
		"This memo is subject to revision after the review."},
	{"mnda_dated",
		"Mutual Non-Disclosure Agreement dated January 1, 2025.",
		"We had a mutual understanding about the deadline."},
	{"confidentiality_agreement",
		"Confidentiality Agreement dated 2024-08-12 governs the data.",
		"We have an unwritten confidentiality understanding."},
	{"confidential_information_designation",
		"As Confidential Information of the Disclosing Party, …",
		"This is confidential information about our roadmap."},
	{"arbitration_clause",
		"Disputes shall be resolved by binding arbitration administered by JAMS.",
		"Binding decisions are made by the steering committee."},
	{"choice_of_law_clause",
		"This Agreement is governed by the laws of the State of Delaware.",
		"The team is governed by the engineering OKRs."},
}
