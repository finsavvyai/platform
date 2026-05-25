package screening

import (
	"database/sql"
	"fmt"
)

// Migration SQL (Go-based migrations):
// CREATE TABLE match_outcomes (
//   id SERIAL PRIMARY KEY,
//   algorithm TEXT NOT NULL,
//   list_source TEXT NOT NULL,
//   true_positive BOOLEAN NOT NULL,
//   created_at TIMESTAMPTZ DEFAULT NOW()
// );

// MatchOutcome records whether an algorithm produced a true or false positive.
type MatchOutcome struct {
	Algorithm    string
	ListSource   string
	TruePositive bool
}

// LearnedWeights holds per-algorithm weights derived from outcome history.
type LearnedWeights struct {
	Exact     float64
	Fuzzy     float64
	Phonetic  float64
	Token     float64
	Embedding float64
	Graph     float64
}

var defaultWeights = LearnedWeights{
	Exact: 1.0, Fuzzy: 0.7, Phonetic: 0.5,
	Token: 0.6, Embedding: 0.8, Graph: 0.4,
}

const minSamples = 20

// RecordOutcome stores a match result for learning.
func RecordOutcome(db *sql.DB, outcome MatchOutcome) error {
	_, err := db.Exec(
		`INSERT INTO match_outcomes (algorithm, list_source, true_positive)
		 VALUES ($1, $2, $3)`,
		outcome.Algorithm, outcome.ListSource, outcome.TruePositive,
	)
	if err != nil {
		return fmt.Errorf("record outcome: %w", err)
	}
	return nil
}

// GetWeights returns learned weights for a specific list source.
// Falls back to default weights if insufficient data.
func GetWeights(db *sql.DB, listSource string) (LearnedWeights, error) {
	rows, err := db.Query(
		`SELECT algorithm, COUNT(*) FILTER (WHERE true_positive) AS tp,
		        COUNT(*) AS total
		 FROM match_outcomes WHERE list_source = $1
		 GROUP BY algorithm`, listSource,
	)
	if err != nil {
		return defaultWeights, fmt.Errorf("get weights: %w", err)
	}
	defer rows.Close()

	w := defaultWeights
	for rows.Next() {
		var algo string
		var tp, total int
		if err := rows.Scan(&algo, &tp, &total); err != nil {
			return defaultWeights, fmt.Errorf("scan weights: %w", err)
		}
		if total < minSamples {
			continue
		}
		precision := float64(tp) / float64(total)
		applyWeight(&w, algo, precision)
	}
	return w, rows.Err()
}

func applyWeight(w *LearnedWeights, algo string, precision float64) {
	switch algo {
	case "exact":
		w.Exact = precision
	case "fuzzy":
		w.Fuzzy = precision
	case "phonetic":
		w.Phonetic = precision
	case "token":
		w.Token = precision
	case "embedding":
		w.Embedding = precision
	case "graph":
		w.Graph = precision
	}
}
