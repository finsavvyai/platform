package ingestion

import (
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

// enrichPEPFromProps pulls richer fields out of the properties JSON blob.
// Called after enrichPEPFromRow populates direct columns. Populates
// both metadata (legacy) and the first-class enrichment columns added
// in migration 067.
func enrichPEPFromProps(
	ent *domain.Entity, props map[string][]string,
) {
	if ent.DOB == nil {
		if dob := firstSlice(props["birthDate"]); dob != "" {
			setMeta(ent, "dob", dob)
			parseDOB(ent, dob)
		}
	}
	gender := firstSlice(props["gender"])
	birthPlace := firstSlice(props["birthPlace"])
	position := firstSlice(props["position"])

	setMeta(ent, "gender", gender)
	setMeta(ent, "birth_place", birthPlace)
	setMeta(ent, "birth_country", firstSlice(props["birthCountry"]))
	setMeta(ent, "position", position)
	setMeta(ent, "summary", firstSlice(props["summary"]))
	setMeta(ent, "topics", joinSemi(props["topics"]...))

	// Promote to first-class columns (migration 067).
	if ent.Gender == "" {
		ent.Gender = gender
	}
	if ent.PlaceOfBirth == "" {
		ent.PlaceOfBirth = birthPlace
	}
	if ent.PositionTitle == "" {
		ent.PositionTitle = position
	}

	// Prefer the keyword-based classifier (captures Tier1..4) when we
	// have a position string; otherwise fall back to topics-based
	// SANCTION/PEP tagging.
	schema, _ := ent.Metadata["schemaType"].(string)
	if position != "" && ent.PEPTier == domain.PEPTierNone {
		ent.PEPTier = classifyPEPTier(position, schema)
	}
	setPepTier(ent, props["topics"])

	for _, c := range props["nationality"] {
		addUnique(&ent.Nationalities, strings.TrimSpace(c))
	}
}

// splitMulti splits a semicolon/comma-delimited cell into trimmed tokens.
func splitMulti(s string) []string {
	if s == "" {
		return nil
	}
	sep := ";"
	if !strings.Contains(s, ";") && strings.Contains(s, ",") {
		sep = ","
	}
	parts := strings.Split(s, sep)
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if t := strings.TrimSpace(p); t != "" {
			out = append(out, t)
		}
	}
	return out
}
