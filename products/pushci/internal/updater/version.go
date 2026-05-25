package updater

import (
	"strconv"
	"strings"
)

// isNewer reports whether latest is a strictly higher semver than
// current. Both values may be prefixed with "v" — we strip that
// before parsing. Pre-release suffixes (-rc.1, -beta) are treated
// as equal to their base version for comparison purposes: we
// never ask a user to "upgrade" from 1.4.1 to 1.4.1-rc.2.
//
// We don't pull in golang.org/x/mod/semver for this — the update
// check is a single cold comparison of two dotted-int strings and
// adding a dep for six lines of arithmetic is worse than the six
// lines themselves.
func isNewer(latest, current string) bool {
	l := parseSemver(latest)
	c := parseSemver(current)
	if l == nil || c == nil {
		return false
	}
	for i := 0; i < 3; i++ {
		if l[i] != c[i] {
			return l[i] > c[i]
		}
	}
	return false
}

// parseSemver turns "v1.4.1" / "1.4.1" / "1.4.1-rc.2" / "1.4" into a
// [major, minor, patch] int slice. Returns nil if the input doesn't
// parse — callers treat that as "can't compare, skip the banner".
func parseSemver(s string) []int {
	if s == "" {
		return nil
	}
	s = strings.TrimPrefix(s, "v")
	// Drop pre-release / build metadata. "1.4.1-rc.2" → "1.4.1",
	// "1.4.1+sha.abc" → "1.4.1".
	if idx := strings.IndexAny(s, "-+"); idx >= 0 {
		s = s[:idx]
	}
	parts := strings.Split(s, ".")
	out := make([]int, 3)
	for i := 0; i < 3; i++ {
		if i >= len(parts) {
			out[i] = 0
			continue
		}
		n, err := strconv.Atoi(parts[i])
		if err != nil {
			return nil
		}
		out[i] = n
	}
	return out
}

// isDevBuild returns true when the binary reports a development
// version string. Dev builds should never show the upgrade banner
// — the whole point of a dev build is that it's ahead of what's
// published, so there's nothing to upgrade to.
func isDevBuild(current string) bool {
	if current == "" || current == "dev" || current == "unknown" {
		return true
	}
	return strings.HasSuffix(current, "-dev") ||
		strings.HasSuffix(current, "-dirty") ||
		strings.Contains(current, "-snapshot")
}
