package projects

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
)

// fakeRepo is an in-memory Repository for unit tests.
type fakeRepo struct {
	projects map[uuid.UUID]*Project
	members  map[uuid.UUID][]Member
}

func newFakeRepo() *fakeRepo {
	return &fakeRepo{
		projects: make(map[uuid.UUID]*Project),
		members:  make(map[uuid.UUID][]Member),
	}
}

func (f *fakeRepo) Create(_ context.Context, p *Project) error {
	if _, ok := f.projects[p.ID]; ok {
		return errors.New("dup")
	}
	cp := *p
	f.projects[p.ID] = &cp
	return nil
}

func (f *fakeRepo) Get(_ context.Context, tenantID, id uuid.UUID) (*Project, error) {
	p, ok := f.projects[id]
	if !ok {
		return nil, ErrNotFound
	}
	if p.TenantID != tenantID {
		return nil, ErrNotFound
	}
	cp := *p
	cp.Members = append([]Member{}, f.members[id]...)
	return &cp, nil
}

func (f *fakeRepo) List(_ context.Context, tenantID uuid.UUID) ([]*Project, error) {
	out := []*Project{}
	for _, p := range f.projects {
		if p.TenantID == tenantID {
			cp := *p
			out = append(out, &cp)
		}
	}
	return out, nil
}

func (f *fakeRepo) Update(_ context.Context, p *Project) error {
	if _, ok := f.projects[p.ID]; !ok {
		return ErrNotFound
	}
	cp := *p
	f.projects[p.ID] = &cp
	return nil
}

func (f *fakeRepo) Delete(_ context.Context, tenantID, id uuid.UUID) error {
	p, ok := f.projects[id]
	if !ok || p.TenantID != tenantID {
		return ErrNotFound
	}
	delete(f.projects, id)
	delete(f.members, id)
	return nil
}

func (f *fakeRepo) AddMember(_ context.Context, _, projectID uuid.UUID, m Member) error {
	if _, ok := f.projects[projectID]; !ok {
		return ErrNotFound
	}
	f.members[projectID] = append(f.members[projectID], m)
	return nil
}

func (f *fakeRepo) ListMembers(_ context.Context, _, projectID uuid.UUID) ([]Member, error) {
	if _, ok := f.projects[projectID]; !ok {
		return nil, ErrNotFound
	}
	return append([]Member{}, f.members[projectID]...), nil
}


type fixedClock struct{ t time.Time }

func (f fixedClock) Now() time.Time { return f.t }

func newSvc() (*Service, *fakeRepo) {
	r := newFakeRepo()
	return NewService(r, fixedClock{t: time.Date(2026, 4, 26, 0, 0, 0, 0, time.UTC)}), r
}

func TestCreate_HappyPath(t *testing.T) {
	s, _ := newSvc()
	tenant := uuid.New()
	user := uuid.New()
	p, err := s.Create(context.Background(), tenant, user, CreateInput{Name: "  My Project "})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if p.Name != "My Project" {
		t.Fatalf("name not trimmed: %q", p.Name)
	}
	if p.TenantID != tenant || p.CreatedBy != user {
		t.Fatalf("ownership mismatch: %+v", p)
	}
	if len(p.Members) != 1 || p.Members[0].Role != RoleOwner {
		t.Fatalf("creator must be owner: %+v", p.Members)
	}
}

func TestCreate_InvalidName(t *testing.T) {
	s, _ := newSvc()
	_, err := s.Create(context.Background(), uuid.New(), uuid.New(), CreateInput{Name: "   "})
	if !errors.Is(err, ErrInvalidName) {
		t.Fatalf("want ErrInvalidName, got %v", err)
	}
}

func TestGet_TenantIsolation(t *testing.T) {
	s, _ := newSvc()
	tenantA := uuid.New()
	tenantB := uuid.New()
	user := uuid.New()
	p, err := s.Create(context.Background(), tenantA, user, CreateInput{Name: "A"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.Get(context.Background(), tenantB, p.ID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("cross-tenant Get must be ErrNotFound, got %v", err)
	}
	if _, err := s.Get(context.Background(), tenantA, p.ID); err != nil {
		t.Fatalf("same-tenant Get must succeed, got %v", err)
	}
}

func TestUpdate_PartialPatch(t *testing.T) {
	s, _ := newSvc()
	tenant, user := uuid.New(), uuid.New()
	p, _ := s.Create(context.Background(), tenant, user, CreateInput{Name: "old"})
	newName := "new"
	got, err := s.Update(context.Background(), tenant, p.ID, UpdateInput{Name: &newName})
	if err != nil {
		t.Fatalf("update: %v", err)
	}
	if got.Name != "new" {
		t.Fatalf("name not updated: %q", got.Name)
	}
}

func TestDelete_TenantIsolation(t *testing.T) {
	s, _ := newSvc()
	tenantA, tenantB, user := uuid.New(), uuid.New(), uuid.New()
	p, _ := s.Create(context.Background(), tenantA, user, CreateInput{Name: "A"})
	if err := s.Delete(context.Background(), tenantB, p.ID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("cross-tenant Delete must be ErrNotFound, got %v", err)
	}
	if err := s.Delete(context.Background(), tenantA, p.ID); err != nil {
		t.Fatalf("same-tenant Delete must succeed, got %v", err)
	}
}

func TestAddMember_RoleValidation(t *testing.T) {
	s, _ := newSvc()
	tenant, user := uuid.New(), uuid.New()
	p, _ := s.Create(context.Background(), tenant, user, CreateInput{Name: "x"})
	if _, err := s.AddMember(context.Background(), tenant, p.ID, uuid.New(), Role("admin")); !errors.Is(err, ErrInvalidRole) {
		t.Fatalf("bad role must be ErrInvalidRole, got %v", err)
	}
	m, err := s.AddMember(context.Background(), tenant, p.ID, uuid.New(), RoleEditor)
	if err != nil || m.Role != RoleEditor {
		t.Fatalf("editor add: %v %+v", err, m)
	}
}

func TestList_OnlyTenantProjects(t *testing.T) {
	s, _ := newSvc()
	tenantA, tenantB, user := uuid.New(), uuid.New(), uuid.New()
	_, _ = s.Create(context.Background(), tenantA, user, CreateInput{Name: "A1"})
	_, _ = s.Create(context.Background(), tenantA, user, CreateInput{Name: "A2"})
	_, _ = s.Create(context.Background(), tenantB, user, CreateInput{Name: "B1"})
	got, err := s.List(context.Background(), tenantA)
	if err != nil || len(got) != 2 {
		t.Fatalf("list A: %d %v", len(got), err)
	}
}
