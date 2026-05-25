package dlp

import "testing"

func TestMaskPAN(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want string
	}{
		{"valid Visa with dashes", "card 4111-1111-1111-1111 ok",
			"card ************1111 ok"},
		{"valid MC with spaces", "PAN: 5555 5555 5555 4444",
			"PAN: ************4444"},
		{"invalid (Luhn fails)", "fake 4111111111111112 here",
			"fake 4111111111111112 here"},
		{"too short", "id 1234567 ok", "id 1234567 ok"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := MaskPAN(tt.in); got != tt.want {
				t.Errorf("MaskPAN(%q) = %q, want %q", tt.in, got, tt.want)
			}
		})
	}
}

func TestMaskIBAN(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want string
	}{
		{"valid DE", "send to DE89370400440532013000 today",
			"send to DE89****3000 today"},
		{"valid GB with spaces", "GB29 NWBK 6016 1331 9268 19",
			"GB29****6819"},
		{"bogus check", "DE00370400440532013000 nope",
			"DE00370400440532013000 nope"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := MaskIBAN(tt.in); got != tt.want {
				t.Errorf("MaskIBAN(%q) = %q, want %q", tt.in, got, tt.want)
			}
		})
	}
}

func TestMaskBIC(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want string
	}{
		{"8-char DEUT", "wire to DEUTDEFF here",
			"wire to DEUT-DE-XX here"},
		{"11-char with branch", "BIC BARCGB22XXX listed",
			"BIC BARC-GB-XX listed"},
		{"too short ignored", "DEUT here", "DEUT here"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := MaskBIC(tt.in); got != tt.want {
				t.Errorf("MaskBIC(%q) = %q, want %q", tt.in, got, tt.want)
			}
		})
	}
}

func TestMaskILID(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want string
	}{
		{"valid checksum", "ID 123456782 here", "ID *******82 here"},
		{"invalid checksum", "ID 123456789 here", "ID 123456789 here"},
		{"not 9 digits", "ID 1234 here", "ID 1234 here"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := MaskILID(tt.in); got != tt.want {
				t.Errorf("MaskILID(%q) = %q, want %q", tt.in, got, tt.want)
			}
		})
	}
}

