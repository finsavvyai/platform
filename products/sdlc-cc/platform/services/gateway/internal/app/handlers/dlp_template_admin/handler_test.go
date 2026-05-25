// Behavior tests for the DLP template admin endpoints. Validates
// that the catalog renders as JSON, that applying a known template
// upserts the policy with the expected action + image policy +
// custom patterns, and that bad inputs return clean errors.
package dlp_template_admin

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/middleware"
)

type fakeRepo struct {
	gotTenant   uuid.UUID
	gotAction   middleware.Action
	gotImage    middleware.ImagePolicy
	gotPatterns int
}

func (f *fakeRepo) UpsertPolicy(_ context.Context, tenantID uuid.UUID,
	action middleware.Action, image middleware.ImagePolicy,
	patterns []middleware.CustomPatternSpec) error {
	f.gotTenant = tenantID
	f.gotAction = action
	f.gotImage = image
	f.gotPatterns = len(patterns)
	return nil
}

func TestListHandler_ReturnsCatalogJSON(t *testing.T) {
	r := chi.NewRouter()
	Mount(r, nil) // listing works without a repo
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec,
		httptest.NewRequest(http.MethodGet, "/admin/dlp-templates", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	var resp struct {
		Templates []struct {
			Name         string `json:"name"`
			Description  string `json:"description"`
			Action       string `json:"action"`
			ImagePolicy  string `json:"image_policy"`
			PatternCount int    `json:"pattern_count"`
		} `json:"templates"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("body not JSON: %v", err)
	}
	if len(resp.Templates) != 4 {
		t.Errorf("got %d templates, want 4", len(resp.Templates))
	}
}

func TestApplyHandler_UpsertsTemplate(t *testing.T) {
	repo := &fakeRepo{}
	r := chi.NewRouter()
	Mount(r, repo)

	tenantID := "11111111-1111-4111-8111-111111111111"
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(http.MethodPost,
		"/admin/tenants/"+tenantID+"/dlp-policy/template/hipaa-strict", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%q", rec.Code, rec.Body.String())
	}
	if repo.gotTenant.String() != tenantID {
		t.Errorf("repo got tenant %q, want %q", repo.gotTenant, tenantID)
	}
	if repo.gotAction != middleware.ActionBlock {
		t.Errorf("repo got action %q, want block (hipaa-strict default)", repo.gotAction)
	}
	if repo.gotImage != middleware.ImagePolicyBlock {
		t.Errorf("repo got image %q, want block", repo.gotImage)
	}
	if repo.gotPatterns < 3 {
		t.Errorf("hipaa-strict should ship at least 3 custom patterns, got %d",
			repo.gotPatterns)
	}
}

func TestApplyHandler_UnknownTemplateReturns404(t *testing.T) {
	r := chi.NewRouter()
	Mount(r, &fakeRepo{})
	tenantID := "22222222-2222-4222-8222-222222222222"
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(http.MethodPost,
		"/admin/tenants/"+tenantID+"/dlp-policy/template/not-a-real-template", nil))

	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404 on unknown template", rec.Code)
	}
}

func TestApplyHandler_InvalidTenantIDReturns400(t *testing.T) {
	r := chi.NewRouter()
	Mount(r, &fakeRepo{})
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(http.MethodPost,
		"/admin/tenants/not-a-uuid/dlp-policy/template/hipaa-strict", nil))

	if rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400 on bad tenant id", rec.Code)
	}
}

func TestApplyHandler_NilRepoReturns503(t *testing.T) {
	r := chi.NewRouter()
	Mount(r, nil)
	tenantID := "33333333-3333-4333-8333-333333333333"
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(http.MethodPost,
		"/admin/tenants/"+tenantID+"/dlp-policy/template/hipaa-strict", nil))

	if rec.Code != http.StatusServiceUnavailable {
		t.Errorf("status = %d, want 503 with nil repo", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "DLP template repo not wired") {
		t.Errorf("error message should mention missing repo; got %q", rec.Body.String())
	}
}
