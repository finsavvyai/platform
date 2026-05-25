package ingestion

import (
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

var tier1Keywords = []string{
	"president", "prime minister", "head of state", "king", "queen",
	"supreme court", "chief justice", "speaker of parliament",
	"chancellor", "emperor", "sultan",
}

var tier2Keywords = []string{
	"minister", "ambassador", "general", "admiral", "commander",
	"secretary of state", "deputy minister", "governor",
	"senator", "member of parliament", "central bank",
}

var tier3Keywords = []string{
	"mayor", "councillor", "alderman", "regional", "provincial",
	"state legislat", "local government", "municipal",
}

func classifyTier(position string) domain.PEPTier {
	lower := strings.ToLower(position)
	for _, kw := range tier1Keywords {
		if strings.Contains(lower, kw) {
			return domain.PEPTier1
		}
	}
	for _, kw := range tier2Keywords {
		if strings.Contains(lower, kw) {
			return domain.PEPTier2
		}
	}
	for _, kw := range tier3Keywords {
		if strings.Contains(lower, kw) {
			return domain.PEPTier3
		}
	}
	return domain.PEPTier4
}

func firstProp(props map[string][]string, key string) string {
	if vals, ok := props[key]; ok && len(vals) > 0 {
		return vals[0]
	}
	return ""
}
