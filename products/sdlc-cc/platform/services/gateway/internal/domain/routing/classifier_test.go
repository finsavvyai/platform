package routing

import (
	"strings"
	"testing"

	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/llm"
)

func TestDecide_HeaderOverrideWins(t *testing.T) {
	in := PromptInput{Text: strings.Repeat("very long ", 100), HeadroomPct: 100, HeaderTier: "cheap"}
	if got := Decide(in); got != llm.TierCheap {
		t.Fatalf("header override must win, got %s", got)
	}
}

func TestDecide_SimpleRoutesCheap(t *testing.T) {
	in := PromptInput{Text: "hello", HeadroomPct: 100}
	if got := Decide(in); got != llm.TierCheap {
		t.Fatalf("simple should be cheap, got %s", got)
	}
}

func TestDecide_ComplexRoutesPremium(t *testing.T) {
	in := PromptInput{Text: strings.Repeat("complex ", 600), HeadroomPct: 100}
	if got := Decide(in); got != llm.TierPremium {
		t.Fatalf("long text should be premium, got %s", got)
	}
}

func TestDecide_AttachmentsBumpToComplex(t *testing.T) {
	in := PromptInput{Text: "summarize", AttachmentCt: 4, HeadroomPct: 100}
	if got := Decide(in); got != llm.TierPremium {
		t.Fatalf(">=3 attachments should force premium, got %s", got)
	}
}

func TestDecide_MediumRoutesBalanced(t *testing.T) {
	in := PromptInput{
		Text:         "Summarize this please. Pay attention to dates.",
		AttachmentCt: 0,
		HeadroomPct:  100,
	}
	if got := Decide(in); got != llm.TierBalanced {
		t.Fatalf("multi-sentence should be balanced, got %s", got)
	}
}

func TestDecide_LowHeadroomForcesCheap(t *testing.T) {
	in := PromptInput{
		Text:        strings.Repeat("complex ", 600),
		HeadroomPct: 10, // tenant near soft cap
	}
	if got := Decide(in); got != llm.TierCheap {
		t.Fatalf("low headroom must force cheap regardless of complexity, got %s", got)
	}
}
