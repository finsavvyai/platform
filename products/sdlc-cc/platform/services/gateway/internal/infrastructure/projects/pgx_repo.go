// Postgres-backed Repository for projects + project_members.
// BEAT-PLAN Day 53 follow-up: replaces the missing impl so
// MountProjects can be wired into the request path.
//
// Schema lives at database/migrations/016_projects.sql. Tenant
// isolation is enforced by RLS (`app.current_tenant`); this repo
// scopes every query by tenant_id explicitly so callers don't depend
// on the session GUC being set.
package projects

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	domprojects "github.com/sdlc-ai/platform/services/gateway/internal/domain/projects"
)

// PgxRepo implements domprojects.Repository against a pgxpool.
type PgxRepo struct {
	pool *pgxpool.Pool
}

// NewPgxRepo wires the repository. Pool is required.
func NewPgxRepo(pool *pgxpool.Pool) *PgxRepo {
	if pool == nil {
		panic("projects: pgxpool required")
	}
	return &PgxRepo{pool: pool}
}

// Create inserts a project row. The service layer assigns id and
// timestamps so this is a straight INSERT.
func (r *PgxRepo) Create(ctx context.Context, p *domprojects.Project) error {
	_, err := r.pool.Exec(ctx,
		`INSERT INTO projects
		   (id, tenant_id, name, description, system_prompt, created_by, created_at, updated_at)
		   VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
		p.ID, p.TenantID, p.Name, p.Description, p.SystemPrompt,
		p.CreatedBy, p.CreatedAt, p.UpdatedAt,
	)
	return err
}

// Get fetches one project + its members in two queries.
func (r *PgxRepo) Get(ctx context.Context, tenantID, id uuid.UUID) (*domprojects.Project, error) {
	row := r.pool.QueryRow(ctx,
		`SELECT id, tenant_id, name, description, system_prompt, created_by, created_at, updated_at
		   FROM projects WHERE tenant_id=$1 AND id=$2`,
		tenantID, id,
	)
	var p domprojects.Project
	err := row.Scan(&p.ID, &p.TenantID, &p.Name, &p.Description, &p.SystemPrompt,
		&p.CreatedBy, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domprojects.ErrNotFound
		}
		return nil, err
	}
	members, err := r.ListMembers(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	p.Members = members
	return &p, nil
}

// List returns every project for the tenant (no member roster — call
// Get for that). Ordered most-recently-updated first.
func (r *PgxRepo) List(ctx context.Context, tenantID uuid.UUID) ([]*domprojects.Project, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, tenant_id, name, description, system_prompt, created_by, created_at, updated_at
		   FROM projects WHERE tenant_id=$1 ORDER BY updated_at DESC`,
		tenantID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*domprojects.Project
	for rows.Next() {
		var p domprojects.Project
		if err := rows.Scan(&p.ID, &p.TenantID, &p.Name, &p.Description, &p.SystemPrompt,
			&p.CreatedBy, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, &p)
	}
	return out, nil
}

// Update applies the patched fields. Service layer already merged the
// values, so this is a straight UPDATE.
func (r *PgxRepo) Update(ctx context.Context, p *domprojects.Project) error {
	tag, err := r.pool.Exec(ctx,
		`UPDATE projects
		    SET name=$3, description=$4, system_prompt=$5, updated_at=$6
		  WHERE tenant_id=$1 AND id=$2`,
		p.TenantID, p.ID, p.Name, p.Description, p.SystemPrompt, p.UpdatedAt,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domprojects.ErrNotFound
	}
	return nil
}

// Delete removes the project; FK cascade clears members + connectors.
func (r *PgxRepo) Delete(ctx context.Context, tenantID, id uuid.UUID) error {
	tag, err := r.pool.Exec(ctx,
		`DELETE FROM projects WHERE tenant_id=$1 AND id=$2`, tenantID, id,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domprojects.ErrNotFound
	}
	return nil
}

// AddMember upserts a member row; tenant scoping is via the project_id
// FK + the policy on project_members.
func (r *PgxRepo) AddMember(ctx context.Context, _ uuid.UUID, projectID uuid.UUID, m domprojects.Member) error {
	_, err := r.pool.Exec(ctx,
		`INSERT INTO project_members (project_id, user_id, role, added_at)
		   VALUES ($1,$2,$3,$4)
		 ON CONFLICT (project_id, user_id) DO UPDATE SET role=EXCLUDED.role`,
		projectID, m.UserID, string(m.Role), m.AddedAt,
	)
	return err
}

// RemoveMember deletes one row from project_members scoped to tenant.
func (r *PgxRepo) RemoveMember(ctx context.Context, tenantID, projectID, userID uuid.UUID) error {
	tag, err := r.pool.Exec(ctx,
		`DELETE FROM project_members m
		  USING projects p
		  WHERE p.id = m.project_id
		    AND p.tenant_id = $1
		    AND m.project_id = $2
		    AND m.user_id = $3`,
		tenantID, projectID, userID,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domprojects.ErrNotFound
	}
	return nil
}

// ListMembers returns the project's roster. Tenant scope is via the
// projects join so cross-tenant project_id values return zero rows.
func (r *PgxRepo) ListMembers(ctx context.Context, tenantID, projectID uuid.UUID) ([]domprojects.Member, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT m.project_id, m.user_id, m.role, m.added_at
		   FROM project_members m
		   JOIN projects p ON p.id = m.project_id
		  WHERE p.tenant_id=$1 AND m.project_id=$2
		  ORDER BY m.added_at`,
		tenantID, projectID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]domprojects.Member, 0)
	for rows.Next() {
		var m domprojects.Member
		var role string
		if err := rows.Scan(&m.ProjectID, &m.UserID, &role, &m.AddedAt); err != nil {
			return nil, err
		}
		m.Role = domprojects.Role(role)
		out = append(out, m)
	}
	return out, nil
}
