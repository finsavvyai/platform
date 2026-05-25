package ai

import (
	"strings"
	"testing"
)

func TestTruncateForAPIShort(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string
	}{
		{"empty", "", ""},
		{"short", "hello", "hello"},
		{"exact 1500", strings.Repeat("a", 1500), strings.Repeat("a", 1500)},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := truncateForAPI(tt.input); got != tt.want {
				t.Errorf("truncateForAPI len=%d, want len=%d", len(got), len(tt.want))
			}
		})
	}
}

func TestTruncateForAPILong(t *testing.T) {
	input := strings.Repeat("x", 2000)
	got := truncateForAPI(input)
	if len(got) != 1500 {
		t.Errorf("len = %d, want 1500", len(got))
	}
	// Should keep the tail (last 1500 chars)
	if got != input[500:] {
		t.Error("truncated string should be the last 1500 chars")
	}
}

func TestTruncateForAPIPreservesTail(t *testing.T) {
	// Build a string with distinct head and tail
	head := strings.Repeat("H", 1000)
	tail := strings.Repeat("T", 1000)
	input := head + tail
	got := truncateForAPI(input)
	if !strings.HasSuffix(got, strings.Repeat("T", 1000)) {
		t.Error("should preserve the tail of the string")
	}
	if strings.Contains(got, strings.Repeat("H", 600)) {
		t.Error("should have truncated most of the head")
	}
}

func TestConvertSystemPromptContainsFormat(t *testing.T) {
	if !strings.Contains(convertSystem, "PushCI") {
		t.Error("convert system prompt should mention PushCI")
	}
}

func TestExplainSystemPromptFormat(t *testing.T) {
	if !strings.Contains(explainSystem, "DIAGNOSIS") {
		t.Error("explain system prompt should contain DIAGNOSIS")
	}
	if !strings.Contains(explainSystem, "FIX") {
		t.Error("explain system prompt should contain FIX")
	}
}
