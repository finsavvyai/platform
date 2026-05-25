package screening

// jaccardStrings computes Jaccard similarity |A∩B| / |A∪B| on two
// string slices. Both-empty returns 1.0 (degenerate equal case);
// disjoint or either-empty returns 0.
func jaccardStrings(a, b []string) float64 {
	if len(a) == 0 && len(b) == 0 {
		return 1.0
	}
	set := make(map[string]struct{}, len(a))
	for _, s := range a {
		set[s] = struct{}{}
	}
	inter := 0
	for _, s := range b {
		if _, ok := set[s]; ok {
			inter++
		}
	}
	union := len(a) + len(b) - inter
	if union == 0 {
		return 0
	}
	return float64(inter) / float64(union)
}
