package ingestion

import "github.com/aegis-aml/aegis/internal/domain"

// AuDFATParser parses Australian DFAT sanctions from OpenSanctions
// CSV data filtered by the au_dfat dataset prefix.
type AuDFATParser struct {
	inner *CountryFilterParser
}

// NewAuDFATParser creates a parser for Australian DFAT sanctions.
func NewAuDFATParser() *AuDFATParser {
	return &AuDFATParser{
		inner: NewCountryFilterParser("au_dfat", "au-dfat"),
	}
}

// Parse filters OpenSanctions CSV for Australian DFAT entries.
func (p *AuDFATParser) Parse(data []byte) ([]domain.Entity, error) {
	return p.inner.Parse(data)
}
