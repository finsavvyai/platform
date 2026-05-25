package handlers_test

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"

	"github.com/sdlc-ai/platform/services/gateway/internal/domain/projects"
)

func TestProjectsGet_MemberSees200(t *testing.T) {
	tenant, owner := uuid.New(), uuid.New()
	r, _ := newTestRouter(tenant, owner)

	w := postJSON(r, "/v1/projects/", map[string]any{"Name": "Finance Bot"})
	if w.Code != http.StatusCreated {
		t.Fatalf("create: %d", w.Code)
	}
	var p projects.Project
	json.NewDecoder(w.Body).Decode(&p) //nolint:errcheck

	w = doRequest(r, http.MethodGet, "/v1/projects/"+p.ID.String())
	if w.Code != http.StatusOK {
		t.Fatalf("member GET: want 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestProjectsGet_NonMember403(t *testing.T) {
	tenant, owner, stranger := uuid.New(), uuid.New(), uuid.New()

	// Owner creates a project.
	ownerRepo := newStubRepo()
	ownerSvc := projects.NewService(ownerRepo, stubClock{})
	_, _ = ownerSvc.Create(t.Context(), tenant, owner, projects.CreateInput{Name: "Private"})
	// Find the created project.
	list, _ := ownerSvc.List(t.Context(), tenant)
	if len(list) != 1 {
		t.Fatal("expected 1 project")
	}
	projectID := list[0].ID

	// Stranger has same tenant but is not a member.
	strangerRepo := newStubRepo()
	// Share project data to simulate same DB.
	for k, v := range ownerRepo.projects {
		strangerRepo.projects[k] = v
	}
	strangerSvc := projects.NewService(strangerRepo, stubClock{})
	_, err := strangerSvc.GetForUser(t.Context(), tenant, projectID, stranger)
	if !errors.Is(err, projects.ErrNotMember) {
		t.Fatalf("non-member must get ErrNotMember, got %v", err)
	}
}

func TestProjectsAddAndRemoveMember(t *testing.T) {
	tenant, owner := uuid.New(), uuid.New()
	r, _ := newTestRouter(tenant, owner)

	w := postJSON(r, "/v1/projects/", map[string]any{"Name": "Team"})
	if w.Code != http.StatusCreated {
		t.Fatalf("create: %d", w.Code)
	}
	var p projects.Project
	json.NewDecoder(w.Body).Decode(&p) //nolint:errcheck

	editor := uuid.New()
	w = postJSON(r, "/v1/projects/"+p.ID.String()+"/members", map[string]any{
		"user_id": editor.String(),
		"role":    "editor",
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("add member: want 201, got %d: %s", w.Code, w.Body.String())
	}

	req := httptest.NewRequest(http.MethodDelete,
		"/v1/projects/"+p.ID.String()+"/members/"+editor.String(), nil)
	wr := httptest.NewRecorder()
	r.ServeHTTP(wr, req)
	if wr.Code != http.StatusNoContent {
		t.Fatalf("remove member: want 204, got %d: %s", wr.Code, wr.Body.String())
	}
}
