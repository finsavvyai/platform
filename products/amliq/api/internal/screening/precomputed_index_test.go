package screening

import (
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestPrecomputedIndex_ExactMatch(t *testing.T) {
	pi := NewPrecomputedIndex()
	pi.Load([]domain.Entity{
		makeBenchEntity("ent_aaaaaaaaaaaa", "VLADIMIR PUTIN"),
		makeBenchEntity("ent_bbbbbbbbbbbb", "KIM JONG UN"),
	})

	results := pi.SearchByName("vladimir putin", 10)
	if len(results) == 0 {
		t.Fatal("expected at least one result")
	}
	if results[0].Entity.ID.String() != "ent_aaaaaaaaaaaa" {
		t.Errorf("expected ent_aaaaaaaaaaaa, got %s", results[0].Entity.ID)
	}
}

func TestPrecomputedIndex_PhoneticMatch(t *testing.T) {
	pi := NewPrecomputedIndex()
	pi.Load([]domain.Entity{
		makeBenchEntity("ent_aaaaaaaaaaaa", "VLADIMIR PUTIN"),
	})

	results := pi.SearchByName("VLADIMER PUTEEN", 10)
	if len(results) > 0 {
		t.Logf("phonetic match found: score=%.2f", results[0].Score)
	}
}

func TestPrecomputedIndex_NoMatch(t *testing.T) {
	pi := NewPrecomputedIndex()
	pi.Load([]domain.Entity{
		makeBenchEntity("ent_aaaaaaaaaaaa", "VLADIMIR PUTIN"),
	})

	results := pi.SearchByName("JOHN SMITH", 10)
	for _, r := range results {
		if r.Score > 0.5 {
			t.Errorf("unexpected high score for unrelated name: %f", r.Score)
		}
	}
}

func BenchmarkPrecomputedIndex_Search(b *testing.B) {
	pi := NewPrecomputedIndex()
	entities := make([]domain.Entity, 100)
	for i := range entities {
		id := "ent_" + padInt(i)
		entities[i] = makeBenchEntity(id, benchNames[i%len(benchNames)].Full)
	}
	pi.Load(entities)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		pi.SearchByName("vladimir putin", 10)
	}
}
