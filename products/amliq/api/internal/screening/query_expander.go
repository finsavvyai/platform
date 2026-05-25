package screening

import "strings"

// ExpandedQuery holds the original name plus all generated variants.
type ExpandedQuery struct {
	Original string
	Variants []string
}

// ExpandQuery generates name variants for broader search coverage.
// Handles: reversed order, comma-reorder, Arabic, Hebrew, Cyrillic.
func ExpandQuery(name string) ExpandedQuery {
	eq := ExpandedQuery{Original: name}
	norm := normalizeExact(name)
	if norm == "" {
		return eq
	}

	// 1. Reversed word order
	words := strings.Fields(norm)
	if len(words) >= 2 {
		rev := reverseWords(words)
		if rev != norm {
			eq.Variants = append(eq.Variants, rev)
		}
	}

	// 2. Comma reorder: "PUTIN, Vladimir" → "Vladimir Putin"
	if strings.Contains(name, ",") {
		parts := strings.SplitN(name, ",", 2)
		if len(parts) == 2 {
			reordered := normalizeExact(
				strings.TrimSpace(parts[1]) + " " + strings.TrimSpace(parts[0]),
			)
			if reordered != norm {
				eq.Variants = append(eq.Variants, reordered)
			}
		}
	}

	// 3. Arabic transliteration variants
	eq.Variants = appendScriptVariants(eq.Variants, name, expandArabic)

	// 4. Hebrew transliteration variants
	eq.Variants = appendScriptVariants(eq.Variants, name, expandHebrew)

	// 5. Cyrillic transliteration variants
	eq.Variants = appendScriptVariants(eq.Variants, name, expandCyrillic)

	// 6. CJK (Chinese/Japanese/Korean) romanization variants
	eq.Variants = appendScriptVariants(eq.Variants, name, expandCJK)

	return eq
}

type variantFunc func(string) []string

func appendScriptVariants(
	variants []string, name string, fn variantFunc,
) []string {
	expanded := fn(name)
	for _, v := range expanded {
		norm := normalizeExact(v)
		if norm != "" && norm != normalizeExact(name) {
			variants = append(variants, norm)
		}
	}
	return variants
}

func expandArabic(name string) []string {
	return NormalizeArabic(name)
}

func expandHebrew(name string) []string {
	return NormalizeHebrew(name)
}

func expandCyrillic(name string) []string {
	return NormalizeCyrillic(name)
}

func expandCJK(name string) []string {
	return NormalizeCJK(name)
}
