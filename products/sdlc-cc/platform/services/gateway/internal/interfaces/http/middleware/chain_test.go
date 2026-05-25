package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/lestrrat-go/jwx/v2/jwa"
	"github.com/lestrrat-go/jwx/v2/jwt"
	"github.com/sirupsen/logrus"
)

const (
	testJWTSecret = "test-jwt-secret-32-chars-minimum!!"
	testJWTIssuer = "sdlc-platform-test"
)

// requestThrough builds a router with the chain applied, mounts a single
// handler that echoes the audit subject from context, and returns the
// recorded response for inspection.
func requestThrough(t *testing.T, deps ChainDeps, method, path, authz string) *httptest.ResponseRecorder {
	t.Helper()

	r := chi.NewRouter()
	Apply(r, deps)

	var seenSubject, seenTenant string
	r.Get("/api/v1/echo", func(w http.ResponseWriter, req *http.Request) {
		if v, ok := req.Context().Value(CtxKeyAuthSub).(string); ok {
			seenSubject = v
		}
		if v, ok := req.Context().Value(CtxKeyTenantID).(string); ok {
			seenTenant = v
		}
		_, _ = w.Write([]byte("ok"))
	})

	req := httptest.NewRequest(method, path, nil)
	if authz != "" {
		req.Header.Set("Authorization", authz)
	}
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	t.Logf("subject=%q tenant=%q", seenSubject, seenTenant)
	return rec
}

func authedDeps() ChainDeps {
	return ChainDeps{
		Logger:    logrus.New(),
		JWTSecret: testJWTSecret,
		JWTIssuer: testJWTIssuer,
	}
}

func signedBearerToken(t *testing.T, tenantID string) string {
	t.Helper()
	if tenantID == "" {
		tenantID = uuid.NewString()
	}
	userID := uuid.NewString()
	now := time.Now()
	token, err := jwt.NewBuilder().
		Subject(userID).
		Issuer(testJWTIssuer).
		Claim("user_id", userID).
		Claim("tenant_id", tenantID).
		Claim("token_type", "access").
		IssuedAt(now).
		NotBefore(now.Add(-1 * time.Minute)).
		Expiration(now.Add(15 * time.Minute)).
		Build()
	if err != nil {
		t.Fatalf("failed to build token: %v", err)
	}
	signed, err := jwt.Sign(token, jwt.WithKey(jwa.HS256, []byte(testJWTSecret)))
	if err != nil {
		t.Fatalf("failed to sign token: %v", err)
	}
	return "Bearer " + string(signed)
}

func TestChain_RejectsUnauthenticated(t *testing.T) {
	rec := requestThrough(t, authedDeps(), http.MethodGet, "/api/v1/echo", "")
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("want 401, got %d", rec.Code)
	}
}

func TestChain_AcceptsValidJWT(t *testing.T) {
	rec := requestThrough(t, authedDeps(), http.MethodGet, "/api/v1/echo", signedBearerToken(t, uuid.NewString()))
	if rec.Code != http.StatusOK {
		t.Fatalf("want 200, got %d (body=%s)", rec.Code, rec.Body.String())
	}
}

func TestChain_PublicPathsBypassAuth(t *testing.T) {
	deps := authedDeps()
	deps.SkipAuthFor = []string{"/health"}

	r := chi.NewRouter()
	Apply(r, deps)
	r.Get("/health", func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("ok"))
	})

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("want 200 on bypassed path, got %d", rec.Code)
	}
}

func TestChain_SetsSecurityHeaders(t *testing.T) {
	rec := requestThrough(t, authedDeps(), http.MethodGet, "/api/v1/echo", signedBearerToken(t, uuid.NewString()))

	for _, h := range []string{"X-Content-Type-Options", "X-Frame-Options", "Referrer-Policy", "Permissions-Policy"} {
		if rec.Header().Get(h) == "" {
			t.Errorf("missing security header %s", h)
		}
	}
}

func TestChain_VersionHeader(t *testing.T) {
	deps := authedDeps()
	deps.Version = "v1.2.3"
	rec := requestThrough(t, deps, http.MethodGet, "/api/v1/echo", signedBearerToken(t, uuid.NewString()))
	if got := rec.Header().Get("X-Gateway-Version"); got != "v1.2.3" {
		t.Fatalf("want X-Gateway-Version=v1.2.3, got %q", got)
	}
}

func TestChain_CORSAllowedOrigin(t *testing.T) {
	r := chi.NewRouter()
	deps := authedDeps()
	deps.CORSOrigins = []string{"https://app.example.com"}
	Apply(r, deps)
	r.Get("/api/v1/echo", func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("ok"))
	})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/echo", nil)
	req.Header.Set("Origin", "https://app.example.com")
	req.Header.Set("Authorization", signedBearerToken(t, uuid.NewString()))
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "https://app.example.com" {
		t.Fatalf("CORS allow origin not set: got %q", got)
	}
}

func TestChain_CORSDisallowedOriginGetsNoHeader(t *testing.T) {
	r := chi.NewRouter()
	deps := authedDeps()
	deps.CORSOrigins = []string{"https://app.example.com"}
	Apply(r, deps)
	r.Get("/api/v1/echo", func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("ok"))
	})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/echo", nil)
	req.Header.Set("Origin", "https://evil.example.net")
	req.Header.Set("Authorization", signedBearerToken(t, uuid.NewString()))
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Fatalf("CORS allow origin should not be set for unlisted origin: got %q", got)
	}
}

func TestChain_OptionsPreflightShortCircuits(t *testing.T) {
	r := chi.NewRouter()
	deps := authedDeps()
	deps.CORSOrigins = []string{"https://app.example.com"}
	Apply(r, deps)

	called := false
	r.Get("/api/v1/echo", func(w http.ResponseWriter, _ *http.Request) {
		called = true
	})

	req := httptest.NewRequest(http.MethodOptions, "/api/v1/echo", nil)
	req.Header.Set("Origin", "https://app.example.com")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("want 204 on OPTIONS, got %d", rec.Code)
	}
	if called {
		t.Fatal("downstream handler must not run on OPTIONS preflight")
	}
}

func TestChain_RejectsOversizedBody(t *testing.T) {
	r := chi.NewRouter()
	Apply(r, authedDeps())
	r.Post("/api/v1/echo", func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("ok"))
	})

	req := httptest.NewRequest(http.MethodPost, "/api/v1/echo", strings.NewReader(""))
	req.Header.Set("Authorization", signedBearerToken(t, uuid.NewString()))
	req.ContentLength = 200 << 20 // 200 MiB > 100 MiB cap
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("want 413, got %d", rec.Code)
	}
}

func TestChain_RejectsTenantHeaderMismatch(t *testing.T) {
	deps := authedDeps()
	r := chi.NewRouter()
	Apply(r, deps)
	r.Get("/api/v1/echo", func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("ok"))
	})

	claimTenant := uuid.NewString()
	req := httptest.NewRequestWithContext(context.Background(), http.MethodGet, "/api/v1/echo", nil)
	req.Header.Set("Authorization", signedBearerToken(t, claimTenant))
	req.Header.Set("X-Tenant-ID", uuid.NewString())
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("want 403 on tenant mismatch, got %d", rec.Code)
	}
}
