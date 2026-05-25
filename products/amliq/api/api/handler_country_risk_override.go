package api

import (
	"encoding/json"
	"net/http"
	"strings"
)

type OverrideRequest struct {
	Score float64 `json:"score"`
}

func (h *CountryRiskHandler) SetOverride(
	w http.ResponseWriter,
	r *http.Request,
) {
	tenantID := GetTenantID(r)
	if tenantID == "" {
		Error(w, "UNAUTHORIZED", "missing tenant",
			http.StatusUnauthorized)
		return
	}

	code := strings.TrimSpace(r.PathValue("code"))
	if code == "" {
		Error(w, "MISSING_PARAM", "country code required",
			http.StatusBadRequest)
		return
	}

	var req OverrideRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		Error(w, "INVALID_JSON", "malformed request",
			http.StatusBadRequest)
		return
	}

	if err := h.index.SetOverride(tenantID, code, req.Score); err != nil {
		Error(w, "INVALID_SCORE", err.Error(),
			http.StatusBadRequest)
		return
	}

	Success(w, map[string]interface{}{
		"code":   code,
		"tenant": tenantID,
		"score":  req.Score,
	}, http.StatusOK)
}
