package screening

import "strings"

// SlimSearchResult holds a compact search result from the SlimIndex.
type SlimSearchResult struct {
	EntityID string
	Hits     int // number of matching codes
}

// Search finds entity IDs matching phonetic codes and name hash.
func (si *SlimIndex) Search(query string, limit int) []SlimSearchResult {
	si.mu.RLock()
	defer si.mu.RUnlock()

	if limit <= 0 {
		limit = 50
	}

	hitCount := make(map[uint32]int)

	norm := normalizeExact(query)
	if norm == "" {
		return nil
	}

	// Check exact normalized name hash (highest signal)
	h := hashName(norm)
	for _, off := range si.nameHash[h] {
		hitCount[off] += 10
	}

	// Check phonetic codes
	codes := slimPhoneticCodes(norm)
	for _, code := range codes {
		for _, off := range si.phonetic[code] {
			hitCount[off]++
		}
	}

	// Also check reversed name order
	words := strings.Fields(norm)
	if len(words) >= 2 {
		reversed := reverseWords(words)
		revCodes := slimPhoneticCodes(reversed)
		for _, code := range revCodes {
			for _, off := range si.phonetic[code] {
				hitCount[off]++
			}
		}
	}

	return si.topResults(hitCount, limit)
}

func (si *SlimIndex) topResults(
	hitCount map[uint32]int, limit int,
) []SlimSearchResult {
	results := make([]SlimSearchResult, 0, len(hitCount))
	for off, hits := range hitCount {
		results = append(results, SlimSearchResult{
			EntityID: si.idLookup[off],
			Hits:     hits,
		})
	}
	sortSlimResults(results)
	if len(results) > limit {
		results = results[:limit]
	}
	return results
}

func reverseWords(words []string) string {
	rev := make([]string, len(words))
	for i, w := range words {
		rev[len(words)-1-i] = w
	}
	return strings.Join(rev, " ")
}

func sortSlimResults(results []SlimSearchResult) {
	for i := 1; i < len(results); i++ {
		for j := i; j > 0 && results[j].Hits > results[j-1].Hits; j-- {
			results[j], results[j-1] = results[j-1], results[j]
		}
	}
}
