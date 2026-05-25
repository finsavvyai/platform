package api

import "net/http"

// RemoveMember deactivates a team member's seat.
// DELETE /api/v1/team/{id}
func (h *TeamHandler) RemoveMember(w http.ResponseWriter, r *http.Request) {
	seatID := PathParam(r, "id")
	if seatID == "" {
		Error(w, "VALIDATION", "member id required", http.StatusBadRequest)
		return
	}
	if err := h.seats.Deactivate(r.Context(), seatID); err != nil {
		Error(w, "DB_ERROR", "remove failed", http.StatusInternalServerError)
		return
	}
	Success(w, map[string]string{
		"id": seatID, "status": "removed",
	}, http.StatusOK)
}
