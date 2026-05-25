package ingestion

import "github.com/aegis-aml/aegis/internal/domain"

// BrazilCOAFParser parses Brazil COAF sanctions from OpenSanctions
// CSV data filtered by the br_ dataset prefix.
type BrazilCOAFParser struct {
	inner *CountryFilterParser
}

// NewBrazilCOAFParser creates a parser for Brazil COAF sanctions.
func NewBrazilCOAFParser() *BrazilCOAFParser {
	return &BrazilCOAFParser{
		inner: NewCountryFilterParser("br_", "br-coaf"),
	}
}

// Parse filters OpenSanctions CSV for Brazil entries.
func (p *BrazilCOAFParser) Parse(data []byte) ([]domain.Entity, error) {
	return p.inner.Parse(data)
}
