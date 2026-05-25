package updater

import "testing"

func TestIsNewer(t *testing.T) {
	cases := []struct {
		latest, current string
		want            bool
	}{
		// Happy-path upgrades
		{"1.4.1", "1.4.0", true},
		{"1.5.0", "1.4.9", true},
		{"2.0.0", "1.99.99", true},

		// Same or older — never prompt
		{"1.4.1", "1.4.1", false},
		{"1.4.0", "1.4.1", false},
		{"1.3.0", "1.4.0", false},

		// v-prefixed forms
		{"v1.4.1", "1.4.0", true},
		{"1.4.1", "v1.4.0", true},
		{"v1.4.1", "v1.4.0", true},

		// Pre-release / build metadata is stripped
		{"1.4.1", "1.4.1-rc.2", false},
		{"1.4.1-rc.2", "1.4.1", false},
		{"1.4.1+sha.abc", "1.4.0", true},

		// Malformed → refuse to nag
		{"", "1.4.1", false},
		{"not-a-version", "1.4.1", false},
		{"1.4.1", "", false},
		{"1.4", "1.3", true}, // two-component still parses
	}
	for _, tc := range cases {
		t.Run(tc.latest+"_vs_"+tc.current, func(t *testing.T) {
			got := isNewer(tc.latest, tc.current)
			if got != tc.want {
				t.Errorf("isNewer(%q, %q) = %v, want %v", tc.latest, tc.current, got, tc.want)
			}
		})
	}
}

func TestParseSemver(t *testing.T) {
	cases := map[string][]int{
		"1.4.1":         {1, 4, 1},
		"v1.4.1":        {1, 4, 1},
		"1.4.1-rc.2":    {1, 4, 1},
		"1.4.1+sha.abc": {1, 4, 1},
		"2.0":           {2, 0, 0},
		"10.20.30":      {10, 20, 30},
	}
	for in, want := range cases {
		got := parseSemver(in)
		if got == nil {
			t.Errorf("parseSemver(%q) = nil, want %v", in, want)
			continue
		}
		for i := 0; i < 3; i++ {
			if got[i] != want[i] {
				t.Errorf("parseSemver(%q)[%d] = %d, want %d", in, i, got[i], want[i])
			}
		}
	}

	// Invalid inputs
	for _, in := range []string{"", "abc", "1.x.3", "1..3"} {
		if got := parseSemver(in); got != nil {
			t.Errorf("parseSemver(%q) = %v, want nil", in, got)
		}
	}
}

func TestIsDevBuild(t *testing.T) {
	devCases := []string{"", "dev", "unknown", "1.4.1-dev", "1.4.1-dirty", "snapshot-snapshot"}
	for _, v := range devCases {
		if !isDevBuild(v) {
			t.Errorf("isDevBuild(%q) = false, want true", v)
		}
	}
	realCases := []string{"1.4.1", "v1.4.1", "1.4.1-rc.2", "2.0.0"}
	for _, v := range realCases {
		if isDevBuild(v) {
			t.Errorf("isDevBuild(%q) = true, want false", v)
		}
	}
}
