package api

import "net/http"

func (sh *ScreenHandler) GetScreening(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		Error(w, "MISSING_AUTH", "invalid or missing claims",
			http.StatusUnauthorized)
		return
	}

	screeningID := PathParam(r, "id")
	if screeningID == "" {
		Error(w, "MISSING_PARAM", "id required", http.StatusBadRequest)
		return
	}

	screening, err := sh.screenings.GetByID(screeningID)
	if err != nil {
		Error(w, "DB_ERROR", "screening lookup failed",
			http.StatusInternalServerError)
		return
	}
	if screening == nil || screening.Request.TenantID.String() != claims.TenantID {
		Error(w, "NOT_FOUND", "screening not found", http.StatusNotFound)
		return
	}

	response := map[string]interface{}{
		"id":              screening.ID,
		"status":          "completed",
		"matches":         len(screening.Matches),
		"timestamp":       screening.Timestamp.Unix(),
		"processing_time": screening.ProcessingTime.Milliseconds(),
	}
	Success(w, response, http.StatusOK)
}
