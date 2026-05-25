package api

import (
	"encoding/csv"
	"fmt"
	"net/http"

	"github.com/aegis-aml/aegis/internal/domain"
)

func writeBatchCSV(w http.ResponseWriter, results []domain.BatchResult) {
	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition",
		"attachment; filename=batch_results.csv")

	cw := csv.NewWriter(w)
	cw.Write([]string{
		"entity_name", "match_count", "top_match",
		"confidence", "list_id",
	})
	for _, r := range results {
		cw.Write([]string{
			r.EntityName,
			fmt.Sprintf("%d", r.MatchCount),
			r.TopMatch,
			fmt.Sprintf("%.4f", r.Confidence),
			r.ListID,
		})
	}
	cw.Flush()
}
