package main

// nearestFlag returns the closest known flag by Levenshtein
// distance, but only if the edit distance is <= 3 — prevents
// nonsense suggestions for totally unrelated typos. Used by
// validateFlags to power the "did you mean" hint.
func nearestFlag(input string, known []string) string {
	best := ""
	bestD := 4
	for _, k := range known {
		d := levenshtein(input, k)
		if d < bestD {
			bestD = d
			best = k
		}
	}
	return best
}

// levenshtein is a classic DP edit-distance implementation with
// rolling rows — O(len(a)*len(b)) time, O(len(b)) space. Small
// enough that we don't need the hot-path optimisations. Used
// exclusively for human-readable suggestions; never in a tight
// loop.
func levenshtein(a, b string) int {
	if a == b {
		return 0
	}
	la, lb := len(a), len(b)
	prev := make([]int, lb+1)
	cur := make([]int, lb+1)
	for j := 0; j <= lb; j++ {
		prev[j] = j
	}
	for i := 1; i <= la; i++ {
		cur[0] = i
		for j := 1; j <= lb; j++ {
			cost := 1
			if a[i-1] == b[j-1] {
				cost = 0
			}
			cur[j] = min3(prev[j]+1, cur[j-1]+1, prev[j-1]+cost)
		}
		prev, cur = cur, prev
	}
	return prev[lb]
}

func min3(a, b, c int) int {
	m := a
	if b < m {
		m = b
	}
	if c < m {
		m = c
	}
	return m
}
