package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

// Stream serves GET /api/v1/alerts/stream as Server-Sent Events.
// The dashboard polls this connection instead of /api/v1/alerts so
// new high-priority alerts surface within ~5s of insert without a
// full re-fetch of the list. Strictly tenant-scoped: only alerts
// belonging to the JWT-derived tenant are emitted.
//
// Why SSE not WebSocket: SSE is one-way (server → client), survives
// HTTP/2 multiplexing, replays cleanly through reverse proxies, and
// needs no separate auth handshake — the existing JWT middleware on
// /api/v1/* covers it. WebSocket would need a token-in-querystring
// shim that an auditor would flag.
func (ah *AlertHandler) Stream(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		Error(w, "MISSING_AUTH", "invalid or missing claims",
			http.StatusUnauthorized)
		return
	}
	tid, err := domain.NewTenantID(claims.TenantID)
	if err != nil {
		Error(w, "INVALID_TENANT", err.Error(), http.StatusBadRequest)
		return
	}
	flusher, ok := w.(http.Flusher)
	if !ok {
		Error(w, "STREAM_UNSUPPORTED",
			"server does not support streaming",
			http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no") // nginx: disable buffering
	flusher.Flush()

	seen := make(map[string]struct{})
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()
	keepalive := time.NewTicker(20 * time.Second)
	defer keepalive.Stop()

	for {
		select {
		case <-r.Context().Done():
			return
		case <-keepalive.C:
			fmt.Fprintf(w, ": ping\n\n")
			flusher.Flush()
		case <-ticker.C:
			alerts, err := ah.alerts.ListByTenant(tid)
			if err != nil {
				continue
			}
			for _, a := range alerts {
				if _, ok := seen[a.ID]; ok {
					continue
				}
				seen[a.ID] = struct{}{}
				payload, err := json.Marshal(a)
				if err != nil {
					continue
				}
				fmt.Fprintf(w, "event: alert\ndata: %s\n\n", payload)
				flusher.Flush()
			}
		}
	}
}
