package api

import (
	"net/http"
	"os"
)

// handleBillingHealth returns billing system status.
func handleBillingHealth(w http.ResponseWriter, _ *http.Request) {
	lsConfigured := os.Getenv("LS_API_KEY") != ""
	mode := "free_tier"
	if lsConfigured {
		mode = "production"
	}

	Success(w, map[string]interface{}{
		"status":          "healthy",
		"mode":            mode,
		"ls_configured":   lsConfigured,
		"webhook_enabled": os.Getenv("LS_WEBHOOK_SECRET") != "",
	}, http.StatusOK)
}
