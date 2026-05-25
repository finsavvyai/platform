package main

import "testing"

func TestParseExtendArgs(t *testing.T) {
	cases := []struct {
		name     string
		in       []string
		wantText string
		wantDry  bool
		wantYes  bool
	}{
		{"bare prompt", []string{"add", "e2e"}, "add e2e", false, false},
		{"dry-run", []string{"--dry-run", "cache", "deps"}, "cache deps", true, false},
		{"yes", []string{"--yes", "fix", "lint"}, "fix lint", false, true},
		{"short yes", []string{"-y", "add", "playwright"}, "add playwright", false, true},
		{"mixed", []string{"--dry-run", "add", "--yes", "step"}, "add step", true, true},
		{"empty", []string{}, "", false, false},
		{"only flags", []string{"--dry-run", "-y"}, "", true, true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got, f := parseExtendArgs(c.in)
			if got != c.wantText {
				t.Errorf("text: got %q, want %q", got, c.wantText)
			}
			if f.dryRun != c.wantDry {
				t.Errorf("dryRun: got %v, want %v", f.dryRun, c.wantDry)
			}
			if f.yes != c.wantYes {
				t.Errorf("yes: got %v, want %v", f.yes, c.wantYes)
			}
		})
	}
}

func TestHasAIProviderKey(t *testing.T) {
	// Clear all keys first
	keys := []string{"ANTHROPIC_API_KEY", "GROQ_API_KEY", "DEEPSEEK_API_KEY", "OPEN_AI_KEY", "OPENAI_API_KEY", "GEMINI_API_KEY"}
	for _, k := range keys {
		t.Setenv(k, "")
	}
	if hasAIProviderKey() {
		t.Fatal("expected false when no keys set")
	}
	t.Setenv("GROQ_API_KEY", "gsk_test")
	if !hasAIProviderKey() {
		t.Fatal("expected true when GROQ_API_KEY set")
	}
}
