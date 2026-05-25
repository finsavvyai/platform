package domain

import "testing"

func TestNewWebhookPayload(t *testing.T) {
	tests := []struct {
		name      string
		eventType WebhookEventType
		tenantID  string
		data      interface{}
	}{
		{"case created", WebhookCaseCreated, "tnt_abc", map[string]string{"id": "c1"}},
		{"case assigned", WebhookCaseAssigned, "tnt_abc", nil},
		{"case escalated", WebhookCaseEscalated, "tnt_abc", "data"},
		{"case resolved", WebhookCaseResolved, "tnt_abc", 42},
		{"alert created", WebhookAlertCreated, "tnt_def", nil},
		{"txn alert", WebhookTxnAlert, "tnt_def", nil},
		{"monitor match", WebhookMonitorMatch, "tnt_ghi", nil},
		{"edd completed", WebhookEDDCompleted, "tnt_ghi", nil},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p := NewWebhookPayload(tt.eventType, tt.tenantID, tt.data)
			if p.EventType != tt.eventType {
				t.Errorf("EventType = %s, want %s", p.EventType, tt.eventType)
			}
			if p.TenantID != tt.tenantID {
				t.Errorf("TenantID = %s, want %s", p.TenantID, tt.tenantID)
			}
			if p.ID == "" {
				t.Error("ID should not be empty")
			}
			if p.CreatedAt.IsZero() {
				t.Error("CreatedAt should be set")
			}
		})
	}
}
