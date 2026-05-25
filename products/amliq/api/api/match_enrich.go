package api

import "github.com/aegis-aml/aegis/internal/domain"

// enrichMatchResult promotes entity fields and metadata into
// the match result map for rich frontend display.
func enrichMatchResult(result map[string]interface{}, ent domain.Entity) {
	result["type"] = ent.Type.String()
	result["nationalities"] = ent.Nationalities
	result["addresses"] = ent.Addresses

	if ent.DOB != nil {
		result["date_of_birth"] = ent.DOB.Format("2006-01-02")
	}
	if len(ent.Names) > 0 {
		result["given_name"] = ent.Names[0].Given
		result["family_name"] = ent.Names[0].Family
	}

	// Build aliases from additional names.
	if len(ent.Names) > 1 {
		aliases := make([]string, 0, len(ent.Names)-1)
		for _, n := range ent.Names[1:] {
			if n.Full != "" {
				aliases = append(aliases, n.Full)
			}
		}
		result["aliases"] = aliases
	}

	// Build identifiers array.
	if len(ent.Identifiers) > 0 {
		ids := make([]map[string]string, len(ent.Identifiers))
		for i, id := range ent.Identifiers {
			ids[i] = map[string]string{
				"type": string(id.Type), "value": id.Value,
				"country": id.Country,
			}
		}
		result["identifiers"] = ids
	}

	// Promote known metadata fields to top level.
	promoteMetadata(result, ent.Metadata)

	// Pass remaining metadata under "metadata" key.
	result["metadata"] = ent.Metadata
}
