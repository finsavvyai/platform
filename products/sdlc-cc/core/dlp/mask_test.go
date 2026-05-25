package dlp

import "testing"

func TestMaskEmailKeepsDomain(t *testing.T) {
	tests := []struct{ in, want string }{
		{"john.doe@example.com",
			"j******e@example.com"},
		{"contact: user@example.com please",
			"contact: u**r@example.com please"},
		{"a@b.co", "***@b.co"},
		{"no email here", "no email here"},
	}
	for _, tt := range tests {
		got := MaskEmail(tt.in)
		if got != tt.want {
			t.Errorf("MaskEmail(%q) = %q, want %q",
				tt.in, got, tt.want)
		}
	}
}

func TestMaskPhoneKeepsLastFour(t *testing.T) {
	tests := []struct{ in, want string }{
		{"call +972-50-123-4567 today",
			"call ***4567 today"},
		{"phone 5551234567 ok", "phone ***4567 ok"},
		{"no phone", "no phone"},
	}
	for _, tt := range tests {
		got := MaskPhone(tt.in)
		if got != tt.want {
			t.Errorf("MaskPhone(%q) = %q, want %q",
				tt.in, got, tt.want)
		}
	}
}

func TestMaskPIIBoth(t *testing.T) {
	in := "user a@b.co called +972 50 123 4567"
	got := MaskPII(in)
	if got == in {
		t.Errorf("MaskPII did not redact: %q", got)
	}
	if got != "user ***@b.co called ***4567" {
		t.Errorf("MaskPII = %q", got)
	}
}
