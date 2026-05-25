// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Postgres-backed lookups for the finance + healthcare DLP preset
// opt-in flags. Mirrors PgxPolicyLookup.LegalPreset; kept in a
// separate file so dlp_policy_lookup.go stays under the portfolio
// 200-line cap.

package middleware

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// FinancePreset reads the tenant's finance-preset opt-in boolean
// from the `finance_preset` column (migration 033). Missing rows +
// missing column default to false so the preset is strictly
// opt-in. Implements FinancePresetLookup so dlp_middleware merges
// FinancePatterns() into the pattern set when the flag is true.
func (l *PgxPolicyLookup) FinancePreset(ctx context.Context, tenantID string) (bool, error) {
	return l.readPresetBool(ctx, tenantID, "finance_preset")
}

// HealthcarePreset reads the tenant's healthcare-preset opt-in
// boolean from the `healthcare_preset` column (migration 033).
// Same fallback semantics as FinancePreset.
func (l *PgxPolicyLookup) HealthcarePreset(ctx context.Context, tenantID string) (bool, error) {
	return l.readPresetBool(ctx, tenantID, "healthcare_preset")
}

// readPresetBool is the shared lookup body used by FinancePreset
// and HealthcarePreset. The column name is interpolated into the
// SQL literal — *not* parameterised — because Postgres does not
// allow parameterised column identifiers. Callers must pass a
// vetted, package-internal column name; passing untrusted input
// here would be SQL injection.
func (l *PgxPolicyLookup) readPresetBool(
	ctx context.Context,
	tenantID, column string,
) (bool, error) {
	if tenantID == "" {
		return false, nil
	}
	id, err := uuid.Parse(tenantID)
	if err != nil {
		return false, nil
	}
	q := fmt.Sprintf(
		`SELECT COALESCE(%s, false) FROM tenant_dlp_policy WHERE tenant_id = $1`,
		column,
	)
	var on bool
	err = l.pool.QueryRow(ctx, q, id).Scan(&on)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("dlp %s lookup: %w", column, err)
	}
	return on, nil
}
