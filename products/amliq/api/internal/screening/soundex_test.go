package screening

import "testing"

func TestSoundexCode(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{"smith", "Smith", "S530"},
		{"johnson", "Johnson", "J525"},
		{"robert", "Robert", "R163"},
		{"maria", "Maria", "M600"},
		{"empty", "", ""},
		{"single", "A", "A000"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := soundexCode(tt.input)
			if got != tt.expected {
				t.Errorf("soundexCode(%q) = %q, want %q", tt.input, got, tt.expected)
			}
		})
	}
}
