package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/domain"
)

// Update modifies a monitoring profile (frequency, lists, pause/resume).
func (h *MonitorProfileHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		Error(w, "MISSING_PARAM", "profile id required", http.StatusBadRequest)
		return
	}
	profile, err := h.profiles.GetByID(r.Context(), id)
	if err != nil || profile == nil {
		Error(w, "NOT_FOUND", "profile not found", http.StatusNotFound)
		return
	}
	var req struct {
		Frequency string   `json:"frequency"`
		Lists     []string `json:"lists"`
		Status    string   `json:"status"`
	}
	if err := DecodeJSON(r, &req); err != nil {
		Error(w, "INVALID", "bad json", http.StatusBadRequest)
		return
	}
	if req.Frequency != "" {
		freq, _ := domain.ParseFrequency(req.Frequency)
		profile.Frequency = freq
	}
	if len(req.Lists) > 0 {
		profile.ListsToScreen = req.Lists
	}
	if req.Status == "paused" {
		*profile = profile.Pause()
	} else if req.Status == "active" {
		*profile = profile.Resume()
	}
	if err := h.profiles.Update(r.Context(), *profile); err != nil {
		Error(w, "DB_ERROR", "update failed", http.StatusInternalServerError)
		return
	}
	Success(w, profile, http.StatusOK)
}

// Delete removes a profile from monitoring.
func (h *MonitorProfileHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		Error(w, "MISSING_PARAM", "profile id required", http.StatusBadRequest)
		return
	}
	if err := h.profiles.Delete(r.Context(), id); err != nil {
		Error(w, "DB_ERROR", "delete failed", http.StatusInternalServerError)
		return
	}
	Success(w, map[string]string{"status": "deleted"}, http.StatusOK)
}
