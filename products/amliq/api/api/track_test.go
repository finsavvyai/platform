package api

import (
	"testing"

	"github.com/aegis-aml/aegis/internal/analytics"
	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/storage"
)

func TestTrackSignupEmitsAuthSignup(t *testing.T) {
	cap := withCaptureSink(t)
	trackSignup("tnt_1", "US")
	cap.waitFor(t, 1)
	ev := cap.events[0]
	if ev.Name != analytics.EventAuthSignup || ev.DistinctID != "tnt_1" {
		t.Errorf("event=%+v", ev)
	}
	if ev.Properties["country"] != "US" {
		t.Errorf("country=%v", ev.Properties["country"])
	}
}

func TestTrackLoginAndUsageExhausted(t *testing.T) {
	tests := []struct {
		name      string
		emit      func()
		wantName  string
		wantProp  string
		wantValue interface{}
	}{
		{
			name: "login carries user_id",
			emit: func() { trackLogin("tnt_2", "u_42") },
			wantName: analytics.EventAuthLogin, wantProp: "user_id", wantValue: "u_42",
		},
		{
			name: "usage exhausted carries code",
			emit: func() { trackUsageExhausted("tnt_3", "FREE_TIER_EXHAUSTED") },
			wantName: analytics.EventUsageExhausted, wantProp: "code",
			wantValue: "FREE_TIER_EXHAUSTED",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cap := withCaptureSink(t)
			tt.emit()
			cap.waitFor(t, 1)
			if cap.events[0].Name != tt.wantName {
				t.Errorf("name=%q, want %q", cap.events[0].Name, tt.wantName)
			}
			if cap.events[0].Properties[tt.wantProp] != tt.wantValue {
				t.Errorf("%s=%v, want %v", tt.wantProp,
					cap.events[0].Properties[tt.wantProp], tt.wantValue)
			}
		})
	}
}

func TestTrackScreenEmitsExecutedAndFirst(t *testing.T) {
	cap := withCaptureSink(t)
	tid, _ := domain.NewTenantID("tnt_first")
	repo := storage.NewInMemoryScreeningRepo()
	resp := domain.NewScreenResponse(domain.ScreenRequest{TenantID: tid})
	if err := repo.Create(resp); err != nil {
		t.Fatalf("seed: %v", err)
	}
	trackScreen(tid, repo)
	cap.waitFor(t, 2)
	names := map[string]bool{}
	for _, ev := range cap.events {
		names[ev.Name] = true
	}
	if !names[analytics.EventScreenExecuted] || !names[analytics.EventScreenFirst] {
		t.Errorf("missing events: got %+v", names)
	}
}

func TestTrackScreenDoesNotEmitFirstAfterRow1(t *testing.T) {
	cap := withCaptureSink(t)
	tid, _ := domain.NewTenantID("tnt_second")
	repo := storage.NewInMemoryScreeningRepo()
	for i := 0; i < 2; i++ {
		_ = repo.Create(domain.NewScreenResponse(domain.ScreenRequest{TenantID: tid}))
	}
	trackScreen(tid, repo)
	cap.waitFor(t, 1)
	for _, ev := range cap.events {
		if ev.Name == analytics.EventScreenFirst {
			t.Errorf("screen.first must not fire when count > 1")
		}
	}
}
