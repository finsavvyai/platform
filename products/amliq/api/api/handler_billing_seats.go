package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/storage"
)

type AddSeatRequest struct {
	Email string `json:"email"`
	Role  string `json:"role"`
}

const defaultSeatLimit = 3

func handleAddSeat(seats storage.SeatRepository, seatLimit int) http.HandlerFunc {
	if seatLimit <= 0 {
		seatLimit = defaultSeatLimit
	}
	return func(w http.ResponseWriter, req *http.Request) {
		tenantID := GetTenantID(req)
		if tenantID == "" {
			Error(w, "UNAUTHORIZED", "tenant_id required", http.StatusUnauthorized)
			return
		}
		var sr AddSeatRequest
		if err := json.NewDecoder(req.Body).Decode(&sr); err != nil {
			Error(w, "INVALID_REQUEST", "invalid body", http.StatusBadRequest)
			return
		}
		count, err := seats.CountByTenant(req.Context(), tenantID)
		if err != nil {
			Error(w, "INTERNAL", "count seats failed", http.StatusInternalServerError)
			return
		}
		if count >= seatLimit {
			Error(w, "SEAT_LIMIT",
				fmt.Sprintf("plan limit of %d seats reached", seatLimit),
				http.StatusForbidden)
			return
		}
		userID := fmt.Sprintf("usr_%d", time.Now().UnixNano())
		seat, err := domain.NewSeat(tenantID, userID, sr.Email, sr.Role)
		if err != nil {
			Error(w, "VALIDATION_ERROR", err.Error(), http.StatusBadRequest)
			return
		}
		if err := seats.Create(req.Context(), seat); err != nil {
			Error(w, "INTERNAL", "create seat failed", http.StatusInternalServerError)
			return
		}
		Success(w, seat, http.StatusCreated)
	}
}

func handleGetSeats(seats storage.SeatRepository) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		tenantID := GetTenantID(req)
		if tenantID == "" {
			Error(w, "UNAUTHORIZED", "tenant_id required", http.StatusUnauthorized)
			return
		}
		list, err := seats.ListByTenant(req.Context(), tenantID)
		if err != nil {
			Error(w, "INTERNAL", "list seats failed", http.StatusInternalServerError)
			return
		}
		if list == nil {
			list = []domain.Seat{}
		}
		Success(w, map[string]interface{}{"seats": list}, http.StatusOK)
	}
}

func handleDeleteSeat(seats storage.SeatRepository) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		seatID := req.PathValue("id")
		if seatID == "" {
			Error(w, "INVALID_REQUEST", "seat id required", http.StatusBadRequest)
			return
		}
		if err := seats.Deactivate(req.Context(), seatID); err != nil {
			Error(w, "INTERNAL", "deactivate seat failed", http.StatusInternalServerError)
			return
		}
		Success(w, map[string]string{"status": "deactivated"}, http.StatusOK)
	}
}
