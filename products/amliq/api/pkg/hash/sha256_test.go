package hash

import "testing"

func TestSHA256(t *testing.T) {
	tests := []struct {
		name     string
		data     []byte
		expected string
	}{
		{
			name:     "empty",
			data:     []byte(""),
			expected: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
		},
		{
			name:     "simple",
			data:     []byte("hello"),
			expected: "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := SHA256(tt.data)
			if got != tt.expected {
				t.Errorf("SHA256() = %s, want %s", got, tt.expected)
			}
		})
	}
}

func TestSHA256String(t *testing.T) {
	got := SHA256String("test")
	if len(got) != 64 {
		t.Errorf("SHA256String() returned wrong length: %d", len(got))
	}
}
