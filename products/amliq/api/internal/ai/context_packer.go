package ai

// alwaysKeep lists fields always included in packed context.
var alwaysKeep = map[string]bool{
	"name":        true,
	"full_name":   true,
	"dob":         true,
	"date_of_birth": true,
	"nationality": true,
	"list_source": true,
}

// removable lists fields that are always stripped.
var removable = map[string]bool{
	"id":          true,
	"internal_id": true,
	"created_at":  true,
	"updated_at":  true,
	"deleted_at":  true,
	"metadata":    true,
	"_version":    true,
}

// PackEntityContext trims an entity record to only the fields
// relevant for the match explanation.
// Full entity may have 50+ fields; we only need the matched ones.
func PackEntityContext(
	entity map[string]interface{},
	matchedFields []string,
) map[string]interface{} {
	keep := buildKeepSet(matchedFields)
	result := make(map[string]interface{}, len(keep))
	for k, v := range entity {
		if removable[k] {
			continue
		}
		if keep[k] {
			result[k] = v
		}
	}
	return result
}

func buildKeepSet(matchedFields []string) map[string]bool {
	keep := make(map[string]bool, len(alwaysKeep)+len(matchedFields))
	for k := range alwaysKeep {
		keep[k] = true
	}
	for _, f := range matchedFields {
		keep[f] = true
	}
	return keep
}

// EstimateTokens rough-estimates token count (chars / 4).
func EstimateTokens(text string) int {
	n := len(text) / 4
	if n == 0 && len(text) > 0 {
		return 1
	}
	return n
}
