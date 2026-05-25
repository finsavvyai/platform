package ingestion

import (
	"encoding/json"
	"fmt"

	"github.com/aegis-aml/aegis/internal/domain"
)

const europolListID = "europol-wanted"

// EuropolParser parses the Europol Most Wanted list.
// Source: eumostwanted.eu (~100 fugitives).
type EuropolParser struct{}

// NewEuropolParser creates a Europol most wanted parser.
func NewEuropolParser() *EuropolParser {
	return &EuropolParser{}
}

type europolEntry struct {
	Name        string `json:"name"`
	Nationality string `json:"nationality"`
	DateOfBirth string `json:"date_of_birth"`
	Gender      string `json:"gender"`
	Offence     string `json:"offence"`
	ID          string `json:"id"`
}

type europolResponse struct {
	Entries []europolEntry `json:"entries"`
}

// Parse extracts entities from Europol JSON data.
func (p *EuropolParser) Parse(data []byte) ([]domain.Entity, error) {
	var resp europolResponse
	if err := json.Unmarshal(data, &resp); err != nil {
		return p.parseFallback(data)
	}

	var entities []domain.Entity
	for i, entry := range resp.Entries {
		ent, ok := p.buildEntity(entry, i)
		if ok {
			entities = append(entities, ent)
		}
	}
	return entities, nil
}

func (p *EuropolParser) buildEntity(entry europolEntry, idx int) (domain.Entity, bool) {
	if entry.Name == "" {
		return domain.Entity{}, false
	}
	normalized := NormalizeName(entry.Name)
	if normalized == "" {
		return domain.Entity{}, false
	}

	idBase := fmt.Sprintf("euw%08d00", idx)
	id, _ := domain.NewEntityID("ent_" + idBase[:12])
	name, _ := domain.NewName(normalized, "", "", "")
	ent, err := domain.NewEntity(id, domain.EntityTypeIndividual, []domain.Name{name})
	if err != nil {
		return domain.Entity{}, false
	}
	ent.ListID = europolListID
	if entry.Nationality != "" {
		ent.Nationalities = []string{entry.Nationality}
	}
	if entry.Offence != "" {
		ent.Metadata["offence"] = entry.Offence
	}
	setEuropolFields(&ent, entry)
	return ent, true
}

func (p *EuropolParser) parseFallback(data []byte) ([]domain.Entity, error) {
	var entries []europolEntry
	if err := json.Unmarshal(data, &entries); err != nil {
		return nil, fmt.Errorf("europol parse: %w", err)
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
