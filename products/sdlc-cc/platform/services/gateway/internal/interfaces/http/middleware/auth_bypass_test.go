// LOCAL_BYPASS tests — verify the bypass turns on in dev, refuses to
// turn on in prod, and stamps the right context keys.
package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
)

func TestBypass_Off_ByDefault(t *testing.T) {
	t.Setenv(envBypassEnabled, "")
	if bypassActive() {
		t.Fatalf("bypass should be off when env unset")
	}
}

func TestBypass_On_InDev(t *testing.T) {
	t.Setenv(envBypassEnabled, "true")
	for _, k := range prodEnvVars {
		t.Setenv(k, "")
	}
	if !bypassActive() {
		t.Fatalf("bypass should be on in dev when LOCAL_AUTH_BYPASS=true")
	}
}

func TestBypass_RefusedInProd(t *testing.T) {
	cases := []struct {
		key string
		val string
	}{
		{"APP_ENV", "prod"},
		{"APP_ENV", "production"},
		{"ENVIRONMENT", "Live"},
		{"SDLC_ENV", "PRODUCTION"},
		{"GO_ENV", "production"},
		{"DEPLOY_ENV", "prod"},
	}
	for _, c := range cases {
		t.Run(c.key+"="+c.val, func(t *testing.T) {
			for _, k := range prodEnvVars {
				t.Setenv(k, "")
			}
			t.Setenv(envBypassEnabled, "true")
			t.Setenv(c.key, c.val)
			if bypassActive() {
				t.Fatalf("bypass MUST refuse to enable when %s=%q", c.key, c.val)
			}
		})
	}
}

func TestBypass_HonorsCustomTenantUserSubject(t *testing.T) {
	for _, k := range prodEnvVars {
		t.Setenv(k, "")
	}
	t.Setenv(envBypassEnabled, "1")
	t.Setenv(envBypassTenant, "tenant-xyz")
	t.Setenv(envBypassUser, "user-abc")
	t.Setenv(envBypassSubject, "sub-123")

	if got := bypassTenant(); got != "tenant-xyz" {
		t.Fatalf("bypassTenant=%q want tenant-xyz", got)
	}
	if got := bypassUser(); got != "user-abc" {
		t.Fatalf("bypassUser=%q want user-abc", got)
	}
	if got := bypassSubject(); got != "sub-123" {
		t.Fatalf("bypassSubject=%q want sub-123", got)
	}
}

func TestBypass_ChainStampsContext(t *testing.T) {
	for _, k := range prodEnvVars {
		t.Setenv(k, "")
	}
	t.Setenv(envBypassEnabled, "true")
	t.Setenv(envBypassTenant, "")
	t.Setenv(envBypassUser, "")
	t.Setenv(envBypassSubject, "")

	r := chi.NewRouter()
	r.Use(authMiddleware(ChainDeps{JWTSecret: "irrelevant-when-bypass-on"}))
	r.Use(tenantMiddleware())

	var seenSub, seenTenant, seenUser string
	r.Get("/probe", func(w http.ResponseWriter, req *http.Request) {
		if v, ok := req.Context().Value(CtxKeyAuthSub).(string); ok {
			seenSub = v
		}
		if v, ok := req.Context().Value(CtxKeyTenantID).(string); ok {
			seenTenant = v
		}
		if v, ok := req.Context().Value(CtxKeyUserID).(string); ok {
			seenUser = v
		}
		w.WriteHeader(http.StatusOK)
	})

	srv := httptest.NewServer(r)
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/probe")
	if err != nil {
		t.Fatalf("probe GET: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status=%d want 200 (bypass should let request through)", resp.StatusCode)
	}
	if seenSub != defaultBypassSubject {
		t.Fatalf("CtxKeyAuthSub=%q want %q", seenSub, defaultBypassSubject)
	}
	if seenTenant != defaultBypassTenant {
		t.Fatalf("CtxKeyTenantID=%q want %q", seenTenant, defaultBypassTenant)
	}
	if seenUser != defaultBypassUser {
		t.Fatalf("CtxKeyUserID=%q want %q", seenUser, defaultBypassUser)
	}
}

func TestBypass_BootstrapMessages(t *testing.T) {
	for _, k := range prodEnvVars {
		t.Setenv(k, "")
	}

	t.Setenv(envBypassEnabled, "")
	if got := Bootstrap(); !strings.Contains(got, "off") {
		t.Errorf("Bootstrap off message: %q", got)
	}

	t.Setenv(envBypassEnabled, "true")
	if got := Bootstrap(); !strings.Contains(got, "ACTIVE") {
		t.Errorf("Bootstrap on message: %q", got)
	}

	t.Setenv("APP_ENV", "production")
	if got := Bootstrap(); !strings.Contains(got, "ignored") {
		t.Errorf("Bootstrap prod message: %q", got)
	}
}
