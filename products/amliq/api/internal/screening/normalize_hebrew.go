package screening

import (
	"strings"
	"unicode"
)

// hebrewVariants maps Hebrew words to Latin transliterations.
var hebrewVariants = map[string][]string{
	"בנימין":   {"binyamin", "benjamin"},
	"נתניהו":   {"netanyahu", "nethanyahu"},
	"ישראל":    {"israel", "yisrael"},
	"חמאס":     {"hamas", "khamas"},
	"חיזבאללה": {"hezbollah", "hizbullah", "hizballah"},
	"משה":      {"moshe", "moses"},
	"דוד":      {"david", "daveed"},
	"יעקב":     {"yaakov", "jacob"},
}

// hebrewLetterVariants maps Hebrew consonants with ambiguous transliteration.
var hebrewLetterVariants = map[rune][]string{
	'ח': {"ch", "kh", "h"},
	'כ': {"k", "kh"},
	'צ': {"ts", "tz"},
	'ש': {"sh", "s"},
	'ת': {"t", "th"},
	'ו': {"v", "w", "u", "o"},
	'ע': {"a", "e", ""},
}

// NormalizeHebrew returns transliteration variants for a Hebrew name.
func NormalizeHebrew(name string) []string {
	name = strings.TrimSpace(name)

	// Check for known Hebrew words
	for hebrew, variants := range hebrewVariants {
		if strings.Contains(name, hebrew) {
			return variants
		}
	}

	// If it contains Hebrew script, generate letter-based variants
	if IsHebrewScript(name) {
		return hebrewLetterExpand(name)
	}

	// Latin input: check known Latin mappings
	lower := strings.ToLower(name)
	return latinHebrewExpand(lower)
}

// hebrewLetterExpand generates basic variants from Hebrew consonants.
func hebrewLetterExpand(s string) []string {
	var result []string
	for r, variants := range hebrewLetterVariants {
		if strings.ContainsRune(s, r) {
			if len(result) == 0 {
				result = append(result, variants...)
			} else {
				result = append(result, variants...)
			}
		}
	}
	if len(result) == 0 {
		return []string{strings.ToLower(s)}
	}
	return result
}

// latinHebrewExpand maps Latin Hebrew transliterations to variants.
var latinHebrewMap = map[string][]string{
	"binyamin":   {"binyamin", "benjamin"},
	"benjamin":   {"binyamin", "benjamin"},
	"netanyahu":  {"netanyahu", "nethanyahu"},
	"nethanyahu": {"netanyahu", "nethanyahu"},
	"hezbollah":  {"hezbollah", "hizbullah", "hizballah"},
	"hizbullah":  {"hezbollah", "hizbullah", "hizballah"},
	"hizballah":  {"hezbollah", "hizbullah", "hizballah"},
}

func latinHebrewExpand(name string) []string {
	lower := strings.ToLower(strings.TrimSpace(name))
	for _, token := range strings.Fields(lower) {
		if variants, ok := latinHebrewMap[token]; ok {
			return variants
		}
	}
	return []string{lower}
}

// IsHebrewScript returns true if the string contains Hebrew characters.
func IsHebrewScript(s string) bool {
	for _, r := range s {
		if unicode.Is(unicode.Hebrew, r) {
			return true
		}
	}
	return false
}
