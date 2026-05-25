package screening

import (
	"testing"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestFastEngineExactMatch(t *testing.T) {
	fe := NewFastEngine()
	cand := makeTestEntity(t, "ent_000000000002", "John Smith")
	cand.ListID = "ofac_sdn"

	result := fe.Screen("John Smith", []domain.Entity{cand})
	if !result.Match {
		t.Error("expected match")
	}
	if result.Confidence < 0.5 {
		t.Errorf("confidence too low: %v", result.Confidence)
	}
}

func TestFastEngineNoMatch(t *testing.T) {
	fe := NewFastEngine()
	cand := makeTestEntity(t, "ent_000000000002", "Completely Different")
	cand.ListID = "ofac_sdn"

	result := fe.Screen("John Smith", []domain.Entity{cand})
	if result.Match {
		t.Error("expected no match")
	}
}

func TestFastEnginePerformance(t *testing.T) {
	fe := NewFastEngine()
	var candidates []domain.Entity
	for i := 0; i < 100; i++ {
		c := makeTestEntity(t, "ent_"+padInt(i), "Entity Name "+padInt(i))
		c.ListID = "ofac"
		candidates = append(candidates, c)
	}

	start := time.Now()
	for i := 0; i < 100; i++ {
		fe.Screen("John Smith", candidates)
	}
	elapsed := time.Since(start)

	// 100 screens against 100 candidates should complete in <1s
	if elapsed > time.Second {
		t.Errorf("too slow: %v for 100 screens", elapsed)
	}
}

func padInt(i int) string {
	s := "000000000000"
	v := s + string(rune('0'+i%10))
	return v[len(v)-12:]
}
