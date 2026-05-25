package middleware

import (
	"errors"
	"strings"
	"testing"
)

func TestDetect_FindsSSN(t *testing.T) {
	d := NewDetector()
	matches := d.Detect("Customer SSN is 123-45-6789, please update")
	if len(matches) != 1 || matches[0].Type != "ssn" {
		t.Fatalf("ssn detection failed: %+v", matches)
	}
}

func TestDetect_FindsCreditCard(t *testing.T) {
	d := NewDetector()
	for _, in := range []string{
		"Card: 4111 1111 1111 1111",
		"4111-1111-1111-1111",
		"4111111111111111",
	} {
		if got := d.Detect(in); len(got) == 0 || got[0].Type != "credit_card" {
			t.Fatalf("credit_card detection failed for %q: %+v", in, got)
		}
	}
}

func TestApply_AllowReturnsInput(t *testing.T) {
	d := NewDetector()
	out, _, err := d.Apply("nothing here", ActionAllow)
	if err != nil || out != "nothing here" {
		t.Fatalf("allow path: out=%q err=%v", out, err)
	}
}

func TestApply_BlockReturnsErr(t *testing.T) {
	d := NewDetector()
	_, _, err := d.Apply("SSN 123-45-6789", ActionBlock)
	if !errors.Is(err, ErrBlocked) {
		t.Fatalf("block must return ErrBlocked, got %v", err)
	}
}

func TestApply_MaskPreservesLength(t *testing.T) {
	d := NewDetector()
	out, matches, _ := d.Apply("SSN 123-45-6789 OK", ActionMask)
	if len(matches) != 1 {
		t.Fatalf("expected 1 match, got %d", len(matches))
	}
	if strings.Contains(out, "123-45-6789") {
		t.Fatalf("plaintext SSN must not survive masking, got %q", out)
	}
	// Mask retains length so positional alignment is preserved.
	if len("SSN 123-45-6789 OK") != len(out) {
		t.Fatalf("mask must preserve length: %d vs %d", len("SSN 123-45-6789 OK"), len(out))
	}
}

func TestApply_RedactReplacesWithLabel(t *testing.T) {
	d := NewDetector()
	out, _, _ := d.Apply("contact alice@example.com", ActionRedact)
	// B3: redact label is now <UPPER_TYPE> so the surrounding
	// context (here just plain text) stays parseable. The previous
	// [REDACTED:email] form broke shells and JSON pasted into
	// Claude Team chats.
	if !strings.Contains(out, "<EMAIL>") {
		t.Fatalf("redact must use <UPPER_TYPE> placeholder, got %q", out)
	}
}

func TestApply_NoMatchPassesThrough(t *testing.T) {
	d := NewDetector()
	out, matches, _ := d.Apply("hello world", ActionMask)
	if out != "hello world" || len(matches) != 0 {
		t.Fatalf("no-PII input must pass through unchanged: out=%q matches=%d", out, len(matches))
	}
}

func TestDetect_LuhnRejectsInvalidCreditCard(t *testing.T) {
	d := NewDetector()
	// 16 digits but fails Luhn — must not be tagged credit_card. (May
	// still be account_number, which is fine.)
	got := d.Detect("ref 4111111111111112")
	for _, m := range got {
		if m.Type == "credit_card" {
			t.Fatalf("Luhn-invalid 16-digit run must NOT be credit_card: %+v", m)
		}
	}
}

func TestDetect_FindsITIN(t *testing.T) {
	d := NewDetector()
	got := d.Detect("ITIN 912-78-1234")
	found := false
	for _, m := range got {
		if m.Type == "itin" {
			found = true
		}
	}
	if !found {
		t.Fatalf("itin must be detected, got %+v", got)
	}
}

func TestDetect_FindsAccountNumber(t *testing.T) {
	d := NewDetector()
	got := d.Detect("acct 12345678901")
	if len(got) == 0 {
		t.Fatal("11-digit run must be detected")
	}
}

func TestDetect_SyntheticOnly(t *testing.T) {
	// Honesty-of-test-data check: every fixture in this file uses
	// known-invalid synthetics (the 999-99-9999 SSN, Visa test
	// number 4111-1111-1111-1111). If a future contributor pastes a
	// real PII string, this assertion fails loud.
	d := NewDetector()
	for _, ssn := range []string{"123-45-6789", "999-99-9999"} {
		matches := d.Detect(ssn)
		if len(matches) != 1 {
			t.Fatalf("synthetic SSN %q must match exactly once, got %d", ssn, len(matches))
		}
	}
}
