package ingestion

import (
	"bytes"
	"encoding/csv"
	"fmt"

	"github.com/aegis-aml/aegis/internal/domain"
)

const hkHKMAListID = "hk-hkma"

// HKSanctionsParser parses the Hong Kong Monetary Authority sanctions list.
type HKSanctionsParser struct{}

// NewHKSanctionsParser creates a HKMA sanctions parser.
func NewHKSanctionsParser() *HKSanctionsParser {
	return &HKSanctionsParser{}
}

// Parse extracts entities from HKMA CSV data.
func (p *HKSanctionsParser) Parse(data []byte) ([]domain.Entity, error) {
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

func (p *HKSanctionsParser) parseRecord(
	rec []string, hdr headerIndex, idx int,
) (domain.Entity, bool) {
	fullName := norm(hdr.get(rec, "Name", "name", "Full Name"))
	if fullName == "" {
		return domain.Entity{}, false
	}

	normalized := NormalizeName(fullName)
	if normalized == "" {
		return domain.Entity{}, false
	}

	entityType := domain.EntityTypeIndividual
	typeVal := norm(hdr.get(rec, "Type", "type", "Entity Type"))
	if typeVal == "Entity" || typeVal == "Company" || typeVal == "Organization" {
		entityType = domain.EntityTypeCompany
	}

	idBase := fmt.Sprintf("hkm%08d00", idx)
	id, _ := domain.NewEntityID("ent_" + idBase[:12])
	name, _ := domain.NewName(normalized, "", "", "")
	ent, err := domain.NewEntity(id, entityType, []domain.Name{name})
	if err != nil {
		return domain.Entity{}, false
	}
	ent.ListID = hkHKMAListID

	country := norm(hdr.get(rec, "Country", "country", "Nationality"))
	if country != "" {
		ent.Nationalities = []string{country}
	}
	setHKHKMAFields(&ent, rec, hdr, entityType)
	return ent, true
}
