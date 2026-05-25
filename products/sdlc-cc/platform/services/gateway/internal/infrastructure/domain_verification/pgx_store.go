// Postgres-backed Store for domain_verification. BEAT-PLAN Day 25
// follow-up: replaces MemStore so domain ownership survives restarts
// and email-domain -> SSO auto-redirect can serve real traffic.
//
// Schema: database/migrations/025_domain_verification.sql.
package domain_verification

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PgxStore implements Store against pgxpool.
type PgxStore struct {
	pool *pgxpool.Pool
}

// NewPgxStore wires the store. Pool is required.
func NewPgxStore(pool *pgxpool.Pool) *PgxStore {
	if pool == nil {
		panic("domain_verification: pgxpool required")
	}
	return &PgxStore{pool: pool}
}

// Save upserts a domain record by (tenant_id, domain).
func (s *PgxStore) Save(ctx context.Context, r DomainRecord) error {
	if r.ID == uuid.Nil {
		r.ID = uuid.New()
	}
	_, err := s.pool.Exec(ctx,
		`INSERT INTO tenant_domains
		   (id, tenant_id, domain, token, method, status, verified_at, expires_at, created_at)
		   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
		 ON CONFLICT (tenant_id, domain) DO UPDATE
		    SET token=EXCLUDED.token,
		        method=EXCLUDED.method,
		        status=EXCLUDED.status,
		        verified_at=EXCLUDED.verified_at,
		        expires_at=EXCLUDED.expires_at`,
		r.ID, r.TenantID, r.Domain, string(r.Token), string(r.Method),
		string(r.Status), r.VerifiedAt, r.ExpiresAt, r.CreatedAt,
	)
	return err
}

// Get fetches one record, scoped to tenant.
func (s *PgxStore) Get(ctx context.Context, tenantID uuid.UUID, domain string) (DomainRecord, error) {
	row := s.pool.QueryRow(ctx,
		`SELECT id, tenant_id, domain, token, method, status, verified_at, expires_at, created_at
		   FROM tenant_domains WHERE tenant_id=$1 AND domain=$2`,
		tenantID, domain,
	)
	return scanDomainRow(row)
}

// List returns every domain record owned by the tenant.
func (s *PgxStore) List(ctx context.Context, tenantID uuid.UUID) ([]DomainRecord, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, tenant_id, domain, token, method, status, verified_at, expires_at, created_at
		   FROM tenant_domains WHERE tenant_id=$1 ORDER BY created_at DESC`,
		tenantID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []DomainRecord
	for rows.Next() {
		r, err := scanDomainRow(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, nil
}

// Delete removes a domain record. Idempotent: missing rows return nil.
func (s *PgxStore) Delete(ctx context.Context, tenantID uuid.UUID, domain string) error {
	_, err := s.pool.Exec(ctx,
		`DELETE FROM tenant_domains WHERE tenant_id=$1 AND domain=$2`,
		tenantID, domain,
	)
	return err
}

// FindVerifiedByDomain finds the tenant that owns a verified domain
// (used by SSO auto-redirect). Returns ErrNotFound when none.
func (s *PgxStore) FindVerifiedByDomain(ctx context.Context, domain string) (DomainRecord, error) {
	row := s.pool.QueryRow(ctx,
		`SELECT id, tenant_id, domain, token, method, status, verified_at, expires_at, created_at
		   FROM tenant_domains WHERE domain=$1 AND status='verified'
		   ORDER BY verified_at DESC LIMIT 1`,
		domain,
	)
	return scanDomainRow(row)
}

func scanDomainRow(row pgx.Row) (DomainRecord, error) {
	var r DomainRecord
	var token, method, status string
	err := row.Scan(&r.ID, &r.TenantID, &r.Domain, &token, &method, &status,
		&r.VerifiedAt, &r.ExpiresAt, &r.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return DomainRecord{}, ErrNotFound
		}
		return DomainRecord{}, err
	}
	r.Token = Token(token)
	r.Method = VerifyMethod(method)
	r.Status = DomainStatus(status)
	return r, nil
}
