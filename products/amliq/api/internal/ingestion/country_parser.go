package ingestion

import (
	"bytes"
	"encoding/csv"
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

// CountryFilterParser parses OpenSanctions CSV data, filtering rows
// by a dataset column prefix. Used by country-specific parsers that
// wrap OpenSanctions aggregated data.
type CountryFilterParser struct {
	CountryPrefix string
	ListID        string
}

// NewCountryFilterParser creates a parser that filters by dataset prefix.
func NewCountryFilterParser(prefix, listID string) *CountryFilterParser {
	return &CountryFilterParser{
		CountryPrefix: prefix,
		ListID:        listID,
	}
}

// Parse reads OpenSanctions CSV and returns entities matching the
// configured dataset prefix.
func (p *CountryFilterParser) Parse(data []byte) ([]domain.Entity, error) {
	reader := csv.NewReader(bytes.NewReader(stripBOM(data)))
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
		ent, ok := p.parseRow(rec, hdr)
		if ok {
			entities = append(entities, ent)
		}
	}
	return entities, nil
}

func (p *CountryFilterParser) parseRow(
	rec []string, hdr headerIndex,
) (domain.Entity, bool) {
	dataset := hdr.get(rec, "dataset")
	if !strings.Contains(dataset, p.CountryPrefix) {
		return domain.Entity{}, false
	}
	return p.buildEntity(rec, hdr)
}

func (p *CountryFilterParser) buildEntity(
	rec []string, hdr headerIndex,
) (domain.Entity, bool) {
	rawID := hdr.get(rec, "id")
	if rawID == "" || len(rawID) < 12 {
		return domain.Entity{}, false
	}

	schema := hdr.get(rec, "schema")
	typ := domain.EntityTypeIndividual
	if schema != "" && schema != "Person" {
		typ = domain.EntityTypeCompany
	}

	return buildCountryEntity(rec, hdr, rawID, typ, p.ListID)
}
