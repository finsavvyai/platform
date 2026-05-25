package mcp

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestExplainMatchDefHasRequiredName(t *testing.T) {
	def := explainMatchDef()
	if def.Name != "explain_match" {
		t.Errorf("Name=%q, want explain_match", def.Name)
	}
	req, _ := def.InputSchema["required"].([]string)
	if len(req) != 1 || req[0] != "name" {
		t.Errorf("required=%v, want [name]", req)
	}
}

func TestHandleExplainMatchRejectsBlankName(t *testing.T) {
	s := testServer()
	params, _ := json.Marshal(explainParams{Name: "  "})
	if _, err := s.handleExplainMatch(params); err == nil {
		t.Error("expected error for blank name")
	}
}

func TestHandleExplainMatchUnmatchedReturnsMatchedFalse(t *testing.T) {
	s := testServer()
	params, _ := json.Marshal(explainParams{Name: "Nobody"})
	got, err := s.handleExplainMatch(params)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	resp := got.(map[string]interface{})
	if resp["matched"] != false {
		t.Errorf("matched=%v, want false", resp["matched"])
	}
}

func TestPickExplainTarget(t *testing.T) {
	idA, _ := domain.NewEntityID("ent_a")
	idB, _ := domain.NewEntityID("ent_b")
	a := domain.MatchResult{EntityID: idA, ListID: "ofac"}
	b := domain.MatchResult{EntityID: idB, ListID: "eu"}
	tests := []struct {
		name     string
		results  []domain.MatchResult
		entityID string
		want     string
	}{
		{"no results no id returns nil", nil, "", ""},
		{"no results with id returns nil", nil, "ent_x", ""},
		{"empty id picks top", []domain.MatchResult{a, b}, "", "ent_a"},
		{"matching id picks that one", []domain.MatchResult{a, b}, "ent_b", "ent_b"},
		{"non-matching id returns nil", []domain.MatchResult{a, b}, "ent_z", ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := pickExplainTarget(tt.results, tt.entityID)
			if tt.want == "" {
				if got != nil {
					t.Errorf("got %v, want nil", got)
				}
				return
			}
			if got == nil || got.EntityID.String() != tt.want {
				t.Errorf("got %v, want %s", got, tt.want)
			}
		})
	}
}

func TestComposeRationaleHasConfidenceAndList(t *testing.T) {
	id, _ := domain.NewEntityID("ent_1")
	conf, _ := domain.NewConfidence(0.92)
	r := domain.MatchResult{
		EntityID:   id,
		ListID:     "ofac",
		Confidence: conf,
		Evidence: []domain.MatchEvidence{{
			Layer: domain.MatchLayerExact, Algorithm: "exact",
			Score: 1.0, MatchedValue: "Acme Corp",
		}},
		TimestampHit: time.Now(),
	}
	got := composeRationale(r)
	if !strings.Contains(got, "92%") || !strings.Contains(got, "ofac") {
		t.Errorf("rationale missing fields: %q", got)
	}
}
