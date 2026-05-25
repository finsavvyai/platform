package ingestion

import "github.com/aegis-aml/aegis/internal/domain"

// UAECBParser parses UAE Central Bank sanctions from OpenSanctions
// CSV data filtered by the ae_ dataset prefix.
type UAECBParser struct {
	inner *CountryFilterParser
}

// NewUAECBParser creates a parser for UAE Central Bank sanctions.
func NewUAECBParser() *UAECBParser {
	return &UAECBParser{
		inner: NewCountryFilterParser("ae_", "ae-cbuae"),
	}
}

// Parse filters OpenSanctions CSV for UAE entries.
func (p *UAECBParser) Parse(data []byte) ([]domain.Entity, error) {
	return p.inner.Parse(data)
}
