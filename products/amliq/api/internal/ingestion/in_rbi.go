package ingestion

import "github.com/aegis-aml/aegis/internal/domain"

// IndiaRBIParser parses India RBI sanctions from OpenSanctions
// CSV data filtered by the in_ dataset prefix.
type IndiaRBIParser struct {
	inner *CountryFilterParser
}

// NewIndiaRBIParser creates a parser for India RBI sanctions.
func NewIndiaRBIParser() *IndiaRBIParser {
	return &IndiaRBIParser{
		inner: NewCountryFilterParser("in_", "in-rbi"),
	}
}

// Parse filters OpenSanctions CSV for India entries.
func (p *IndiaRBIParser) Parse(data []byte) ([]domain.Entity, error) {
	return p.inner.Parse(data)
}
