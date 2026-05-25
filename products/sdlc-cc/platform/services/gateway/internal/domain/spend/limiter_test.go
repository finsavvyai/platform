package spend

import (
	"context"
	"testing"

	"github.com/google/uuid"
)

func cfg() LimitConfig {
	return LimitConfig{
		Scope:           "tenant",
		ScopeID:         uuid.New(),
		MonthlyUSDCents: 100_000, // $1,000
		SoftCapPct:      80,
		HardCapPct:      100,
	}
}

func TestCheck_BelowSoft_AllowsSilent(t *testing.T) {
	v := Check(context.Background(), cfg(), 50_000) // 50%
	if !v.Allowed || v.OverSoftCap || v.OverHardCap {
		t.Fatalf("50%% should be silent allow, got %+v", v)
	}
}

func TestCheck_AtSoftCap_AllowsWithWarning(t *testing.T) {
	v := Check(context.Background(), cfg(), 80_000) // 80%
	if !v.Allowed || !v.OverSoftCap || v.OverHardCap {
		t.Fatalf("80%% should warn but allow, got %+v", v)
	}
}

func TestCheck_AtHardCap_Blocks(t *testing.T) {
	v := Check(context.Background(), cfg(), 100_000)
	if v.Allowed || !v.OverHardCap || !v.OverSoftCap {
		t.Fatalf("100%% should hard-block, got %+v", v)
	}
}

func TestCheck_OverHardCap_Blocks(t *testing.T) {
	v := Check(context.Background(), cfg(), 250_000)
	if v.Allowed || !v.OverHardCap {
		t.Fatalf("over budget must block, got %+v", v)
	}
}

func TestCheck_HardCapAllowsOverage(t *testing.T) {
	c := cfg()
	c.HardCapPct = 120 // 20% buffer
	v := Check(context.Background(), c, 110_000)
	if !v.Allowed {
		t.Fatalf("110%% with 120%% hard cap should still allow, got %+v", v)
	}
}
