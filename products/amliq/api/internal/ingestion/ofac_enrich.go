package ingestion

import (
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

// setOFACEnrichFields extracts DOB, POB, nationality, passport, national ID, aliases
// from remarks/notes freetext (typically in col 12+).
func setOFACEnrichFields(ent *domain.Entity, rec []string) {
	if len(rec) <= 12 {
		return
	}
	remarks := strings.TrimSpace(rec[12])
	if remarks == "" {
		return
	}

	// Extract structured fields from remarks text
	extractOFACPassport(ent, remarks)
	extractOFACNationality(ent, remarks)
	extractOFACPOB(ent, remarks)
	extractOFACAliases(ent, remarks)

	// Store remarks as metadata
	setMeta(ent, "remarks", remarks)
}

func extractOFACPassport(ent *domain.Entity, remarks string) {
	// Pattern: "Passport XYZ123"
	idx := strings.Index(strings.ToLower(remarks), "passport")
	if idx == -1 {
		return
	}
	start := idx + len("passport")
	rest := strings.TrimSpace(remarks[start:])
	parts := strings.Fields(rest)
	if len(parts) > 0 {
		passport := parts[0]
		if passport != "" {
			id, _ := domain.NewIdentifier(domain.IDPassport, passport, "")
			ent.Identifiers = append(ent.Identifiers, id)
		}
	}
}

func extractOFACNationality(ent *domain.Entity, remarks string) {
	// Pattern: "Nationality: [Country]" or similar
	idx := strings.Index(strings.ToLower(remarks), "nationality")
	if idx == -1 {
		return
	}
	start := idx + len("nationality")
	rest := remarks[start:]
	// Skip past colon/comma/whitespace
	rest = strings.TrimSpace(strings.TrimPrefix(rest, ":"))
	rest = strings.TrimSpace(strings.TrimPrefix(rest, ","))
	// Take first word or phrase up to next punctuation
	if !strings.Contains(rest, ";") {
		addUnique(&ent.Nationalities, rest)
	} else {
		nat := strings.TrimSpace(strings.Split(rest, ";")[0])
		addUnique(&ent.Nationalities, nat)
	}
}

func extractOFACPOB(ent *domain.Entity, remarks string) {
	// Pattern: "POB [City, Country]"
	idx := strings.Index(strings.ToLower(remarks), "pob")
	if idx == -1 {
		return
	}
	start := idx + len("pob")
	rest := strings.TrimSpace(remarks[start:])
	// Take up to next semicolon or end
	if pos := strings.Index(rest, ";"); pos != -1 {
		rest = rest[:pos]
	}
	if rest != "" {
		setMeta(ent, "birth_place", rest)
	}
}

// extractOFACAliases is defined in ofac_enrich_aliases.go.
