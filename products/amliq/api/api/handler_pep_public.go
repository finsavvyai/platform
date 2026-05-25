package api

import (
	"net/http"
	"time"

	"github.com/aegis-aml/aegis/internal/storage"
)

var pepPublicLimiter = NewIPRateLimiter(2, 1*time.Hour)

// PublicPEPScreen handles unauthenticated PEP name searches.
// Limited to 2 requests per hour per IP. Blocks bots.
func PublicPEPScreen(peps storage.PEPRepository) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if isCloudflareBot(r) {
			Error(w, "BOT_DETECTED", "automated requests blocked",
				http.StatusForbidden)
			return
		}
		ip := clientIP(r)
		if !pepPublicLimiter.Allow(ip) {
			Error(w, "RATE_LIMITED",
				"free PEP search limited to 2 per hour",
				http.StatusTooManyRequests)
			return
		}
		var req PEPScreenRequest
		if err := DecodeJSON(r, &req); err != nil {
			Error(w, "INVALID", "bad json", http.StatusBadRequest)
			return
		}
		if req.Name == "" {
			Error(w, "VALIDATION", "name required",
				http.StatusBadRequest)
			return
		}
		results, err := peps.SearchByName(r.Context(), req.Name, 10)
		if err != nil {
			Error(w, "DB_ERROR", "search failed",
				http.StatusInternalServerError)
			return
		}
		Success(w, map[string]interface{}{
			"results": results, "total": len(results),
		}, http.StatusOK)
	}
}
