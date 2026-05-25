package ingestion

import "strings"

// unJoinFamily combines the UN SECOND_NAME / THIRD_NAME / FOURTH_NAME
// fields (which together form the family portion in UN notation)
// into a single family-name string.
func unJoinFamily(parts ...string) string {
	var out []string
	for _, p := range parts {
		if s := strings.TrimSpace(p); s != "" {
			out = append(out, s)
		}
	}
	return strings.Join(out, " ")
}
