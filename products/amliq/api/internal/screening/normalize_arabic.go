package screening

import (
	"strings"
	"unicode"
)

// arabicVariants maps Arabic words (in original script) to Latin transliterations.
var arabicVariants = map[string][]string{
	"محمد":  {"muhammad", "mohammad", "mohammed", "mohamad", "muhammed"},
	"علي":   {"ali", "aly"},
	"حسن":   {"hassan", "hasan"},
	"أحمد":  {"ahmed", "ahmad"},
	"عبد":   {"abd", "abdul", "abdel"},
	"الله":  {"allah"},
	"ابن":   {"ibn", "bin", "ben"},
}

// latinArabicVariants maps common Latin spellings to their variants.
var latinArabicVariants = map[string][]string{
	"muhammad": {"muhammad", "mohammad", "mohammed", "mohamad", "muhammed"},
	"mohammad": {"muhammad", "mohammad", "mohammed", "mohamad", "muhammed"},
	"mohammed": {"muhammad", "mohammad", "mohammed", "mohamad", "muhammed"},
	"mohamad":  {"muhammad", "mohammad", "mohammed", "mohamad", "muhammed"},
	"muhammed": {"muhammad", "mohammad", "mohammed", "mohamad", "muhammed"},
	"ali":      {"ali", "aly"},
	"aly":      {"ali", "aly"},
	"hassan":   {"hassan", "hasan"},
	"hasan":    {"hassan", "hasan"},
	"ahmed":    {"ahmed", "ahmad"},
	"ahmad":    {"ahmed", "ahmad"},
	"abd":      {"abd", "abdul", "abdel"},
	"abdul":    {"abd", "abdul", "abdel"},
	"abdel":    {"abd", "abdul", "abdel"},
	"ibn":      {"ibn", "bin", "ben"},
	"bin":      {"ibn", "bin", "ben"},
	"ben":      {"ibn", "bin", "ben"},
}

// NormalizeArabic returns transliteration variants for an Arabic name.
func NormalizeArabic(name string) []string {
	name = stripArabicDiacritics(name)
	name = normalizeDefiniteArticle(name)

	// Check if name contains Arabic script words
	for arabic, variants := range arabicVariants {
		if strings.Contains(name, arabic) {
			return variants
		}
	}

	// Check Latin transliterations
	lower := strings.ToLower(strings.TrimSpace(name))
	for _, token := range strings.Fields(lower) {
		if variants, ok := latinArabicVariants[token]; ok {
			return variants
		}
	}

	return []string{lower}
}

// stripArabicDiacritics removes tashkeel (Arabic diacritical marks).
func stripArabicDiacritics(s string) string {
	return strings.Map(func(r rune) rune {
		// Arabic diacritics range: U+0610-U+061A, U+064B-U+065F, U+0670
		if (r >= 0x0610 && r <= 0x061A) ||
			(r >= 0x064B && r <= 0x065F) ||
			r == 0x0670 {
			return -1
		}
		return r
	}, s)
}

// normalizeDefiniteArticle converts Arabic "ال" to "al-" prefix.
func normalizeDefiniteArticle(s string) string {
	s = strings.ReplaceAll(s, "ال", "al-")
	return s
}

// IsArabicScript returns true if the string contains Arabic characters.
func IsArabicScript(s string) bool {
	for _, r := range s {
		if unicode.Is(unicode.Arabic, r) {
			return true
		}
	}
	return false
}
