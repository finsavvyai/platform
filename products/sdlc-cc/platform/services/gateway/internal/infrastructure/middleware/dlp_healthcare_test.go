// SPDX-License-Identifier: AGPL-3.0-or-later
package middleware

import (
	"strings"
	"testing"
)

func TestHealthcarePatterns_RedactsPHIMarker(t *testing.T) {
	d := NewDetector()
	in := "Protected Health Information: patient Smith presented with"
	out, matches, err := d.ApplyHealthcare(in, ActionRedact)
	if err != nil {
		t.Fatalf("apply: %v", err)
	}
	if strings.Contains(strings.ToLower(out), "protected health information") {
		t.Fatalf("PHI marker leaked: %q", out)
	}
	if !hasType(matches, "phi_marker") {
		t.Fatalf("no phi_marker match in %+v", matches)
	}
}

func TestHealthcarePatterns_RedactsNPI(t *testing.T) {
	d := NewDetector()
	in := "ordering provider NPI: 1234567893"
	out, matches, err := d.ApplyHealthcare(in, ActionRedact)
	if err != nil {
		t.Fatalf("apply: %v", err)
	}
	if strings.Contains(out, "1234567893") {
		t.Fatalf("NPI leaked: %q", out)
	}
	if !hasType(matches, "npi") {
		t.Fatalf("no npi match in %+v", matches)
	}
}

func TestHealthcarePatterns_RedactsDEA(t *testing.T) {
	d := NewDetector()
	in := "controlled substance DEA: BS1234567 prescribed"
	out, matches, err := d.ApplyHealthcare(in, ActionRedact)
	if err != nil {
		t.Fatalf("apply: %v", err)
	}
	if strings.Contains(out, "BS1234567") {
		t.Fatalf("DEA leaked: %q", out)
	}
	if !hasType(matches, "dea") {
		t.Fatalf("no dea match in %+v", matches)
	}
}

func TestHealthcarePatterns_RedactsICD10(t *testing.T) {
	d := NewDetector()
	in := "diagnosis E11.9 with comorbidities I10 and F33.0"
	out, matches, err := d.ApplyHealthcare(in, ActionRedact)
	if err != nil {
		t.Fatalf("apply: %v", err)
	}
	for _, code := range []string{"E11.9", "F33.0"} {
		if strings.Contains(out, code) {
			t.Fatalf("ICD-10 %s leaked: %q", code, out)
		}
	}
	if !hasType(matches, "icd10") {
		t.Fatalf("no icd10 match in %+v", matches)
	}
}

func TestHealthcarePatterns_NoFalsePositiveOnPlainText(t *testing.T) {
	d := NewDetector()
	in := "the meeting was productive and we agreed on next steps"
	_, matches, err := d.ApplyHealthcare(in, ActionRedact)
	if err != nil {
		t.Fatalf("apply: %v", err)
	}
	hits := filterTypes(matches, []string{"phi_marker", "npi", "dea", "icd10"})
	if len(hits) != 0 {
		t.Fatalf("unexpected healthcare match: %+v", hits)
	}
}

func TestHealthcarePatternNames_StableOrder(t *testing.T) {
	got := HealthcarePatternNames()
	want := []string{"phi_marker", "npi", "dea", "icd10"}
	if len(got) != len(want) {
		t.Fatalf("count: got %d want %d", len(got), len(want))
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("at %d: got %q want %q", i, got[i], want[i])
		}
	}
}
