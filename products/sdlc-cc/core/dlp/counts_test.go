package dlp

import "testing"

func TestMaskAMLWithCounts_PAN(t *testing.T) {
	in := "Card 4111-1111-1111-1111 and bogus 1234-5678-9012-3456"
	out, c := MaskAMLWithCounts(in)
	// 4111-... is Luhn-valid; 1234-... fails Luhn so it's not counted.
	if c.PAN != 1 {
		t.Errorf("PAN count = %d, want 1 (only Luhn-valid match counts)", c.PAN)
	}
	if out == in {
		t.Errorf("masking should have changed the string")
	}
}

func TestMaskAMLWithCounts_Mixed(t *testing.T) {
	// Use distinct line breaks so the phone regex doesn't grab digit
	// runs from the PAN — those are intentionally separate kinds in
	// the per-counter design.
	in := "Email me at john.doe@example.com\nPAN 4111-1111-1111-1111"
	_, c := MaskAMLWithCounts(in)
	if c.Email != 1 || c.PAN != 1 {
		t.Errorf("unexpected counts: %+v", c)
	}
	if c.Total() < 2 {
		t.Errorf("Total = %d, want >=2", c.Total())
	}
}

func TestMaskAMLWithCounts_NoPII(t *testing.T) {
	in := "hello world, the quick brown fox jumps over the lazy dog"
	out, c := MaskAMLWithCounts(in)
	if c.Total() != 0 {
		t.Errorf("expected zero PII, got %+v", c)
	}
	if out != in {
		t.Errorf("scrubber rewrote a clean string: %q", out)
	}
}

func TestMaskAMLWithCounts_IBAN(t *testing.T) {
	// Valid German IBAN (mod-97 passes)
	in := "Wire to DE89 3704 0044 0532 0130 00 today"
	_, c := MaskAMLWithCounts(in)
	if c.IBAN != 1 {
		t.Errorf("IBAN count = %d, want 1", c.IBAN)
	}
}
