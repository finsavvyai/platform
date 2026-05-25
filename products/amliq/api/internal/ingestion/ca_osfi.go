package ingestion

import "github.com/aegis-aml/aegis/internal/domain"

// CanadaOSFIParser parses Canadian OSFI sanctions from OpenSanctions
// CSV data filtered by the ca_dfatd dataset prefix.
type CanadaOSFIParser struct {
	inner *CountryFilterParser
}

// NewCanadaOSFIParser creates a parser for Canadian sanctions.
func NewCanadaOSFIParser() *CanadaOSFIParser {
	return &CanadaOSFIParser{
		inner: NewCountryFilterParser("ca_dfatd", "ca-osfi"),
	}
}

// Parse filters OpenSanctions CSV for Canadian entries.
func (p *CanadaOSFIParser) Parse(data []byte) ([]domain.Entity, error) {
	return p.inner.Parse(data)
}
