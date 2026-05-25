package screening

import (
	"context"
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

func makeTestProfile(t *testing.T) domain.MonitorProfile {
	t.Helper()
	tid, _ := domain.NewTenantID("tnt_aabbccddee11")
	p, _ := domain.NewMonitorProfile(tid, "Test Entity", domain.EntityTypeIndividual, domain.RiskHigh)
	return p
}

func makeCandidates(names ...string) []domain.Entity {
	var out []domain.Entity
	for i, n := range names {
		id := []byte("aaaaaaaaaaaa")
		id[11] = byte('a' + i)
		eid, _ := domain.NewEntityID("ent_" + string(id))
		nm, _ := domain.NewName(n, "", "", "")
		e, _ := domain.NewEntity(eid, domain.EntityTypeIndividual, []domain.Name{nm})
		out = append(out, e)
	}
	return out
}

func TestMonitorEngine(t *testing.T) {
	me := NewMonitorEngine(NewEngine(nil))
	ctx := context.Background()
	// Get baseline score for exact match
	cands := makeCandidates("Test Entity")
	base, _ := me.ScreenProfile(ctx, makeTestProfile(t), cands, nil)
	baseScore, baseID := 0.0, "ent_aaaaaaaaaaaa"
	if len(base) > 0 {
		baseScore = base[0].MatchScore
		baseID = base[0].MatchedEntity
	}

	tests := []struct {
		name     string
		cands    []domain.Entity
		prev     []PreviousMatch
		wantMin  int
		wantMax  int
		wantType domain.MonitorAlertType
	}{
		{"new match", makeCandidates("Test Entity"), nil, 1, 10, domain.AlertNewMatch},
		{"no match", makeCandidates("Zzz Qqq"), nil, 0, 0, ""},
		{"same score", makeCandidates("Test Entity"),
			[]PreviousMatch{{EntityID: baseID, Score: baseScore}}, 0, 0, ""},
		{"removed match", makeCandidates("Zzz Qqq"),
			[]PreviousMatch{{EntityID: "ent_oldoldoldold", Score: 0.9}}, 1, 1, domain.AlertMatchRemoved},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			alerts, err := me.ScreenProfile(ctx, makeTestProfile(t), tt.cands, tt.prev)
			if err != nil {
				t.Fatalf("error: %v", err)
			}
			if len(alerts) < tt.wantMin || len(alerts) > tt.wantMax {
				t.Errorf("got %d alerts, want %d-%d", len(alerts), tt.wantMin, tt.wantMax)
			}
			if tt.wantMin > 0 && len(alerts) > 0 && alerts[0].AlertType != tt.wantType {
				t.Errorf("type=%s, want %s", alerts[0].AlertType, tt.wantType)
			}
		})
	}
}
