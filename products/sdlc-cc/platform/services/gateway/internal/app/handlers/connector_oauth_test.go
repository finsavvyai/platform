package handlers

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/sdlc-ai/platform/services/gateway/internal/connectors"
)

// mockConnector lets tests observe Authenticate calls.
type mockConnector struct {
	name      string
	gotTenant uuid.UUID
	gotCode   string
	authErr   error
}

func (m *mockConnector) Name() string { return m.name }
func (m *mockConnector) Authenticate(_ context.Context, tenantID uuid.UUID, code string) error {
	m.gotTenant = tenantID
	m.gotCode = code
	return m.authErr
}
func (m *mockConnector) ListResources(_ context.Context, _ uuid.UUID) ([]connectors.Resource, error) {
	return nil, nil
}
func (m *mockConnector) Fetch(_ context.Context, _ uuid.UUID, _ string) (*connectors.Document, error) {
	return nil, nil
}
func (m *mockConnector) Search(_ context.Context, _ uuid.UUID, _ string) ([]connectors.Resource, error) {
	return nil, nil
}
func (m *mockConnector) Watch(_ context.Context, _ uuid.UUID) (<-chan connectors.ChangeEvent, error) {
	return nil, nil
}

func newTestRouter(t *testing.T, mock *mockConnector, now func() time.Time, ttl time.Duration) (*chi.Mux, ConnectorOAuthDeps) {
	t.Helper()
	reg := connectors.NewRegistry()
	if mock != nil {
		_ = reg.Register(mock)
	}
	deps := ConnectorOAuthDeps{
		Registry:     reg,
		Secret:       []byte("test-secret"),
		AuthorizeURL: func(_ string) (string, error) { return "https://vendor/authorize?client_id=x", nil },
		AdminUIURL:   "/admin/connectors",
		Now:          now,
		StateTTL:     ttl,
	}
	r := chi.NewRouter()
	MountConnectorOAuth(r, deps)
	return r, deps
}

func TestStart_RedirectsWithSignedState(t *testing.T) {
	mock := &mockConnector{name: "zendesk"}
	now := func() time.Time { return time.Unix(1700000000, 0) }
	r, _ := newTestRouter(t, mock, now, 5*time.Minute)
	tenant := uuid.New()
	req := httptest.NewRequest(http.MethodGet, "/v1/connectors/zendesk/oauth/start?tenant_id="+tenant.String(), nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusFound {
		t.Fatalf("status: %d", rec.Code)
	}
	loc := rec.Header().Get("Location")
	if !strings.Contains(loc, "state=") || !strings.HasPrefix(loc, "https://vendor/authorize") {
		t.Fatalf("location: %s", loc)
	}
}

func TestStart_UnknownConnector_404(t *testing.T) {
	r, _ := newTestRouter(t, nil, time.Now, time.Minute)
	req := httptest.NewRequest(http.MethodGet, "/v1/connectors/nope/oauth/start?tenant_id="+uuid.NewString(), nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status: %d", rec.Code)
	}
}

func TestCallback_SuccessRoundTrip(t *testing.T) {
	mock := &mockConnector{name: "zendesk"}
	now := func() time.Time { return time.Unix(1700000000, 0) }
	r, deps := newTestRouter(t, mock, now, 5*time.Minute)
	tenant := uuid.New()
	state := signState(deps.Secret, tenant, "zendesk", "n1", deps.Now().Add(deps.StateTTL))
	req := httptest.NewRequest(http.MethodGet, "/v1/connectors/zendesk/oauth/callback?code=AUTHCODE&state="+state, nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusFound {
		t.Fatalf("status: %d body=%s", rec.Code, rec.Body.String())
	}
	if mock.gotCode != "AUTHCODE" || mock.gotTenant != tenant {
		t.Fatalf("authenticate not called correctly: code=%s tenant=%s", mock.gotCode, mock.gotTenant)
	}
	if !strings.Contains(rec.Header().Get("Location"), "connected=zendesk") {
		t.Fatalf("redirect: %s", rec.Header().Get("Location"))
	}
}

func TestCallback_ExpiredState(t *testing.T) {
	mock := &mockConnector{name: "zendesk"}
	now := func() time.Time { return time.Unix(1700000000, 0) }
	r, deps := newTestRouter(t, mock, now, 5*time.Minute)
	state := signState(deps.Secret, uuid.New(), "zendesk", "n1", deps.Now().Add(-time.Second))
	req := httptest.NewRequest(http.MethodGet, "/v1/connectors/zendesk/oauth/callback?code=X&state="+state, nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status: %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "expired") {
		t.Fatalf("body: %s", rec.Body.String())
	}
}

func TestCallback_ConnectorMismatch(t *testing.T) {
	mock := &mockConnector{name: "zendesk"}
	now := func() time.Time { return time.Unix(1700000000, 0) }
	r, deps := newTestRouter(t, mock, now, 5*time.Minute)
	// state signed for hubspot but URL targets zendesk
	state := signState(deps.Secret, uuid.New(), "hubspot", "n1", deps.Now().Add(deps.StateTTL))
	req := httptest.NewRequest(http.MethodGet, "/v1/connectors/zendesk/oauth/callback?code=X&state="+state, nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status: %d body=%s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "mismatch") {
		t.Fatalf("body: %s", rec.Body.String())
	}
}

func TestCallback_BadSignature(t *testing.T) {
	mock := &mockConnector{name: "zendesk"}
	now := func() time.Time { return time.Unix(1700000000, 0) }
	r, _ := newTestRouter(t, mock, now, 5*time.Minute)
	// signed with a *different* secret
	state := signState([]byte("wrong-secret"), uuid.New(), "zendesk", "n1", now().Add(5*time.Minute))
	req := httptest.NewRequest(http.MethodGet, "/v1/connectors/zendesk/oauth/callback?code=X&state="+state, nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status: %d body=%s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "signature") {
		t.Fatalf("body: %s", rec.Body.String())
	}
}

func TestCallback_AuthenticateError(t *testing.T) {
	mock := &mockConnector{name: "zendesk", authErr: errors.New("vendor 500")}
	now := func() time.Time { return time.Unix(1700000000, 0) }
	r, deps := newTestRouter(t, mock, now, 5*time.Minute)
	state := signState(deps.Secret, uuid.New(), "zendesk", "n1", deps.Now().Add(deps.StateTTL))
	req := httptest.NewRequest(http.MethodGet, "/v1/connectors/zendesk/oauth/callback?code=X&state="+state, nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadGateway {
		t.Fatalf("status: %d", rec.Code)
	}
}

func TestCallback_MissingCode(t *testing.T) {
	mock := &mockConnector{name: "zendesk"}
	r, _ := newTestRouter(t, mock, time.Now, time.Minute)
	req := httptest.NewRequest(http.MethodGet, "/v1/connectors/zendesk/oauth/callback?state=foo", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status: %d", rec.Code)
	}
}
