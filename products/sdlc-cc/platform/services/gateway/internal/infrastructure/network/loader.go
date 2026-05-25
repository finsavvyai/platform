// Postgres-backed loader for the per-tenant IP allowlist.
//
// Day 26 of the production-ready roadmap. The middleware uses
// LookupTenant to fetch the network_mode + every CIDR rule for a
// tenant on each request — small enough that an in-pool query is
// fine; if the volume ever requires it, drop a per-tenant TTL cache
// in front of this struct.
package network

import (
	"context"
	"errors"
	"fmt"
	"net"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// NetworkMode is the per-tenant policy controlling what happens when
// a request arrives without a matching allowlist rule.
type NetworkMode string

const (
	// NetworkModePublic allows requests from any source IP. The
	// allowlist still applies as a *positive* match for audit, but
	// no IP is rejected for missing the list.
	NetworkModePublic NetworkMode = "public"

	// NetworkModePrivateOnly rejects every IP that doesn't match a
	// CIDR in the allowlist.
	NetworkModePrivateOnly NetworkMode = "private_only"
)

// TenantPolicy is one read of the allowlist table for a tenant.
type TenantPolicy struct {
	Mode      NetworkMode
	AllowList AllowList
}

// PgxLoader implements the loader interface used by the middleware.
type PgxLoader struct {
	pool *pgxpool.Pool
}

// NewPgxLoader wires a loader. Pool is required.
func NewPgxLoader(pool *pgxpool.Pool) *PgxLoader {
	if pool == nil {
		panic("network: pgxpool required")
	}
	return &PgxLoader{pool: pool}
}

// LookupTenant returns the TenantPolicy for tenantID. Returns the
// public-mode default when the tenant row is missing — the
// middleware then admits the request.
func (l *PgxLoader) LookupTenant(ctx context.Context, tenantID uuid.UUID) (TenantPolicy, error) {
	if tenantID == uuid.Nil {
		return TenantPolicy{Mode: NetworkModePublic}, nil
	}
	var modeStr string
	err := l.pool.QueryRow(ctx,
		`SELECT COALESCE(network_mode, 'public') FROM tenants WHERE id = $1`,
		tenantID,
	).Scan(&modeStr)
	if errors.Is(err, pgx.ErrNoRows) {
		return TenantPolicy{Mode: NetworkModePublic}, nil
	}
	if err != nil {
		return TenantPolicy{}, fmt.Errorf("network: tenants lookup: %w", err)
	}

	rows, err := l.pool.Query(ctx,
		`SELECT api_key_id, cidr::text FROM ip_allowlists WHERE tenant_id = $1`,
		tenantID,
	)
	if err != nil {
		return TenantPolicy{}, fmt.Errorf("network: ip_allowlists query: %w", err)
	}
	defer rows.Close()

	policy := TenantPolicy{
		Mode: NetworkMode(modeStr),
		AllowList: AllowList{
			PerKey: map[uuid.UUID][]*net.IPNet{},
		},
	}
	for rows.Next() {
		var apiKey *uuid.UUID
		var cidrStr string
		if err := rows.Scan(&apiKey, &cidrStr); err != nil {
			return TenantPolicy{}, fmt.Errorf("network: scan: %w", err)
		}
		_, cidr, err := net.ParseCIDR(cidrStr)
		if err != nil {
			continue
		}
		if apiKey == nil {
			policy.AllowList.TenantWide = append(policy.AllowList.TenantWide, cidr)
			continue
		}
		policy.AllowList.PerKey[*apiKey] = append(policy.AllowList.PerKey[*apiKey], cidr)
	}
	return policy, nil
}

