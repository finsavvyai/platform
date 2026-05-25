package quota

import (
	"testing"
	"time"
)

func TestNewAIQuotaEnforcer_DisabledByDefault(t *testing.T) {
	t.Setenv("AEGIS_AI_DAILY_CAP", "")
	t.Setenv("AEGIS_AI_DAILY_CAP_PER_SEAT", "")
	if e := NewAIQuotaEnforcer(); e != nil {
		t.Error("expected nil enforcer when both caps unset")
	}
	t.Setenv("AEGIS_AI_DAILY_CAP", "0")
	t.Setenv("AEGIS_AI_DAILY_CAP_PER_SEAT", "0")
	if e := NewAIQuotaEnforcer(); e != nil {
		t.Error("expected nil enforcer when both caps zero")
	}
	t.Setenv("AEGIS_AI_DAILY_CAP", "-5")
	t.Setenv("AEGIS_AI_DAILY_CAP_PER_SEAT", "-1")
	if e := NewAIQuotaEnforcer(); e != nil {
		t.Error("expected nil enforcer when both caps negative")
	}
}

func newTestEnforcer(tenantCap, seatCap int) *AIQuotaEnforcer {
	return &AIQuotaEnforcer{
		tenantCounts: make(map[string][]time.Time),
		seatCounts:   make(map[string][]time.Time),
		tenantCap:    tenantCap,
		seatCap:      seatCap,
	}
}

func TestAIQuotaEnforcer_TenantCap(t *testing.T) {
	e := newTestEnforcer(3, 0)
	tid := "tnt_abc123def456"
	for i := 0; i < 3; i++ {
		if !e.Allow(tid, "usr_x") {
			t.Fatalf("call %d: expected Allow", i+1)
		}
		e.Record(tid, "usr_x")
	}
	if e.Allow(tid, "usr_x") {
		t.Error("expected Allow=false after tenant cap reached")
	}
}

func TestAIQuotaEnforcer_PerSeatCap(t *testing.T) {
	e := newTestEnforcer(0, 2)
	tid := "tnt_abc123def456"
	if !e.Allow(tid, "usr_alice") || !e.Allow(tid, "usr_bob") {
		t.Fatal("first calls should pass")
	}
	e.Record(tid, "usr_alice")
	e.Record(tid, "usr_alice")
	if e.Allow(tid, "usr_alice") {
		t.Error("alice should be over per-seat cap")
	}
	if !e.Allow(tid, "usr_bob") {
		t.Error("bob is independent — should still be under")
	}
}

func TestAIQuotaEnforcer_BothGates(t *testing.T) {
	e := newTestEnforcer(5, 2)
	tid := "tnt_abc123def456"
	e.Record(tid, "usr_alice")
	e.Record(tid, "usr_alice")
	if e.Allow(tid, "usr_alice") {
		t.Error("alice over per-seat cap")
	}
	if !e.Allow(tid, "usr_bob") {
		t.Error("bob under both caps")
	}
}

func TestAIQuotaEnforcer_PerTenantIsolation(t *testing.T) {
	e := newTestEnforcer(1, 0)
	e.Record("tnt_aaaaaaaaaaaa", "u")
	if e.Allow("tnt_aaaaaaaaaaaa", "u") {
		t.Error("A should be over cap")
	}
	if !e.Allow("tnt_bbbbbbbbbbbb", "u") {
		t.Error("B should be independent")
	}
}
