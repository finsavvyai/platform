package handlers

import (
	"net/http"
	"strconv"
	"strings"
)

// SimilarFindingsResponse is the payload returned by the "similar findings"
// endpoint. When the RuVector client is disabled it returns an empty hits
// slice with enabled=false so dashboards can hide the UI affordance.
type SimilarFindingsResponse struct {
	FindingID int64            `json:"finding_id"`
	Enabled   bool             `json:"enabled"`
	Hits      []SimilarFinding `json:"hits"`
}

// SimilarFinding is one entry in the similar-findings result list.
type SimilarFinding struct {
	ID    int64   `json:"id"`
	Score float64 `json:"score"`
	Title string  `json:"title"`
	Why   string  `json:"why,omitempty"`
}

// GetSimilarFindings handles GET /api/v1/findings/{id}/similar.
// Returns the top-k structurally/semantically similar findings via RuVector.
// If RuVector is not configured the response has enabled=false and hits=[].
func (h *Handlers) GetSimilarFindings(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	id, err := extractFindingIDFromSimilarPath(r.URL.Path)
	if err != nil {
		jsonError(w, "invalid finding ID", http.StatusBadRequest)
		return
	}

	k := 10
	if s := r.URL.Query().Get("k"); s != "" {
		if n, err := strconv.Atoi(s); err == nil && n > 0 && n <= 50 {
			k = n
		}
	}

	resp := SimilarFindingsResponse{FindingID: id, Enabled: h.searchClient.Enabled(), Hits: []SimilarFinding{}}

	if !h.searchClient.Enabled() {
		jsonOK(w, resp)
		return
	}

	hits, err := h.searchClient.Similar(r.Context(), id, k)
	if err != nil {
		h.logger.Warnw("similar findings query failed", "finding_id", id, "error", err)
		jsonError(w, "similar findings unavailable", http.StatusBadGateway)
		return
	}

	resp.Hits = make([]SimilarFinding, 0, len(hits))
	for _, hit := range hits {
		resp.Hits = append(resp.Hits, SimilarFinding{
			ID: hit.ID, Score: hit.Score, Title: hit.Title, Why: hit.Why,
		})
	}
	jsonOK(w, resp)
}

func extractFindingIDFromSimilarPath(path string) (int64, error) {
	trimmed := strings.TrimPrefix(path, "/api/v1/findings/")
	trimmed = strings.TrimSuffix(trimmed, "/similar")
	return strconv.ParseInt(trimmed, 10, 64)
}
