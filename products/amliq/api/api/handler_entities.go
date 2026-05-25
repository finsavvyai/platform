package api

import (
	"context"
	"net/http"
	"strconv"

	"github.com/aegis-aml/aegis/internal/domain"
)

// EntitySearcher searches entities with full-text and fuzzy matching.
type EntitySearcher interface {
	FullTextSearch(ctx context.Context, tenantID domain.TenantID, query string, limit int) ([]domain.Entity, error)
}

// EntitySearchHandler handles entity search requests.
type EntitySearchHandler struct {
	entities EntitySearcher
}

// NewEntitySearchHandler creates a new entity search handler.
func NewEntitySearchHandler(entities EntitySearcher) *EntitySearchHandler {
	return &EntitySearchHandler{entities: entities}
}

// Search handles GET /api/v1/entities?q=query&limit=N.
func (h *EntitySearchHandler) Search(w http.ResponseWriter, r *http.Request) {
	tenantIDStr := GetTenantID(r)
	if tenantIDStr == "" {
		Error(w, "MISSING_TENANT", "tenant_id required", http.StatusBadRequest)
		return
	}

	tenantID, err := domain.NewTenantID(tenantIDStr)
	if err != nil {
		Error(w, "INVALID_TENANT", err.Error(), http.StatusBadRequest)
		return
	}

	query := r.URL.Query().Get("q")
	if query == "" {
		Error(w, "MISSING_QUERY", "q parameter required", http.StatusBadRequest)
		return
	}

	limit := 100
	if l := r.URL.Query().Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	ctx := context.Background()
	entities, err := h.entities.FullTextSearch(ctx, tenantID, query, limit)
	if err != nil {
		Error(w, "SEARCH_ERROR", "entity search failed", http.StatusInternalServerError)
		return
	}

	items := make([]map[string]interface{}, len(entities))
	for i, e := range entities {
		items[i] = entityToMap(e)
	}
	Paginated(w, map[string]interface{}{"entities": items},
		int64(len(items)), http.StatusOK)
}
