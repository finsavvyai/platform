package handlers

import (
	"net/http"
	"time"
)

// StatusResponse holds comprehensive service status information.
type StatusResponse struct {
	Status       string     `json:"status"`
	Version      string     `json:"version"`
	Uptime       int64      `json:"uptime_seconds"`
	Timestamp    time.Time  `json:"timestamp"`
	Connections  int        `json:"connections_count"`
	LastScanTime *time.Time `json:"last_scan_time,omitempty"`
	Database     HealthInfo `json:"database"`
	Vault        HealthInfo `json:"vault"`
	Billing      HealthInfo `json:"billing"`
	Providers    HealthInfo `json:"providers"`
	GitHubApp    HealthInfo `json:"github_app"`
	Webhooks     HealthInfo `json:"webhooks"`
}

// HealthInfo represents the health of a component.
type HealthInfo struct {
	Healthy bool   `json:"healthy"`
	Message string `json:"message,omitempty"`
}

var startTime = time.Now()

// Status handles GET /api/v1/status
// Returns comprehensive service health and diagnostic information for external integrations.
func (h *Handlers) Status(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Count active connections
	connCount := 0
	if h.manager != nil {
		// manager.List() returns slice of connections
		connCount = h.manager.Count()
	}

	// Check database health
	dbHealthy := true
	var dbMsg string
	if h.db == nil {
		dbHealthy = false
		dbMsg = "not initialized"
	} else if err := h.db.Ping(); err != nil {
		dbHealthy = false
		dbMsg = err.Error()
	} else {
		dbMsg = string(h.db.Driver())
	}

	// Check vault health
	vaultHealthy := true
	vaultMsg := "operational"
	if h.vault == nil {
		vaultHealthy = false
		vaultMsg = "not initialized"
	} else if !h.vault.Enabled() {
		vaultHealthy = true
		vaultMsg = "disabled (no master key)"
	}

	var lastScanTime *time.Time
	if h.db != nil {
		if ts, err := h.db.LastAnalysisTime(); err == nil {
			lastScanTime = ts
		}
	}

	billingHealthy := true
	billingMsg := "trial mode"
	if h.cfg != nil && h.cfg.Features.Billing {
		if h.billingClient == nil || h.cfg.Billing.LemonSqueezyWebhookSecret == "" {
			billingMsg = "disabled"
		} else {
			billingMsg = "configured"
		}
	}

	providersHealthy := true
	providersMsg := "ga providers enabled"
	if h.cfg != nil && h.cfg.Features.ExperimentalProviders {
		providersMsg = "ga + experimental providers enabled"
	}

	githubAppStatus := h.githubAppStatusPayload()
	githubAppHealthy := githubAppStatus.Configured
	githubAppMsg := githubAppStatus.Message
	if githubAppStatus.Configured {
		githubAppMsg = "configured"
	}

	webhooksHealthy := true
	webhooksMsg := "not configured"
	if h.db != nil {
		if cfg, err := h.db.GetWebhookConfig(defaultWebhookConfigName); err == nil {
			if cfg.Enabled {
				webhooksMsg = "configured"
			} else {
				webhooksMsg = "disabled"
			}
		}
	}

	resp := StatusResponse{
		Status:       "healthy",
		Version:      "1.0.0", // Should come from build/version
		Uptime:       int64(time.Since(startTime).Seconds()),
		Timestamp:    time.Now().UTC(),
		Connections:  connCount,
		LastScanTime: lastScanTime,
		Database: HealthInfo{
			Healthy: dbHealthy,
			Message: dbMsg,
		},
		Vault: HealthInfo{
			Healthy: vaultHealthy,
			Message: vaultMsg,
		},
		Billing: HealthInfo{
			Healthy: billingHealthy,
			Message: billingMsg,
		},
		Providers: HealthInfo{
			Healthy: providersHealthy,
			Message: providersMsg,
		},
		GitHubApp: HealthInfo{
			Healthy: githubAppHealthy,
			Message: githubAppMsg,
		},
		Webhooks: HealthInfo{
			Healthy: webhooksHealthy,
			Message: webhooksMsg,
		},
	}

	// Mark as degraded if any critical component is down
	if !dbHealthy || !vaultHealthy {
		resp.Status = "degraded"
	}

	jsonOK(w, resp)
}
