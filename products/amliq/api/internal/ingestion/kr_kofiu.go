package ingestion

import "github.com/aegis-aml/aegis/internal/domain"

// KoreaKOFIUParser parses South Korean sanctions from OpenSanctions
// CSV data filtered by the kr_ dataset prefix.
type KoreaKOFIUParser struct {
	inner *CountryFilterParser
}

// NewKoreaKOFIUParser creates a parser for South Korean sanctions.
func NewKoreaKOFIUParser() *KoreaKOFIUParser {
	return &KoreaKOFIUParser{
		inner: NewCountryFilterParser("kr_", "kr-kofiu"),
	}
}

// Parse filters OpenSanctions CSV for South Korean entries.
func (p *KoreaKOFIUParser) Parse(data []byte) ([]domain.Entity, error) {
	return p.inner.Parse(data)
}
