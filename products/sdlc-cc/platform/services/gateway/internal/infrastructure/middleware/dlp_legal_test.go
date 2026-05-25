// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Behavior tests for the legal-vertical DLP preset. Every pattern
// gets a positive sample (must match) and a representative negative
// sample (must NOT match) to prove no false positive on benign
// English. Test data lives in dlp_legal_cases_test.go.
package middleware

import (
	"strings"
	"testing"
)

// TestLegalPatterns_PositiveAndNegativeCoverage drives every row of
// legalCases through DetectLegal: positive samples must produce a
// match of the named class; negative samples must not. Negative
// samples are deliberately adversarial — phrases that contain a
// near-keyword without forming the legend.
func TestLegalPatterns_PositiveAndNegativeCoverage(t *testing.T) {
	d := NewDetector()
	for _, tc := range legalCases {
		t.Run(tc.name+"/positive", func(t *testing.T) {
			matches := d.DetectLegal(tc.positive)
			if !hasMatch(matches, tc.name) {
				t.Fatalf("expected %q to fire on %q; got types=%v",
					tc.name, tc.positive, matchTypes(matches))
			}
		})
		t.Run(tc.name+"/negative", func(t *testing.T) {
			matches := d.DetectLegal(tc.negative)
			if hasMatch(matches, tc.name) {
				t.Fatalf("FALSE POSITIVE: %q fired on benign input %q",
					tc.name, tc.negative)
			}
		})
	}
}

// TestLegalPatterns_RedactProducesUppercaseLabel proves the
// preset's classes flow through the existing redact path and emit
// `<UPPER_TYPE>` placeholders consistent with the built-in pack.
func TestLegalPatterns_RedactProducesUppercaseLabel(t *testing.T) {
	d := NewDetector()
	in := "PRIVILEGED & CONFIDENTIAL — memo from outside counsel"
	out, matches, err := d.ApplyLegal(in, ActionRedact)
	if err != nil {
		t.Fatalf("ApplyLegal redact errored: %v", err)
	}
	if len(matches) == 0 {
		t.Fatalf("expected at least one match, got none")
	}
	if !strings.Contains(out, "<ATTORNEY_CLIENT_PRIVILEGE>") {
		t.Fatalf("redact output missing class placeholder: %q", out)
	}
	if strings.Contains(out, "PRIVILEGED & CONFIDENTIAL") {
		t.Fatalf("raw legend survived redact: %q", out)
	}
}

// TestLegalPatterns_MaskIsTheDefaultSafeAction proves the preset is
// usable with mask (the recommended default per the doc) without
// crashing or dropping content. Mask preserves length so positional
// references in the audit trail still resolve.
func TestLegalPatterns_MaskIsTheDefaultSafeAction(t *testing.T) {
	d := NewDetector()
	in := "Attorney-Client Communication: see Smith v. Jones for posture."
	out, matches, err := d.ApplyLegal(in, ActionMask)
	if err != nil {
		t.Fatalf("ApplyLegal mask errored: %v", err)
	}
	if len(matches) < 2 { // privilege legend + case caption
		t.Fatalf("expected >=2 matches, got %d: %v", len(matches), matchTypes(matches))
	}
	if len(out) != len(in) {
		t.Fatalf("mask must preserve length: in=%d out=%d", len(in), len(out))
	}
}

// TestLegalPatternNames_StableExport guards the public list against
// accidental rename — the admin UI keys per-class policy on these
// strings, so removing or renaming a name is a breaking change.
func TestLegalPatternNames_StableExport(t *testing.T) {
	names := LegalPatternNames()
	if len(names) == 0 {
		t.Fatalf("LegalPatternNames returned empty slice")
	}
	required := []string{
		"attorney_client_privilege",
		"attorney_work_product",
		"bates_number",
		"federal_docket_number",
		"ca_bar_number",
		"nda_subject",
	}
	for _, r := range required {
		if !containsString(names, r) {
			t.Errorf("required class %q missing from LegalPatternNames()", r)
		}
	}
}

// TestLegalPatterns_BlockReturnsErrBlocked proves block flows
// through ApplyLegal the same way it does for the built-in pack —
// callers can route the preset through the existing 422
// problem+json handler without special-casing.
func TestLegalPatterns_BlockReturnsErrBlocked(t *testing.T) {
	d := NewDetector()
	_, matches, err := d.ApplyLegal(
		"ATTORNEY WORK PRODUCT — privileged.", ActionBlock)
	if err == nil {
		t.Fatalf("expected ErrBlocked, got nil")
	}
	if len(matches) == 0 {
		t.Fatalf("expected matches alongside block error")
	}
}

// hasMatch returns true when any element of matches has the given
// type. Pulled out so the table loop reads as one assertion.
func hasMatch(matches []Match, typ string) bool {
	for _, m := range matches {
		if m.Type == typ {
			return true
		}
	}
	return false
}

func matchTypes(matches []Match) []string {
	out := make([]string, 0, len(matches))
	for _, m := range matches {
		out = append(out, m.Type)
	}
	return out
}

func containsString(s []string, v string) bool {
	for _, x := range s {
		if x == v {
			return true
		}
	}
	return false
}
