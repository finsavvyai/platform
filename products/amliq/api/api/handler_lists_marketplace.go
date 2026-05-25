package api

import (
	"database/sql"
	"net/http"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/storage"
)

// MarketplaceListsHandler serves the lists marketplace catalog.
type MarketplaceListsHandler struct {
	tenants storage.TenantRepository
	db      *sql.DB
}

func NewMarketplaceListsHandler(
	tenants storage.TenantRepository, db *sql.DB,
) *MarketplaceListsHandler {
	return &MarketplaceListsHandler{tenants: tenants, db: db}
}

func (h *MarketplaceListsHandler) ListAll(
	w http.ResponseWriter, r *http.Request,
) {
	enabledSet := h.enabledListIDs(r)
	catalog := domain.MarketplaceCatalog()
	counts, _ := CachedListCounts(r.Context(), h.loadCounts)

	items := make([]map[string]interface{}, len(catalog))
	for i, entry := range catalog {
		_, enabled := enabledSet[entry.ID]
		cnt := entry.EntityCount
		if c, ok := counts[entry.ID]; ok && c > 0 {
			cnt = c
		}
		items[i] = marketplaceItem(entry, enabled, cnt)
	}
	Success(w, map[string]interface{}{"lists": items}, http.StatusOK)
}

func marketplaceItem(
	e domain.MarketplaceEntry, enabled bool, count int,
) map[string]interface{} {
	return map[string]interface{}{
		"id": e.ID, "name": e.Name, "description": e.Description,
		"region": e.Region, "category": e.Category,
		"source_url": e.SourceURL, "entity_count": count,
		"update_frequency": e.UpdateFrequency,
		"last_synced": e.LastSynced, "enabled": enabled,
		"tier": e.Tier,
	}
}
