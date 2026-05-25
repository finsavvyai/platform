package dlp

import (
	"strings"
	"testing"
)

func TestNIValid(t *testing.T) {
	cases := map[string]bool{
		"AB123456C":   true,
		"AB 12 34 56 C": true,
		"ZZ123456C":   false, // disallowed prefix
		"BG123456A":   false, // disallowed prefix
		"AB12345C":    false, // wrong length
	}
	for in, want := range cases {
		if got := niValid(in); got != want {
			t.Errorf("niValid(%q) = %v, want %v", in, got, want)
		}
	}
}

func TestMaskUKNI_Redacts(t *testing.T) {
	in := "Employee NI is AB 12 34 56 C as recorded."
	out := MaskUKNI(in)
	if strings.Contains(out, "AB 12 34 56 C") || strings.Contains(out, "AB123456C") {
		t.Errorf("NI leaked: %s", out)
	}
	if !strings.Contains(out, "[UKNI]") {
		t.Errorf("expected [UKNI] redaction, got: %s", out)
	}
}

func TestMaskUKNI_DisallowedPrefix(t *testing.T) {
	in := "Bogus reference ZZ123456C"
	out := MaskUKNI(in)
	if !strings.Contains(out, "ZZ123456C") {
		t.Errorf("disallowed-prefix candidate should not be redacted: %s", out)
	}
}

func TestCountUKNI(t *testing.T) {
	in := "Two NIs: AB123456C and CE654321D, plus a fake ZZ987654A"
	if n := countUKNI(in); n != 2 {
		t.Errorf("expected 2 valid NIs, got %d", n)
	}
}
