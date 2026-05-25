package handlers

import (
	"encoding/json"
	"net/http"
)

// APIDocs handles GET /api/v1/docs — returns the OpenAPI 3.0.0 specification.
func (h *Handlers) APIDocs(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(openAPISpec)
}
