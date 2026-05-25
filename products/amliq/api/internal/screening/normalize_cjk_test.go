package screening

import "testing"

func TestNormalizeCJK(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		wantAny string
	}{
		{
			name:    "pinyin zhang",
			input:   "Zhang Wei",
			wantAny: "chang",
		},
		{
			name:    "pinyin wang",
			input:   "Wang Li",
			wantAny: "wong",
		},
		{
			name:    "korean lee",
			input:   "Lee Jong",
			wantAny: "li",
		},
		{
			name:    "unknown name",
			input:   "Tanaka",
			wantAny: "tanaka",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			variants := NormalizeCJK(tt.input)
			found := false
			for _, v := range variants {
				if v == tt.wantAny {
					found = true
					break
				}
			}
			if !found {
				t.Errorf("NormalizeCJK(%q) = %v, want contains %q",
					tt.input, variants, tt.wantAny)
			}
		})
	}
}

func TestIsCJKScript(t *testing.T) {
	tests := []struct {
		input string
		want  bool
	}{
		{"习近平", true},
		{"Xi Jinping", false},
		{"김정은", true},
		{"田中太郎", true},
		{"", false},
	}
	for _, tt := range tests {
		got := IsCJKScript(tt.input)
		if got != tt.want {
			t.Errorf("IsCJKScript(%q) = %v, want %v",
				tt.input, got, tt.want)
		}
	}
}
