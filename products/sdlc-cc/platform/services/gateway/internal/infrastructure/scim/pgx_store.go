// Postgres-backed SCIM Users Store. BEAT-PLAN Day 23 follow-up:
// replaces MemoryStore so resources survive restarts. Schema lives in
// database/migrations/024_scim_resources.sql. Tenant scope is enforced
// in every query; the in-memory uniqueness check is replaced by the
// (tenant_id, user_name) unique index.
package scim

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PgxStore implements Store against pgxpool.
type PgxStore struct {
	pool *pgxpool.Pool
}

// NewPgxStore wires the store. Pool is required.
func NewPgxStore(pool *pgxpool.Pool) *PgxStore {
	if pool == nil {
		panic("scim: pgxpool required")
	}
	return &PgxStore{pool: pool}
}

// Create inserts a new SCIM user. Conflict on (tenant_id, user_name)
// surfaces ErrConflict so the handler returns 409.
func (s *PgxStore) Create(ctx context.Context, u User) (User, error) {
	if u.UserName == "" {
		return User{}, ErrConflict
	}
	if u.ID == "" {
		u.ID = uuid.NewString()
	}
	emails, _ := json.Marshal(u.Emails)
	now := nowFn()
	u.Meta.Created = now
	u.Meta.LastModified = now
	u.Meta.Version = etag(u)
	_, err := s.pool.Exec(ctx,
		`INSERT INTO scim_users
		   (id, tenant_id, user_name, active, name_formatted, name_family, name_given,
		    emails, created_at, updated_at, version)
		   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
		u.ID, u.TenantID, u.UserName, u.Active,
		u.Name.Formatted, u.Name.FamilyName, u.Name.GivenName,
		emails, u.Meta.Created, u.Meta.LastModified, u.Meta.Version,
	)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return User{}, ErrConflict
		}
		return User{}, err
	}
	return u, nil
}

// Get fetches one user by id, scoped to tenant.
func (s *PgxStore) Get(ctx context.Context, tenantID, id string) (User, error) {
	row := s.pool.QueryRow(ctx,
		`SELECT id, tenant_id, user_name, active, name_formatted, name_family, name_given,
		        emails, created_at, updated_at, version
		   FROM scim_users WHERE tenant_id=$1 AND id=$2`,
		tenantID, id,
	)
	return scanUser(row)
}

// Delete removes a user; returns ErrNotFound when no row matched.
func (s *PgxStore) Delete(ctx context.Context, tenantID, id string) error {
	tag, err := s.pool.Exec(ctx,
		`DELETE FROM scim_users WHERE tenant_id=$1 AND id=$2`, tenantID, id,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// Update replaces every attribute of an existing user.
func (s *PgxStore) Update(ctx context.Context, u User) (User, error) {
	emails, _ := json.Marshal(u.Emails)
	u.Meta.LastModified = nowFn()
	u.Meta.Version = etag(u)
	tag, err := s.pool.Exec(ctx,
		`UPDATE scim_users
		    SET user_name=$3, active=$4, name_formatted=$5, name_family=$6, name_given=$7,
		        emails=$8, updated_at=$9, version=$10
		  WHERE tenant_id=$1 AND id=$2`,
		u.TenantID, u.ID, u.UserName, u.Active,
		u.Name.Formatted, u.Name.FamilyName, u.Name.GivenName,
		emails, u.Meta.LastModified, u.Meta.Version,
	)
	if err != nil {
		return User{}, err
	}
	if tag.RowsAffected() == 0 {
		return User{}, ErrNotFound
	}
	return s.Get(ctx, u.TenantID, u.ID)
}

// Search returns users matching the SCIM filter. Pagination uses the
// 1-indexed Start + Count semantics of the SCIM spec.
func (s *PgxStore) Search(ctx context.Context, tenantID string, f Filter) ([]User, int, error) {
	args := []any{tenantID}
	where := "WHERE tenant_id=$1"
	if f.UserNameEq != "" {
		where += " AND lower(user_name)=lower($2)"
		args = append(args, f.UserNameEq)
	}
	var total int
	if err := s.pool.QueryRow(ctx, `SELECT count(*) FROM scim_users `+where, args...).Scan(&total); err != nil {
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
	args = append(args, limit, offset)
	q := `SELECT id, tenant_id, user_name, active, name_formatted, name_family, name_given,
	             emails, created_at, updated_at, version
	        FROM scim_users ` + where +
		` ORDER BY created_at LIMIT $` + itoa(len(args)-1) + ` OFFSET $` + itoa(len(args))
	rows, err := s.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	out := make([]User, 0, limit)
	for rows.Next() {
		u, err := scanUser(rows)
		if err != nil {
			return nil, 0, err
		}
		out = append(out, u)
	}
	return out, total, nil
}

// scanUser is the shared row -> User mapper used by Get + Search.
func scanUser(row pgx.Row) (User, error) {
	var u User
	var emails []byte
	err := row.Scan(&u.ID, &u.TenantID, &u.UserName, &u.Active,
		&u.Name.Formatted, &u.Name.FamilyName, &u.Name.GivenName,
		&emails, &u.Meta.Created, &u.Meta.LastModified, &u.Meta.Version,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return User{}, ErrNotFound
		}
		return User{}, err
	}
	u.Schemas = []string{UserSchema}
	if len(emails) > 0 {
		_ = json.Unmarshal(emails, &u.Emails)
	}
	return u, nil
}

// itoa is a tiny helper so the Search query can build $N placeholders
// without pulling in strconv.
func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	digits := make([]byte, 0, 4)
	for n > 0 {
		digits = append([]byte{byte('0' + n%10)}, digits...)
		n /= 10
	}
	return string(digits)
}
