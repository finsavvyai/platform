package screening

import "testing"

func TestBKTree_ExactMatch(t *testing.T) {
	tree := NewBKTree("vladimir putin", "ent_1")
	tree.Insert("kim jong un", "ent_2")
	tree.Insert("hassan nasrallah", "ent_3")

	results := tree.Search("vladimir putin", 0)
	if len(results) != 1 || results[0].EntityID != "ent_1" {
		t.Errorf("expected exact match for 'vladimir putin', got %v", results)
	}
}

func TestBKTree_FuzzyMatch(t *testing.T) {
	tree := NewBKTree("vladimir putin", "ent_1")
	tree.Insert("vladimer putin", "ent_2")
	tree.Insert("john smith", "ent_3")

	results := tree.Search("vladimir putin", 2)
	if len(results) < 2 {
		t.Errorf("expected at least 2 matches within distance 2, got %d", len(results))
	}
}

func TestBKTree_NoMatch(t *testing.T) {
	tree := NewBKTree("vladimir putin", "ent_1")
	results := tree.Search("completely different name", 2)
	if len(results) != 0 {
		t.Errorf("expected no match, got %v", results)
	}
}

func TestBKTree_Size(t *testing.T) {
	tree := NewBKTree("a", "1")
	tree.Insert("b", "2")
	tree.Insert("c", "3")
	if tree.Size() != 3 {
		t.Errorf("expected size 3, got %d", tree.Size())
	}
}

func TestLevenshteinDistance_BK(t *testing.T) {
	tests := []struct {
		a, b string
		want int
	}{
		{"", "", 0},
		{"abc", "", 3},
		{"", "abc", 3},
		{"kitten", "sitting", 3},
		{"putin", "putin", 0},
		{"putin", "puteen", 2},
	}
	for _, tt := range tests {
		got := levenshteinDistance(tt.a, tt.b)
		if got != tt.want {
			t.Errorf("lev(%q, %q) = %d, want %d", tt.a, tt.b, got, tt.want)
		}
	}
}

func BenchmarkBKTree_Search(b *testing.B) {
	tree := NewBKTree("vladimir putin", "ent_0")
	for i := 1; i < 1000; i++ {
		tree.Insert(benchNames[i%len(benchNames)].Full, padInt(i))
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		tree.Search("vladimir putin", 2)
	}
}

func BenchmarkLevenshtein(b *testing.B) {
	for i := 0; i < b.N; i++ {
		levenshteinDistance("vladimir putin", "vladimer puteen")
	}
}
