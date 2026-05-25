package api

// allMetaKeys covers both snake_case and camelCase variants
// from OpenSanctions data format.
var allMetaKeys = map[string]bool{
	"emails": true, "phones": true, "websites": true,
	"sanctions": true, "programs": true, "remarks": true,
	"source_url": true, "sourceUrl": true,
	"birth_place": true, "birthPlace": true,
	"birth_country": true, "birthCountry": true,
	"dataset": true, "schema_type": true, "schemaType": true,
	"listing_date": true, "listingDate": true,
	"first_seen": true, "firstSeen": true,
	"last_seen": true, "lastSeen": true,
	"last_change": true, "lastChange": true,
	"extended_data": true, "extendedData": true,
	"gender": true, "position": true,
	"pep_tier": true, "pepTier": true,
}

// promoteEntityMeta lifts known metadata fields into the output map,
// skipping empty values, and normalizing to consistent output keys.
func promoteEntityMeta(out, meta map[string]interface{}) {
	if meta == nil {
		return
	}
	// Map of (input key → output key) for normalization.
	keyMap := map[string]string{
		"emails": "emails", "phones": "phones",
		"websites": "websites", "sanctions": "sanctions",
		"programs": "programs", "remarks": "remarks",
		"source_url": "source_url", "sourceUrl": "source_url",
		"birth_place": "birth_place", "birthPlace": "birth_place",
		"birth_country": "birth_country", "birthCountry": "birth_country",
		"dataset": "dataset",
		"schema_type": "schema_type", "schemaType": "schema_type",
		"listing_date": "listing_date", "listingDate": "listing_date",
		"first_seen": "first_seen", "firstSeen": "first_seen",
		"last_seen": "last_seen", "lastSeen": "last_seen",
		"last_change": "last_change", "lastChange": "last_change",
		"extended_data": "extended_data", "extendedData": "extended_data",
		"gender": "gender", "position": "position",
		"pep_tier": "pep_tier", "pepTier": "pep_tier",
	}
	for inKey, outKey := range keyMap {
		v, ok := meta[inKey]
		if !ok || isEmptyValue(v) {
			continue
		}
		// Don't overwrite if already set by a previous variant.
		if _, exists := out[outKey]; exists {
			continue
		}
		out[outKey] = v
	}
}

// filterUnknownMeta returns metadata keys not in the known set.
func filterUnknownMeta(meta map[string]interface{}) map[string]interface{} {
	extra := make(map[string]interface{})
	for k, v := range meta {
		if !allMetaKeys[k] && !isEmptyValue(v) {
			extra[k] = v
		}
	}
	return extra
}
