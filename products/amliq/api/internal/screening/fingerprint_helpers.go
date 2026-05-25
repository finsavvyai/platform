package screening

import (
	"sort"
	"strings"
)

func appendTokenPairFPs(fps []Fingerprint, id, norm string) []Fingerprint {
	words := strings.Fields(norm)
	if len(words) < 2 {
		return fps
	}
	sorted := make([]string, len(words))
	copy(sorted, words)
	sort.Strings(sorted)
	for i := 0; i < len(sorted)-1 && i < 3; i++ {
		for j := i + 1; j < len(sorted) && j < 4; j++ {
			pair := sorted[i] + "+" + sorted[j]
			fps = append(fps, Fingerprint{id, FPTokenPair, pair})
		}
	}
	return fps
}

func buildInitials(norm string) string {
	words := strings.Fields(norm)
	if len(words) < 2 {
		return ""
	}
	initials := make([]byte, 0, len(words))
	for _, w := range words {
		if len(w) > 0 {
			initials = append(initials, w[0])
		}
	}
	sort.Slice(initials, func(i, j int) bool { return initials[i] < initials[j] })
	return string(initials)
}
