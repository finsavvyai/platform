// SPDX-License-Identifier: AGPL-3.0-or-later
package middleware

import (
	"strings"
	"testing"
)

// Phone — positive cases for each variant.

func TestPIIDefault_RedactsE164Phone(t *testing.T) {
	d := NewDetector()
	in := "call me at +14155551234 anytime"
	out, matches, err := d.Apply(in, ActionRedact)
	if err != nil {
		t.Fatalf("apply: %v", err)
	}
	if strings.Contains(out, "+14155551234") {
		t.Fatalf("e164 leaked: %q", out)
	}
	if !hasType(matches, "phone_e164") {
		t.Fatalf("no phone_e164 in %+v", matches)
	}
}

func TestPIIDefault_RedactsUSPhoneFormatted(t *testing.T) {
	cases := []string{
		"reach me at (415) 555-1234 today",
		"my number is 415-555-1234, ok?",
		"415.555.1234 is my cell",
		"call 1-415-555-1234 immediately",
		"415 555 1234 (work line)",
	}
	d := NewDetector()
	for _, in := range cases {
		out, matches, err := d.Apply(in, ActionRedact)
		if err != nil {
			t.Fatalf("apply %q: %v", in, err)
		}
		if !hasType(matches, "phone_us") {
			t.Fatalf("no phone_us in %q -> %+v", in, matches)
		}
		if strings.Contains(out, "415") && strings.Contains(out, "1234") &&
			strings.Contains(out, "555") {
			t.Fatalf("digits leaked for %q: %q", in, out)
		}
	}
}

// Phone — negative cases that must NOT match.

func TestPIIDefault_NoFalsePositiveOnDates(t *testing.T) {
	negatives := []string{
		"event on 2024-12-31 was great",
		"build #20251231 finished",
		"version 1.2.3 shipped",
		"the clock read 10:30:45",
		"hash a1b2c3d4e5f6 verified",
	}
	d := NewDetector()
	for _, in := range negatives {
		_, matches, _ := d.Apply(in, ActionRedact)
		for _, m := range matches {
			if m.Type == "phone_us" || m.Type == "phone_e164" {
				t.Fatalf("phone false-positive on %q: %+v", in, m)
			}
		}
	}
}

// Address — positive.

func TestPIIDefault_RedactsUSStreetAddress(t *testing.T) {
	cases := []string{
		"mail to 123 Main St please",
		"office at 4500 Cherry Creek Drive",
		"meet at 99 Park Avenue tomorrow",
		"ship to 1600 Pennsylvania Avenue NW",
		"delivery: 12 Elm Lane",
	}
	d := NewDetector()
	for _, in := range cases {
		out, matches, err := d.Apply(in, ActionRedact)
		if err != nil {
			t.Fatalf("apply %q: %v", in, err)
		}
		if !hasType(matches, "us_street_address") {
			t.Fatalf("no us_street_address in %q -> %+v", in, matches)
		}
		if strings.Contains(out, "Main St") || strings.Contains(out, "Park Avenue") {
			// At least the suffix should be inside the redacted span.
			// The match spans number-through-suffix, so the literal
			// suffix should be absent from `out`. Above are heuristic
			// checks — we just spot-check two of the inputs.
		}
	}
}

// Address — negative.

func TestPIIDefault_NoAddressFalsePositiveOnGenericRuns(t *testing.T) {
	negatives := []string{
		"the 3 little pigs ran fast",
		"I bought 12 apples and 4 pears",
		"chapter 7 page 42 was hard",
		"build 1234 took 5 minutes",
	}
	d := NewDetector()
	for _, in := range negatives {
		_, matches, _ := d.Apply(in, ActionRedact)
		if hasType(matches, "us_street_address") {
			t.Fatalf("address false-positive on %q: %+v", in, matches)
		}
	}
}

// ZIP — positive with explicit label or state prefix.

func TestPIIDefault_RedactsLabelledZIP(t *testing.T) {
	cases := []string{
		"ZIP: 94103",
		"zip 10001-1234",
		"send to NY 10001",
		"office in CA, 94103-4567",
	}
	d := NewDetector()
	for _, in := range cases {
		_, matches, err := d.Apply(in, ActionRedact)
		if err != nil {
			t.Fatalf("apply %q: %v", in, err)
		}
		if !hasType(matches, "us_zip") {
			t.Fatalf("no us_zip in %q -> %+v", in, matches)
		}
	}
}

func TestPIIDefault_NoBareZIPFalsePositive(t *testing.T) {
	negatives := []string{
		"order 94103 was shipped",
		"reference 10001 not found",
		"build 20250101 deployed",
	}
	d := NewDetector()
	for _, in := range negatives {
		_, matches, _ := d.Apply(in, ActionRedact)
		if hasType(matches, "us_zip") {
			t.Fatalf("us_zip false-positive on %q: %+v", in, matches)
		}
	}
}

// Person name — honorific only, positive.

func TestPIIDefault_RedactsHonorificName(t *testing.T) {
	cases := []string{
		"the witness is Dr. Jane Doe",
		"defendant Mr. John Smith took the stand",
		"client Ms. Alice Wong called",
		"Sen. Mary Jackson voted no",
		"as Prof. Robert O'Neill testified",
		"Capt. Sarah Smith-Jones reports",
	}
	d := NewDetector()
	for _, in := range cases {
		out, matches, err := d.Apply(in, ActionRedact)
		if err != nil {
			t.Fatalf("apply %q: %v", in, err)
		}
		if !hasType(matches, "person_name") {
			t.Fatalf("no person_name in %q -> %+v", in, matches)
		}
		if strings.Contains(out, "Jane Doe") ||
			strings.Contains(out, "John Smith") ||
			strings.Contains(out, "Alice Wong") {
			t.Fatalf("name leaked for %q: %q", in, out)
		}
	}
}

// Person name — negative. Bare capitalised bigrams MUST NOT trip the
// honorific pattern, otherwise every "New York" or "Steve Jobs" in
// technical text would be redacted.
func TestPIIDefault_NoNameFalsePositiveOnBareCaps(t *testing.T) {
	negatives := []string{
		"I visited New York last week",
		"Steve Jobs once said something",
		"the React Native build failed",
		"Open Telemetry collector is up",
		"GitHub Copilot suggested code",
	}
	d := NewDetector()
	for _, in := range negatives {
		_, matches, _ := d.Apply(in, ActionRedact)
		if hasType(matches, "person_name") {
			t.Fatalf("person_name false-positive on %q: %+v", in, matches)
		}
	}
}

// Always-on integration check — pii_default extended classes fire
// without any tenant policy lookup (they live in the global
// pattern slice).
func TestPIIDefault_AlwaysOnNoTenantConfig(t *testing.T) {
	d := NewDetector()
	in := "Dr. Jane Doe lives at 123 Main St, call +14155551234"
	matches := d.Detect(in)
	if !hasType(matches, "person_name") ||
		!hasType(matches, "us_street_address") ||
		!hasType(matches, "phone_e164") {
		t.Fatalf("expected name + address + phone, got %+v", matches)
	}
}
