package api

// promoteMetadata lifts important metadata fields to the top level
// of a match result map so the frontend can display them directly.
func promoteMetadata(result map[string]interface{}, meta map[string]interface{}) {
	if meta == nil {
		return
	}
	// Fields to promote — these map to OpenSanctions schema.
	promoted := []string{
		"dataset", "schemaType", "schema_type",
		"firstSeen", "first_seen", "lastSeen", "last_seen",
		"lastChange", "last_change", "listingDate", "listing_date",
		"birthPlace", "birth_place", "birthCountry", "birth_country",
		"sourceUrl", "source_url",
		"gender", "position", "pep_tier", "pepTier",
		"programs", "sanctions", "remarks",
	}
	for _, key := range promoted {
		v, ok := meta[key]
		if !ok {
			continue
		}
		if isEmptyValue(v) {
			continue
		}
		result[key] = v
	}

	// Promote list-like fields, normalizing to arrays.
	promoteListField(result, meta, "emails")
	promoteListField(result, meta, "phones")
	promoteListField(result, meta, "websites")
}

// promoteListField promotes a field that may be a string, array,
// or empty value into a proper array in the result.
func promoteListField(
	result map[string]interface{},
	meta map[string]interface{},
	key string,
) {
	v, ok := meta[key]
	if !ok {
		return
	}
	switch val := v.(type) {
	case []interface{}:
		if len(val) > 0 {
			result[key] = val
		}
	case string:
		if val != "" {
			result[key] = []string{val}
		}
	}
}

// isEmptyValue returns true for nil, empty strings, and empty slices.
func isEmptyValue(v interface{}) bool {
	if v == nil {
		return true
	}
	if s, ok := v.(string); ok {
		return s == ""
	}
	if a, ok := v.([]interface{}); ok {
		return len(a) == 0
	}
	return false
}
