package screening

func levenshteinDistance(s1, s2 string) int {
	a, b := []rune(s1), []rune(s2)
	if len(a) == 0 {
		return len(b)
	}
	if len(b) == 0 {
		return len(a)
	}
	d := make([][]int, len(a)+1)
	for i := range d {
		d[i] = make([]int, len(b)+1)
		d[i][0] = i
	}
	for j := range d[0] {
		d[0][j] = j
	}
	for i := 1; i <= len(a); i++ {
		for j := 1; j <= len(b); j++ {
			cost := 1
			if a[i-1] == b[j-1] {
				cost = 0
			}
			d[i][j] = min(
				d[i-1][j]+1,
				min(d[i][j-1]+1, d[i-1][j-1]+cost),
			)
		}
	}
	return d[len(a)][len(b)]
}

func levenshteinSimilarity(s1, s2 string) float64 {
	maxLen := len(s1)
	if len(s2) > maxLen {
		maxLen = len(s2)
	}
	if maxLen == 0 {
		return 1.0
	}
	dist := levenshteinDistance(s1, s2)
	return 1.0 - (float64(dist) / float64(maxLen))
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
