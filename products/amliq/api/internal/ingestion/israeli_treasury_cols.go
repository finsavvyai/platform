package ingestion

import "strings"

// findCol returns the first header index matching any keyword,
// or -1. Case-insensitive substring match.
func findCol(hdr []string, keywords ...string) int {
	for i, cell := range hdr {
		lower := strings.ToLower(cell)
		for _, kw := range keywords {
			if strings.Contains(lower, kw) {
				return i
			}
		}
	}
	return -1
}

// findFirstNonEmpty scans the first few rows for one with at least
// minCols columns and returns 0 (the first column) if found, -1 otherwise.
func findFirstNonEmpty(rows [][]string, minCols int) int {
	for i := 0; i < len(rows) && i < 5; i++ {
		if len(rows[i]) >= minCols {
			return 0
		}
	}
	return -1
}
