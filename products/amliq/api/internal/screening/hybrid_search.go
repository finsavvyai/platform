package screening

import (
	"database/sql"
	"sort"
)

// SearchResult holds a single entity match from any search strategy.
type SearchResult struct {
	EntityID   string
	Score      float64
	Source     string // "dense", "sparse", "fused"
	ListSource string
}

// ReciprocalRankFusion merges dense and sparse results using RRF.
// Formula: score = sum(1 / (k + rank_i)) across all lists.
func ReciprocalRankFusion(
	dense, sparse []SearchResult, topK, k int,
) []SearchResult {
	scores := make(map[string]float64)
	lists := make(map[string]string)

	for rank, r := range dense {
		scores[r.EntityID] += 1.0 / float64(k+rank+1)
		lists[r.EntityID] = r.ListSource
	}
	for rank, r := range sparse {
		scores[r.EntityID] += 1.0 / float64(k+rank+1)
		if _, ok := lists[r.EntityID]; !ok {
			lists[r.EntityID] = r.ListSource
		}
	}

	fused := make([]SearchResult, 0, len(scores))
	for id, score := range scores {
		fused = append(fused, SearchResult{
			EntityID: id, Score: score,
			Source: "fused", ListSource: lists[id],
		})
	}
	sort.Slice(fused, func(i, j int) bool {
		return fused[i].Score > fused[j].Score
	})
	if topK > 0 && len(fused) > topK {
		fused = fused[:topK]
	}
	return fused
}

// SparseSearch performs keyword matching using PostgreSQL trigram similarity.
func SparseSearch(
	db *sql.DB, query string, topK int,
) ([]SearchResult, error) {
	rows, err := db.Query(sparseSQLQuery, query, topK)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanSearchResults(rows, "sparse")
}

const sparseSQLQuery = `SELECT id, full_name, list_id,
  similarity(full_name, $1) AS sim
  FROM entities WHERE full_name % $1
  ORDER BY sim DESC LIMIT $2`

// DenseSearch performs vector similarity using pgvector cosine distance.
func DenseSearch(
	db *sql.DB, embedding []float32, topK int,
) ([]SearchResult, error) {
	rows, err := db.Query(denseSQLQuery, float32SliceToStr(embedding), topK)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanSearchResults(rows, "dense")
}

const denseSQLQuery = `SELECT id, full_name, list_id,
  1 - (embedding <=> $1::vector) AS sim
  FROM entities WHERE embedding IS NOT NULL
  ORDER BY embedding <=> $1::vector LIMIT $2`

// HybridSearch runs both sparse and dense search, then fuses results.
func HybridSearch(
	db *sql.DB, query string, embedding []float32, topK int,
) ([]SearchResult, error) {
	sparse, err := SparseSearch(db, query, topK*2)
	if err != nil {
		return nil, err
	}
	dense, err := DenseSearch(db, embedding, topK*2)
	if err != nil {
		return nil, err
	}
	return ReciprocalRankFusion(dense, sparse, topK, 60), nil
}
