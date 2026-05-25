package cli

import "testing"

func TestColorWrappers(t *testing.T) {
	tests := []struct {
		name string
		fn   func(string) string
		want string
	}{
		{"Green", Green, "\033[32mhi\033[0m"},
		{"Red", Red, "\033[31mhi\033[0m"},
		{"Yellow", Yellow, "\033[33mhi\033[0m"},
		{"Blue", Blue, "\033[34mhi\033[0m"},
		{"Bold", Bold, "\033[1mhi\033[0m"},
		{"Dim", Dim, "\033[2mhi\033[0m"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := tt.fn("hi")
			if got != tt.want {
				t.Errorf("%s(\"hi\") = %q, want %q", tt.name, got, tt.want)
			}
		})
	}
}

func TestMarks(t *testing.T) {
	tests := []struct {
		name string
		fn   func() string
	}{
		{"CheckMark", CheckMark},
		{"CrossMark", CrossMark},
		{"Dot", Dot},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.fn(); got == "" {
				t.Errorf("%s() returned empty", tt.name)
			}
		})
	}
}

func TestProgressBar(t *testing.T) {
	tests := []struct {
		current, total int
		label          string
	}{
		{0, 10, "test"},
		{5, 10, "half"},
		{10, 10, "done"},
	}
	for _, tt := range tests {
		got := ProgressBar(tt.current, tt.total, tt.label)
		if got == "" {
			t.Errorf("ProgressBar(%d,%d,%s) empty", tt.current, tt.total, tt.label)
		}
	}
}
