// Wire-format helpers shared by users.go, groups.go, and bulk.go.
// Pulled out on the Day 23 split to keep each handler file ≤200 LOC.
package scim

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
)

func parseIntDefault(s string, def int) int {
	if s == "" {
		return def
	}
	n, err := strconv.Atoi(s)
	if err != nil || n < 1 {
		return def
	}
	return n
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/scim+json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, scimType, detail string) {
	w.Header().Set("Content-Type", "application/scim+json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"schemas":  []string{ErrorSchema},
		"detail":   detail,
		"scimType": scimType,
		"status":   fmt.Sprintf("%d", status),
	})
}
