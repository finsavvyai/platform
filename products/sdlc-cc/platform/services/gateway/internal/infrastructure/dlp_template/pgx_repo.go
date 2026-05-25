// Postgres-backed repo that applies a DLP policy template to one
// tenant. Claude Team D2 closeout. Upserts the tenant_dlp_policy
// row with the action, image_policy, and custom_patterns JSONB
// from the chosen template.
package dlp_template

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/middleware"
)

// PgxRepo writes to tenant_dlp_policy.
type PgxRepo struct {
	pool *pgxpool.Pool
}

// NewPgxRepo wires the repo. Pool is required.
func NewPgxRepo(pool *pgxpool.Pool) *PgxRepo {
	if pool == nil {
		panic("dlp_template: pgxpool required")
	}
	return &PgxRepo{pool: pool}
}

// UpsertPolicy is a single SQL statement: UPSERT (tenant_id) DO
// UPDATE so applying a template repeatedly is idempotent. The
// caller is responsible for sourcing the template values; this
// repo trusts them.
func (r *PgxRepo) UpsertPolicy(ctx context.Context, tenantID uuid.UUID,
	action middleware.Action, image middleware.ImagePolicy,
	patterns []middleware.CustomPatternSpec) error {
	patternsJSON, err := json.Marshal(patterns)
	if err != nil {
		return fmt.Errorf("dlp_template: marshal patterns: %w", err)
	}
	_, err = r.pool.Exec(ctx,
		`INSERT INTO tenant_dlp_policy
		   (tenant_id, action, image_policy, custom_patterns)
		   VALUES ($1, $2, $3, $4)
		 ON CONFLICT (tenant_id) DO UPDATE
		    SET action = EXCLUDED.action,
		        image_policy = EXCLUDED.image_policy,
		        custom_patterns = EXCLUDED.custom_patterns,
		        updated_at = NOW()`,
		tenantID, string(action), string(image), patternsJSON,
	)
	if err != nil {
		return fmt.Errorf("dlp_template: upsert: %w", err)
	}
	return nil
}
