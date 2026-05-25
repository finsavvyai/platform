package ingestion

import (
	"context"
	"fmt"

	"github.com/aegis-aml/aegis/internal/domain"
)

// FetchSOEs queries Wikidata for state-owned enterprises in a country.
func (f *WikidataPEPFetcher) FetchSOEs(
	ctx context.Context, country string,
) ([]domain.Entity, error) {
	qid := GetQID(country)
	if qid == "" {
		return nil, fmt.Errorf("unknown country code: %s", country)
	}
	query := soeQuery(qid)
	resp, err := f.executeSPARQL(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("soe sparql %s: %w", country, err)
	}
	return parseSOEResults(resp, country)
}

func parseSOEResults(
	resp sparqlResponse, country string,
) ([]domain.Entity, error) {
	var entities []domain.Entity
	seen := make(map[string]bool)

	for _, b := range resp.Results.Bindings {
		orgQID := extractQID(b.Value("org"))
		orgLabel := b.Value("orgLabel")
		if orgQID == "" || orgLabel == "" || seen[orgQID] {
			continue
		}
		seen[orgQID] = true

		entID := sanitizeBulkID("soe-" + orgQID)
		id, err := domain.NewEntityID(entID)
		if err != nil {
			continue
		}
		name, err := domain.NewName(orgLabel, "", "", "")
		if err != nil {
			continue
		}
		ent, err := domain.NewEntity(
			id, domain.EntityTypeCompany, []domain.Name{name},
		)
		if err != nil {
			continue
		}
		ent.ListID = fmt.Sprintf("soe-%s", country)
		owner := b.Value("ownerLabel")
		if owner != "" {
			ent.Metadata["owner"] = owner
		}
		ent.Metadata["wikidata_id"] = orgQID
		ent.Nationalities = []string{country}
		entities = append(entities, ent)
	}
	return entities, nil
}
