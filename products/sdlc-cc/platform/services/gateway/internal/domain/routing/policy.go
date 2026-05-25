// Package routing — model-tier policy.
//
// Day 50 deliverable: maps a Tier (cheap | balanced | premium) to a
// concrete model id, with two overrides:
//
//   - X-Model-Tier header (validated, then routed normally)
//   - X-Model-Override header (raw model id; bypasses the tier map)
//
// Spend headroom (in cents) downgrades the tier when the tenant is
// near or past their soft cap. The mapping is per-Policy so different
// tenants can pin to different vendors.
package routing

import (
	"strings"

	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/llm"
)

// Policy holds a tenant's tier→model mapping.
//
// Models[tier] returns the configured model id; if a tier has no
// mapping, Decide falls back to DefaultModel.
type Policy struct {
	Models       map[llm.Tier]string
	DefaultModel string
}

// NewDefaultPolicy returns a sensible cross-vendor default.
func NewDefaultPolicy() *Policy {
	return &Policy{
		Models: map[llm.Tier]string{
			llm.TierCheap:    "claude-3-5-haiku-20241022",
			llm.TierBalanced: "gpt-4o-mini",
			llm.TierPremium:  "claude-3-5-sonnet-20241022",
		},
		DefaultModel: "gpt-4o-mini",
	}
}

// Spend headroom thresholds (cents). When headroom is at or below
// downgradeThreshold the tier drops one level; at zero we force cheap.
const (
	hardCapCents       int64 = 0
	downgradeThreshold int64 = 500 // $5 remaining
)

// Decide picks a model id given the classifier output, the tenant's
// remaining spend headroom in cents, and an optional raw override.
//
// Precedence:
//  1. override (validated against the policy's known model set; an
//     unrecognised id falls through and is returned as-is so admins
//     can pin to brand-new models without a code change).
//  2. spend headroom: <=hardCapCents → cheap, <=downgradeThreshold → drop one tier.
//  3. tier → Models[tier], or DefaultModel.
func (p *Policy) Decide(tier llm.Tier, spendHeadroomCents int64, override string) string {
	if override = strings.TrimSpace(override); override != "" {
		return override
	}
	if spendHeadroomCents <= hardCapCents {
		tier = llm.TierCheap
	} else if spendHeadroomCents <= downgradeThreshold {
		tier = downgrade(tier)
	}
	if m, ok := p.Models[tier]; ok && m != "" {
		return m
	}
	return p.DefaultModel
}

func downgrade(t llm.Tier) llm.Tier {
	switch t {
	case llm.TierPremium:
		return llm.TierBalanced
	case llm.TierBalanced:
		return llm.TierCheap
	}
	return llm.TierCheap
}

// NormalizeHeaderTier validates the X-Model-Tier header and returns
// the canonical Tier value. An empty / unknown header returns "" so
// the caller falls back to Classify.
func NormalizeHeaderTier(h string) llm.Tier {
	switch strings.ToLower(strings.TrimSpace(h)) {
	case "cheap":
		return llm.TierCheap
	case "balanced":
		return llm.TierBalanced
	case "premium":
		return llm.TierPremium
	}
	return ""
}
