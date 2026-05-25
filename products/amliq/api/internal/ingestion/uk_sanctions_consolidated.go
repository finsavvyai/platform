package ingestion

import (
	"bytes"
	"encoding/csv"
	"fmt"

	"github.com/aegis-aml/aegis/internal/domain"
)

const ukHMTListID = "uk-hmt"

// UKHMTParser parses the UK HMT Consolidated Sanctions List.
// Separate from OFSI, provides additional UK sanctions data.
type UKHMTParser struct{}

// NewUKHMTParser creates a UK HMT consolidated list parser.
func NewUKHMTParser() *UKHMTParser {
	return &UKHMTParser{}
}

// Parse extracts entities from UK HMT CSV data.
func (p *UKHMTParser) Parse(data []byte) ([]domain.Entity, error) {
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

func (p *UKHMTParser) parseRecord(
	rec []string, hdr headerIndex, idx int,
) (domain.Entity, bool) {
	lastName := norm(hdr.get(rec, "Name 6", "Last Name", "name6"))
	firstName := norm(hdr.get(rec, "Name 1", "First Name", "name1"))
	fullName := buildFullName(firstName, lastName)
	if fullName == "" {
		return domain.Entity{}, false
	}

	normalized := NormalizeName(fullName)
	if normalized == "" {
		return domain.Entity{}, false
	}

	entityType := domain.EntityTypeIndividual
	groupType := norm(hdr.get(rec, "Group Type", "Type"))
	if groupType == "Entity" {
		entityType = domain.EntityTypeCompany
	}

	idBase := fmt.Sprintf("hmt%08d00", idx)
	id, _ := domain.NewEntityID("ent_" + idBase[:12])
	name, _ := domain.NewName(normalized, firstName, lastName, "")
	ent, err := domain.NewEntity(id, entityType, []domain.Name{name})
	if err != nil {
		return domain.Entity{}, false
	}
	ent.ListID = ukHMTListID

	country := norm(hdr.get(rec, "Country", "country"))
	if country != "" {
		ent.Nationalities = []string{country}
	}
	setUKHMTFields(&ent, rec, hdr)
	return ent, true
}

func buildFullName(first, last string) string {
	if first == "" && last == "" {
		return ""
	}
	if first == "" {
		return last
	}
	if last == "" {
		return first
	}
	return first + " " + last
}
