package ingestion

import "github.com/aegis-aml/aegis/internal/domain"

// SECOParser wraps OpenSanctionsParser for Swiss SECO sanctions.
// SECO data is sourced via OpenSanctions CSV format:
// https://data.opensanctions.org/datasets/latest/ch_seco_sanctions/targets.simple.csv
type SECOParser struct {
	inner *OpenSanctionsParser
}

func NewSECOParser() *SECOParser {
	return &SECOParser{inner: NewOpenSanctionsParser()}
}

func (sp *SECOParser) Parse(data []byte) ([]domain.Entity, error) {
	entities, err := sp.inner.Parse(data)
	if err != nil {
		return nil, err
	}
	// Override ListID and enrich with SECO-specific metadata
	for i := range entities {
		entities[i].ListID = "seco"
		enrichSECOEntity(&entities[i])
	}
	return entities, nil
}
