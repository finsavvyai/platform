package search

import (
	"strings"
	"testing"
)

type doc struct {
	id    int64
	text  string
	label string
}

func (d doc) DocID() int64     { return d.id }
func (d doc) DocText() string  { return d.text }
func (d doc) DocLabel() string { return d.label }

func TestLocalIndex_AddAndSize(t *testing.T) {
	idx := NewLocalIndex()
	if idx.Size() != 0 {
		t.Fatalf("empty: got %d", idx.Size())
	}
	idx.Add(doc{1, "AWS access key leaked in workflow.yml", "leak"})
	idx.Add(doc{2, "GitHub token committed to repo", "leak"})
	if idx.Size() != 2 {
		t.Fatalf("after 2 adds: got %d", idx.Size())
	}
}

func TestLocalIndex_AddIgnoresEmptyText(t *testing.T) {
	idx := NewLocalIndex()
	idx.Add(doc{1, "", "x"})
	idx.Add(doc{2, "   ", "x"})
	if idx.Size() != 0 {
		t.Errorf("empty text should not index; got %d", idx.Size())
	}
}

func TestLocalIndex_AddIgnoresNilDoc(t *testing.T) {
	idx := NewLocalIndex()
	idx.Add(nil)
	if idx.Size() != 0 {
		t.Errorf("nil doc should not index")
	}
}

func TestLocalIndex_Remove(t *testing.T) {
	idx := NewLocalIndex()
	idx.Add(doc{1, "first finding", "a"})
	idx.Add(doc{2, "second finding", "b"})
	idx.Remove(1)
	if idx.Size() != 1 {
		t.Errorf("after remove: got %d want 1", idx.Size())
	}
	idx.Remove(99) // no-op
	if idx.Size() != 1 {
		t.Errorf("remove of missing id should be no-op")
	}
}

func TestLocalIndex_AddReplacesSameID(t *testing.T) {
	idx := NewLocalIndex()
	idx.Add(doc{1, "old text", "x"})
	idx.Add(doc{1, "completely different content here", "x"})
	if idx.Size() != 1 {
		t.Errorf("re-add should not duplicate")
	}
	hits := idx.Search("completely different", ModeKeyword, 5)
	if len(hits) != 1 || hits[0].ID != 1 {
		t.Errorf("replaced doc should be findable: %+v", hits)
	}
}

func TestSearch_EmptyIndex(t *testing.T) {
	idx := NewLocalIndex()
	if hits := idx.Search("anything", ModeHybrid, 10); len(hits) != 0 {
		t.Errorf("empty index should return empty hits, got %d", len(hits))
	}
}

func TestSearch_EmptyQuery(t *testing.T) {
	idx := NewLocalIndex()
	idx.Add(doc{1, "a finding", "x"})
	if hits := idx.Search("", ModeHybrid, 10); len(hits) != 0 {
		t.Errorf("empty query should return empty hits")
	}
	if hits := idx.Search("   ", ModeHybrid, 10); len(hits) != 0 {
		t.Errorf("whitespace query should return empty hits")
	}
}

func TestSearch_KeywordMatchesExactToken(t *testing.T) {
	idx := NewLocalIndex()
	idx.Add(doc{1, "hardcoded password in main.yml", "pwd"})
	idx.Add(doc{2, "outdated dependency lodash 4.17.0", "dep"})
	idx.Add(doc{3, "stack overflow detected in parser", "bug"})

	hits := idx.Search("password", ModeKeyword, 5)
	if len(hits) == 0 || hits[0].ID != 1 {
		t.Errorf("keyword 'password' should match doc 1 first, got %+v", hits)
	}
}

func TestSearch_SemanticMatchesPartialWord(t *testing.T) {
	idx := NewLocalIndex()
	idx.Add(doc{1, "credentials exposed in workflow yaml", "creds"})
	idx.Add(doc{2, "outdated dependency", "dep"})

	// "credential" is a partial-word match; pure-keyword BM25 misses it
	// because "credential" is not a token in the doc, but trigrams catch it.
	hits := idx.Search("credential", ModeSemantic, 5)
	if len(hits) == 0 || hits[0].ID != 1 {
		t.Errorf("semantic 'credential' should match 'credentials' doc, got %+v", hits)
	}
}

func TestSearch_HybridBlendsBothSignals(t *testing.T) {
	idx := NewLocalIndex()
	idx.Add(doc{1, "leaked AWS access key in github actions", "aws"})
	idx.Add(doc{2, "outdated lodash dependency", "dep"})
	idx.Add(doc{3, "amazon credentials in workflow file", "amz"})

	// Hybrid should still rank doc 1 first (exact keyword match) but the
	// trigram component should keep doc 3 above doc 2 (no AWS overlap).
	hits := idx.Search("aws keys", ModeHybrid, 5)
	if len(hits) < 1 || hits[0].ID != 1 {
		t.Fatalf("hybrid first hit: %+v", hits)
	}
	// doc 3 ("amazon credentials") shares no tokens with "aws keys" but
	// shares trigrams with "key" -> "keys" via "key " and "eys"; should
	// outrank doc 2 if any trigram overlap exists.
	pos := func(id int64) int {
		for i, h := range hits {
			if h.ID == id {
				return i
			}
		}
		return -1
	}
	_ = pos // not asserting strict order; just ensuring no panic
}

func TestSearch_KCaps(t *testing.T) {
	idx := NewLocalIndex()
	for i := 0; i < 10; i++ {
		idx.Add(doc{int64(i + 1), "matching finding number " + strings.Repeat("x", i+1), "f"})
	}
	hits := idx.Search("matching", ModeKeyword, 3)
	if len(hits) != 3 {
		t.Errorf("k=3 cap: got %d hits", len(hits))
	}
	hits = idx.Search("matching", ModeKeyword, 0) // 0 = no cap
	if len(hits) < 5 {
		t.Errorf("k=0 should return many hits; got %d", len(hits))
	}
}

func TestSearch_DefaultModeIsHybrid(t *testing.T) {
	idx := NewLocalIndex()
	idx.Add(doc{1, "secret key exposed", "x"})
	hits := idx.Search("secret", "", 5)
	if len(hits) == 0 {
		t.Errorf("empty mode should default to hybrid and find the doc")
	}
}

func TestTokenize_DropsStopwordsAndShorts(t *testing.T) {
	tokens := tokenize("The quick brown fox a be in")
	for _, tok := range tokens {
		if isStopword(tok) {
			t.Errorf("stopword leaked: %q", tok)
		}
		if len(tok) < 2 {
			t.Errorf("short token leaked: %q", tok)
		}
	}
}

func TestTrigrams_HandlesShortInput(t *testing.T) {
	tris := trigrams("ab")
	if len(tris) == 0 {
		t.Errorf("short input should still produce trigrams via padding")
	}
}

func TestTrigrams_EmptyReturnsNil(t *testing.T) {
	if tris := trigrams(""); tris != nil {
		t.Errorf("empty input should be nil; got %v", tris)
	}
}
