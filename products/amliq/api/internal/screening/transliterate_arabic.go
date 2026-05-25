package screening

import "strings"

// arabicToLatin maps Arabic consonants to common Latin transliterations.
var arabicToLatin = map[rune]string{
	'ا': "a", 'أ': "a", 'إ': "i", 'آ': "aa", 'ب': "b",
	'ت': "t", 'ث': "th", 'ج': "j", 'ح': "h", 'خ': "kh",
	'د': "d", 'ذ': "dh", 'ر': "r", 'ز': "z", 'س': "s",
	'ش': "sh", 'ص': "s", 'ض': "d", 'ط': "t", 'ظ': "z",
	'ع': "a", 'غ': "gh", 'ف': "f", 'ق': "q", 'ك': "k",
	'ل': "l", 'م': "m", 'ن': "n", 'ه': "h", 'و': "w",
	'ي': "y", 'ى': "a", 'ة': "a", 'ء': "",
}

// transliterateArabic converts Arabic script to approximate Latin.
func transliterateArabic(s string) string {
	s = stripArabicDiacritics(s)
	var b strings.Builder
	b.Grow(len(s))
	for _, r := range s {
		if latin, ok := arabicToLatin[r]; ok {
			b.WriteString(latin)
		} else {
			b.WriteRune(r)
		}
	}
	return b.String()
}
