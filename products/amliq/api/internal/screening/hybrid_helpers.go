package screening

import (
	"database/sql"
	"fmt"
	"strings"
)

// scanSearchResults scans rows into SearchResult slice with a given source tag.
func scanSearchResults(
	rows *sql.Rows, source string,
) ([]SearchResult, error) {
	var results []SearchResult
	for rows.Next() {
		var id, name, listID string
		var sim float64
		if err := rows.Scan(&id, &name, &listID, &sim); err != nil {
			return nil, fmt.Errorf("scan %s result: %w", source, err)
		}
		results = append(results, SearchResult{
			EntityID:   id,
			Score:      sim,
			Source:     source,
			ListSource: listID,
		})
	}
	return results, rows.Err()
}

// float32SliceToStr converts a float32 embedding to pgvector string format.
func float32SliceToStr(v []float32) string {
	parts := make([]string, len(v))
	for i, f := range v {
		parts[i] = fmt.Sprintf("%.8f", f)
	}
	return "[" + strings.Join(parts, ",") + "]"
}
