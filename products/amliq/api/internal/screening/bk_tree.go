package screening

// BKTree indexes strings in a metric space using edit distance.
// Queries run in O(log n) average instead of O(n) linear scan by
// exploiting triangle inequality: |d(x,root) - d(query,root)| <= threshold.
type BKTree struct {
	word     string
	entityID string
	children map[int]*BKTree
}

// BKResult is a fuzzy search hit from the BK-Tree.
type BKResult struct {
	Word     string
	EntityID string
	Distance int
}

// NewBKTree creates a BK-Tree with a root word.
func NewBKTree(word, entityID string) *BKTree {
	return &BKTree{
		word:     word,
		entityID: entityID,
		children: make(map[int]*BKTree),
	}
}

// Insert adds a word to the BK-Tree.
func (t *BKTree) Insert(word, entityID string) {
	d := levenshteinDistance(t.word, word)
	if child, ok := t.children[d]; ok {
		child.Insert(word, entityID)
	} else {
		t.children[d] = NewBKTree(word, entityID)
	}
}

// Search finds all words within maxDist edit distance of query.
// Average complexity: O(n^(1/d)) ≈ O(log n) for typical name lengths.
func (t *BKTree) Search(query string, maxDist int) []BKResult {
	var results []BKResult
	t.search(query, maxDist, &results)
	return results
}

func (t *BKTree) search(query string, maxDist int, results *[]BKResult) {
	d := levenshteinDistance(t.word, query)
	if d <= maxDist {
		*results = append(*results, BKResult{
			Word: t.word, EntityID: t.entityID, Distance: d,
		})
	}
	// Triangle inequality pruning: only visit children in range [d-maxDist, d+maxDist]
	lo := d - maxDist
	hi := d + maxDist
	for dist, child := range t.children {
		if dist >= lo && dist <= hi {
			child.search(query, maxDist, results)
		}
	}
}

// Size returns the total number of entries in the tree.
func (t *BKTree) Size() int {
	count := 1
	for _, child := range t.children {
		count += child.Size()
	}
	return count
}

// levenshteinDistance is defined in levenshtein.go — reused here.
