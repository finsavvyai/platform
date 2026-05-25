package ingestion

// headerIndex maps column names to their position in a CSV header.
type headerIndex map[string]int

// buildHeaderIndex creates a lookup from header row values.
func buildHeaderIndex(header []string) headerIndex {
	idx := make(headerIndex, len(header))
	for i, h := range header {
		if _, exists := idx[h]; !exists {
			idx[h] = i // keep first occurrence
		}
	}
	return idx
}

// get returns the value for the first matching column name found.
// Returns empty string if none of the candidates exist or the
// record is too short.
func (h headerIndex) get(record []string, names ...string) string {
	for _, name := range names {
		if i, ok := h[name]; ok && i < len(record) {
			return record[i]
		}
	}
	return ""
}

// has returns true if any of the given column names exist.
func (h headerIndex) has(names ...string) bool {
	for _, name := range names {
		if _, ok := h[name]; ok {
			return true
		}
	}
	return false
}
