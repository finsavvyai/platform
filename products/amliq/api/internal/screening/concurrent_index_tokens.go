package screening

// tokenize extracts significant (length > 2) tokens from a name.
// Stop-word-free; works across any Latin-mapped script.
func tokenize(s string) []string {
	words := splitFields(normalizeExact(s))
	result := make([]string, 0, len(words))
	for _, w := range words {
		if len(w) > 2 {
			result = append(result, w)
		}
	}
	return result
}

// computeTrigrams returns all length-3 character windows, used for
// fuzzy-match recall. Short strings (< 3 runes) return nil.
func computeTrigrams(s string) []string {
	if len(s) < 3 {
		return nil
	}
	runes := []rune(s)
	tris := make([]string, 0, len(runes)-2)
	for i := 0; i <= len(runes)-3; i++ {
		tris = append(tris, string(runes[i:i+3]))
	}
	return tris
}

// splitFields splits on whitespace without the allocation pattern
// of strings.Fields. Hot path during indexing; worth the manual loop.
func splitFields(s string) []string {
	var fields []string
	start := -1
	for i, r := range s {
		if r == ' ' || r == '\t' || r == '\n' {
			if start >= 0 {
				fields = append(fields, s[start:i])
				start = -1
			}
		} else if start < 0 {
			start = i
		}
	}
	if start >= 0 {
		fields = append(fields, s[start:])
	}
	return fields
}
