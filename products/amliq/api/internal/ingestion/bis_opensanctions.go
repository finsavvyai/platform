package ingestion

import "github.com/aegis-aml/aegis/internal/domain"

// BISOpenSanctionsParser parses BIS Denied Persons via OpenSanctions CSV.
type BISOpenSanctionsParser struct {
	inner *OpenSanctionsParser
}

func NewBISOpenSanctionsParser() *BISOpenSanctionsParser {
	return &BISOpenSanctionsParser{inner: NewOpenSanctionsParser()}
}

func (p *BISOpenSanctionsParser) Parse(data []byte) ([]domain.Entity, error) {
	entities, err := p.inner.Parse(data)
	if err != nil {
		return nil, err
	}
	for i := range entities {
		entities[i].ListID = "us-bis-denied"
	}
	return entities, nil
}
