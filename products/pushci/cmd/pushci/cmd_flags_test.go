package main

import (
	"strings"
	"testing"
)

func TestValidateFlags_AcceptsKnown(t *testing.T) {
	specs := []FlagSpec{
		{Long: "--dry-run", Aliases: []string{"-n"}},
		{Long: "--stage", Aliases: []string{"-s"}, Takes: true},
	}
	if err := validateFlags("run", []string{"--dry-run", "--stage", "test"}, specs); err != nil {
		t.Fatalf("known flags should pass, got: %v", err)
	}
	if err := validateFlags("run", []string{"-n", "-s=test"}, specs); err != nil {
		t.Fatalf("aliases + = form should pass, got: %v", err)
	}
}

func TestValidateFlags_RejectsUnknownWithSuggestion(t *testing.T) {
	specs := []FlagSpec{{Long: "--dry-run"}}
	err := validateFlags("run", []string{"--drr-run"}, specs)
	if err == nil {
		t.Fatal("expected error for typo")
	}
	if !strings.Contains(err.Error(), "--dry-run") {
		t.Errorf("want suggestion for --dry-run, got: %v", err)
	}
}

func TestValidateFlags_TakesValueSkipsNextArg(t *testing.T) {
	// --stage takes a value. The value "--drr-run" should NOT be
	// treated as a flag — it's the value.
	specs := []FlagSpec{{Long: "--stage", Takes: true}}
	if err := validateFlags("run", []string{"--stage", "--drr-run"}, specs); err != nil {
		t.Errorf("value after --stage should not be parsed as flag: %v", err)
	}
}

func TestNearestFlag_NoMatchForWildlyDifferent(t *testing.T) {
	known := []string{"--dry-run", "--stage"}
	if got := nearestFlag("--potatoes-in-the-engine", known); got != "" {
		t.Errorf("no suggestion expected for unrelated typo, got %q", got)
	}
}

func TestLevenshtein_Basic(t *testing.T) {
	cases := []struct {
		a, b string
		want int
	}{
		{"--dry-run", "--dry-run", 0},
		{"--drr-run", "--dry-run", 1},
		{"--verbose", "--verbos", 1},
	}
	for _, c := range cases {
		if got := levenshtein(c.a, c.b); got != c.want {
			t.Errorf("levenshtein(%q,%q) = %d, want %d", c.a, c.b, got, c.want)
		}
	}
}
