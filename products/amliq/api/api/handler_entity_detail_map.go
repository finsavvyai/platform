package api

import "github.com/aegis-aml/aegis/internal/domain"

// entityDetailMap converts an Entity to a rich JSON response
// exposing all metadata fields from OpenSanctions, OFAC, etc.
func entityDetailMap(e domain.Entity) map[string]interface{} {
	names := make([]map[string]string, len(e.Names))
	for i, n := range e.Names {
		names[i] = map[string]string{
			"full": n.Full, "given": n.Given,
			"family": n.Family, "original_script": n.OriginalScript,
		}
	}

	ids := make([]map[string]string, len(e.Identifiers))
	for i, id := range e.Identifiers {
		ids[i] = map[string]string{
			"type": string(id.Type), "value": id.Value,
			"country": id.Country,
		}
	}

	out := map[string]interface{}{
		"id":            e.ID.String(),
		"type":          e.Type.String(),
		"names":         names,
		"primary_name":  e.PrimaryName().Full,
		"identifiers":   ids,
		"addresses":     e.Addresses,
		"nationalities": e.Nationalities,
		"list_id":       e.ListID,
		"created_at":    e.CreatedAt,
		"updated_at":    e.UpdatedAt,
	}

	if e.DOB != nil {
		out["date_of_birth"] = e.DOB.Format("2006-01-02")
	}

	// Promote metadata — handle both snake_case and camelCase keys
	// from OpenSanctions data format.
	promoteEntityMeta(out, e.Metadata)

	// Pass remaining non-promoted metadata under "extra".
	extra := filterUnknownMeta(e.Metadata)
	if len(extra) > 0 {
		out["extra"] = extra
	}

	return out
}
