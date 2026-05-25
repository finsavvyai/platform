package ingestion

import "github.com/aegis-aml/aegis/internal/domain"

// JapanMOFParser parses Japanese MOF sanctions from OpenSanctions
// CSV data filtered by the jp_mof dataset prefix.
type JapanMOFParser struct {
	inner *CountryFilterParser
}

// NewJapanMOFParser creates a parser for Japanese MOF sanctions.
func NewJapanMOFParser() *JapanMOFParser {
	return &JapanMOFParser{
		inner: NewCountryFilterParser("jp_mof", "jp-mof"),
	}
}

// Parse filters OpenSanctions CSV for Japanese MOF entries.
func (p *JapanMOFParser) Parse(data []byte) ([]domain.Entity, error) {
	return p.inner.Parse(data)
}
