package screening

import "testing"

func TestNormalizeCyrillic(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		wantAny string
	}{
		{
			name:    "cyrillic script",
			input:   "Владимир Путин",
			wantAny: "vladimir putin",
		},
		{
			name:    "latin vladimir",
			input:   "Vladimir",
			wantAny: "volodymyr",
		},
		{
			name:    "latin sergei",
			input:   "Sergei",
			wantAny: "sergey",
		},
		{
			name:    "unknown latin",
			input:   "Unknown",
			wantAny: "unknown",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			variants := NormalizeCyrillic(tt.input)
			found := false
			for _, v := range variants {
				if v == tt.wantAny {
					found = true
					break
				}
			}
			if !found {
				t.Errorf("NormalizeCyrillic(%q) = %v, want contains %q",
					tt.input, variants, tt.wantAny)
			}
		})
	}
}

func TestIsCyrillicScript(t *testing.T) {
	tests := []struct {
		input string
		want  bool
	}{
		{"Путин", true},
		{"Putin", false},
		{"Владимир Putin", true},
		{"", false},
	}
	for _, tt := range tests {
		got := IsCyrillicScript(tt.input)
		if got != tt.want {
			t.Errorf("IsCyrillicScript(%q) = %v, want %v",
				tt.input, got, tt.want)
		}
	}
}

func TestTransliterateCyrillic(t *testing.T) {
	got := transliterateCyrillic("Путин")
	want := "putin"
	if got != want {
		t.Errorf("transliterateCyrillic(Путин) = %q, want %q", got, want)
	}
}
