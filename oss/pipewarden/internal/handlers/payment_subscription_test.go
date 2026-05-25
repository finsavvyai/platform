package handlers

import (
	"testing"
	"time"

	"github.com/finsavvyai/pipewarden/internal/billing"
)

func TestSubscriptionFromEvent_NilEvent(t *testing.T) {
	if got := subscriptionFromEvent(nil); got != nil {
		t.Errorf("nil event must yield nil record, got %#v", got)
	}
}

func TestSubscriptionFromEvent_MissingTenantID(t *testing.T) {
	ev := &billing.WebhookEvent{
		Meta: billing.EventMeta{EventName: "subscription_created", CustomData: map[string]interface{}{}},
	}
	if got := subscriptionFromEvent(ev); got != nil {
		t.Errorf("event without tenant_id must yield nil record, got %#v", got)
	}
}

func TestSubscriptionFromEvent_TierMapping(t *testing.T) {
	cases := map[string]string{
		"subscription_created_starter":         "starter",
		"subscription_updated_team":            "team",
		"subscription_created_professional":    "professional",
		"subscription_created_enterprise":      "enterprise",
		"subscription_created_enterprise_plus": "enterprise_plus",
		"subscription_created_enterprise-plus": "enterprise_plus",
		"subscription_created":                 "community",
	}
	for eventName, wantTier := range cases {
		ev := &billing.WebhookEvent{
			Meta: billing.EventMeta{
				EventName:  eventName,
				CustomData: map[string]interface{}{"tenant_id": "tenant-1"},
			},
		}
		got := subscriptionFromEvent(ev)
		if got == nil {
			t.Fatalf("event %q produced nil record", eventName)
		}
		if got.Tier != wantTier {
			t.Errorf("event %q tier = %q, want %q", eventName, got.Tier, wantTier)
		}
		if got.TenantID != "tenant-1" {
			t.Errorf("tenant_id mismatch: %q", got.TenantID)
		}
	}
}

func TestSubscriptionFromEvent_StatusAutoFill(t *testing.T) {
	created := &billing.WebhookEvent{
		Meta: billing.EventMeta{EventName: "subscription_created", CustomData: map[string]interface{}{"tenant_id": "t"}},
	}
	got := subscriptionFromEvent(created)
	if got == nil || got.Status != "active" {
		t.Errorf("created without explicit status should default to active, got %#v", got)
	}

	cancelled := &billing.WebhookEvent{
		Meta: billing.EventMeta{EventName: "subscription_cancelled", CustomData: map[string]interface{}{"tenant_id": "t"}},
	}
	got = subscriptionFromEvent(cancelled)
	if got == nil || got.Status != "cancelled" {
		t.Errorf("cancelled status auto-fill failed, got %#v", got)
	}
	if got.CancelledAt == nil {
		t.Error("cancelled record should set CancelledAt")
	}
}

func TestSubscriptionFromEvent_RenewsAtPreserved(t *testing.T) {
	renewsAt := time.Date(2026, 5, 1, 12, 0, 0, 0, time.UTC)
	ev := &billing.WebhookEvent{
		Meta: billing.EventMeta{EventName: "subscription_updated", CustomData: map[string]string{"tenant_id": "t"}},
		Data: billing.EventData{Attributes: billing.SubscriptionAttrs{Status: "active", RenewsAt: renewsAt}},
	}
	got := subscriptionFromEvent(ev)
	if got == nil || got.RenewsAt == nil || !got.RenewsAt.Equal(renewsAt) {
		t.Errorf("RenewsAt not preserved: got %#v", got)
	}
}

func TestTenantIDFromCustomData(t *testing.T) {
	cases := []struct {
		name string
		in   interface{}
		want string
	}{
		{"map_interface_with_id", map[string]interface{}{"tenant_id": "abc"}, "abc"},
		{"map_interface_no_id", map[string]interface{}{"other": "x"}, ""},
		{"map_string_with_id", map[string]string{"tenant_id": "xyz"}, "xyz"},
		{"map_string_no_id", map[string]string{"other": "x"}, ""},
		{"unsupported_type", "string-not-map", ""},
		{"nil", nil, ""},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := tenantIDFromCustomData(c.in); got != c.want {
				t.Errorf("got %q, want %q", got, c.want)
			}
		})
	}
}
