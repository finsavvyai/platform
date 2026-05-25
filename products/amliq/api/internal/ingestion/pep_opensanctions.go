package ingestion

import (
	"encoding/json"
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

// PEPOpenSanctionsParser parses OpenSanctions PEP FTM JSON entities.
type PEPOpenSanctionsParser struct{}

func NewPEPOpenSanctionsParser() *PEPOpenSanctionsParser {
	return &PEPOpenSanctionsParser{}
}

type ftmEntity struct {
	ID         string              `json:"id"`
	Schema     string              `json:"schema"`
	Properties map[string][]string `json:"properties"`
}

// Parse reads FTM JSON lines and returns PEP profiles.
func (p *PEPOpenSanctionsParser) Parse(
	data []byte,
) ([]domain.PEPProfile, []domain.RCARelation) {
	var profiles []domain.PEPProfile
	var relations []domain.RCARelation

	for _, line := range strings.Split(string(data), "\n") {
		if line == "" {
			continue
		}
		var ent ftmEntity
		if err := json.Unmarshal([]byte(line), &ent); err != nil {
			continue
		}
		if ent.Schema == "Person" {
			if profile, ok := p.parsePEP(ent); ok {
				profiles = append(profiles, profile)
			}
		}
		if ent.Schema == "Family" || ent.Schema == "Associate" {
			relations = append(relations, p.parseRelation(ent)...)
		}
	}
	return profiles, relations
}

func (p *PEPOpenSanctionsParser) parsePEP(ent ftmEntity) (domain.PEPProfile, bool) {
	position := firstProp(ent.Properties, "position")
	country := firstProp(ent.Properties, "country")
	if position == "" && country == "" {
		return domain.PEPProfile{}, false
	}

	tier := classifyTier(position)
	profile := domain.NewPEPProfile(ent.ID, tier, position, country)
	profile.ActiveFrom = firstProp(ent.Properties, "startDate")
	profile.ActiveTo = firstProp(ent.Properties, "endDate")
	profile.IsActive = profile.ActiveTo == ""
	return profile, true
}

func (p *PEPOpenSanctionsParser) parseRelation(
	ent ftmEntity,
) []domain.RCARelation {
	pepID := firstProp(ent.Properties, "person")
	relatedID := firstProp(ent.Properties, "relative")
	if relatedID == "" {
		relatedID = firstProp(ent.Properties, "associate")
	}
	if pepID == "" || relatedID == "" {
		return nil
	}
	relType := domain.RCAAssociate
	if ent.Schema == "Family" {
		relType = domain.RCASpouse
	}
	rel, err := domain.NewRCARelation(pepID, relatedID, relType, ent.Schema)
	if err != nil {
		return nil
	}
	return []domain.RCARelation{rel}
}
