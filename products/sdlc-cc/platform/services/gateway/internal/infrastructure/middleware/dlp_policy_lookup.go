// Postgres-backed PolicyLookup. BEAT-PLAN S1.3 / Day 34.
// Missing row = ActionAllow so a tenant without an explicit policy
// fails open (matches the middleware's nil-tolerant contract).
// Claude Team B4: surfaces tenant-defined custom regex patterns
// from the same row's `custom_patterns` JSONB column (migration 029).

package middleware

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PgxPolicyLookup implements PolicyLookup against tenant_dlp_policy.
type PgxPolicyLookup struct {
	pool *pgxpool.Pool
}

// NewPgxPolicyLookup wires the lookup. Pool is required.
func NewPgxPolicyLookup(pool *pgxpool.Pool) *PgxPolicyLookup {
	if pool == nil {
		panic("dlp policy lookup: pool required")
	}
	return &PgxPolicyLookup{pool: pool}
}

// DLPAction returns the configured action. Empty/invalid tenant ids
// resolve to ActionAllow so a malformed bypass token never triggers
// a 422.
func (l *PgxPolicyLookup) DLPAction(ctx context.Context, tenantID string) (Action, error) {
	if tenantID == "" {
		return ActionAllow, nil
	}
	id, err := uuid.Parse(tenantID)
	if err != nil {
		return ActionAllow, nil
	}
	var action string
	err = l.pool.QueryRow(ctx,
		`SELECT action FROM tenant_dlp_policy WHERE tenant_id = $1`,
		id).Scan(&action)
	if errors.Is(err, pgx.ErrNoRows) {
		return ActionAllow, nil
	}
	if err != nil {
		return ActionAllow, fmt.Errorf("dlp policy lookup: %w", err)
	}
	return Action(action), nil
}

// ImagePolicy reads the tenant's image-input policy from the
// `image_policy` column. Missing rows + invalid values resolve to
// ImagePolicyAllow so a malformed policy never blocks legitimate
// traffic. Claude Team C2.
func (l *PgxPolicyLookup) ImagePolicy(ctx context.Context, tenantID string) (ImagePolicy, error) {
	if tenantID == "" {
		return ImagePolicyAllow, nil
	}
	id, err := uuid.Parse(tenantID)
	if err != nil {
		return ImagePolicyAllow, nil
	}
	var v string
	err = l.pool.QueryRow(ctx,
		`SELECT image_policy FROM tenant_dlp_policy WHERE tenant_id = $1`,
		id).Scan(&v)
	if errors.Is(err, pgx.ErrNoRows) {
		return ImagePolicyAllow, nil
	}
	if err != nil {
		return ImagePolicyAllow, fmt.Errorf("dlp image policy lookup: %w", err)
	}
	switch ImagePolicy(v) {
	case ImagePolicyBlock, ImagePolicyWarn:
		return ImagePolicy(v), nil
	}
	return ImagePolicyAllow, nil
}

// LegalPreset reads the tenant's legal-preset opt-in boolean from
// the `legal_preset` column (migration 032). Missing rows + missing
// column default to false so the preset is strictly opt-in.
// Implements LegalPresetLookup so dlp_middleware merges
// LegalPatterns() into the pattern set when the flag is true.
func (l *PgxPolicyLookup) LegalPreset(ctx context.Context, tenantID string) (bool, error) {
	if tenantID == "" {
		return false, nil
	}
	id, err := uuid.Parse(tenantID)
	if err != nil {
		return false, nil
	}
	var on bool
	err = l.pool.QueryRow(ctx,
		`SELECT COALESCE(legal_preset, false) FROM tenant_dlp_policy WHERE tenant_id = $1`,
		id).Scan(&on)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("dlp legal preset lookup: %w", err)
	}
	return on, nil
}

// CustomPatterns reads the tenant's user-defined regex pack from
// the `custom_patterns` JSONB column. Returns an empty slice when
// the row is missing or the column is the default '[]'. Implements
// the optional CustomPatternsLookup capability so the middleware
// merges the pack with built-in patterns at request time.
func (l *PgxPolicyLookup) CustomPatterns(ctx context.Context, tenantID string) ([]CustomPatternSpec, error) {
	if tenantID == "" {
		return nil, nil
	}
	id, err := uuid.Parse(tenantID)
	if err != nil {
		return nil, nil
	}
	var raw []byte
	err = l.pool.QueryRow(ctx,
		`SELECT custom_patterns FROM tenant_dlp_policy WHERE tenant_id = $1`,
		id).Scan(&raw)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("dlp custom patterns lookup: %w", err)
	}
	if len(raw) == 0 {
		return nil, nil
	}
	var specs []CustomPatternSpec
	if err := json.Unmarshal(raw, &specs); err != nil {
		// Malformed JSON in the column should not wedge the
		// pipeline; surface zero patterns instead.
		return nil, nil
	}
	return specs, nil
}
