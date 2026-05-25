package screening

import "testing"

func TestNormalizer(t *testing.T) {
	n := NewNormalizer()
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{"lowercase", "JOHN", "john"},
		{"whitespace", "john  doe", "john doe"},
		{"mixed", "JOHN  DOE", "john doe"},
		{"trim", "  john  ", "john"},
		{"empty", "", ""},
		{"space_only", "   ", ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := n.Normalize(tt.input)
			if got != tt.expected {
				t.Errorf("Normalize(%q) = %q, want %q", tt.input, got, tt.expected)
			}
		})
	}
}
