package ingestion

import (
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

var pepTier1Keywords = []string{
	"head of state", "head of government", "president",
	"prime minister", "king", "queen", "emperor", "sultan",
}

var pepTier2Keywords = []string{
	"minister", "member of parliament", "senator",
	"secretary of state", "ambassador", "mp",
}

var pepTier3Keywords = []string{
	"mayor", "governor", "judge", "magistrate",
	"councillor", "alderman",
}

var rcaSchemas = map[string]bool{
	"Family": true, "Associate": true,
}

// classifyPEPTier determines PEP tier from position and schema.
func classifyPEPTier(position, schema string) domain.PEPTier {
	if rcaSchemas[schema] {
		return domain.PEPTierNone // RCA, not a PEP themselves
	}
	lower := strings.ToLower(position)
	for _, kw := range pepTier1Keywords {
		if strings.Contains(lower, kw) {
			return domain.PEPTier1
		}
	}
	for _, kw := range pepTier2Keywords {
		if strings.Contains(lower, kw) {
			return domain.PEPTier2
		}
	}
	for _, kw := range pepTier3Keywords {
		if strings.Contains(lower, kw) {
			return domain.PEPTier3
		}
	}
	return domain.PEPTier4
}

func buildRCARelations(
	id string, props map[string][]string, schema string,
) []domain.RCARelation {
	pepID := firstSlice(props["person"])
	relatedID := firstSlice(props["relative"])
	if relatedID == "" {
		relatedID = firstSlice(props["associate"])
	}
	if pepID == "" {
		pepID = id
	}
	if relatedID == "" {
		return nil
	}
	relType := domain.RCAAssociate
	if schema == "Family" {
		relType = domain.RCASpouse
	}
	rel, err := domain.NewRCARelation(pepID, relatedID, relType, schema)
	if err != nil {
		return nil
	}
	return []domain.RCARelation{rel}
}
