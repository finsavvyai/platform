// LOCAL_BYPASS(remove-before-prod): Local-only auth bypass.
//
// This file injects a synthetic auth context when LOCAL_AUTH_BYPASS=true
// in the environment, so a developer can hit authenticated routes
// without minting a JWT. It refuses to enable in any environment
// where APP_ENV / ENVIRONMENT / SDLC_ENV / GO_ENV is set to a
// production-looking value.
//
// To remove:
//   1. Delete this file.
//   2. Delete the `if bypassActive(...)` blocks in chain.go (auth +
//      tenant middleware). They are tagged with the same
//      LOCAL_BYPASS marker so `grep -rn LOCAL_BYPASS services/`
//      surfaces every line that needs to come out.
//   3. Drop LOCAL_AUTH_BYPASS / LOCAL_AUTH_BYPASS_* from .env / k8s
//      manifests / docker-compose.
//
// Search marker: LOCAL_BYPASS
package middleware

import (
	"context"
	"net/http"
	"os"
	"strings"
)

// LOCAL_BYPASS: env vars that drive the bypass.
//
//   LOCAL_AUTH_BYPASS=true                 — turn it on.
//   LOCAL_AUTH_BYPASS_TENANT=<uuid|name>   — synthetic tenant id (default "local-tenant").
//   LOCAL_AUTH_BYPASS_USER=<uuid|name>     — synthetic user id    (default "local-user").
//   LOCAL_AUTH_BYPASS_SUB=<string>         — synthetic JWT subject (default "local-bypass").
const (
	envBypassEnabled = "LOCAL_AUTH_BYPASS"
	envBypassTenant  = "LOCAL_AUTH_BYPASS_TENANT"
	envBypassUser    = "LOCAL_AUTH_BYPASS_USER"
	envBypassSubject = "LOCAL_AUTH_BYPASS_SUB"

	defaultBypassTenant  = "local-tenant"
	defaultBypassUser    = "local-user"
	defaultBypassSubject = "local-bypass"
)

// LOCAL_BYPASS: any of these env vars set to one of these values
// triggers the prod kill-switch — bypass is a hard no-op in prod.
var prodEnvVars = []string{"APP_ENV", "ENVIRONMENT", "SDLC_ENV", "GO_ENV", "DEPLOY_ENV"}
var prodEnvValues = []string{"prod", "production", "live"}

// bypassActive reports whether the local auth bypass should run.
// It returns false (with no error) whenever the prod kill-switch
// matches, so a misconfigured prod deploy can never accidentally
// turn this on.
func bypassActive() bool {
	if !envTruthy(os.Getenv(envBypassEnabled)) {
		return false
	}
	if isProdEnvironment() {
		// LOCAL_BYPASS: kill-switch hit. We deliberately do NOT
		// log here from a hot path; the application boot logs
		// the disabled-in-prod fact at startup (see Bootstrap()).
		return false
	}
	return true
}

// Bootstrap is called once at gateway start so an operator sees, in
// the logs, whether the bypass is on. Returns a short status string
// for the boot banner.
//
// LOCAL_BYPASS: callers in cmd/server/main.go should call this and
// log the result.
func Bootstrap() string {
	on := envTruthy(os.Getenv(envBypassEnabled))
	prod := isProdEnvironment()
	switch {
	case on && prod:
		return "LOCAL_AUTH_BYPASS=true ignored: prod environment detected"
	case on && !prod:
		return "!! LOCAL_AUTH_BYPASS ACTIVE — every request will be authenticated as " +
			bypassSubject() + " in tenant " + bypassTenant() + " — DEV ONLY"
	default:
		return "auth bypass: off"
	}
}

// applyBypassToContext stamps the synthetic identity onto ctx using
// the same context keys the real auth middleware uses. Downstream
// middleware (tenant, audit, RBAC) sees a fully-populated request
// just as if a real JWT had been validated.
//
// LOCAL_BYPASS.
func applyBypassToContext(ctx context.Context) context.Context {
	ctx = context.WithValue(ctx, CtxKeyAuthSub, bypassSubject())
	ctx = context.WithValue(ctx, CtxKeyUserID, bypassUser())
	ctx = context.WithValue(ctx, legacyUserIDContextKey, bypassUser())
	ctx = context.WithValue(ctx, ctxKeyTenantClaim, bypassTenant())
	ctx = context.WithValue(ctx, CtxKeyTenantID, bypassTenant())
	ctx = context.WithValue(ctx, legacyTenantIDContextKey, bypassTenant())
	return ctx
}

// applyBypassToRequest also forces the X-Tenant-ID header so any
// downstream code that re-reads it stays consistent. LOCAL_BYPASS.
func applyBypassToRequest(r *http.Request) *http.Request {
	r = r.WithContext(applyBypassToContext(r.Context()))
	r.Header.Set("X-Tenant-ID", bypassTenant())
	return r
}

func bypassTenant() string {
	if v := strings.TrimSpace(os.Getenv(envBypassTenant)); v != "" {
		return v
	}
	return defaultBypassTenant
}

func bypassUser() string {
	if v := strings.TrimSpace(os.Getenv(envBypassUser)); v != "" {
		return v
	}
	return defaultBypassUser
}

func bypassSubject() string {
	if v := strings.TrimSpace(os.Getenv(envBypassSubject)); v != "" {
		return v
	}
	return defaultBypassSubject
}

func envTruthy(v string) bool {
	switch strings.ToLower(strings.TrimSpace(v)) {
	case "1", "true", "yes", "on", "y":
		return true
	default:
		return false
	}
}

func isProdEnvironment() bool {
	for _, key := range prodEnvVars {
		v := strings.ToLower(strings.TrimSpace(os.Getenv(key)))
		if v == "" {
			continue
		}
		for _, p := range prodEnvValues {
			if v == p {
				return true
			}
		}
	}
	return false
}
