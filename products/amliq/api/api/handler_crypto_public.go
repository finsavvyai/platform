package api

import (
	"net/http"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/screening"
)

func publicCryptoScreen(
	idx *screening.CryptoIndex,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ip := clientIP(r)
		if !publicScreenDemoLimiter.Allow(ip) {
			Error(w, "RATE_LIMITED", "demo: 2 checks/hour",
				http.StatusTooManyRequests)
			return
		}

		var req struct {
			Address string `json:"wallet_address"`
		}
		if err := DecodeJSON(r, &req); err != nil {
			Error(w, "INVALID", "bad json", http.StatusBadRequest)
			return
		}
		if req.Address == "" {
			Error(w, "VALIDATION", "wallet_address required",
				http.StatusBadRequest)
			return
		}

		start := time.Now()
		entry, found := idx.Lookup(req.Address)
		elapsed := time.Since(start).Microseconds()

		decision := "CLEAR"
		if found {
			decision = "BLOCKED"
		}

		var hits []domain.CryptoEntry
		if found {
			hits = append(hits, entry)
		}

		Success(w, map[string]interface{}{
			"decision":       decision,
			"wallet_address": req.Address,
			"sanctioned":     found,
			"hits":           hits,
			"wallets_in_db":  idx.Count(),
			"processing_us":  elapsed,
		}, http.StatusOK)
	}
}
