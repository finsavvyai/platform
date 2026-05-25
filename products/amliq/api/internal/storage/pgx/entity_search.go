package pgx

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

// SearchOptions configures the entity search.
type SearchOptions struct {
	Query     string
	Lists     []string  // filter by list IDs (empty = all)
	Threshold float64   // trigram similarity threshold (0.0-1.0)
	Limit     int
}

// FastSearch uses trigram similarity for blazing fast fuzzy search.
// Configurable list filters and fuzzy thresholds. No tenant required.
func (r *EntityRepository) FastSearch(
	ctx context.Context, opts SearchOptions,
) ([]domain.Entity, error) {
	if opts.Limit <= 0 || opts.Limit > 500 {
		opts.Limit = 100
	}
	if opts.Threshold <= 0 {
		opts.Threshold = 0.2
	}

	var args []interface{}
	args = append(args, opts.Query)                // $1
	args = append(args, opts.Query)                // $2 (for ILIKE)
	args = append(args, lastWord(opts.Query))      // $3 (last word)
	args = append(args, opts.Threshold)            // $4
	args = append(args, opts.Limit)                // $5

	listFilter := ""
	if len(opts.Lists) > 0 {
		placeholders := make([]string, len(opts.Lists))
		for i, l := range opts.Lists {
			args = append(args, l)
			placeholders[i] = fmt.Sprintf("$%d", len(args))
		}
		listFilter = fmt.Sprintf("AND list_id IN (%s)", strings.Join(placeholders, ","))
	}

	query := fmt.Sprintf(`
		SELECT id, type, full_name, given_name, family_name,
		       original_script, dob, nationalities, list_id,
		       metadata, created_at, updated_at,
		       addresses, identifiers, aliases,
		       GREATEST(
		         similarity(full_name, $1),
		         similarity(full_name, $3),
		         COALESCE(similarity(family_name, $1), 0),
		         COALESCE(similarity(given_name, $1), 0)
		       ) AS sim
		FROM entities
		WHERE (
		  similarity(full_name, $1) > $4
		  OR similarity(full_name, $3) > $4
		  OR COALESCE(similarity(family_name, $1), 0) > $4
		  OR COALESCE(similarity(given_name, $1), 0) > $4
		  OR full_name ILIKE '%%' || $2 || '%%'
		  OR full_name ILIKE '%%' || $3 || '%%'
		  OR family_name ILIKE '%%' || $1 || '%%'
		  OR given_name ILIKE '%%' || $1 || '%%'
		) %s
		ORDER BY sim DESC
		LIMIT $5
	`, listFilter)

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("fast search: %w", err)
	}
	defer rows.Close()
	return collectEntitiesWithSim(rows)
}

func collectEntitiesWithSim(rows *sql.Rows) ([]domain.Entity, error) {
	// Every caller in QuickSearch passes LIMIT ≤ 100, so
	// preallocate to the common 50-row case and let Go grow once
	// if needed. Avoids the 6+ reallocations on a full result.
	results := make([]domain.Entity, 0, 50)
	for rows.Next() {
		var sim float64
		ent, err := scanEntityWithExtra(rows, &sim)
		if err != nil {
			return nil, err
		}
		results = append(results, *ent)
	}
	return results, rows.Err()
}
