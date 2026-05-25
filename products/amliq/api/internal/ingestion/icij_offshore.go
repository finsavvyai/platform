package ingestion

import (
	"bytes"
	"encoding/csv"
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

// ICIJ Offshore Leaks data URLs (Panama Papers, Pandora Papers, etc.)
const (
	ICIJEntitiesURL = "https://offshoreleaks-data.icij.org/offshoreleaks/csv/csv_entities.csv.zip"
	ICIJOfficersURL = "https://offshoreleaks-data.icij.org/offshoreleaks/csv/csv_officers.csv.zip"
)

// ICIJParser parses ICIJ Offshore Leaks CSV data.
type ICIJParser struct{}

func NewICIJParser() *ICIJParser { return &ICIJParser{} }

func (p *ICIJParser) Parse(data []byte) ([]domain.Entity, error) {
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
	for _, rec := range records[1:] {
		if ent, ok := p.parseRow(rec, hdr); ok {
			entities = append(entities, ent)
		}
	}
	return entities, nil
}

func (p *ICIJParser) parseRow(
	rec []string, hdr headerIndex,
) (domain.Entity, bool) {
	name := hdr.get(rec, "name", "entity_name", "officer_name")
	if name == "" {
		return domain.Entity{}, false
	}
	name = strings.TrimSpace(name)
	if len(name) < 3 || isOneWord(name) {
		return domain.Entity{}, false
	}

	rawID := hdr.get(rec, "node_id", "id")
	if rawID == "" {
		return domain.Entity{}, false
	}
	entID := sanitizeBulkID("icij_" + rawID)
	id, err := domain.NewEntityID(entID)
	if err != nil {
		return domain.Entity{}, false
	}

	normalized := NormalizeName(name)
	n, _ := domain.NewName(normalized, "", "", "")

	typ := domain.EntityTypeCompany
	jurisdiction := hdr.get(rec, "jurisdiction", "country_codes")
	if looksLikePerson(name) {
		typ = domain.EntityTypeIndividual
	}

	ent, err := domain.NewEntity(id, typ, []domain.Name{n})
	if err != nil {
		return domain.Entity{}, false
	}
	ent.ListID = "icij_offshore"
	if jurisdiction != "" {
		setMeta(&ent, "jurisdiction", jurisdiction)
	}
	source := hdr.get(rec, "sourceID", "source")
	if source != "" {
		setMeta(&ent, "source", source)
	}
	setICIJFields(&ent, rec, hdr, typ)
	return ent, true
}

