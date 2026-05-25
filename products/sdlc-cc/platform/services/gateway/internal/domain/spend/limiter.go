// Package spend (domain) enforces per-user / per-tenant monthly USD
// spend caps. Soft cap emits a warning event; hard cap blocks with
// 402 Payment Required.
//
// Day 29 of the production-ready roadmap.
package spend

import (
	"context"
	"errors"

	"github.com/google/uuid"
)

// LimitConfig is what an admin sets via the Day-29 admin endpoint.
type LimitConfig struct {
	Scope            string // "user" | "tenant"
	ScopeID          uuid.UUID
	MonthlyUSDCents  int64
	SoftCapPct       int // 80 default
	HardCapPct       int // 100 default
}

// Verdict is the outcome of a Check.
type Verdict struct {
	Allowed       bool
	OverSoftCap   bool
	OverHardCap   bool
	UsedCents     int64
	BudgetCents   int64
	WarnAtCents   int64
}

// Check returns the verdict for "user wants to spend more". If
// OverHardCap is true the caller emits 402; OverSoftCap fires a
// webhook / email warning but still allows.
func Check(_ context.Context, cfg LimitConfig, currentMonthUsedCents int64) Verdict {
	soft := (cfg.MonthlyUSDCents * int64(cfg.SoftCapPct)) / 100
	hard := (cfg.MonthlyUSDCents * int64(cfg.HardCapPct)) / 100
	if cfg.HardCapPct == 0 {
		hard = cfg.MonthlyUSDCents
	}
	v := Verdict{
		UsedCents:   currentMonthUsedCents,
		BudgetCents: cfg.MonthlyUSDCents,
		WarnAtCents: soft,
	}
	if currentMonthUsedCents >= hard {
		v.OverHardCap = true
		v.OverSoftCap = true
		return v
	}
	if currentMonthUsedCents >= soft {
		v.OverSoftCap = true
	}
	v.Allowed = true
	return v
}

// ErrOverHardCap is the canonical error a handler returns to the user
// (mapped to HTTP 402 Payment Required at the boundary).
var ErrOverHardCap = errors.New("spend: hard cap exceeded")
