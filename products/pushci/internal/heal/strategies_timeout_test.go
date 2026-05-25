package heal

import "testing"

func TestTimeoutFix(t *testing.T) {
	tests := []struct {
		name   string
		output string
		hasFix bool
	}{
		{"go timeout", "go test timed out after 30s", true},
		{"jest timeout", "jest timed out after 5000ms", true},
		{"deadline exceeded", "context deadline exceeded after 60s", true},
		{"no timeout", "all tests passed", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fix := timeoutFix(tt.output)
			if tt.hasFix && fix == nil {
				t.Error("expected fix")
			}
			if !tt.hasFix && fix != nil {
				t.Errorf("unexpected fix: %+v", fix)
			}
			if fix != nil && fix.Pattern != "timeout-increase" {
				t.Errorf("pattern = %q, want timeout-increase", fix.Pattern)
			}
		})
	}
}

func TestCalculateNewTimeout(t *testing.T) {
	tests := []struct {
		current int
		want    int
	}{
		{30, 60},
		{60, 120},
		{300, 600},
		{400, 600}, // capped at 600
	}
	for _, tt := range tests {
		got := calculateNewTimeout(tt.current)
		if got != tt.want {
			t.Errorf("calculateNewTimeout(%d) = %d, want %d", tt.current, got, tt.want)
		}
	}
}

func TestExtractTimeout(t *testing.T) {
	tests := []struct {
		output string
		want   int
	}{
		{"timeout: 30", 30},
		{"deadline exceeded 60", 60},
		{"some error", 30}, // default
	}
	for _, tt := range tests {
		got := extractTimeout(tt.output)
		if got != tt.want {
			t.Errorf("extractTimeout(%q) = %d, want %d", tt.output, got, tt.want)
		}
	}
}
