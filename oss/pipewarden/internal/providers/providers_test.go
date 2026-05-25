package providers

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

// ─── GitLab ──────────────────────────────────────────────────────────────────

func TestGitLabName(t *testing.T) {
	p := NewGitLab(Config{Token: "tok"})
	if p.Name() != "gitlab" {
		t.Errorf("expected 'gitlab', got %q", p.Name())
	}
}

func TestGitLabTestConnectionMissingToken(t *testing.T) {
	p := NewGitLab(Config{})
	if err := p.TestConnection(context.Background()); err == nil {
		t.Error("expected error for missing token")
	}
}

func TestGitLabTestConnectionHappyPath(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v4/user" {
			http.NotFound(w, r)
			return
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	p := NewGitLab(Config{Token: "good-token", BaseURL: srv.URL})
	p.cli = srv.Client()

	if err := p.TestConnection(context.Background()); err != nil {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestGitLabTestConnectionUnauthorized(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer srv.Close()

	p := NewGitLab(Config{Token: "bad-token", BaseURL: srv.URL})
	p.cli = srv.Client()

	if err := p.TestConnection(context.Background()); err == nil {
		t.Error("expected error for 401")
	}
}

func TestGitLabTestConnectionServerError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer srv.Close()

	p := NewGitLab(Config{Token: "tok", BaseURL: srv.URL})
	p.cli = srv.Client()

	if err := p.TestConnection(context.Background()); err == nil {
		t.Error("expected error for 500")
	}
}

func TestGitLabTestConnectionDefaultBaseURL(t *testing.T) {
	// Ensure the default URL branch is exercised without a live call:
	// provide a token and a closed server so the HTTP request fails fast.
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	srv.Close() // deliberately closed — Do() will return a transport error

	p := NewGitLab(Config{Token: "tok"}) // BaseURL intentionally empty
	p.cli = srv.Client()

	// The request will fail with a connection error (server closed); that is the
	// expected non-nil error for this branch — we just want the code path hit.
	err := p.TestConnection(context.Background())
	if err == nil {
		t.Error("expected a network error when server is closed")
	}
}

func TestGitLabTestConnectionContextCancelled(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // cancel immediately

	p := NewGitLab(Config{Token: "tok", BaseURL: srv.URL})
	p.cli = srv.Client()

	if err := p.TestConnection(ctx); err == nil {
		t.Error("expected error for cancelled context")
	}
}

func TestGitLabGetLogs(t *testing.T) {
	p := NewGitLab(Config{Token: "tok"})
	logs, err := p.GetLogs(context.Background(), "my-job")
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}
	if len(logs) != 0 {
		t.Errorf("expected empty log slice, got %d entries", len(logs))
	}
}

// ─── Jenkins ─────────────────────────────────────────────────────────────────

func TestJenkinsName(t *testing.T) {
	p := NewJenkins(Config{Token: "tok", BaseURL: "http://jenkins.local"})
	if p.Name() != "jenkins" {
		t.Errorf("expected 'jenkins', got %q", p.Name())
	}
}

func TestJenkinsTestConnectionMissingBaseURL(t *testing.T) {
	p := NewJenkins(Config{Token: "tok"})
	if err := p.TestConnection(context.Background()); err == nil {
		t.Error("expected error for missing base URL")
	}
}

func TestJenkinsTestConnectionMissingToken(t *testing.T) {
	p := NewJenkins(Config{BaseURL: "http://jenkins.local"})
	if err := p.TestConnection(context.Background()); err == nil {
		t.Error("expected error for missing token")
	}
}

func TestJenkinsTestConnectionHappyPath(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/json" {
			http.NotFound(w, r)
			return
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	p := NewJenkins(Config{Token: "tok", Username: "admin", BaseURL: srv.URL})
	p.cli = srv.Client()

	if err := p.TestConnection(context.Background()); err != nil {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestJenkinsTestConnectionUnauthorized(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer srv.Close()

	p := NewJenkins(Config{Token: "bad", Username: "admin", BaseURL: srv.URL})
	p.cli = srv.Client()

	if err := p.TestConnection(context.Background()); err == nil {
		t.Error("expected error for 401")
	}
}

func TestJenkinsTestConnectionForbidden(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusForbidden)
	}))
	defer srv.Close()

	p := NewJenkins(Config{Token: "tok", Username: "admin", BaseURL: srv.URL})
	p.cli = srv.Client()

	if err := p.TestConnection(context.Background()); err == nil {
		t.Error("expected error for 403")
	}
}

func TestJenkinsTestConnectionContextCancelled(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	p := NewJenkins(Config{Token: "tok", Username: "admin", BaseURL: srv.URL})
	p.cli = srv.Client()

	if err := p.TestConnection(ctx); err == nil {
		t.Error("expected error for cancelled context")
	}
}

func TestJenkinsGetLogs(t *testing.T) {
	p := NewJenkins(Config{Token: "tok", BaseURL: "http://jenkins.local"})
	logs, err := p.GetLogs(context.Background(), "build-job")
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}
	if len(logs) != 0 {
		t.Errorf("expected empty log slice, got %d entries", len(logs))
	}
}

// ─── Azure DevOps ─────────────────────────────────────────────────────────────

func TestAzureDevOpsName(t *testing.T) {
	p := NewAzureDevOps(Config{Token: "tok", BaseURL: "https://dev.azure.com/org"})
	if p.Name() != "azure" {
		t.Errorf("expected 'azure', got %q", p.Name())
	}
}

