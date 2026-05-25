package actions

import (
	"strings"
	"testing"
)

func TestParseVersion_Valid(t *testing.T) {
	cases := []struct {
		in            string
		major, mi, pa int
	}{
		{"act version 0.2.87", 0, 2, 87},
		{"act version 1.10.5\n", 1, 10, 5},
		{"prefix\nact version 2.0.0\nsuffix", 2, 0, 0},
	}
	for _, tc := range cases {
		t.Run(tc.in, func(t *testing.T) {
			ma, mi, pa, err := parseVersion(tc.in)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if ma != tc.major || mi != tc.mi || pa != tc.pa {
				t.Errorf("got %d.%d.%d, want %d.%d.%d", ma, mi, pa, tc.major, tc.mi, tc.pa)
			}
		})
	}
}

func TestParseVersion_Invalid(t *testing.T) {
	cases := []string{
		"",
		"some other text",
		"act 0.2.87",       // missing "version"
		"act version v0.2", // missing patch
	}
	for _, in := range cases {
		t.Run(in, func(t *testing.T) {
			if _, _, _, err := parseVersion(in); err == nil {
				t.Errorf("expected error for %q", in)
			}
		})
	}
}

func TestInstallHint_MentionsBrew(t *testing.T) {
	hint := InstallHint()
	if !strings.Contains(hint, "brew install act") {
		t.Errorf("install hint should mention brew, got: %s", hint)
	}
	if !strings.Contains(hint, "act") {
		t.Errorf("install hint should mention act explicitly")
	}
}

func TestErrActMissing_IsSentinel(t *testing.T) {
	if ErrActMissing == nil {
		t.Fatal("ErrActMissing should be exported")
	}
	if ErrActMissing.Error() == "" {
		t.Error("ErrActMissing should have a message")
	}
}

func TestAtoi(t *testing.T) {
	cases := map[string]int{
		"0":   0,
		"1":   1,
		"42":  42,
		"100": 100,
	}
	for in, want := range cases {
		if got := atoi(in); got != want {
			t.Errorf("atoi(%q) = %d, want %d", in, got, want)
		}
	}
}
