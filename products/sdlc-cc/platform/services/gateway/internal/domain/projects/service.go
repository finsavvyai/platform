// Package projects — service layer for project CRUD.
//
// REAL implementation. The service depends on a Repository interface
// so callers can plug in a Postgres-backed impl in production and a
// fake in tests. Tenant isolation is enforced at TWO layers:
//
//   1. RLS in Postgres (see migration 016_projects.sql).
//   2. Explicit tenantID checks in this service so unit tests catch
//      regressions before they reach RLS.
package projects

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"
)

// Repository is the data-layer contract.
type Repository interface {
	Create(ctx context.Context, p *Project) error
	Get(ctx context.Context, tenantID, id uuid.UUID) (*Project, error)
	List(ctx context.Context, tenantID uuid.UUID) ([]*Project, error)
	Update(ctx context.Context, p *Project) error
	Delete(ctx context.Context, tenantID, id uuid.UUID) error
	AddMember(ctx context.Context, tenantID, projectID uuid.UUID, m Member) error
	RemoveMember(ctx context.Context, tenantID, projectID, userID uuid.UUID) error
	ListMembers(ctx context.Context, tenantID, projectID uuid.UUID) ([]Member, error)
}

// Clock is injectable so tests freeze time.
type Clock interface {
	Now() time.Time
}

type realClock struct{}

func (realClock) Now() time.Time { return time.Now().UTC() }

// Service is the public API used by handlers.
type Service struct {
	repo  Repository
	clock Clock
}

// NewService wires the dependencies. Pass nil clock for the default.
func NewService(repo Repository, clock Clock) *Service {
	if clock == nil {
		clock = realClock{}
	}
	return &Service{repo: repo, clock: clock}
}

// Create validates input, builds the aggregate, and persists.
func (s *Service) Create(ctx context.Context, tenantID, userID uuid.UUID, in CreateInput) (*Project, error) {
	if err := in.Validate(); err != nil {
		return nil, err
	}
	now := s.clock.Now()
	p := &Project{
		ID:           uuid.New(),
		TenantID:     tenantID,
		Name:         strings.TrimSpace(in.Name),
		Description:  in.Description,
		SystemPrompt: in.SystemPrompt,
		CreatedBy:    userID,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	if err := s.repo.Create(ctx, p); err != nil {
		return nil, err
	}
	// Creator is automatically owner.
	owner := Member{ProjectID: p.ID, UserID: userID, Role: RoleOwner, AddedAt: now}
	if err := s.repo.AddMember(ctx, tenantID, p.ID, owner); err != nil {
		return nil, err
	}
	p.Members = []Member{owner}
	return p, nil
}

// Get returns the project iff it belongs to tenantID.
func (s *Service) Get(ctx context.Context, tenantID, id uuid.UUID) (*Project, error) {
	p, err := s.repo.Get(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if p.TenantID != tenantID {
		return nil, ErrCrossTenant
	}
	return p, nil
}

// List returns every project visible to tenantID.
func (s *Service) List(ctx context.Context, tenantID uuid.UUID) ([]*Project, error) {
	return s.repo.List(ctx, tenantID)
}

// Update applies a partial UpdateInput.
func (s *Service) Update(ctx context.Context, tenantID, id uuid.UUID, in UpdateInput) (*Project, error) {
	if err := in.Validate(); err != nil {
		return nil, err
	}
	p, err := s.Get(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if in.Name != nil {
		p.Name = strings.TrimSpace(*in.Name)
	}
	if in.Description != nil {
		p.Description = *in.Description
	}
	if in.SystemPrompt != nil {
		p.SystemPrompt = *in.SystemPrompt
	}
	p.UpdatedAt = s.clock.Now()
	if err := s.repo.Update(ctx, p); err != nil {
		return nil, err
	}
	return p, nil
}

// Delete removes a project (and via FK cascade its members + connectors).
func (s *Service) Delete(ctx context.Context, tenantID, id uuid.UUID) error {
	if _, err := s.Get(ctx, tenantID, id); err != nil {
		return err
	}
	return s.repo.Delete(ctx, tenantID, id)
}

// AddMember enrolls userID with the given role.
func (s *Service) AddMember(ctx context.Context, tenantID, projectID, userID uuid.UUID, role Role) (*Member, error) {
	if err := role.Validate(); err != nil {
		return nil, ErrInvalidRole
	}
	if _, err := s.Get(ctx, tenantID, projectID); err != nil {
		return nil, err
	}
	m := Member{
		ProjectID: projectID,
		UserID:    userID,
		Role:      role,
		AddedAt:   s.clock.Now(),
	}
	if err := s.repo.AddMember(ctx, tenantID, projectID, m); err != nil {
		return nil, err
	}
	return &m, nil
}

// ListMembers returns the roster for a project (after tenant check).
func (s *Service) ListMembers(ctx context.Context, tenantID, projectID uuid.UUID) ([]Member, error) {
	if _, err := s.Get(ctx, tenantID, projectID); err != nil {
		return nil, err
	}
	return s.repo.ListMembers(ctx, tenantID, projectID)
}

// RemoveMember removes userID from the project roster.
func (s *Service) RemoveMember(ctx context.Context, tenantID, projectID, userID uuid.UUID) error {
	if _, err := s.Get(ctx, tenantID, projectID); err != nil {
		return err
	}
	return s.repo.RemoveMember(ctx, tenantID, projectID, userID)
}

// GetForUser returns the project only when userID is a member, 403 otherwise.
func (s *Service) GetForUser(ctx context.Context, tenantID, id, userID uuid.UUID) (*Project, error) {
	p, err := s.Get(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	for _, m := range p.Members {
		if m.UserID == userID {
			return p, nil
		}
	}
	return nil, ErrNotMember
}
