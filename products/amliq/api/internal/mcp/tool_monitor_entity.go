package mcp

import (
	"encoding/json"
	"fmt"
	"strings"
)

// monitorEntityDef is the MCP tool definition for S9-08
// monitor_entity. Once registered, list-update events for the watched
// entity push an HMAC-SHA256-signed webhook to the supplied URL.
func monitorEntityDef() ToolDef {
	return ToolDef{
		Name: "monitor_entity",
		Description: "Subscribe to ongoing-monitoring events for an " +
			"entity. Returns a subscription ID. Webhook payload is " +
			"signed with HMAC-SHA256 (X-Aegis-Signature header).",
		InputSchema: objSchema(map[string]interface{}{
			"tenant_id":   strProp("Tenant the subscription belongs to"),
			"entity_id":   strProp("Entity ID to watch (from a prior screen_entity call)"),
			"webhook_url": strProp("HTTPS endpoint to receive change events"),
			"events":      arrayProp("Optional event filter; default: monitor.match_found"),
		}, []string{"tenant_id", "entity_id", "webhook_url"}),
	}
}

type monitorParams struct {
	TenantID   string   `json:"tenant_id"`
	EntityID   string   `json:"entity_id"`
	WebhookURL string   `json:"webhook_url"`
	Events     []string `json:"events"`
}

func (s *Server) handleMonitorEntity(params json.RawMessage) (interface{}, error) {
	var p monitorParams
	if err := json.Unmarshal(params, &p); err != nil {
		return nil, fmt.Errorf("bad params: %w", err)
	}
	if !strings.HasPrefix(p.WebhookURL, "https://") {
		return nil, fmt.Errorf("webhook_url must use https://")
	}
	if s.registrar == nil {
		return nil, fmt.Errorf("monitoring registrar not configured")
	}
	sub, err := s.registrar.Register(p.TenantID, p.EntityID, p.WebhookURL, p.Events)
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{
		"subscription_id": sub.ID,
		"tenant_id":       sub.TenantID,
		"entity_id":       sub.EntityID,
		"events":          sub.Events,
		"created_at":      sub.CreatedAt.Format("2006-01-02T15:04:05Z"),
		"status":          "active",
	}, nil
}
