// Postgres-backed SCIM Groups Store. BEAT-PLAN Day 23 follow-up:
// matches MemoryGroupStore semantics but persists rows in scim_groups.
package scim

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PgxGroupStore implements GroupStore against pgxpool.
type PgxGroupStore struct {
	pool *pgxpool.Pool
}

// NewPgxGroupStore wires the group store. Pool is required.
func NewPgxGroupStore(pool *pgxpool.Pool) *PgxGroupStore {
	if pool == nil {
		panic("scim: pgxpool required")
	}
	return &PgxGroupStore{pool: pool}
}

// Create inserts a new SCIM group; auto-assigns id when missing.
func (s *PgxGroupStore) Create(ctx context.Context, g Group) (Group, error) {
	if g.ID == "" {
		g.ID = uuid.NewString()
	}
	members, _ := json.Marshal(g.Members)
	now := nowFn()
	g.Meta.Created = now
	g.Meta.LastModified = now
	g.Meta.Version = etagFor(g.Meta.LastModified)
	_, err := s.pool.Exec(ctx,
		`INSERT INTO scim_groups (id, tenant_id, display_name, members, created_at, updated_at, version)
		 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		g.ID, g.TenantID, g.DisplayName, members,
		g.Meta.Created, g.Meta.LastModified, g.Meta.Version,
	)
	if err != nil {
		return Group{}, err
	}
	return g, nil
}

// Get fetches one group, scoped to tenant.
func (s *PgxGroupStore) Get(ctx context.Context, tenantID, id string) (Group, error) {
	row := s.pool.QueryRow(ctx,
		`SELECT id, tenant_id, display_name, members, created_at, updated_at, version
		   FROM scim_groups WHERE tenant_id=$1 AND id=$2`,
		tenantID, id,
	)
	return scanGroup(row)
}

// Delete removes a group; returns ErrNotFound when no row matched.
func (s *PgxGroupStore) Delete(ctx context.Context, tenantID, id string) error {
	tag, err := s.pool.Exec(ctx,
		`DELETE FROM scim_groups WHERE tenant_id=$1 AND id=$2`, tenantID, id,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// Update replaces the displayName + members of an existing group.
func (s *PgxGroupStore) Update(ctx context.Context, g Group) (Group, error) {
	members, _ := json.Marshal(g.Members)
	g.Meta.LastModified = nowFn()
	g.Meta.Version = etagFor(g.Meta.LastModified)
	tag, err := s.pool.Exec(ctx,
		`UPDATE scim_groups
		    SET display_name=$3, members=$4, updated_at=$5, version=$6
		  WHERE tenant_id=$1 AND id=$2`,
		g.TenantID, g.ID, g.DisplayName, members,
		g.Meta.LastModified, g.Meta.Version,
	)
	if err != nil {
		return Group{}, err
	}
	if tag.RowsAffected() == 0 {
		return Group{}, ErrNotFound
	}
	return s.Get(ctx, g.TenantID, g.ID)
}

// Search returns a tenant-scoped page of groups. Filter is currently
// ignored beyond pagination; SCIM Groups filter syntax is not used by
// Okta or Azure AD against this resource.
func (s *PgxGroupStore) Search(ctx context.Context, tenantID string, f Filter) ([]Group, int, error) {
	var total int
	if err := s.pool.QueryRow(ctx,
		`SELECT count(*) FROM scim_groups WHERE tenant_id=$1`, tenantID,
	).Scan(&total); err != nil {
		return nil, 0, err
	}
	limit := f.Count
	if limit <= 0 {
		limit = 100
	}
	offset := f.Start - 1
	if offset < 0 {
		offset = 0
	}
	rows, err := s.pool.Query(ctx,
		`SELECT id, tenant_id, display_name, members, created_at, updated_at, version
		   FROM scim_groups WHERE tenant_id=$1 ORDER BY created_at LIMIT $2 OFFSET $3`,
		tenantID, limit, offset,
	)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	out := make([]Group, 0, limit)
	for rows.Next() {
		g, err := scanGroup(rows)
		if err != nil {
			return nil, 0, err
		}
		out = append(out, g)
	}
	return out, total, nil
}

// scanGroup is the shared row -> Group mapper.
func scanGroup(row pgx.Row) (Group, error) {
	var g Group
	var members []byte
	err := row.Scan(&g.ID, &g.TenantID, &g.DisplayName, &members,
		&g.Meta.Created, &g.Meta.LastModified, &g.Meta.Version,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Group{}, ErrNotFound
		}
		return Group{}, err
	}
	g.Schemas = []string{GroupSchema}
	if len(members) > 0 {
		_ = json.Unmarshal(members, &g.Members)
	}
	return g, nil
}
