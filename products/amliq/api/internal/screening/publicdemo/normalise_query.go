package publicdemo

import (
	"strings"

	"github.com/aegis-aml/aegis/internal/screening"
)

// expandQuery returns the raw query plus deterministic Latin-script
// variants for any non-Latin (Cyrillic or Arabic) input it detects.
// The raw query is always at index [0]; subsequent entries are
// transliterations and known-token alternates produced by the existing
// screening.Normalize* helpers. Output is de-duplicated and trims
// whitespace.
//
// The public-demo handler runs the engine cascade once per variant and
// merges results (see handler.runScreening + mergeMatches). The original
// query string is always echoed back as Response.Query — variants are
// internal expansion only.
func expandQuery(raw string) []string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}
	out := []string{raw}
	seen := map[string]struct{}{raw: {}}

	add := func(v string) {
		v = strings.TrimSpace(v)
		if v == "" {
			return
		}
		if _, dup := seen[v]; dup {
			return
		}
		seen[v] = struct{}{}
		out = append(out, v)
	}

	// Cyrillic-script input: rely on NormalizeCyrillic which returns
	// the Latin transliteration via transliterateCyrillic.
	if screening.IsCyrillicScript(raw) {
		for _, v := range screening.NormalizeCyrillic(raw) {
			add(v)
		}
	}
	// Arabic-script input: NormalizeArabic only handles diacritics +
	// the definite article ("ال" -> "al-") and does NOT transliterate
	// the bulk of the alphabet. Layer in TransliterateArabic against
	// both the raw input and NormalizeArabic's al--prefixed form so the
	// embedding layer sees a Latin-ish variant even for names outside
	// the curated arabicVariants table.
	if screening.IsArabicScript(raw) {
		normed := screening.NormalizeArabic(raw)
		for _, v := range normed {
			add(v)
			add(screening.TransliterateArabic(v))
		}
		add(screening.TransliterateArabic(raw))
	}
	// Latin input may still benefit from known-token spelling variants
	// (e.g. "Vladimir" -> {vladimir, volodymyr, wladimir}). These are
	// safe to apply unconditionally — NormalizeCyrillic/Arabic return
	// the input lowercased when no known token matches, which is then
	// de-duplicated by `add` above.
	if !screening.IsCyrillicScript(raw) && !screening.IsArabicScript(raw) {
		for _, v := range screening.NormalizeCyrillic(raw) {
			add(v)
		}
		for _, v := range screening.NormalizeArabic(raw) {
			add(v)
		}
	}
	return out
}
