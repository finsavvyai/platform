package mcp

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestMonitorEntityDef(t *testing.T) {
	def := monitorEntityDef()
	if def.Name != "monitor_entity" {
		t.Errorf("Name=%q, want monitor_entity", def.Name)
	}
	req, _ := def.InputSchema["required"].([]string)
	got := strings.Join(req, ",")
	if got != "tenant_id,entity_id,webhook_url" {
		t.Errorf("required=%q, want tenant_id,entity_id,webhook_url", got)
	}
}

func TestHandleMonitorEntity(t *testing.T) {
	tests := []struct {
		name    string
		body    monitorParams
		wantErr bool
	}{
		{
			name: "valid https url",
			body: monitorParams{
				TenantID: "t1", EntityID: "ent_a",
				WebhookURL: "https://hook.example.com/x",
			},
			wantErr: false,
		},
		{
			name: "rejects http url",
			body: monitorParams{
				TenantID: "t1", EntityID: "ent_a",
				WebhookURL: "http://hook.example.com/x",
			},
			wantErr: true,
		},
		{
			name:    "rejects empty tenant",
			body:    monitorParams{EntityID: "ent_a", WebhookURL: "https://h/x"},
			wantErr: true,
		},
		{
			name:    "rejects empty entity",
			body:    monitorParams{TenantID: "t1", WebhookURL: "https://h/x"},
			wantErr: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := testServer()
			params, _ := json.Marshal(tt.body)
			got, err := s.handleMonitorEntity(params)
			if (err != nil) != tt.wantErr {
				t.Fatalf("err=%v wantErr=%v", err, tt.wantErr)
			}
			if tt.wantErr {
				return
			}
			resp := got.(map[string]interface{})
			if resp["status"] != "active" {
				t.Errorf("status=%v, want active", resp["status"])
			}
			if !strings.HasPrefix(resp["subscription_id"].(string), "sub_") {
				t.Errorf("subscription_id missing sub_ prefix: %v", resp["subscription_id"])
			}
		})
	}
}
