package routing

import (
	"testing"

	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/llm"
)

func TestPolicy_Decide_BasicTierMapping(t *testing.T) {
	p := NewDefaultPolicy()
	cases := []struct {
		tier llm.Tier
		want string
	}{
		{llm.TierCheap, "claude-3-5-haiku-20241022"},
		{llm.TierBalanced, "gpt-4o-mini"},
		{llm.TierPremium, "claude-3-5-sonnet-20241022"},
	}
	for _, c := range cases {
		if got := p.Decide(c.tier, 10000, ""); got != c.want {
			t.Errorf("tier=%s: got %q want %q", c.tier, got, c.want)
		}
	}
}

func TestPolicy_Decide_OverrideWins(t *testing.T) {
	p := NewDefaultPolicy()
	got := p.Decide(llm.TierCheap, 10000, "gpt-4o")
	if got != "gpt-4o" {
		t.Fatalf("override must win, got %q", got)
	}
}

func TestPolicy_Decide_HardCapForcesCheap(t *testing.T) {
	p := NewDefaultPolicy()
	got := p.Decide(llm.TierPremium, 0, "")
	if got != "claude-3-5-haiku-20241022" {
		t.Fatalf("hard cap must force cheap, got %q", got)
	}
}

func TestPolicy_Decide_LowHeadroomDowngrades(t *testing.T) {
	p := NewDefaultPolicy()
	got := p.Decide(llm.TierPremium, 100, "")
	if got != "gpt-4o-mini" {
		t.Fatalf("low headroom should drop premium→balanced, got %q", got)
	}
}

func TestPolicy_Decide_FallsBackToDefault(t *testing.T) {
	p := &Policy{DefaultModel: "fallback-1"}
	if got := p.Decide(llm.TierBalanced, 10000, ""); got != "fallback-1" {
		t.Fatalf("missing tier should use default, got %q", got)
	}
}

func TestNormalizeHeaderTier(t *testing.T) {
	cases := map[string]llm.Tier{
		"cheap":    llm.TierCheap,
		"BALANCED": llm.TierBalanced,
		"premium":  llm.TierPremium,
		" cheap ":  llm.TierCheap,
		"":         "",
		"garbage":  "",
	}
	for in, want := range cases {
		if got := NormalizeHeaderTier(in); got != want {
			t.Errorf("NormalizeHeaderTier(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestClassify_PromptFixtures(t *testing.T) {
	// Spec-mandated 8-12 fixtures.
	cases := []struct {
		name   string
		prompt string
		atts   int
		role   string
		want   llm.Tier
	}{
		{"short hello", "hi", 0, "free", llm.TierCheap},
		{"medium 2-sentence", "Summarize this. Highlight dates.", 0, "free", llm.TierBalanced},
		{"single attachment", "what is this", 1, "free", llm.TierBalanced},
		{"three attachments", "compare these", 3, "free", llm.TierPremium},
		{"long prose", longString(600), 0, "free", llm.TierPremium},
		{"premium role short", "hi", 0, "enterprise", llm.TierBalanced},
		{"premium role medium", "Summarize. Be brief.", 0, "vip", llm.TierPremium},
		{"premium role + attachment", "compare", 1, "premium", llm.TierPremium},
		{"admin no boost", "hi", 0, "admin", llm.TierCheap},
		{"empty", "", 0, "free", llm.TierCheap},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := Classify(c.prompt, c.atts, c.role); got != c.want {
				t.Errorf("got %s want %s", got, c.want)
			}
		})
	}
}

func longString(words int) string {
	out := ""
	for i := 0; i < words; i++ {
		out += "complex "
	}
	return out
}
