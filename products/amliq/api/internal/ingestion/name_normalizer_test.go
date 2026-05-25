package ingestion

import "testing"

func TestNormalizeName(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "basic_latin",
			input:    "John Smith",
			expected: "John Smith",
		},
		{
			name:     "accented_chars",
			input:    "José García López",
			expected: "Jose Garcia Lopez",
		},
		{
			name:     "extra_whitespace",
			input:    "  John   David   Smith  ",
			expected: "John David Smith",
		},
		{
			name:     "special_chars_removed",
			input:    "John #Smith$ @Test",
			expected: "John Smith Test",
		},
		{
			name:     "preserved_punctuation",
			input:    "O'Brien, Jr.",
			expected: "O'Brien, Jr.",
		},
		{
			name:     "arabic_preserved",
			input:    "Mohammed " + string(rune(0x0645)) + "test",
			expected: "Mohammed \u0645test",
		},
		{
			name:     "empty_string",
			input:    "",
			expected: "",
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := NormalizeName(tc.input)
			if got != tc.expected {
				t.Errorf("NormalizeName(%q) = %q, want %q",
					tc.input, got, tc.expected)
			}
		})
	}
}

func TestTruncateBytes(t *testing.T) {
	tests := []struct {
		name string
		s    string
		max  int
		want int
	}{
		{"short", "hello", 10, 5},
		{"exact", "hello", 5, 5},
		{"truncated", "hello world", 5, 5},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := truncateBytes(tc.s, tc.max)
			if len(got) > tc.want {
				t.Errorf("truncateBytes len = %d, want <= %d",
					len(got), tc.want)
			}
		})
	}
}
