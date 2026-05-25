package ingestion

import (
	"bytes"
	"encoding/csv"

	"github.com/aegis-aml/aegis/internal/domain"
)

const PEPDataURL = "https://data.opensanctions.org/datasets/latest/peps/targets.simple.csv"

// OpenSanctionsPEPParser parses PEP CSV from OpenSanctions.
type OpenSanctionsPEPParser struct{}

func NewOpenSanctionsPEPParser() *OpenSanctionsPEPParser {
	return &OpenSanctionsPEPParser{}
}

// ParsePEPs reads PEP CSV and returns profiles + RCA relations.
func (p *OpenSanctionsPEPParser) ParsePEPs(
	data []byte,
) ([]domain.PEPProfile, []domain.RCARelation) {
	reader := csv.NewReader(bytes.NewReader(data))
	records, err := reader.ReadAll()
	if err != nil {
		return nil, nil
	}
	if len(records) < 2 {
		return nil, nil
	}
	hdr := buildHeaderIndex(records[0])
	var profiles []domain.PEPProfile
	var relations []domain.RCARelation
	for _, rec := range records[1:] {
		prof, rels, ok := p.parseRow(rec, hdr)
		if ok {
			profiles = append(profiles, prof)
			relations = append(relations, rels...)
		}
	}
	return profiles, relations
}

func (p *OpenSanctionsPEPParser) parseRow(
	rec []string, hdr headerIndex,
) (domain.PEPProfile, []domain.RCARelation, bool) {
	id := hdr.get(rec, "id")
	caption := hdr.get(rec, "name", "caption")
	schema := hdr.get(rec, "schema")
	if id == "" || caption == "" {
		return domain.PEPProfile{}, nil, false
	}
	props := parseProperties(hdr.get(rec, "properties"))
	position := firstSlice(props["position"])
	country := firstSlice(props["country"])
	// Simple CSV: fall back to direct columns
	if country == "" {
		country = hdr.get(rec, "countries")
	}
	if position == "" {
		position = caption // use name as position fallback
	}
	tier := classifyPEPTier(position, schema)
	profile := domain.NewPEPProfile(id, tier, position, country)
	profile.ActiveFrom = firstSlice(props["startDate"])
	profile.ActiveTo = firstSlice(props["endDate"])
	profile.IsActive = profile.ActiveTo == ""
	var rels []domain.RCARelation
	if schema == "Family" || schema == "Associate" {
		rels = buildRCARelations(id, props, schema)
	}
	return profile, rels, true
}

// Parse implements Parser interface for registry compatibility.
// Builds richly-enriched entities (DOB, nationalities, metadata) from
// the OpenSanctions PEP simple.csv. Uses the person's caption as the
// entity name — not their position — so matches display correctly.
func (p *OpenSanctionsPEPParser) Parse(
	data []byte,
) ([]domain.Entity, error) {
	reader := csv.NewReader(bytes.NewReader(data))
	reader.FieldsPerRecord = -1
	records, err := reader.ReadAll()
	if err != nil || len(records) < 2 {
		return nil, err
	}
	hdr := buildHeaderIndex(records[0])
	entities := make([]domain.Entity, 0, len(records)-1)
	for _, rec := range records[1:] {
		if ent, ok := buildPEPEntity(rec, hdr); ok {
			entities = append(entities, ent)
		}
	}
	return entities, nil
}
