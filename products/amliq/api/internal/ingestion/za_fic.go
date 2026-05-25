package ingestion

import "github.com/aegis-aml/aegis/internal/domain"

// SouthAfricaFICParser parses South Africa FIC sanctions from
// OpenSanctions CSV data filtered by the za_ dataset prefix.
type SouthAfricaFICParser struct {
	inner *CountryFilterParser
}

// NewSouthAfricaFICParser creates a parser for South Africa sanctions.
func NewSouthAfricaFICParser() *SouthAfricaFICParser {
	return &SouthAfricaFICParser{
		inner: NewCountryFilterParser("za_", "za-fic"),
	}
}

// Parse filters OpenSanctions CSV for South Africa entries.
func (p *SouthAfricaFICParser) Parse(data []byte) ([]domain.Entity, error) {
	return p.inner.Parse(data)
}
