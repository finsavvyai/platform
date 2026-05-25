package screening

import "strings"

// hebrewToLatin maps Hebrew consonants to common Latin transliterations.
var hebrewToLatin = map[rune]string{
	'א': "a", 'ב': "b", 'ג': "g", 'ד': "d", 'ה': "h",
	'ו': "v", 'ז': "z", 'ח': "ch", 'ט': "t", 'י': "y",
	'כ': "k", 'ך': "k", 'ל': "l", 'מ': "m", 'ם': "m",
	'נ': "n", 'ן': "n", 'ס': "s", 'ע': "a", 'פ': "p",
	'ף': "f", 'צ': "ts", 'ץ': "ts", 'ק': "k", 'ר': "r",
	'ש': "sh", 'ת': "t",
}

// transliterateHebrew converts Hebrew script to approximate Latin.
func transliterateHebrew(s string) string {
	var b strings.Builder
	b.Grow(len(s))
	for _, r := range s {
		if latin, ok := hebrewToLatin[r]; ok {
			b.WriteString(latin)
		} else {
			b.WriteRune(r)
		}
	}
	return b.String()
}
