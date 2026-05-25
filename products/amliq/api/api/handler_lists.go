package api

import (
	"context"
	"log"
	"net/http"

	"github.com/aegis-aml/aegis/internal/domain"
	spgx "github.com/aegis-aml/aegis/internal/storage/pgx"
)

func (lh *ListsHandler) ListMetadata(w http.ResponseWriter, r *http.Request) {
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

	tenant, err := lh.tenants.GetByID(tenantID)
	if err != nil {
		Error(w, "DB_ERROR", "internal error", http.StatusInternalServerError)
		return
	}
	if tenant == nil {
		Error(w, "NOT_FOUND", "tenant not found", http.StatusNotFound)
		return
	}

	// Get real entity counts from DB (cached ~2h, invalidated on refresh).
	// On cache/DB error fall back to zero counts so the endpoint still
	// returns list metadata rather than failing the whole request.
	counts := make(map[string]int)
	if pgxRepo, ok := lh.entities.(*spgx.EntityRepository); ok {
		got, err := CachedListCounts(r.Context(),
			func(ctx context.Context) (map[string]int, error) {
				return pgxRepo.CountByListID(ctx)
			})
		if err != nil {
			log.Printf("list counts cache miss (tenant=%s): %v", tenantID, err)
		} else {
			counts = got
		}
	}

	lists := make([]map[string]interface{}, len(tenant.Config.EnabledLists))
	for i, lc := range tenant.Config.EnabledLists {
		count := counts[lc.ListID]
		lists[i] = map[string]interface{}{
			"id":           lc.ListID,
			"source_url":   lc.SourceURL,
			"custom_url":   lc.CustomSourceURL,
			"parser_type":  lc.ParserType,
			"entity_count": count,
			"last_synced":  lc.LastSyncedAt.Unix(),
			"sync_enabled": lc.SyncEnabled,
			"threshold":    lc.Threshold,
		}
	}

	response := map[string]interface{}{"lists": lists}
	Paginated(w, response, int64(len(lists)), http.StatusOK)
}

func (lh *ListsHandler) SyncList(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		Error(w, "METHOD_NOT_ALLOWED", "use POST", http.StatusMethodNotAllowed)
		return
	}

	listID := PathParam(r, "id")
	if listID == "" {
		Error(w, "MISSING_PARAM", "id required", http.StatusBadRequest)
		return
	}

	response := map[string]interface{}{
		"list_id": listID,
		"status":  "syncing",
	}
	Success(w, response, http.StatusAccepted)
}
