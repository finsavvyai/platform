package clawpipe

import "testing"

func TestCheapMode_DefaultsOff(t *testing.T) {
	t.Setenv("PIPEWARDEN_CHEAP_MODE", "")
	if CheapMode() {
		t.Error("CheapMode() should be false when env unset")
	}
}

func TestCheapMode_OnFor1AndTrue(t *testing.T) {
	for _, v := range []string{"1", "true"} {
		t.Setenv("PIPEWARDEN_CHEAP_MODE", v)
		if !CheapMode() {
			t.Errorf("CheapMode() should be true for %q", v)
		}
	}
}

func TestModelForSeverityCheap_KeepsClaudeOpusOnCritical(t *testing.T) {
	if got := ModelForSeverityCheap("critical"); got != "claude-opus" {
		t.Errorf("critical should stay on claude-opus, got %q", got)
	}
}

func TestModelForSeverityCheap_HighRoutesToDeepseek(t *testing.T) {
	if got := ModelForSeverityCheap("high"); got != "deepseek-chat" {
		t.Errorf("high should route to deepseek-chat, got %q", got)
	}
}

func TestModelForSeverityCheap_MediumLowRouteToGemini(t *testing.T) {
	for _, sev := range []string{"medium", "low", "info", "unknown", ""} {
		if got := ModelForSeverityCheap(sev); got != "gemini-2.0-flash" {
			t.Errorf("severity %q should route to gemini-2.0-flash, got %q", sev, got)
		}
	}
}

func TestModelForAnalysisTypeCheap_HeuristicEmpty(t *testing.T) {
	if got := ModelForAnalysisTypeCheap("heuristic"); got != "" {
		t.Errorf("heuristic should return empty (no AI), got %q", got)
	}
}

func TestModelForAnalysisTypeCheap_DeepStaysOnOpus(t *testing.T) {
	if got := ModelForAnalysisTypeCheap("deep"); got != "claude-opus" {
		t.Errorf("deep should stay on claude-opus, got %q", got)
	}
}

func TestModelForAnalysisTypeCheap_QuickToGemini(t *testing.T) {
	if got := ModelForAnalysisTypeCheap("quick"); got != "gemini-2.0-flash" {
		t.Errorf("quick should route to gemini-2.0-flash, got %q", got)
	}
}

func TestModelForAnalysisTypeCheap_FullToDeepseek(t *testing.T) {
	if got := ModelForAnalysisTypeCheap("full"); got != "deepseek-chat" {
		t.Errorf("full should route to deepseek-chat, got %q", got)
	}
}

func TestPickModel_CriticalAlwaysOpus(t *testing.T) {
	for _, mode := range []string{"", "1"} {
		t.Setenv("PIPEWARDEN_CHEAP_MODE", mode)
		if got := PickModel("critical", "quick"); got != "claude-opus" {
			t.Errorf("critical should always be claude-opus regardless of mode/type, got %q (mode=%q)", got, mode)
		}
	}
}

func TestPickModel_PremiumModeFallsBackToOriginalRouters(t *testing.T) {
	t.Setenv("PIPEWARDEN_CHEAP_MODE", "")
	if got := PickModel("medium", ""); got != "claude-sonnet" {
		t.Errorf("premium-mode medium should be claude-sonnet, got %q", got)
	}
	if got := PickModel("", "quick"); got != "claude-haiku" {
		t.Errorf("premium-mode quick should be claude-haiku, got %q", got)
	}
}

func TestPickModel_CheapModeRoutesToCheap(t *testing.T) {
	t.Setenv("PIPEWARDEN_CHEAP_MODE", "1")
	if got := PickModel("medium", ""); got != "gemini-2.0-flash" {
		t.Errorf("cheap-mode medium should be gemini-2.0-flash, got %q", got)
	}
	if got := PickModel("", "full"); got != "deepseek-chat" {
		t.Errorf("cheap-mode full should be deepseek-chat, got %q", got)
	}
}

func TestPickModel_AnalysisTypeBeatsServerityWhenBothSet(t *testing.T) {
	t.Setenv("PIPEWARDEN_CHEAP_MODE", "1")
	// medium severity + quick analysis → analysis type wins (gemini), not severity router.
	if got := PickModel("medium", "quick"); got != "gemini-2.0-flash" {
		t.Errorf("analysisType should win when set, got %q", got)
	}
}
