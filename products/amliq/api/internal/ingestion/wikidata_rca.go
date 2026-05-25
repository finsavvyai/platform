package ingestion

import (
	"context"
	"log"

	"github.com/aegis-aml/aegis/internal/domain"
)

// rcaPropertyMap maps Wikidata relation types to domain RCA types.
var rcaPropertyMap = map[string]domain.RCAType{
	"spouse":  domain.RCASpouse,
	"child":   domain.RCAChild,
	"father":  domain.RCAParent,
	"mother":  domain.RCAParent,
	"sibling": domain.RCASibling,
	"partner": domain.RCASpouse,
}

// ExpandRCA queries Wikidata for family members of each PEP.
// Returns new RCA profiles and skips persons already in pepSet.
func ExpandRCA(
	ctx context.Context,
	fetcher *WikidataPEPFetcher,
	pepProfiles []domain.PEPProfile,
) ([]domain.PEPProfile, []domain.RCARelation) {
	pepSet := buildPEPSet(pepProfiles)
	var rcaProfiles []domain.PEPProfile
	var relations []domain.RCARelation
	seen := make(map[string]bool)

	for _, pep := range pepProfiles {
		qid := pep.EntityID
		resp, err := fetcher.executeSPARQL(ctx, rcaQuery(qid))
		if err != nil {
			log.Printf("RCA query %s: %v", qid, err)
			continue
		}
		newProfs, newRels := parseRCAResults(resp, pep, pepSet, seen)
		rcaProfiles = append(rcaProfiles, newProfs...)
		relations = append(relations, newRels...)
	}
	return rcaProfiles, relations
}

func parseRCAResults(
	resp sparqlResponse,
	pep domain.PEPProfile,
	pepSet map[string]bool,
	seen map[string]bool,
) ([]domain.PEPProfile, []domain.RCARelation) {
	var profiles []domain.PEPProfile
	var relations []domain.RCARelation

	for _, b := range resp.Results.Bindings {
		relQID := extractQID(b.Value("relative"))
		relType := b.Value("relType")
		if relQID == "" || relType == "" {
			continue
		}
		rcaType, ok := rcaPropertyMap[relType]
		if !ok {
			rcaType = domain.RCAAssociate
		}
		rel, err := domain.NewRCARelation(
			pep.EntityID, relQID, rcaType, relType,
		)
		if err != nil {
			continue
		}
		relations = append(relations, rel)
		if pepSet[relQID] || seen[relQID] {
			continue
		}
		seen[relQID] = true
		label := b.Value("relativeLabel")
		rca := domain.NewPEPProfile(
			relQID, domain.PEPTierNone, label, pep.Country,
		)
		rca.IsActive = false
		profiles = append(profiles, rca)
	}
	return profiles, relations
}

func buildPEPSet(profiles []domain.PEPProfile) map[string]bool {
	s := make(map[string]bool, len(profiles))
	for _, p := range profiles {
		s[p.EntityID] = true
	}
	return s
}
