package screening

import "testing"

func TestDoubleMetaphone(t *testing.T) {
	tests := []struct {
		name        string
		input       string
		wantPrimary string
		wantSecond  string
	}{
		{
			name:        "germanic_schmidt",
			input:       "Schmidt",
			wantPrimary: "XMT",
			wantSecond:  "SKMT",
		},
		{
			name:        "arabic_mohammad",
			input:       "Mohammad",
			wantPrimary: "MHMT",
			wantSecond:  "MHMT",
		},
		{
			name:        "chinese_zhang",
			input:       "Zhang",
			wantPrimary: "SNK",
			wantSecond:  "SNK",
		},
		{
			name:        "spanish_gonzalez",
			input:       "Gonzalez",
			wantPrimary: "KNSLS",
			wantSecond:  "KNSLS",
		},
		{
			name:        "slavic_tchaikovsky",
			input:       "Tchaikovsky",
			wantPrimary: "XKFSK",
			wantSecond:  "XKFSK",
		},
		{
			name:        "english_smith",
			input:       "Smith",
			wantPrimary: "SM0",
			wantSecond:  "SMT",
		},
		{
			name:        "empty_input",
			input:       "",
			wantPrimary: "",
			wantSecond:  "",
		},
		{
			name:        "vietnamese_nguyen",
			input:       "Nguyen",
			wantPrimary: "NN",
			wantSecond:  "KN",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			pri, sec := DoubleMetaphone(tt.input)
			if pri != tt.wantPrimary {
				t.Errorf("primary = %q, want %q", pri, tt.wantPrimary)
			}
			if sec != tt.wantSecond {
				t.Errorf("secondary = %q, want %q", sec, tt.wantSecond)
			}
		})
	}
}

func TestDoubleMetaphonePrimarySecondaryDiffer(t *testing.T) {
	tests := []struct {
		name  string
		input string
	}{
		{"schmidt_differs", "Schmidt"},
		{"smith_differs", "Smith"},
		{"nguyen_differs", "Nguyen"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			pri, sec := DoubleMetaphone(tt.input)
			if pri == sec {
				t.Errorf("expected primary %q != secondary %q", pri, sec)
			}
		})
	}
}
