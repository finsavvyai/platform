package screening

import (
	"strings"
	"unicode"
)

// cyrillicToLatin maps Cyrillic characters to common Latin transliterations.
var cyrillicToLatin = map[rune]string{
	'А': "a", 'Б': "b", 'В': "v", 'Г': "g", 'Д': "d",
	'Е': "e", 'Ё': "yo", 'Ж': "zh", 'З': "z", 'И': "i",
	'Й': "y", 'К': "k", 'Л': "l", 'М': "m", 'Н': "n",
	'О': "o", 'П': "p", 'Р': "r", 'С': "s", 'Т': "t",
	'У': "u", 'Ф': "f", 'Х': "kh", 'Ц': "ts", 'Ч': "ch",
	'Ш': "sh", 'Щ': "shch", 'Ъ': "", 'Ы': "y", 'Ь': "",
	'Э': "e", 'Ю': "yu", 'Я': "ya",
	'а': "a", 'б': "b", 'в': "v", 'г': "g", 'д': "d",
	'е': "e", 'ё': "yo", 'ж': "zh", 'з': "z", 'и': "i",
	'й': "y", 'к': "k", 'л': "l", 'м': "m", 'н': "n",
	'о': "o", 'п': "p", 'р': "r", 'с': "s", 'т': "t",
	'у': "u", 'ф': "f", 'х': "kh", 'ц': "ts", 'ч': "ch",
	'ш': "sh", 'щ': "shch", 'ъ': "", 'ы': "y", 'ь': "",
	'э': "e", 'ю': "yu", 'я': "ya",
}

// latinCyrillicVariants maps common Latin spellings of Russian names.
var latinCyrillicVariants = map[string][]string{
	"vladimir":  {"vladimir", "volodymyr", "wladimir"},
	"volodymyr": {"vladimir", "volodymyr", "wladimir"},
	"wladimir":  {"vladimir", "volodymyr", "wladimir"},
	"sergei":    {"sergei", "sergey", "sergiy"},
	"sergey":    {"sergei", "sergey", "sergiy"},
	"sergiy":    {"sergei", "sergey", "sergiy"},
	"dmitri":    {"dmitri", "dmitry", "dmitriy", "dmytro"},
	"dmitry":    {"dmitri", "dmitry", "dmitriy", "dmytro"},
	"aleksei":   {"aleksei", "alexei", "alexey", "oleksiy"},
	"alexei":    {"aleksei", "alexei", "alexey", "oleksiy"},
	"alexey":    {"aleksei", "alexei", "alexey", "oleksiy"},
	"yuri":      {"yuri", "yury", "yuriy"},
	"igor":      {"igor", "ihor"},
	"mikhail":   {"mikhail", "mikhailo", "mykhailo"},
	"nikolai":   {"nikolai", "nikolay", "mykola"},
	"andrei":    {"andrei", "andrey", "andriy"},
}

// NormalizeCyrillic transliterates Cyrillic to Latin and returns variants.
func NormalizeCyrillic(name string) []string {
	if IsCyrillicScript(name) {
		return []string{transliterateCyrillic(name)}
	}
	lower := strings.ToLower(strings.TrimSpace(name))
	for _, token := range strings.Fields(lower) {
		if variants, ok := latinCyrillicVariants[token]; ok {
			return variants
		}
	}
	return []string{lower}
}

// IsCyrillicScript returns true if the string contains Cyrillic characters.
func IsCyrillicScript(s string) bool {
	for _, r := range s {
		if unicode.Is(unicode.Cyrillic, r) {
			return true
		}
	}
	return false
}

func transliterateCyrillic(s string) string {
	var b strings.Builder
	b.Grow(len(s) * 2)
	for _, r := range s {
		if latin, ok := cyrillicToLatin[r]; ok {
			b.WriteString(latin)
		} else {
			b.WriteRune(r)
		}
	}
	return b.String()
}
