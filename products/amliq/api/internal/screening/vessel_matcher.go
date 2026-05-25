package screening

import (
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

type VesselMatcher struct {
	normalizer *Normalizer
}

func NewVesselMatcher() *VesselMatcher {
	return &VesselMatcher{
		normalizer: NewNormalizer(),
	}
}

func (vm *VesselMatcher) Match(
	query domain.Name,
	candidates []domain.Name,
	queryMeta map[string]interface{},
	candidateMeta []map[string]interface{},
) []domain.MatchEvidence {
	var evidence []domain.MatchEvidence

	queryIMO := getMetaString(queryMeta, "imo")
	queryMMSI := getMetaString(queryMeta, "mmsi")
	queryFlag := getMetaString(queryMeta, "flag")
	queryNorm := vm.normalizer.Normalize(query.Full)

	for i, candidate := range candidates {
		candIMO := getMetaString(candidateMeta[i], "imo")
		candMMSI := getMetaString(candidateMeta[i], "mmsi")
		candFlag := getMetaString(candidateMeta[i], "flag")
		candNorm := vm.normalizer.Normalize(candidate.Full)

		// IMO exact match = 0.99 (IMO is unique identifier)
		if queryIMO != "" && queryIMO == candIMO {
			ev := domain.NewMatchEvidence(
				domain.MatchLayerExact,
				"vessel_imo_exact",
				0.99,
				1.0,
				query.Full,
				candidate.Full,
				"Exact IMO match",
			)
			evidence = append(evidence, ev)
			continue
		}

		// MMSI exact match = 0.95
		if queryMMSI != "" && queryMMSI == candMMSI {
			ev := domain.NewMatchEvidence(
				domain.MatchLayerExact,
				"vessel_mmsi_exact",
				0.95,
				1.0,
				query.Full,
				candidate.Full,
				"Exact MMSI match",
			)
			evidence = append(evidence, ev)
			continue
		}

		// IMO mismatch = skip (different vessel)
		if queryIMO != "" && candIMO != "" && queryIMO != candIMO {
			continue
		}

		// Vessel name fuzzy (Jaro-Winkler)
		jw := jaroWinklerSimilarity(queryNorm, candNorm)

		// Flag + name combo = 0.8 (check before generic fuzzy)
		if queryFlag != "" && queryFlag == candFlag &&
			jw >= 0.75 {
			ev := domain.NewMatchEvidence(
				domain.MatchLayerToken,
				"vessel_flag_name",
				0.8,
				jw,
				query.Full,
				candidate.Full,
				"Vessel flag and name match",
			)
			evidence = append(evidence, ev)
			continue
		}

		if jw >= 0.85 {
			ev := domain.NewMatchEvidence(
				domain.MatchLayerFuzzy,
				"vessel_name_fuzzy",
				0.7,
				jw,
				query.Full,
				candidate.Full,
				"Vessel name fuzzy match",
			)
			evidence = append(evidence, ev)
		}
	}
	return evidence
}

func getMetaString(m map[string]interface{}, key string) string {
	if m == nil {
		return ""
	}
	v, ok := m[key]
	if !ok {
		return ""
	}
	if s, ok := v.(string); ok {
		return strings.TrimSpace(strings.ToUpper(s))
	}
	return ""
}
