package api

import (
	"fmt"
	"net/http"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/storage"
)

// TeamHandler manages team seats with PG persistence.
type TeamHandler struct {
	seats storage.SeatRepository
}

func NewTeamHandler(seats storage.SeatRepository) *TeamHandler {
	return &TeamHandler{seats: seats}
}

type InviteRequest struct {
	Email string `json:"email"`
	Role  string `json:"role"`
}

func (h *TeamHandler) InviteUser(w http.ResponseWriter, r *http.Request) {
	tenantID := GetTenantID(r)
	if tenantID == "" {
		Error(w, "UNAUTHORIZED", "missing tenant", http.StatusUnauthorized)
		return
	}
	var req InviteRequest
	if err := DecodeJSON(r, &req); err != nil {
		Error(w, "INVALID_REQUEST", "bad json", http.StatusBadRequest)
		return
	}
	if req.Email == "" {
		Error(w, "VALIDATION", "email required", http.StatusBadRequest)
		return
	}
	if _, err := domain.ParseRole(req.Role); err != nil {
		Error(w, "INVALID_ROLE", err.Error(), http.StatusBadRequest)
		return
	}
	userID := fmt.Sprintf("usr_%d", time.Now().UnixNano())
	seat, err := domain.NewSeat(tenantID, userID, req.Email, req.Role)
	if err != nil {
		Error(w, "VALIDATION", err.Error(), http.StatusBadRequest)
		return
	}
	if err := h.seats.Create(r.Context(), seat); err != nil {
		Error(w, "DB_ERROR", "invite failed", http.StatusInternalServerError)
		return
	}
	Success(w, seat, http.StatusCreated)
}

func (h *TeamHandler) ListMembers(w http.ResponseWriter, r *http.Request) {
	tenantID := GetTenantID(r)
	if tenantID == "" {
		Error(w, "UNAUTHORIZED", "missing tenant", http.StatusUnauthorized)
		return
	}
	seats, err := h.seats.ListByTenant(r.Context(), tenantID)
	if err != nil {
		Error(w, "DB_ERROR", "list failed", http.StatusInternalServerError)
		return
	}
	Success(w, map[string]interface{}{
		"members": seats, "total": len(seats),
	}, http.StatusOK)
}
