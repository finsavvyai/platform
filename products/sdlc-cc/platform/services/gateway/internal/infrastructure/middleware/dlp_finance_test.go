// SPDX-License-Identifier: AGPL-3.0-or-later
package middleware

import (
	"strings"
	"testing"
)

func TestFinancePatterns_RedactsIBAN(t *testing.T) {
	d := NewDetector()
	in := "wire to GB82 WEST 1234 5698 7654 32 please"
	out, matches, err := d.ApplyFinance(in, ActionRedact)
	if err != nil {
		t.Fatalf("apply: %v", err)
	}
	if strings.Contains(out, "GB82") {
		t.Fatalf("IBAN leaked: %q", out)
	}
	if !hasType(matches, "iban") {
		t.Fatalf("no iban match in %+v", matches)
	}
}

func TestFinancePatterns_RedactsBIC(t *testing.T) {
	d := NewDetector()
	in := "BIC: DEUTDEFFXXX is the receiving bank"
	out, matches, err := d.ApplyFinance(in, ActionRedact)
	if err != nil {
		t.Fatalf("apply: %v", err)
	}
	if strings.Contains(out, "DEUTDEFFXXX") {
		t.Fatalf("BIC leaked: %q", out)
	}
	if !hasType(matches, "bic") {
		t.Fatalf("no bic match in %+v", matches)
	}
}

func TestFinancePatterns_RedactsIsraeliID(t *testing.T) {
	d := NewDetector()
	in := "תעודת זהות 123456782 of the suspect"
	out, matches, err := d.ApplyFinance(in, ActionRedact)
	if err != nil {
		t.Fatalf("apply: %v", err)
	}
	if strings.Contains(out, "123456782") {
		t.Fatalf("Israeli ID leaked: %q", out)
	}
	if !hasType(matches, "israeli_id") {
		t.Fatalf("no israeli_id match in %+v", matches)
	}
}

func TestFinancePatterns_RedactsRoutingNumber(t *testing.T) {
	d := NewDetector()
	in := "ABA: 021000021 (Chase NY)"
	out, matches, err := d.ApplyFinance(in, ActionRedact)
	if err != nil {
		t.Fatalf("apply: %v", err)
	}
	if strings.Contains(out, "021000021") {
		t.Fatalf("routing leaked: %q", out)
	}
	if !hasType(matches, "aba_routing") {
		t.Fatalf("no aba_routing match in %+v", matches)
	}
}

func TestFinancePatterns_NoFalsePositiveOnPlainText(t *testing.T) {
	d := NewDetector()
	in := "the meeting is at 10am sharp; bring three slides"
	_, matches, err := d.ApplyFinance(in, ActionRedact)
	if err != nil {
		t.Fatalf("apply: %v", err)
	}
	if len(filterTypes(matches, []string{"iban", "bic", "israeli_id", "aba_routing"})) != 0 {
		t.Fatalf("unexpected finance match in %+v", matches)
	}
}

func TestFinancePatternNames_StableOrder(t *testing.T) {
	got := FinancePatternNames()
	want := []string{"israeli_id", "iban", "bic", "aba_routing"}
	if len(got) != len(want) {
		t.Fatalf("count: got %d want %d", len(got), len(want))
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("at %d: got %q want %q", i, got[i], want[i])
		}
	}
}

func hasType(matches []Match, t string) bool {
	for _, m := range matches {
		if m.Type == t {
			return true
		}
	}
	return false
}

func filterTypes(matches []Match, types []string) []Match {
	want := map[string]bool{}
	for _, t := range types {
		want[t] = true
	}
	out := make([]Match, 0)
	for _, m := range matches {
		if want[m.Type] {
			out = append(out, m)
		}
	}
	return out
}
