package dlp

import (
	"strings"
	"testing"
)

func TestSSNValid(t *testing.T) {
	cases := map[string]bool{
		"123-45-6789": true,
		"123 45 6789": true,
		"123456789":   true,
		"000-12-3456": false, // area 000
		"666-12-3456": false, // area 666
		"900-12-3456": false, // ITIN range
		"123-00-3456": false, // group 00
		"123-45-0000": false, // serial 0000
		"abcdefghi":   false,
	}
	for in, want := range cases {
		if got := ssnValid(in); got != want {
			t.Errorf("ssnValid(%q) = %v, want %v", in, got, want)
		}
	}
}

func TestMaskSSN_Redacts(t *testing.T) {
	in := "Customer SSN 123-45-6789 was verified."
	out := MaskSSN(in)
	if strings.Contains(out, "123-45-6789") {
		t.Errorf("SSN leaked: %s", out)
	}
	if !strings.Contains(out, "***-**-6789") {
		t.Errorf("expected last4 form, got: %s", out)
	}
}

func TestMaskSSN_KeepsInvalid(t *testing.T) {
	in := "ID 000-00-0000 is not an SSN"
	out := MaskSSN(in)
	if !strings.Contains(out, "000-00-0000") {
		t.Errorf("invalid SSN should not be redacted, got: %s", out)
	}
}

func TestStripWhitespace(t *testing.T) {
	if stripWhitespace("123 - 45 - 6789") != "123456789" {
		t.Error("stripWhitespace failed")
	}
}
