package api

import "github.com/aegis-aml/aegis/internal/domain"

func entityToMap(e domain.Entity) map[string]interface{} {
	return map[string]interface{}{
		"id":      e.ID.String(),
		"type":    e.Type.String(),
		"name":    e.PrimaryName().Full,
		"given":   e.PrimaryName().Given,
		"family":  e.PrimaryName().Family,
		"list_id": e.ListID,
		"created": e.CreatedAt.Unix(),
		"updated": e.UpdatedAt.Unix(),
	}
}
