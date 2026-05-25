package api

import (
	"context"
	"net/http"

	"github.com/aegis-aml/aegis/internal/domain"
)

func (h *MarketplaceListsHandler) enabledListIDs(
	r *http.Request,
) map[string]struct{} {
	result := make(map[string]struct{})
	tenantIDStr := GetTenantID(r)
	if tenantIDStr == "" {
		return result
	}
	tid, err := domain.NewTenantID(tenantIDStr)
	if err != nil {
		return result
	}
	tenant, err := h.tenants.GetByID(tid)
	if err != nil || tenant == nil {
		return result
	}
	for _, lc := range tenant.Config.EnabledLists {
		result[lc.ListID] = struct{}{}
	}
	return result
}

func (h *MarketplaceListsHandler) loadCounts(
	ctx context.Context,
) (map[string]int, error) {
	counts := make(map[string]int)
	if h.db == nil {
		return counts, nil
	}
	rows, err := h.db.QueryContext(ctx, `
		SELECT list_id, COUNT(*) FROM entities
		GROUP BY list_id`)
	if err != nil {
		return counts, err
	}
	defer rows.Close()

	for rows.Next() {
		var listID string
		var count int
		if err := rows.Scan(&listID, &count); err == nil {
			counts[listID] = count
		}
	}
	return counts, rows.Err()
}
