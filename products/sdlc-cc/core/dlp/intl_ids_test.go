package dlp

import "testing"

func TestBSNValid(t *testing.T) {
	cases := map[string]bool{
		"111222333": true,  // 11-proef valid (digits sum to 154 = 14*11)
		"123456782": true,  // 11-proef valid (digits sum to 154 = 14*11)
		"000000000": false, // all zeros
		"123456789": false, // wrong checksum
	}
	for in, want := range cases {
		if got := bsnValid(in); got != want {
			t.Errorf("bsnValid(%q) = %v, want %v", in, got, want)
		}
	}
}

func TestMaskBSN(t *testing.T) {
	out := MaskBSN("citizen BSN 111222333 on file")
	if want := "[NL_BSN]"; !contains(out, want) {
		t.Errorf("expected %q in output, got %q", want, out)
	}
}

func TestSteuerIDValid(t *testing.T) {
	cases := map[string]bool{
		// Real-shape test vector (HMRC-equivalent docs) — first
		// digit non-zero, ISO 7064 checksum.
		"36574261809": true,
		"00000000000": false, // first digit zero
		"12345678901": false, // bad checksum
	}
	for in, want := range cases {
		if got := steuerIDValid(in); got != want {
			t.Errorf("steuerIDValid(%q) = %v, want %v", in, got, want)
		}
	}
}

func TestSINValid(t *testing.T) {
	// 130692544 is a Luhn-valid SIN starting with 1 (Atlantic).
	// Numbers starting with 0 or 8 are rejected per Service Canada
	// (never assigned), even when Luhn-valid.
	cases := map[string]bool{
		"130692544":   true,
		"130-692-544": true,
		"130 692 544": true,
		"046454286":   false, // starts 0 (not assigned)
		"800000000":   false, // starts 8 (reserved)
		"123456789":   false, // bad Luhn
	}
	for in, want := range cases {
		if got := sinValid(in); got != want {
			t.Errorf("sinValid(%q) = %v, want %v", in, got, want)
		}
	}
}

func TestTFNValid(t *testing.T) {
	cases := map[string]bool{
		"123456782": true,  // valid 9-digit test vector
		"123456789": false, // bad checksum
	}
	for in, want := range cases {
		if got := tfnValid(in); got != want {
			t.Errorf("tfnValid(%q) = %v, want %v", in, got, want)
		}
	}
}

func TestNPIValid(t *testing.T) {
	cases := map[string]bool{
		"1234567893": true,  // canonical HIPAA test vector
		"1234567890": false, // wrong checksum
	}
	for in, want := range cases {
		if got := npiValid(in); got != want {
			t.Errorf("npiValid(%q) = %v, want %v", in, got, want)
		}
	}
}

func TestMaskNPI_HIPAATestVector(t *testing.T) {
	out := MaskNPI("Provider NPI 1234567893 billed.")
	if !contains(out, "[US_NPI]") {
		t.Errorf("NPI should redact, got %q", out)
	}
}

// contains is a small helper used across these tests to avoid
// repeating strings.Contains in every assertion.
func contains(s, sub string) bool {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}
