package screening

func jaroSimilarity(s1, s2 string) float64 {
	a, b := []rune(s1), []rune(s2)
	if len(a) == 0 && len(b) == 0 {
		return 1.0
	}
	if len(a) == 0 || len(b) == 0 {
		return 0.0
	}

	matchDistance := maxInt(len(a), len(b))/2 - 1
	if matchDistance < 1 {
		matchDistance = 1
	}

	aMatched := make([]bool, len(a))
	bMatched := make([]bool, len(b))
	matches := 0
	transpositions := 0

	for i := 0; i < len(a); i++ {
		start := i - matchDistance
		if start < 0 {
			start = 0
		}
		end := i + matchDistance + 1
		if end > len(b) {
			end = len(b)
		}
		for j := start; j < end; j++ {
			if bMatched[j] || a[i] != b[j] {
				continue
			}
			aMatched[i] = true
			bMatched[j] = true
			matches++
			break
		}
	}

	if matches == 0 {
		return 0.0
	}

	k := 0
	for i := 0; i < len(a); i++ {
		if !aMatched[i] {
			continue
		}
		for j := k; j < len(b); j++ {
			if bMatched[j] {
				if a[i] != b[j] {
					transpositions++
				}
				k = j + 1
				break
			}
		}
	}

	return (float64(matches)/float64(len(a)) +
		float64(matches)/float64(len(b)) +
		float64(matches-transpositions/2)/float64(matches)) / 3.0
}

func jaroWinklerSimilarity(s1, s2 string) float64 {
	jaro := jaroSimilarity(s1, s2)
	if jaro < 0.7 {
		return jaro
	}

	prefix := 0
	a, b := []rune(s1), []rune(s2)
	maxPrefix := minInt(len(a), len(b))
	if maxPrefix > 4 {
		maxPrefix = 4
	}

	for i := 0; i < maxPrefix; i++ {
		if a[i] == b[i] {
			prefix++
		} else {
			break
		}
	}

	return jaro + float64(prefix)*0.1*(1.0-jaro)
}
