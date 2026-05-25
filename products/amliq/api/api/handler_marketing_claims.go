package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/marketing"
)

// handleMarketingClaims serves the canonical public-facing claims
// (list count, entity count, latency, pricing). Public endpoint —
// no auth — so the landing page, llms.txt generator, and any
// frontend can fetch a single source of truth and stop drifting.
//
// Cache-Control kept short (5 min) so a marketing change rolls out
// without a deploy of every consumer.
func handleMarketingClaims(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Cache-Control", "public, max-age=300")
	Success(w, marketing.Canonical(), http.StatusOK)
}
