package domain

import "testing"

func TestNewWebhookEndpoint(t *testing.T) {
	tid, _ := NewTenantID("tnt_abcdefghijkl")
	tests := []struct {
		name    string
		tenant  TenantID
		url     string
		events  []WebhookEventType
		wantErr bool
	}{
		{"valid", tid, "https://example.com/hook", []WebhookEventType{WebhookCaseCreated}, false},
		{"multiple events", tid, "https://example.com/hook", []WebhookEventType{WebhookCaseCreated, WebhookAlertCreated}, false},
		{"zero tenant", TenantID{}, "https://example.com/hook", []WebhookEventType{WebhookCaseCreated}, true},
		{"empty url", tid, "", []WebhookEventType{WebhookCaseCreated}, true},
		{"invalid url", tid, "not-a-url", []WebhookEventType{WebhookCaseCreated}, true},
		{"no events", tid, "https://example.com/hook", []WebhookEventType{}, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ep, err := NewWebhookEndpoint(tt.tenant, tt.url, "secret", tt.events)
			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected: %v", err)
			}
			if !ep.Active {
				t.Error("expected Active=true")
			}
			if ep.ID == "" {
				t.Error("ID should not be empty")
			}
		})
	}
}

func TestWebhookEndpointSubscribedTo(t *testing.T) {
	tid, _ := NewTenantID("tnt_abcdefghijkl")
	ep, _ := NewWebhookEndpoint(tid, "https://example.com/hook", "s",
		[]WebhookEventType{WebhookCaseCreated, WebhookAlertCreated})
	tests := []struct {
		name  string
		event WebhookEventType
		want  bool
	}{
		{"subscribed case", WebhookCaseCreated, true},
		{"subscribed alert", WebhookAlertCreated, true},
		{"not subscribed txn", WebhookTxnAlert, false},
		{"not subscribed edd", WebhookEDDCompleted, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ep.SubscribedTo(tt.event)
			if got != tt.want {
				t.Errorf("SubscribedTo(%s) = %v, want %v", tt.event, got, tt.want)
			}
		})
	}
}
