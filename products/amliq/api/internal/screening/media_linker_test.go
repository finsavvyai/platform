package screening

import (
	"context"
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestMediaLinkerMatch(t *testing.T) {
	engine := NewFastEngine()
	linker := NewMediaLinker(engine)

	cand := makeTestEntity(t, "ent_000000000002", "Vladimir Putin")
	cand.ListID = "ofac_sdn"

	article := ArticleInput{
		Title:       "Sanctions news",
		URL:         "https://reuters.com/1",
		Source:      "reuters.com",
		PersonNames: []string{"Vladimir Putin"},
	}

	hits := linker.LinkToEntities(context.Background(), article, []domain.Entity{cand})
	if len(hits) == 0 {
		t.Error("expected at least 1 hit")
	}
	if hits[0].Confidence < 0.6 {
		t.Errorf("confidence too low: %v", hits[0].Confidence)
	}
}

func TestMediaLinkerNoMatch(t *testing.T) {
	engine := NewFastEngine()
	linker := NewMediaLinker(engine)

	cand := makeTestEntity(t, "ent_000000000002", "John Smith")
	cand.ListID = "ofac"

	article := ArticleInput{
		PersonNames: []string{"Completely Unrelated Person"},
	}

	hits := linker.LinkToEntities(context.Background(), article, []domain.Entity{cand})
	if len(hits) != 0 {
		t.Error("expected no hits")
	}
}
