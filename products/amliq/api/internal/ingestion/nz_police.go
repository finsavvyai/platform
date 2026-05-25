package ingestion

import (
	"encoding/json"
	"fmt"

	"github.com/aegis-aml/aegis/internal/domain"
)

const nzPoliceListID = "nz-police-terror"

// NZPoliceParser parses the New Zealand Police designated terrorists list.
type NZPoliceParser struct{}

// NewNZPoliceParser creates a NZ Police terror list parser.
func NewNZPoliceParser() *NZPoliceParser {
	return &NZPoliceParser{}
}

type nzPoliceEntry struct {
	Name        string `json:"name"`
	Aliases     string `json:"aliases"`
	Nationality string `json:"nationality"`
	DateOfBirth string `json:"date_of_birth"`
	ListedDate  string `json:"listed_date"`
	Type        string `json:"type"`
}

type nzPoliceResponse struct {
	Designations []nzPoliceEntry `json:"designations"`
}

// Parse extracts entities from NZ Police JSON/CSV data.
func (p *NZPoliceParser) Parse(data []byte) ([]domain.Entity, error) {
	var resp nzPoliceResponse
	if err := json.Unmarshal(data, &resp); err != nil {
		return p.parseFallbackArray(data)
	}

	var entities []domain.Entity
	for i, entry := range resp.Designations {
		ent, ok := p.buildEntity(entry, i)
		if ok {
			entities = append(entities, ent)
		}
	}
	return entities, nil
}

func (p *NZPoliceParser) parseFallbackArray(data []byte) ([]domain.Entity, error) {
	var entries []nzPoliceEntry
	if err := json.Unmarshal(data, &entries); err != nil {
		return nil, fmt.Errorf("nz police parse: %w", err)
	}
	var entities []domain.Entity
	for i, entry := range entries {
		ent, ok := p.buildEntity(entry, i)
		if ok {
			entities = append(entities, ent)
		}
	}
	return entities, nil
}

func (p *NZPoliceParser) buildEntity(entry nzPoliceEntry, idx int) (domain.Entity, bool) {
	if entry.Name == "" {
		return domain.Entity{}, false
	}
	normalized := NormalizeName(entry.Name)
	if normalized == "" {
		return domain.Entity{}, false
	}

	entityType := domain.EntityTypeIndividual
	if entry.Type == "entity" || entry.Type == "Entity" {
		entityType = domain.EntityTypeCompany
	}

	idBase := fmt.Sprintf("nzp%08d00", idx)
	id, _ := domain.NewEntityID("ent_" + idBase[:12])
	name, _ := domain.NewName(normalized, "", "", "")
	ent, err := domain.NewEntity(id, entityType, []domain.Name{name})
	if err != nil {
		return domain.Entity{}, false
	}
	ent.ListID = nzPoliceListID
	if entry.Nationality != "" {
		ent.Nationalities = []string{entry.Nationality}
	}
	setNZPoliceFields(&ent, entry, entityType)
	return ent, true
}
