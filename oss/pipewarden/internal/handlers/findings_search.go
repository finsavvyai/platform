package handlers

import (
	"net/http"
	"strconv"

	"github.com/finsavvyai/pipewarden/internal/search"
)

// SearchFindings handles GET /api/v1/findings/search?q=...&mode=hybrid&k=20
//
// mode: keyword | semantic | hybrid (default hybrid).
// Hybrid blends BM25 (keyword) with character-trigram cosine (semantic).
// Index is in-memory and hydrated from storage on boot, then incrementally
// updated as new findings persist (see persistFindings).
func (h *Handlers) SearchFindings(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	q := r.URL.Query().Get("q")
	if q == "" {
		jsonError(w, "q is required", http.StatusBadRequest)
		return
	}

	mode := search.SearchMode(r.URL.Query().Get("mode"))
	switch mode {
	case "", search.ModeKeyword, search.ModeSemantic, search.ModeHybrid:
		// ok
	default:
		jsonError(w, "mode must be keyword, semantic, or hybrid", http.StatusBadRequest)
		return
	}

	k := 20
	if raw := r.URL.Query().Get("k"); raw != "" {
		if n, err := strconv.Atoi(raw); err == nil && n > 0 && n <= 200 {
			k = n
		}
	}

	if h.localSearch == nil {
		jsonOK(w, map[string]any{"hits": []search.LocalHit{}, "query": q, "mode": mode, "indexed": 0})
		return
	}

	hits := h.localSearch.Search(q, mode, k)
	jsonOK(w, map[string]any{
		"hits":    hits,
		"query":   q,
		"mode":    mode,
		"indexed": h.localSearch.Size(),
		"count":   len(hits),
	})
}
