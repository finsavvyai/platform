package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/storage"
)

// TeamRoleHandler manages role changes for team members.
type TeamRoleHandler struct {
	seats storage.SeatRepository
}

func NewTeamRoleHandler(seats storage.SeatRepository) *TeamRoleHandler {
	return &TeamRoleHandler{seats: seats}
}

type UpdateRoleRequest struct {
	Role string `json:"role"`
}

func (h *TeamRoleHandler) UpdateRole(w http.ResponseWriter, r *http.Request) {
	seatID := PathParam(r, "id")
	if seatID == "" {
		Error(w, "MISSING_PARAM", "seat id required", http.StatusBadRequest)
		return
	}
	var req UpdateRoleRequest
	if err := DecodeJSON(r, &req); err != nil {
		Error(w, "INVALID_REQUEST", "bad json", http.StatusBadRequest)
		return
	}
	role, err := domain.ParseRole(req.Role)
	if err != nil {
		Error(w, "INVALID_ROLE", err.Error(), http.StatusBadRequest)
		return
	}
	if err := h.seats.UpdateRole(r.Context(), seatID, role); err != nil {
		Error(w, "DB_ERROR", "role update failed",
			http.StatusInternalServerError)
		return
	}
	Success(w, map[string]interface{}{
		"seat_id": seatID, "role": role.String(),
	}, http.StatusOK)
}
