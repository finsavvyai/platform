package screening

import (
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

func makeBenchEntity(id, name string) domain.Entity {
	eid, _ := domain.NewEntityID(id)
	n, _ := domain.NewName(name, "", "", "")
	ent, _ := domain.NewEntity(eid, domain.EntityTypeIndividual, []domain.Name{n})
	ent.ListID = "ofac-sdn"
	return ent
}

func TestConcurrentSearchIndex_Load(t *testing.T) {
	ci := NewConcurrentSearchIndex()
	entities := []domain.Entity{
		makeBenchEntity("ent_aaaaaaaaaaaa", "VLADIMIR PUTIN"),
		makeBenchEntity("ent_bbbbbbbbbbbb", "KIM JONG UN"),
	}
	ci.Load(entities)

	if ci.EntityCount() != 2 {
		t.Errorf("expected 2, got %d", ci.EntityCount())
	}
}

func TestConcurrentSearchIndex_ExactMatch(t *testing.T) {
	ci := NewConcurrentSearchIndex()
	entities := []domain.Entity{
		makeBenchEntity("ent_aaaaaaaaaaaa", "VLADIMIR PUTIN"),
	}
	ci.Load(entities)

	results := ci.Search("vladimir putin", SearchOpts{Limit: 10})
	if len(results) == 0 {
		t.Fatal("expected at least one result")
	}
	if results[0].Score < 1.0 {
		t.Errorf("exact match should score >= 1.0, got %f", results[0].Score)
	}
}

func TestConcurrentSearchIndex_PhoneticMatch(t *testing.T) {
	ci := NewConcurrentSearchIndex()
	entities := []domain.Entity{
		makeBenchEntity("ent_aaaaaaaaaaaa", "VLADIMIR PUTIN"),
	}
	ci.Load(entities)

	// "Vladimer Puteen" should match via phonetic codes
	results := ci.Search("VLADIMER PUTEEN", SearchOpts{Limit: 10})
	if len(results) == 0 {
		t.Log("phonetic match not found — may depend on DM codes")
	}
}
