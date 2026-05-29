package screening

import (
	"context"
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

// nameOf is a test helper: build a domain.Name out of a raw string.
// Construction failures fail the test fast so the table reads cleanly.
func nameOf(t *testing.T, full string) domain.Name {
	t.Helper()
	n, err := domain.NewName(full, "", "", "")
	if err != nil {
		t.Fatalf("NewName(%q): %v", full, err)
	}
	return n
}

func TestInMemoryEmbeddingMatcher_Defaults(t *testing.T) {
	m := NewInMemoryEmbeddingMatcher(0, 0)
	if m.dim != 256 {
		t.Errorf("default dim: want 256, got %d", m.dim)
	}
	if m.threshold != 0.62 {
		t.Errorf("default threshold: want 0.62, got %v", m.threshold)
	}
}

// TestInMemoryEmbeddingMatcher_MatchedValueIsCandidate is the
// load-bearing test for the engine pipeline. filterEvidenceForEntity
// drops any evidence whose MatchedValue is not in the candidate's name
// set. If the in-memory matcher emits anything else (e.g. lowercased,
// trimmed, or transliterated text) the embedding layer is silently
// filtered out and Q21-Q28 cannot fire.
func TestInMemoryEmbeddingMatcher_MatchedValueIsCandidate(t *testing.T) {
	cand := "Vladimir Vladimirovich Putin"
	m := NewInMemoryEmbeddingMatcher(0, 0)
	m.SetCandidates([]string{cand})
	ev, err := m.MatchWithContext(
		context.Background(), domain.TenantID{},
		nameOf(t, "Vladimir Putin"),
	)
	if err != nil {
		t.Fatalf("MatchWithContext: %v", err)
	}
	if len(ev) == 0 {
		t.Fatal("expected ≥1 evidence row for an obvious near-match")
	}
	for _, e := range ev {
		if e.MatchedValue != cand {
			t.Errorf("MatchedValue=%q, want exact candidate %q",
				e.MatchedValue, cand)
		}
		if e.Layer != domain.MatchLayerEmbedding {
			t.Errorf("Layer=%v, want Embedding", e.Layer)
		}
		if e.Algorithm != "trigram_cosine" {
			t.Errorf("Algorithm=%q, want trigram_cosine", e.Algorithm)
		}
	}
}

func TestInMemoryEmbeddingMatcher_MatchTable(t *testing.T) {
	cases := []struct {
		name      string
		corpus    []string
		query     string
		wantMatch bool
	}{
		{
			name:      "latin_near_match_kim",
			corpus:    []string{"Kim Jong Un"},
			query:     "Kim Jung-un",
			wantMatch: true,
		},
		{
			name:      "latin_far_miss",
			corpus:    []string{"Vladimir Putin"},
			query:     "Barack Obama",
			wantMatch: false,
		},
		{
			name: "cyrillic_after_transliteration_match",
			// Engine boundary transliterates "Владимир Путин" -> "vladimir putin"
			// before MatchWithContext is called. Simulate that here: the
			// matcher itself never sees Cyrillic.
			corpus:    []string{"Vladimir Vladimirovich Putin"},
			query:     "vladimir putin",
			wantMatch: true,
		},
		{
			name:      "empty_corpus",
			corpus:    nil,
			query:     "Vladimir Putin",
			wantMatch: false,
		},
		{
			name:      "single_character_query",
			corpus:    []string{"Vladimir Putin"},
			query:     "V",
			wantMatch: false,
		},
		{
			name:      "full_name_match",
			corpus:    []string{"Bashar al-Assad"},
			query:     "Bashar al-Asad",
			wantMatch: true,
		},
		{
			name:      "partial_token_below_threshold",
			corpus:    []string{"Vladimir Vladimirovich Putin"},
			query:     "Putin",
			wantMatch: false,
		},
		{
			name:      "duplicate_candidates_dedup",
			corpus:    []string{"Kim Jong Un", "Kim Jong Un"},
			query:     "Kim Jong-un",
			wantMatch: true,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			m := NewInMemoryEmbeddingMatcher(0, 0)
			m.SetCandidates(tc.corpus)
			ev, err := m.MatchWithContext(
				context.Background(), domain.TenantID{},
				nameOf(t, tc.query),
			)
			if err != nil {
				t.Fatalf("MatchWithContext: %v", err)
			}
			got := len(ev) > 0
			if got != tc.wantMatch {
				t.Errorf("matched=%v want=%v; ev=%+v",
					got, tc.wantMatch, ev)
			}
		})
	}
}

func TestInMemoryEmbeddingMatcher_SetCandidatesReplaces(t *testing.T) {
	m := NewInMemoryEmbeddingMatcher(0, 0)
	m.SetCandidates([]string{"Vladimir Putin"})
	if m.CorpusSize() != 1 {
		t.Fatalf("CorpusSize after first SetCandidates: %d", m.CorpusSize())
	}
	m.SetCandidates([]string{"Kim Jong Un", "Bashar al-Assad"})
	if m.CorpusSize() != 2 {
		t.Fatalf("CorpusSize after replace: %d", m.CorpusSize())
	}
	// Old candidate must be gone — querying for Putin should no longer match.
	ev, _ := m.MatchWithContext(
		context.Background(), domain.TenantID{},
		nameOf(t, "Vladimir Putin"),
	)
	if len(ev) > 0 {
		t.Errorf("old candidate still in corpus after replace: %+v", ev)
	}
}

func TestInMemoryEmbeddingMatcher_DeterministicVector(t *testing.T) {
	m := NewInMemoryEmbeddingMatcher(0, 0)
	v1 := m.vectorize("Vladimir Putin")
	v2 := m.vectorize("vladimir putin")
	v3 := m.vectorize("  Vladimir   Putin  ")
	if cosineSimilarity(v1, v2) < 0.9999 {
		t.Errorf("vectors differ for case-variant input: %.4f",
			cosineSimilarity(v1, v2))
	}
	if cosineSimilarity(v1, v3) < 0.9999 {
		t.Errorf("vectors differ for whitespace-variant input: %.4f",
			cosineSimilarity(v1, v3))
	}
}
