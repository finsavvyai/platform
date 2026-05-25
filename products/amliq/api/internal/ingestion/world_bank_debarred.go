package ingestion

import (
	"bytes"
	"encoding/csv"
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

const worldBankListID = "worldbank-debarred"

// WorldBankParser parses the World Bank Debarred Firms list.
// Source: https://www.worldbank.org/en/projects-operations/procurement/debarred-firms
// ~1,200 debarred firms/individuals.
type WorldBankParser struct{}

// NewWorldBankParser creates a new World Bank debarred parser.
func NewWorldBankParser() *WorldBankParser {
	return &WorldBankParser{}
}

// Parse extracts entities from the World Bank CSV data.
func (p *WorldBankParser) Parse(data []byte) ([]domain.Entity, error) {
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

func (p *WorldBankParser) parseRecord(
	rec []string, hdr headerIndex, idx int,
) (domain.Entity, bool) {
	firmName := norm(hdr.get(rec, "Firm Name", "firm_name", "Name"))
	if firmName == "" {
		return domain.Entity{}, false
	}

	normalized := NormalizeName(firmName)
	if normalized == "" {
		return domain.Entity{}, false
	}

	entityType := domain.EntityTypeCompany
	country := norm(hdr.get(rec, "Country", "country"))
	sanctionType := norm(hdr.get(rec, "Sanction Type", "sanction_type"))

	idStr := sanitizeID(strings.ReplaceAll(normalized, " ", "")[:min(12, len(normalized))])
	id, _ := domain.NewEntityID("ent_" + padID(idStr, idx))
	name, _ := domain.NewName(normalized, "", "", "")
	ent, err := domain.NewEntity(id, entityType, []domain.Name{name})
	if err != nil {
		return domain.Entity{}, false
	}
	ent.ListID = worldBankListID
	if country != "" {
		ent.Nationalities = []string{country}
	}
	if sanctionType != "" {
		ent.Metadata["sanction_type"] = sanctionType
	}
	setWorldBankFields(&ent, rec, hdr)
	return ent, true
}

func padID(base string, idx int) string {
	s := base
	for len(s) < 12 {
		s += "0"
	}
	return s[:12]
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
