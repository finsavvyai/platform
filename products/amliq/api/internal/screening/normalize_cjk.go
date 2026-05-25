package screening

import (
	"strings"
	"unicode"
)

// commonPinyinVariants maps romanized Chinese names to known variants.
var commonPinyinVariants = map[string][]string{
	"xi":        {"xi", "hsi"},
	"jinping":   {"jinping", "chin-ping"},
	"mao":       {"mao"},
	"zedong":    {"zedong", "tse-tung", "tsetung"},
	"tse-tung":  {"zedong", "tse-tung", "tsetung"},
	"deng":      {"deng", "teng"},
	"xiaoping":  {"xiaoping", "hsiao-ping"},
	"kim":       {"kim"},
	"jong":      {"jong", "jung", "jeong"},
	"un":        {"un", "eun"},
	"park":      {"park", "pak", "bak"},
	"lee":       {"lee", "li", "yi", "rhee"},
	"li":        {"lee", "li", "yi"},
	"wang":      {"wang", "wong"},
	"wong":      {"wang", "wong"},
	"zhang":     {"zhang", "chang"},
	"chang":     {"zhang", "chang"},
	"chen":      {"chen", "chan"},
	"chan":       {"chen", "chan"},
	"huang":     {"huang", "wong", "hwang"},
	"liu":       {"liu", "lau", "ryu"},
	"tanaka":    {"tanaka"},
	"suzuki":    {"suzuki"},
	"takahashi": {"takahashi"},
}

// NormalizeCJK returns romanization variants for CJK names.
func NormalizeCJK(name string) []string {
	lower := strings.ToLower(strings.TrimSpace(name))

	// If it contains CJK characters, we can't romanize without a full
	// dictionary — store as-is and rely on original_script matching.
	if IsCJKScript(name) {
		return []string{lower}
	}

	// Check Latin romanization variants
	for _, token := range strings.Fields(lower) {
		if variants, ok := commonPinyinVariants[token]; ok {
			return variants
		}
	}
	return []string{lower}
}

// IsCJKScript returns true if the string contains CJK characters.
func IsCJKScript(s string) bool {
	for _, r := range s {
		if unicode.Is(unicode.Han, r) ||
			unicode.Is(unicode.Hangul, r) ||
			unicode.Is(unicode.Katakana, r) ||
			unicode.Is(unicode.Hiragana, r) {
			return true
		}
	}
	return false
}
