package ingestion

import "github.com/aegis-aml/aegis/internal/domain"

// EuropolOpenSanctionsParser parses Europol data via OpenSanctions CSV.
type EuropolOpenSanctionsParser struct {
	inner *OpenSanctionsParser
}

func NewEuropolOpenSanctionsParser() *EuropolOpenSanctionsParser {
	return &EuropolOpenSanctionsParser{inner: NewOpenSanctionsParser()}
}

func (p *EuropolOpenSanctionsParser) Parse(data []byte) ([]domain.Entity, error) {
	entities, err := p.inner.Parse(data)
	if err != nil {
		return nil, err
	}
	for i := range entities {
		entities[i].ListID = "europol-wanted"
	}
	return entities, nil
}
