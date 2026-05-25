package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/storage"
)

type ListsHandler struct {
	tenants  storage.TenantRepository
	entities storage.EntityRepository
}

func NewListsHandler(
	tenants storage.TenantRepository,
	entities storage.EntityRepository,
) *ListsHandler {
	return &ListsHandler{
		tenants:  tenants,
		entities: entities,
	}
}

func (lh *ListsHandler) GetListMetadata(w http.ResponseWriter, r *http.Request) {
	listID := PathParam(r, "id")
	if listID == "" {
		Error(w, "MISSING_PARAM", "id required", http.StatusBadRequest)
		return
	}

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

	var found *domain.ListConfig
	for i := range tenant.Config.EnabledLists {
		if tenant.Config.EnabledLists[i].ListID == listID {
			found = &tenant.Config.EnabledLists[i]
			break
		}
	}

	if found == nil {
		Error(w, "NOT_FOUND", "list not found", http.StatusNotFound)
		return
	}

	response := map[string]interface{}{
		"id":           found.ListID,
		"source_url":   found.SourceURL,
		"custom_url":   found.CustomSourceURL,
		"parser_type":  found.ParserType,
		"entity_count": found.EntityCount,
		"last_synced":  found.LastSyncedAt.Unix(),
		"sync_enabled": found.SyncEnabled,
		"threshold":    found.Threshold,
	}
	Success(w, response, http.StatusOK)
}