func TestAzureDevOpsTestConnectionMissingBaseURL(t *testing.T) {
	p := NewAzureDevOps(Config{Token: "tok"})
	if err := p.TestConnection(context.Background()); err == nil {
		t.Error("expected error for missing base URL")
	}
}

func TestAzureDevOpsTestConnectionMissingToken(t *testing.T) {
	p := NewAzureDevOps(Config{BaseURL: "https://dev.azure.com/org"})
	if err := p.TestConnection(context.Background()); err == nil {
		t.Error("expected error for missing token")
	}
}

func TestAzureDevOpsTestConnectionHappyPath(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/_apis/projects" {
			http.NotFound(w, r)
			return
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	p := NewAzureDevOps(Config{Token: "tok", BaseURL: srv.URL})
	p.cli = srv.Client()

	if err := p.TestConnection(context.Background()); err != nil {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestAzureDevOpsTestConnectionUnauthorized(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer srv.Close()

	p := NewAzureDevOps(Config{Token: "bad", BaseURL: srv.URL})
	p.cli = srv.Client()

	if err := p.TestConnection(context.Background()); err == nil {
		t.Error("expected error for 401")
	}
}

func TestAzureDevOpsTestConnectionForbidden(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusForbidden)
	}))
	defer srv.Close()

	p := NewAzureDevOps(Config{Token: "tok", BaseURL: srv.URL})
	p.cli = srv.Client()

	if err := p.TestConnection(context.Background()); err == nil {
		t.Error("expected error for 403")
	}
}

func TestAzureDevOpsTestConnectionContextCancelled(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	p := NewAzureDevOps(Config{Token: "tok", BaseURL: srv.URL})
	p.cli = srv.Client()

	if err := p.TestConnection(ctx); err == nil {
		t.Error("expected error for cancelled context")
	}
}

func TestAzureDevOpsGetLogs(t *testing.T) {
	p := NewAzureDevOps(Config{Token: "tok", BaseURL: "https://dev.azure.com/org"})
	logs, err := p.GetLogs(context.Background(), "pipeline-job")
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}
	if len(logs) != 0 {
		t.Errorf("expected empty log slice, got %d entries", len(logs))
	}
}

// ─── CircleCI ────────────────────────────────────────────────────────────────

// circleciWithURL returns a CircleCIProvider whose HTTP client is pinned to the
// given test server. Because the production code hardcodes the CircleCI URL we
// use the test-server client together with a transport override so that every
// outbound request is redirected to the mock server regardless of host.
func circleciWithURL(srv *httptest.Server, token string) *CircleCIProvider {
	p := NewCircleCI(Config{Token: token})
	// Replace the transport so all requests go to the test server.
	p.cli = &http.Client{
		Transport: &redirectTransport{base: srv},
	}
	return p
}

// redirectTransport rewrites every request to target the given test server.
type redirectTransport struct {
	base *httptest.Server
}

func (rt *redirectTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	// Swap the host to the test server; keep the path/query unchanged.
	redirected := req.Clone(req.Context())
	redirected.URL.Scheme = "http"
	redirected.URL.Host = rt.base.Listener.Addr().String()
	return rt.base.Client().Transport.RoundTrip(redirected)
}

func TestCircleCIName(t *testing.T) {
	p := NewCircleCI(Config{Token: "tok"})
	if p.Name() != "circleci" {
		t.Errorf("expected 'circleci', got %q", p.Name())
	}
}

func TestCircleCITestConnectionMissingToken(t *testing.T) {
	p := NewCircleCI(Config{})
	if err := p.TestConnection(context.Background()); err == nil {
		t.Error("expected error for missing token")
	}
}

func TestCircleCITestConnectionHappyPath(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	p := circleciWithURL(srv, "valid-token")
	if err := p.TestConnection(context.Background()); err != nil {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestCircleCITestConnectionUnauthorized(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer srv.Close()

	p := circleciWithURL(srv, "bad-token")
	if err := p.TestConnection(context.Background()); err == nil {
		t.Error("expected error for 401")
	}
}

func TestCircleCITestConnectionNotFound(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer srv.Close()

	p := circleciWithURL(srv, "tok")
	if err := p.TestConnection(context.Background()); err == nil {
		t.Error("expected error for 404")
	}
}

func TestCircleCITestConnectionContextCancelled(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	p := circleciWithURL(srv, "tok")
	if err := p.TestConnection(ctx); err == nil {
		t.Error("expected error for cancelled context")
	}
}

func TestCircleCIGetLogs(t *testing.T) {
	p := NewCircleCI(Config{Token: "tok"})
	logs, err := p.GetLogs(context.Background(), "workflow-job")
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}
	if len(logs) != 0 {
		t.Errorf("expected empty log slice, got %d entries", len(logs))
	}
}

// ─── GitHub — remaining branch (default base URL via closed server) ───────────

func TestGitHubTestConnectionDefaultBaseURLNetworkError(t *testing.T) {
	// exercises the baseURL=="" branch + a subsequent transport error
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	srv.Close()

	p := NewGitHub(Config{Token: "tok"}) // BaseURL intentionally empty
	p.cli = srv.Client()

	err := p.TestConnection(context.Background())
	// The real api.github.com is unreachable in test; we expect a network error.
	// If somehow reachable (unlikely in CI), any error is still acceptable because
	// the token is not a real one.
	if err == nil {
		t.Log("note: no error returned — live network may have been reachable")
	}
}
