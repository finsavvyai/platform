// Package routing classifies prompts and maps complexity × user role
// × spend headroom to a model tier (cheap / balanced / premium).
//
// Day 50 of the production-ready roadmap.
//
// Classifier is intentionally heuristic — sub-millisecond, no model
// inference. The full ML-based classifier lives in services/rag and
// is opt-in for tenants that want better accuracy at a per-request
// cost.
package routing

import (
	"strings"

	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/llm"
)

// Complexity is the heuristic-derived prompt class.
type Complexity int

const (
	ComplexitySimple   Complexity = iota // <= 1 sentence, no attachments
	ComplexityMedium                     // multi-sentence OR 1 attachment
	ComplexityComplex                    // long, structured, or many attachments
)

// PromptInput is the slim shape Classifier inspects. Concretely the
// gateway populates these from the inbound HTTP request.
type PromptInput struct {
	Text         string
	AttachmentCt int
	HeaderTier   string // optional X-Model-Tier override
	UserRole     string // user role from the JWT
	HeadroomPct  int    // 0..100; 100 = full budget remains
}

// Decide returns the model tier for an inbound prompt.
func Decide(in PromptInput) llm.Tier {
	// Header override always wins (debugging + admin testing).
	if t := llm.Tier(strings.ToLower(in.HeaderTier)); t == llm.TierCheap || t == llm.TierBalanced || t == llm.TierPremium {
		return t
	}

	c := classify(in)

	// Spend headroom guard: if the tenant is over its soft cap (<20%
	// headroom), force cheap regardless of complexity.
	if in.HeadroomPct < 20 {
		return llm.TierCheap
	}

	// Premium role boost: enterprise/vip plans get one tier upgrade.
	if isPremiumRole(in.UserRole) && c < ComplexityComplex {
		c++
	}

	switch c {
	case ComplexitySimple:
		return llm.TierCheap
	case ComplexityComplex:
		return llm.TierPremium
	default:
		return llm.TierBalanced
	}
}

// isPremiumRole reports whether a role string maps to a paid plan
// that earns a one-tier upgrade.
func isPremiumRole(role string) bool {
	switch strings.ToLower(role) {
	case "enterprise", "premium", "vip":
		return true
	}
	return false
}

// Classify is the spec-mandated 3-arg shape (Day 50 deliverable).
// It composes the existing Decide() so callers that already use
// PromptInput remain unaffected.
//
// Premium-eligible roles short-circuit; otherwise complexity drives
// the tier as in classify().
func Classify(prompt string, attachmentCount int, role string) llm.Tier {
	return Decide(PromptInput{
		Text:         prompt,
		AttachmentCt: attachmentCount,
		UserRole:     role,
		HeadroomPct:  100, // Classify ignores spend; Policy.Decide handles spend.
	})
}

func classify(in PromptInput) Complexity {
	wordCount := len(strings.Fields(in.Text))
	sentenceCount := strings.Count(in.Text, ".") +
		strings.Count(in.Text, "?") +
		strings.Count(in.Text, "!")
	if sentenceCount == 0 && wordCount > 0 {
		sentenceCount = 1
	}

	if in.AttachmentCt >= 3 || wordCount > 500 {
		return ComplexityComplex
	}
	if in.AttachmentCt >= 1 || sentenceCount > 1 || wordCount > 30 {
		return ComplexityMedium
	}
	return ComplexitySimple
}
