package clawpipe

import (
	"testing"
)

func TestModelForSeverity_Critical(t *testing.T) {
	model := ModelForSeverity("critical")
	if model != "claude-opus" {
		t.Errorf("expected claude-opus for critical, got %q", model)
	}
}

func TestModelForSeverity_High(t *testing.T) {
	model := ModelForSeverity("high")
	if model != "claude-sonnet" {
		t.Errorf("expected claude-sonnet for high, got %q", model)
	}
}

func TestModelForSeverity_Medium(t *testing.T) {
	model := ModelForSeverity("medium")
	if model != "claude-sonnet" {
		t.Errorf("expected claude-sonnet for medium, got %q", model)
	}
}

func TestModelForSeverity_Low(t *testing.T) {
	model := ModelForSeverity("low")
	if model != "claude-haiku" {
		t.Errorf("expected claude-haiku for low, got %q", model)
	}
}

func TestModelForSeverity_Info(t *testing.T) {
	model := ModelForSeverity("info")
	if model != "claude-haiku" {
		t.Errorf("expected claude-haiku for info, got %q", model)
	}
}

func TestModelForSeverity_Unknown(t *testing.T) {
	model := ModelForSeverity("unknown")
	if model != "claude-sonnet" {
		t.Errorf("expected default claude-sonnet for unknown, got %q", model)
	}
}

func TestModelForSeverity_Empty(t *testing.T) {
	model := ModelForSeverity("")
	if model != "claude-sonnet" {
		t.Errorf("expected default claude-sonnet for empty string, got %q", model)
	}
}

func TestModelForAnalysisType_Heuristic(t *testing.T) {
	model := ModelForAnalysisType("heuristic")
	if model != "" {
		t.Errorf("expected empty string for heuristic (rule-based), got %q", model)
	}
}

func TestModelForAnalysisType_Quick(t *testing.T) {
	model := ModelForAnalysisType("quick")
	if model != "claude-haiku" {
		t.Errorf("expected claude-haiku for quick, got %q", model)
	}
}

func TestModelForAnalysisType_Full(t *testing.T) {
	model := ModelForAnalysisType("full")
	if model != "claude-sonnet" {
		t.Errorf("expected claude-sonnet for full, got %q", model)
	}
}

func TestModelForAnalysisType_Deep(t *testing.T) {
	model := ModelForAnalysisType("deep")
	if model != "claude-opus" {
		t.Errorf("expected claude-opus for deep, got %q", model)
	}
}

func TestModelForAnalysisType_Unknown(t *testing.T) {
	model := ModelForAnalysisType("unknown")
	if model != "claude-sonnet" {
		t.Errorf("expected default claude-sonnet for unknown, got %q", model)
	}
}

func TestModelForAnalysisType_Empty(t *testing.T) {
	model := ModelForAnalysisType("")
	if model != "claude-sonnet" {
		t.Errorf("expected default claude-sonnet for empty string, got %q", model)
	}
}
