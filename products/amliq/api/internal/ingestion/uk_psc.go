package ingestion

import (
	"bytes"
	"encoding/csv"
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

// UKPSCDataURL is the UK Companies House PSC bulk data.
const UKPSCDataURL = "http://download.companieshouse.gov.uk/en_pscdata.html"

// UKPSCParser parses UK Companies House Persons of Significant Control CSV.
type UKPSCParser struct{}

func NewUKPSCParser() *UKPSCParser { return &UKPSCParser{} }

func (p *UKPSCParser) Parse(data []byte) ([]domain.Entity, error) {
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
	seen := make(map[string]bool)

	for _, rec := range records[1:] {
		name := p.extractName(rec, hdr)
		if name == "" || len(name) < 3 || isOneWord(name) {
			continue
		}
		lower := strings.ToLower(name)
		if seen[lower] {
			continue
		}
		seen[lower] = true

		entID := sanitizeBulkID("ukpsc_" + lower)
		id, err := domain.NewEntityID(entID)
		if err != nil {
			continue
		}
		normalized := NormalizeName(name)
		n, _ := domain.NewName(normalized, "", "", "")

		typ := domain.EntityTypeIndividual
		kind := hdr.get(rec, "data.kind")
		if strings.Contains(kind, "corporate") {
			typ = domain.EntityTypeCompany
		}

		ent, err := domain.NewEntity(id, typ, []domain.Name{n})
		if err != nil {
			continue
		}
		ent.ListID = "uk_psc"
		nationality := hdr.get(rec, "data.nationality")
		if nationality != "" {
			ent.Nationalities = []string{nationality}
		}
		setUKPSCFields(&ent, rec, hdr, typ)
		entities = append(entities, ent)
	}
	return entities, nil
}

func (p *UKPSCParser) extractName(rec []string, hdr headerIndex) string {
	// PSC data has data.name_elements.forename, data.name_elements.surname
	forename := hdr.get(rec, "data.name_elements.forename")
	surname := hdr.get(rec, "data.name_elements.surname")
	if forename != "" && surname != "" {
		return strings.TrimSpace(forename + " " + surname)
	}
	// Fallback: data.name
	return strings.TrimSpace(hdr.get(rec, "data.name"))
}
