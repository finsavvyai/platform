package handlers

import (
	"net/http"
	"time"
)

// GetProviders handles GET /api/v1/providers.
// Returns a list of supported CI/CD platforms.
func (h *Handlers) GetProviders(w http.ResponseWriter, r *http.Request) {
	providers := []map[string]string{
		{"id": "github", "name": "GitHub Actions", "status": "supported"},
		{"id": "gitlab", "name": "GitLab CI/CD", "status": "supported"},
		{"id": "bitbucket", "name": "Bitbucket Pipelines", "status": "supported"},
	}
	if h.cfg != nil && h.cfg.Features.ExperimentalProviders {
		providers = append(providers,
			map[string]string{"id": "jenkins", "name": "Jenkins", "status": "experimental"},
			map[string]string{"id": "azure_devops", "name": "Azure DevOps", "status": "experimental"},
			map[string]string{"id": "circleci", "name": "CircleCI", "status": "experimental"},
		)
	}

	jsonOK(w, map[string]interface{}{
		"providers": providers,
		"count":     len(providers),
	})
}

// GetProvidersStatus handles GET /api/v1/providers/status.
// Tests all active connections and returns their status.
func (h *Handlers) GetProvidersStatus(w http.ResponseWriter, r *http.Request) {
	connections := h.manager.List()

	statuses := make([]map[string]interface{}, 0, len(connections))
	for _, conn := range connections {
		status := map[string]interface{}{
			"name":      conn.Name,
			"platform":  string(conn.Platform),
			"status":    "unknown",
			"connected": false,
		}

		connStatus, err := conn.Provider.TestConnection(r.Context())
		if err != nil {
			status["status"] = "error"
			status["error"] = err.Error()
		} else {
			status["connected"] = connStatus.Connected
			status["rate_limit_ok"] = connStatus.RateLimitOK
			status["latency"] = connStatus.Latency
			if connStatus.Connected {
				status["status"] = "connected"
			} else {
				status["status"] = "error"
			}
			status["message"] = connStatus.Message
			status["user"] = connStatus.User
			if h.db != nil {
				_ = h.db.UpdateConnectionHealth(conn.Name, healthStatus(connStatus.Connected), connStatus.User, time.Now().UTC())
			}
		}

		statuses = append(statuses, status)
	}

	jsonOK(w, map[string]interface{}{
		"status": statuses,
		"count":  len(statuses),
	})
}
