package billing

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestWebhookEventUnmarshal(t *testing.T) {
	eventJSON := `{
		"type": "subscription_created",
		"data": {
			"id": "sub_123",
			"attributes": {
				"status": "active",
				"meta": {"tenant_id": "t1"}
			}
		}
	}`

	var evt WebhookEvent
	err := json.Unmarshal([]byte(eventJSON), &evt)
	if err != nil {
		t.Fatalf("Unmarshal() error = %v", err)
	}
	if evt.Type != "subscription_created" {
		t.Errorf("Type = %v, want subscription_created", evt.Type)
	}
	if evt.Data == nil {
		t.Error("Data should not be nil")
	}
}

func TestParseWebhookEventCases(t *testing.T) {
	tests := []struct {
		name    string
		body    string
		wantErr bool
	}{
		{"valid", `{"type":"subscription_created","data":{}}`, false},
		{"missing type", `{"data":{}}`, true},
		{"invalid json", `{invalid}`, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := ParseWebhookEvent(strings.NewReader(tt.body))
			if (err != nil) != tt.wantErr {
				t.Errorf("err = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestExtractTenantID(t *testing.T) {
	evt := WebhookEvent{
		Type: "subscription_created",
		Data: map[string]interface{}{
			"attributes": map[string]interface{}{
				"meta": map[string]interface{}{
					"tenant_id": "t1",
				},
			},
		},
	}

	tenantID, err := ExtractTenantID(evt)
	if err != nil {
		t.Fatalf("ExtractTenantID() error = %v", err)
	}
	if tenantID != "t1" {
		t.Errorf("tenantID = %s, want t1", tenantID)
	}
}

func TestExtractTenantIDMissing(t *testing.T) {
	evt := WebhookEvent{
		Type: "subscription_created",
		Data: map[string]interface{}{},
	}

	_, err := ExtractTenantID(evt)
	if err == nil {
		t.Error("ExtractTenantID() should fail for missing data")
	}
}
