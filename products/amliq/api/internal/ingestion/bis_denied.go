package ingestion

import (
	"bytes"
	"encoding/csv"
	"fmt"
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

const bisListID = "us-bis-denied"

// BISDeniedParser parses the US Bureau of Industry and Security
// Denied Persons List. ~600 denied persons.
type BISDeniedParser struct{}

// NewBISDeniedParser creates a BIS denied persons parser.
func NewBISDeniedParser() *BISDeniedParser {
	return &BISDeniedParser{}
}

// Parse extracts entities from BIS denied persons CSV data.
func (p *BISDeniedParser) Parse(data []byte) ([]domain.Entity, error) {
	data = stripBOM(data)
	reader := csv.NewReader(bytes.NewReader(data))
	reader.FieldsPerRecord = -1
	reader.LazyQuotes = true

	records, err := reader.ReadAll()
	if err != nil {
		return nil, err
	}
	if len(records) < 2 {
		return nil, nil
	}

	hdr := buildHeaderIndex(records[0])
	var entities []domain.Entity

	for i, rec := range records[1:] {
		ent, ok := p.parseRecord(rec, hdr, i)
		if ok {
			entities = append(entities, ent)
		}
	}
	return entities, nil
}

func (p *BISDeniedParser) parseRecord(
	rec []string, hdr headerIndex, idx int,
) (domain.Entity, bool) {
	fullName := norm(hdr.get(rec, "Name", "name", "Entity"))
	if fullName == "" {
		return domain.Entity{}, false
	}

	normalized := NormalizeName(fullName)
	if normalized == "" {
		return domain.Entity{}, false
	}

	entityType := domain.EntityTypeIndividual
	if strings.Contains(strings.ToLower(fullName), "ltd") ||
		strings.Contains(strings.ToLower(fullName), "corp") ||
		strings.Contains(strings.ToLower(fullName), "inc") {
		entityType = domain.EntityTypeCompany
	}

	country := norm(hdr.get(rec, "Country", "country"))
	idBase := fmt.Sprintf("bis%08d000", idx)
	id, _ := domain.NewEntityID("ent_" + idBase[:12])
	name, _ := domain.NewName(normalized, "", "", "")
	ent, err := domain.NewEntity(id, entityType, []domain.Name{name})
	if err != nil {
		return domain.Entity{}, false
	}
	ent.ListID = bisListID
	if country != "" {
		ent.Nationalities = []string{country}
	}
	setBISFields(&ent, rec, hdr, entityType)
	return ent, true
}
