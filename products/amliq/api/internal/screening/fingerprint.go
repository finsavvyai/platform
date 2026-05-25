package screening

import (
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

// GenerateFingerprints computes all hash keys for an entity.
func GenerateFingerprints(e domain.Entity) []Fingerprint {
	if len(e.Names) == 0 {
		return nil
	}
	id := e.ID.String()
	fullName := e.Names[0].Full
	fps := make([]Fingerprint, 0, 12)

	// FP 1: normalized full name
	norm := normalizeExact(fullName)
	if norm != "" {
		fps = append(fps, Fingerprint{id, FPNormalized, norm})
	}

	// FP 2-5: phonetic codes per word
	fps = appendPhoneticFPs(fps, id, norm)

	// FP 6: sorted token pairs
	fps = appendTokenPairFPs(fps, id, norm)

	// FP 7: sorted initials
	if initials := buildInitials(norm); initials != "" {
		fps = append(fps, Fingerprint{id, FPInitials, initials})
	}

	// FP 8: reversed name order
	fps = appendReversedFP(fps, id, norm)

	// FP 9: transliteration variants
	fps = appendVariantFPs(fps, id, fullName)

	return fps
}

// GenerateQueryFingerprints computes fingerprints for a search query.
func GenerateQueryFingerprints(name string) []Fingerprint {
	dummy, _ := domain.NewEntityID("ent_query0000000")
	n, _ := domain.NewName(name, "", "", "")
	e := domain.Entity{ID: dummy, Names: []domain.Name{n}}
	return GenerateFingerprints(e)
}

func appendPhoneticFPs(fps []Fingerprint, id, norm string) []Fingerprint {
	words := strings.Fields(norm)
	for _, w := range words {
		if len(w) < 2 {
			continue
		}
		if sc := soundexCode(w); sc != "" {
			fps = append(fps, Fingerprint{id, FPSoundex, sc})
		}
		if mc := metaphoneCode(w); mc != "" {
			fps = append(fps, Fingerprint{id, FPMetaphone, mc})
		}
		pri, alt := DoubleMetaphone(w)
		if pri != "" {
			fps = append(fps, Fingerprint{id, FPDMPrimary, pri})
		}
		if alt != "" && alt != pri {
			fps = append(fps, Fingerprint{id, FPDMAlt, alt})
		}
	}
	return fps
}

