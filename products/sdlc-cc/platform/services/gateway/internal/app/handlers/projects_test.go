package handlers_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/sdlc-ai/platform/services/gateway/internal/app/handlers"
	"github.com/sdlc-ai/platform/services/gateway/internal/domain/projects"
)

// --- minimal in-memory stub -------------------------------------------------

type stubProjectsRepo struct {
	projects map[uuid.UUID]*projects.Project
	members  map[uuid.UUID][]projects.Member
}

func newStubRepo() *stubProjectsRepo {
	return &stubProjectsRepo{
		projects: make(map[uuid.UUID]*projects.Project),
		members:  make(map[uuid.UUID][]projects.Member),
	}
}

func (s *stubProjectsRepo) Create(_ context.Context, p *projects.Project) error {
	cp := *p
	s.projects[p.ID] = &cp
	return nil
}

func (s *stubProjectsRepo) Get(_ context.Context, tenantID, id uuid.UUID) (*projects.Project, error) {
	p, ok := s.projects[id]
	if !ok || p.TenantID != tenantID {
		return nil, projects.ErrNotFound
	}
	cp := *p
	cp.Members = append([]projects.Member{}, s.members[id]...)
	return &cp, nil
}

func (s *stubProjectsRepo) List(_ context.Context, tenantID uuid.UUID) ([]*projects.Project, error) {
	var out []*projects.Project
	for _, p := range s.projects {
		if p.TenantID == tenantID {
			cp := *p
			out = append(out, &cp)
		}
	}
	return out, nil
}

func (s *stubProjectsRepo) Update(_ context.Context, p *projects.Project) error {
	if _, ok := s.projects[p.ID]; !ok {
		return projects.ErrNotFound
	}
	cp := *p
	s.projects[p.ID] = &cp
	return nil
}

func (s *stubProjectsRepo) Delete(_ context.Context, tenantID, id uuid.UUID) error {
	p, ok := s.projects[id]
	if !ok || p.TenantID != tenantID {
		return projects.ErrNotFound
	}
	delete(s.projects, id)
	delete(s.members, id)
	return nil
}

func (s *stubProjectsRepo) AddMember(_ context.Context, _, projectID uuid.UUID, m projects.Member) error {
	s.members[projectID] = append(s.members[projectID], m)
	return nil
}

func (s *stubProjectsRepo) RemoveMember(_ context.Context, _, projectID, userID uuid.UUID) error {
	ms := s.members[projectID]
	for i, m := range ms {
		if m.UserID == userID {
			s.members[projectID] = append(ms[:i], ms[i+1:]...)
			return nil
		}
	}
	return projects.ErrNotFound
}

func (s *stubProjectsRepo) ListMembers(_ context.Context, _, projectID uuid.UUID) ([]projects.Member, error) {
	return append([]projects.Member{}, s.members[projectID]...), nil
}

// --- helpers ----------------------------------------------------------------

type stubClock struct{ t time.Time }

func (c stubClock) Now() time.Time { return c.t }

func newTestRouter(tenantID, userID uuid.UUID) (chi.Router, *stubProjectsRepo) {
	repo := newStubRepo()
	svc := projects.NewService(repo, stubClock{t: time.Date(2026, 4, 26, 0, 0, 0, 0, time.UTC)})
	r := chi.NewRouter()
	handlers.MountProjects(r, handlers.ProjectsDeps{
		Service:    svc,
		TenantFrom: func(_ *http.Request) (uuid.UUID, error) { return tenantID, nil },
		UserFrom:   func(_ *http.Request) (uuid.UUID, error) { return userID, nil },
	})
	return r, repo
}

func postJSON(r chi.Router, path string, body any) *httptest.ResponseRecorder {
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, path, bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func doRequest(r chi.Router, method, path string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

// --- tests ------------------------------------------------------------------

func TestProjectsCRUD_ListAndCreate(t *testing.T) {
	tenant, owner := uuid.New(), uuid.New()
	r, _ := newTestRouter(tenant, owner)

	w := doRequest(r, http.MethodGet, "/v1/projects/")
	if w.Code != http.StatusOK {
		t.Fatalf("list: want 200, got %d", w.Code)
	}
	w = postJSON(r, "/v1/projects/", map[string]any{
		"Name":         "Q4 Roadmap",
		"SystemPrompt": "You are a product assistant.",
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create: want 201, got %d: %s", w.Code, w.Body.String())
	}
	var created projects.Project
	json.NewDecoder(w.Body).Decode(&created) //nolint:errcheck
	if created.Name != "Q4 Roadmap" {
		t.Fatalf("name mismatch: %q", created.Name)
	}
}

func TestProjectsSystemPromptEnforced(t *testing.T) {
	tenant, owner := uuid.New(), uuid.New()
	r, _ := newTestRouter(tenant, owner)

	const prompt = "Answer only about compliance."
	w := postJSON(r, "/v1/projects/", map[string]any{
		"Name":         "Compliance Bot",
		"SystemPrompt": prompt,
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create: %d", w.Code)
	}
	var p projects.Project
	json.NewDecoder(w.Body).Decode(&p) //nolint:errcheck

	w = doRequest(r, http.MethodGet, "/v1/projects/"+p.ID.String())
	if w.Code != http.StatusOK {
		t.Fatalf("get: %d", w.Code)
	}
	var got projects.Project
	json.NewDecoder(w.Body).Decode(&got) //nolint:errcheck
	if got.SystemPrompt != prompt {
		t.Fatalf("system prompt not returned: want %q, got %q", prompt, got.SystemPrompt)
	}
}
