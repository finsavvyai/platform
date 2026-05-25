package screening

import "strings"

// slimPhoneticCodes returns a minimal set of phonetic codes for in-memory use.
// Only Soundex + Double Metaphone primary per word (not full phoneticCodes).
func slimPhoneticCodes(norm string) []string {
	words := strings.Fields(norm)
	codes := make([]string, 0, len(words)*2)
	for _, w := range words {
		if len(w) < 2 {
			continue
		}
		if sc := soundexCode(w); sc != "" {
			codes = append(codes, "sx:"+sc)
		}
		pri, _ := DoubleMetaphone(w)
		if pri != "" {
			codes = append(codes, "dm:"+pri)
		}
	}
	return codes
}
