package api

import (
	"encoding/json"
	"net/http"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/ingestion"
	"github.com/aegis-aml/aegis/internal/storage"
)

// TenantListsHandler lets a tenant admin view the catalog of lists
// and toggle their tenant's EnabledLists / schedules / thresholds.
// Mandatory lists (ingestion.MandatoryListIDs) are returned but
// cannot be disabled — only schedule/threshold overrides are kept.
type TenantListsHandler struct {
	tenants storage.TenantRepository
}

func NewTenantListsHandler(t storage.TenantRepository) *TenantListsHandler {
	return &TenantListsHandler{tenants: t}
}

// listItem is the API shape — one row per available list.
type listItem struct {
	ListID       string  `json:"list_id"`
	ParserType   string  `json:"parser_type"`
	Mandatory    bool    `json:"mandatory"`
	SyncEnabled  bool    `json:"sync_enabled"`
	SyncSchedule string  `json:"sync_schedule"`
	Threshold    float64 `json:"threshold"`
}

// GET /v1/tenants/:id/lists — catalog + tenant overrides merged.
func (h *TenantListsHandler) Get(w http.ResponseWriter, r *http.Request) {
	tid, ok := h.resolveTenant(w, r)
	if !ok {
		return
	}
	tenant, err := h.tenants.GetByID(tid)
	if err != nil || tenant == nil {
		Error(w, "NOT_FOUND", "tenant not found", http.StatusNotFound)
		return
	}
	Success(w, buildListView(*tenant), http.StatusOK)
}

// PUT /v1/tenants/:id/lists — replace tenant EnabledLists.
func (h *TenantListsHandler) Put(w http.ResponseWriter, r *http.Request) {
	tid, ok := h.resolveTenant(w, r)
	if !ok {
		return
	}
	var body struct {
		Lists []domain.ListConfig `json:"lists"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		Error(w, "BAD_BODY", err.Error(), http.StatusBadRequest)
		return
	}
	tenant, err := h.tenants.GetByID(tid)
	if err != nil || tenant == nil {
		Error(w, "NOT_FOUND", "tenant not found", http.StatusNotFound)
		return
	}
	// Force-enable mandatory entries regardless of client input.
	for i, lc := range body.Lists {
		if ingestion.IsMandatory(lc.ListID) {
			body.Lists[i].SyncEnabled = true
		}
	}
	tenant.Config.EnabledLists = body.Lists
	if err := h.tenants.Update(*tenant); err != nil {
		Error(w, "DB_ERROR", "update failed", http.StatusInternalServerError)
		return
	}
	Success(w, buildListView(*tenant), http.StatusOK)
}

func (h *TenantListsHandler) resolveTenant(
	w http.ResponseWriter, r *http.Request,
) (domain.TenantID, bool) {
	tid, err := domain.NewTenantID(PathParam(r, "id"))
	if err != nil {
		Error(w, "INVALID_ID", err.Error(), http.StatusBadRequest)
		return tid, false
	}
	return tid, true
}

func buildListView(t domain.Tenant) []listItem {
	overrides := map[string]domain.ListConfig{}
	for _, lc := range t.Config.EnabledLists {
		overrides[lc.ListID] = lc
	}
	out := make([]listItem, 0)
	for _, lc := range ingestion.AllMajorLists() {
		if o, ok := overrides[lc.ListID]; ok {
			lc = o
		}
		out = append(out, listItem{
			ListID: lc.ListID, ParserType: lc.ParserType,
			Mandatory:    ingestion.IsMandatory(lc.ListID),
			SyncEnabled:  lc.SyncEnabled || ingestion.IsMandatory(lc.ListID),
			SyncSchedule: lc.SyncSchedule, Threshold: lc.Threshold,
		})
	}
	return out
}
