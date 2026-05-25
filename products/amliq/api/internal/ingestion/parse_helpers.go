package ingestion

import "strings"

// norm trims whitespace from a string.
func norm(s string) string { return strings.TrimSpace(s) }

// addUnique appends val to slice if non-empty and not already present.
func addUnique(slice *[]string, val string) {
	if val == "" {
		return
	}
	for _, existing := range *slice {
		if existing == val {
			return
		}
	}
	*slice = append(*slice, val)
}

// pickFirst returns current if non-empty, else candidate.
func pickFirst(current, candidate string) string {
	if current == "" {
		return candidate
	}
	return current
}

// minDateStr returns the earlier of two date strings (lexicographic).
func minDateStr(a, b string) string {
	if a == "" {
		return b
	}
	if b == "" {
		return a
	}
	if a <= b {
		return a
	}
	return b
}

// nonEmpty returns s if non-empty, else fallback.
func nonEmpty(s, fallback string) string {
	if s == "" {
		return fallback
	}
	return s
}

// firstOf returns the first element of a slice, or empty string.
func firstOf(slice []string) string {
	if len(slice) > 0 {
		return slice[0]
	}
	return ""
}

// firstNonEmptyStr returns the first non-empty trimmed string.
func firstNonEmptyStr(vals ...string) string {
	for _, v := range vals {
		if s := strings.TrimSpace(v); s != "" {
			return s
		}
	}
	return ""
}

// joinSemi joins non-empty strings with "; " separator.
func joinSemi(parts ...string) string {
	var out []string
	for _, p := range parts {
		if p != "" {
			out = append(out, p)
		}
	}
	return strings.Join(out, "; ")
}

// containsLatinLetter returns true if s has at least one Latin letter.
func containsLatinLetter(s string) bool {
	for _, r := range s {
		if (r >= 'A' && r <= 'Z') || (r >= 'a' && r <= 'z') {
			return true
		}
	}
	return false
}

// stripBOM removes UTF-8 BOM from data if present.
func stripBOM(data []byte) []byte {
	if len(data) >= 3 &&
		data[0] == 0xEF && data[1] == 0xBB && data[2] == 0xBF {
		return data[3:]
	}
	return data
}
