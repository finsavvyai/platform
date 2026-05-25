// PgxRepo persists sealed (provider, key) pairs per tenant in the
// `tenant_provider_credentials` table from migration 027.
package byok

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PgxRepo wraps a pgxpool to read/write credential rows. The repo
// is responsible for sealing/unsealing via Sealer; callers see
// plaintext only on Get.
type PgxRepo struct {
	pool   *pgxpool.Pool
	sealer *Sealer
}

// NewPgxRepo wires a repo. Both pool and sealer are required; nil
// callers should not have constructed the repo at all.
func NewPgxRepo(pool *pgxpool.Pool, sealer *Sealer) *PgxRepo {
	if pool == nil || sealer == nil {
		panic("byok: pool and sealer required")
	}
	return &PgxRepo{pool: pool, sealer: sealer}
}

// ErrNotConfigured signals there's no per-tenant credential for
// the (tenant, provider) pair. Handlers fall back to the platform
// key in this case so the platform-pays model still works.
var ErrNotConfigured = errors.New("byok: no per-tenant credential")

// Get returns the plaintext API key for (tenantID, provider), or
// ErrNotConfigured when the row is missing. Sealer.Open errors
// surface as ErrTampered.
func (r *PgxRepo) Get(ctx context.Context, tenantID uuid.UUID, provider string) (string, error) {
	row := r.pool.QueryRow(ctx,
		`SELECT nonce, ciphertext
		   FROM tenant_provider_credentials
		  WHERE tenant_id = $1 AND provider = $2`,
		tenantID, provider,
	)
	var nonce, ciphertext []byte
	if err := row.Scan(&nonce, &ciphertext); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", ErrNotConfigured
		}
		return "", err
	}
	plaintext, err := r.sealer.Open(nonce, ciphertext)
	if err != nil {
		return "", err
	}
	return string(plaintext), nil
}

// Set seals the apiKey and upserts the row. Used by the admin
// endpoint to register or rotate per-tenant credentials.
func (r *PgxRepo) Set(ctx context.Context, tenantID uuid.UUID, provider, apiKey string) error {
	nonce, ciphertext, err := r.sealer.Seal([]byte(apiKey))
	if err != nil {
		return err
	}
	_, err = r.pool.Exec(ctx,
		`INSERT INTO tenant_provider_credentials
		   (tenant_id, provider, nonce, ciphertext)
		   VALUES ($1, $2, $3, $4)
		 ON CONFLICT (tenant_id, provider) DO UPDATE
		    SET nonce = EXCLUDED.nonce,
		        ciphertext = EXCLUDED.ciphertext,
		        updated_at = NOW()`,
		tenantID, provider, nonce, ciphertext,
	)
	return err
}

// Delete removes the row; used when a tenant rotates back to
// platform-pays or offboards.
func (r *PgxRepo) Delete(ctx context.Context, tenantID uuid.UUID, provider string) error {
	tag, err := r.pool.Exec(ctx,
		`DELETE FROM tenant_provider_credentials
		  WHERE tenant_id = $1 AND provider = $2`,
		tenantID, provider,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotConfigured
	}
	return nil
}
