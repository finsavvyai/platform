// Behavior tests for the BYOK admin endpoints. Validates that PUT
// upserts, DELETE is idempotent, missing fields return 400, and
// when no repo is wired the endpoint 503s with a clear message.
package byok_admin

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/byok"
)

type fakeRepo struct {
	stored        map[string]string
	setShouldFail bool
}

func newFakeRepo() *fakeRepo { return &fakeRepo{stored: map[string]string{}} }

func (f *fakeRepo) Set(_ context.Context, tenantID uuid.UUID, provider, apiKey string) error {
	if f.setShouldFail {
		return errors.New("fake set failure")
	}
	f.stored[tenantID.String()+":"+provider] = apiKey
	return nil
}

func (f *fakeRepo) Delete(_ context.Context, tenantID uuid.UUID, provider string) error {
	key := tenantID.String() + ":" + provider
	if _, ok := f.stored[key]; !ok {
		return byok.ErrNotConfigured
	}
	delete(f.stored, key)
	return nil
}

func TestSet_StoresKey(t *testing.T) {
	repo := newFakeRepo()
	r := chi.NewRouter()
	Mount(r, repo)

	tenantID := "11111111-1111-4111-8111-111111111111"
	body := strings.NewReader(`{"api_key":"sk-ant-tenant-key"}`)
	req := httptest.NewRequest(http.MethodPut,
		"/admin/tenants/"+tenantID+"/provider-credentials/anthropic", body)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want 204; body = %s", rec.Code, rec.Body.String())
	}
	if got := repo.stored[tenantID+":anthropic"]; got != "sk-ant-tenant-key" {
		t.Errorf("stored value = %q, want sk-ant-tenant-key", got)
	}
}

func TestSet_RejectsMissingAPIKey(t *testing.T) {
	r := chi.NewRouter()
	Mount(r, newFakeRepo())
	tenantID := "22222222-2222-4222-8222-222222222222"
	req := httptest.NewRequest(http.MethodPut,
		"/admin/tenants/"+tenantID+"/provider-credentials/anthropic",
		bytes.NewReader([]byte(`{}`)))
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
}

func TestSet_RejectsInvalidTenantID(t *testing.T) {
	r := chi.NewRouter()
	Mount(r, newFakeRepo())
	req := httptest.NewRequest(http.MethodPut,
		"/admin/tenants/not-a-uuid/provider-credentials/anthropic",
		strings.NewReader(`{"api_key":"x"}`))
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
}

func TestDelete_Idempotent(t *testing.T) {
	repo := newFakeRepo()
	r := chi.NewRouter()
	Mount(r, repo)

	tenantID := "33333333-3333-4333-8333-333333333333"
	req := httptest.NewRequest(http.MethodDelete,
		"/admin/tenants/"+tenantID+"/provider-credentials/anthropic", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("delete on missing row = %d, want 204 (idempotent)", rec.Code)
	}
}

func TestDelete_RemovesExisting(t *testing.T) {
	repo := newFakeRepo()
	tenantID := "44444444-4444-4444-8444-444444444444"
	repo.stored[tenantID+":anthropic"] = "sk-ant-existing"

	r := chi.NewRouter()
	Mount(r, repo)
	req := httptest.NewRequest(http.MethodDelete,
		"/admin/tenants/"+tenantID+"/provider-credentials/anthropic", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want 204", rec.Code)
	}
	if _, ok := repo.stored[tenantID+":anthropic"]; ok {
		t.Error("row still present after delete")
	}
}

func TestMount_NilRepoReturns503(t *testing.T) {
	r := chi.NewRouter()
	Mount(r, nil)

	tenantID := "55555555-5555-4555-8555-555555555555"
	req := httptest.NewRequest(http.MethodPut,
		"/admin/tenants/"+tenantID+"/provider-credentials/anthropic",
		strings.NewReader(`{"api_key":"x"}`))
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503 when repo is nil", rec.Code)
	}
	var env struct {
		Error struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &env)
	if !strings.Contains(env.Error.Message, "BYOK_ENCRYPTION_KEY") {
		t.Errorf("error message should mention BYOK_ENCRYPTION_KEY; got %q",
			env.Error.Message)
	}
}
