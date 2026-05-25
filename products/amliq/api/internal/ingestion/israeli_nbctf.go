package ingestion

import (
	"bytes"
	"encoding/csv"
	"fmt"

	"github.com/aegis-aml/aegis/internal/domain"
)

// NBCTFParser handles Israel's NBCTF seizure list (CSV or HTML).
// CSV format: index-based columns (37+), windows-1255 encoding.
// Falls back to HTML table parsing if CSV fails.
type NBCTFParser struct{}

// NewNBCTFParser returns the default NBCTF parser.
func NewNBCTFParser() *NBCTFParser {
	return &NBCTFParser{}
}

// Parse tries CSV first (the richer format) and falls back to HTML
// when the body looks like an ASPX table dump instead of a CSV.
func (p *NBCTFParser) Parse(data []byte) ([]domain.Entity, error) {
	data = stripBOM(data)
	if len(data) == 0 {
		return nil, fmt.Errorf("empty NBCTF data")
	}
	entities, err := p.parseCSV(data)
	if err == nil && len(entities) > 0 {
		return entities, nil
	}
	return p.parseHTML(data)
}

func (p *NBCTFParser) parseCSV(data []byte) ([]domain.Entity, error) {
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

	// New format: row 1 = Hebrew headers, row 2 = English headers,
	// row 3+ = data. The old format is index-based — we fall back
	// to the legacy parseNBCTFRecord loop when headers don't match.
	if len(records) >= 3 {
		hdr := buildHeaderIndex(records[1])
		if hdr.get(records[1], "Name of Individual - English") != "" ||
			hdr.get(records[1], "Organization Name - English") != "" {
			return p.parseWithHeaders(records[2:], hdr)
		}
	}

	var entities []domain.Entity
	for _, rec := range records[1:] {
		if ent, ok := parseNBCTFRecord(rec); ok {
			entities = append(entities, ent)
		}
	}
	return entities, nil
}
