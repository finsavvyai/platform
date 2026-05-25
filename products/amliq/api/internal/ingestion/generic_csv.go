package ingestion

import (
	"bytes"
	"encoding/csv"
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

// CSVListConfig defines how to parse a CSV-formatted sanctions list.
type CSVListConfig struct {
	ListID    string
	Delimiter rune
	FieldMap  map[string]string // our_field -> csv_column
	SkipRows  int
}

// GenericCSVParser parses any CSV sanctions list using a config.
type GenericCSVParser struct {
	config CSVListConfig
}

func NewGenericCSVParser(cfg CSVListConfig) *GenericCSVParser {
	if cfg.Delimiter == 0 {
		cfg.Delimiter = ','
	}
	return &GenericCSVParser{config: cfg}
}

func (p *GenericCSVParser) Parse(data []byte) ([]domain.Entity, error) {
	reader := csv.NewReader(bytes.NewReader(data))
	reader.Comma = p.config.Delimiter
	reader.LazyQuotes = true

	records, err := reader.ReadAll()
	if err != nil {
		return nil, err
	}
	if len(records) < p.config.SkipRows+2 {
		return nil, nil
	}

	hdr := buildHeaderIndex(records[p.config.SkipRows])
	var entities []domain.Entity

	for _, rec := range records[p.config.SkipRows+1:] {
		ent, ok := p.parseRow(rec, hdr)
		if ok {
			entities = append(entities, ent)
		}
	}
	return entities, nil
}

func (p *GenericCSVParser) parseRow(
	rec []string, hdr headerIndex,
) (domain.Entity, bool) {
	nameCol := p.config.FieldMap["name"]
	idCol := p.config.FieldMap["id"]

	fullName := hdr.get(rec, nameCol)
	listID := hdr.get(rec, idCol)
	if fullName == "" || listID == "" {
		return domain.Entity{}, false
	}

	normalized := NormalizeName(fullName)
	if isOneWord(normalized) {
		return domain.Entity{}, false
	}

	entityType := domain.EntityTypeIndividual
	if typeCol, ok := p.config.FieldMap["type"]; ok {
		if strings.Contains(strings.ToLower(hdr.get(rec, typeCol)), "entity") {
			entityType = domain.EntityTypeCompany
		}
	}

	id, _ := domain.NewEntityID("ent_" + sanitizeID(listID))
	name, _ := domain.NewName(normalized, "", "", "")
	ent, err := domain.NewEntity(id, entityType, []domain.Name{name})
	if err != nil {
		return domain.Entity{}, false
	}
	ent.ListID = p.config.ListID
	return ent, true
}

func sanitizeID(id string) string {
	id = strings.ReplaceAll(id, " ", "_")
	if len(id) > 12 {
		return id[:12]
	}
	return id
}
