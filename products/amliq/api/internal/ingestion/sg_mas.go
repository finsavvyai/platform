package ingestion

import "github.com/aegis-aml/aegis/internal/domain"

// SingaporeMASParser parses Singapore MAS sanctions from OpenSanctions
// CSV data filtered by the sg_ dataset prefix.
type SingaporeMASParser struct {
	inner *CountryFilterParser
}

// NewSingaporeMASParser creates a parser for Singapore MAS sanctions.
func NewSingaporeMASParser() *SingaporeMASParser {
	return &SingaporeMASParser{
		inner: NewCountryFilterParser("sg_", "sg-mas"),
	}
}

// Parse filters OpenSanctions CSV for Singapore entries.
func (p *SingaporeMASParser) Parse(data []byte) ([]domain.Entity, error) {
	return p.inner.Parse(data)
}
