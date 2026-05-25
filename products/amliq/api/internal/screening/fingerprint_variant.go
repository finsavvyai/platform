package screening

import "strings"

// appendReversedFP adds a reversed name-order fingerprint.
func appendReversedFP(fps []Fingerprint, id, norm string) []Fingerprint {
	words := strings.Fields(norm)
	if len(words) < 2 {
		return fps
	}
	reversed := make([]string, len(words))
	for i, w := range words {
		reversed[len(words)-1-i] = w
	}
	rev := strings.Join(reversed, " ")
	if rev != norm {
		fps = append(fps, Fingerprint{id, FPReversed, rev})
	}
	return fps
}

// appendVariantFPs adds transliteration variant fingerprints.
func appendVariantFPs(fps []Fingerprint, id, fullName string) []Fingerprint {
	lower := strings.ToLower(strings.TrimSpace(fullName))

	// Native script transliteration (Arabic, Hebrew, Cyrillic)
	fps = appendScriptTranslit(fps, id, fullName)

	// Latin variant expansion for all scripts
	fps = appendLatinVariants(fps, id, lower, latinArabicVariants)
	fps = appendLatinVariants(fps, id, lower, latinHebrewMap)
	if !IsCyrillicScript(fullName) {
		fps = appendLatinVariants(fps, id, lower, latinCyrillicVariants)
	}
	fps = appendLatinVariants(fps, id, lower, commonPinyinVariants)

	// Comma-reorder: "PUTIN, Vladimir" → "vladimir putin"
	fps = appendCommaReorder(fps, id, fullName)
	return fps
}

func appendScriptTranslit(fps []Fingerprint, id, name string) []Fingerprint {
	if IsArabicScript(name) {
		if l := normalizeExact(transliterateArabic(name)); l != "" {
			fps = append(fps, Fingerprint{id, FPVariant, l})
		}
	}
	if IsHebrewScript(name) {
		if l := normalizeExact(transliterateHebrew(name)); l != "" {
			fps = append(fps, Fingerprint{id, FPVariant, l})
		}
	}
	if IsCyrillicScript(name) {
		if l := normalizeExact(transliterateCyrillic(name)); l != "" {
			fps = append(fps, Fingerprint{id, FPVariant, l})
		}
	}
	return fps
}

func appendLatinVariants(
	fps []Fingerprint, id, lower string, vmap map[string][]string,
) []Fingerprint {
	for _, token := range strings.Fields(lower) {
		if variants, ok := vmap[token]; ok {
			for _, v := range variants {
				if v != token {
					fps = append(fps, Fingerprint{id, FPVariant, v})
				}
			}
			return fps
		}
	}
	return fps
}

func appendCommaReorder(fps []Fingerprint, id, name string) []Fingerprint {
	if !strings.Contains(name, ",") {
		return fps
	}
	parts := strings.SplitN(name, ",", 2)
	if len(parts) != 2 {
		return fps
	}
	reordered := normalizeExact(
		strings.TrimSpace(parts[1]) + " " + strings.TrimSpace(parts[0]),
	)
	if reordered != normalizeExact(name) {
		fps = append(fps, Fingerprint{id, FPVariant, reordered})
	}
	return fps
}
