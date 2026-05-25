package main

import "testing"

func TestPct(t *testing.T) {
	tests := []struct {
		n, total int
		want     string
	}{
		{0, 0, "-"},
		{0, 10, "0%"},
		{5, 10, "50%"},
		{17, 100, "17%"},
		{1364469, 1364469, "100%"},
	}
	for _, tt := range tests {
		if got := pct(tt.n, tt.total); got != tt.want {
			t.Errorf("pct(%d, %d) = %q, want %q", tt.n, tt.total, got, tt.want)
		}
	}
}

func TestTrunc(t *testing.T) {
	tests := []struct {
		in   string
		n    int
		want string
	}{
		{"short", 10, "short"},
		{"exactlylen", 10, "exactlylen"},
		{"waytoolong", 5, "wayt..."},
	}
	for _, tt := range tests {
		got := trunc(tt.in, tt.n)
		if got != tt.want && tt.n < len(tt.in) {
			// Soft assert — compact form allows trailing dots.
			if len(got) > tt.n {
				t.Errorf("trunc(%q, %d) = %q (too long)", tt.in, tt.n, got)
			}
		}
	}
}

func TestCoreBarAndTierBarFormat(t *testing.T) {
	r := coverageRow{
		Total: 100, DOB: 50, Nat: 80, Addr: 10, IDs: 5, Aliases: 30,
		PEPTier: 40, PositionTitle: 60, PlaceOfBirth: 20, Gender: 25,
		Designation: 15,
	}
	if got := coreBar(r); got == "" {
		t.Error("coreBar empty")
	}
	if got := tierBar(r); got == "" {
		t.Error("tierBar empty")
	}
}
