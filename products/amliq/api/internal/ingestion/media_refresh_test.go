package ingestion

import "testing"

func TestMediaArticlesToEntitiesDedupes(t *testing.T) {
	articles := []GDELTArticle{
		{
			URL:     "https://example.com/a",
			Persons: []string{"john doe", "john doe", "jane smith"},
			Orgs:    []string{"acme corp"},
		},
		{
			URL:     "https://example.com/b",
			Persons: []string{"john doe"}, // duplicate
		},
	}
	out := mediaArticlesToEntities(articles)
	if len(out) != 3 {
		t.Fatalf("want 3 deduped entities, got %d", len(out))
	}
	for _, e := range out {
		if e.ListID != "adverse_media" {
			t.Errorf("entity %s: ListID=%q want adverse_media",
				e.PrimaryName().Full, e.ListID)
		}
	}
}

func TestNewMediaRefresherDefaults(t *testing.T) {
	r := NewMediaRefresher(nil)
	if r.interval == 0 {
		t.Error("interval must be non-zero")
	}
}
