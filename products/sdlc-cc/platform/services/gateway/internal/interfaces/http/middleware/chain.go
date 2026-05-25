// Package middleware wires the gateway's golden middleware chain.
package middleware

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/google/uuid"
	"github.com/lestrrat-go/jwx/v2/jwa"
	"github.com/lestrrat-go/jwx/v2/jwt"
	"github.com/sirupsen/logrus"

	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/audit"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/fingerprint"
	infmw "github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/middleware"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/network"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/ratelimit"
	"github.com/sdlc-ai/platform/services/gateway/internal/policy"
)

type ctxKey string

const (
	CtxKeyTenantID    ctxKey = "tenant_id"
	CtxKeyUserID      ctxKey = "user_id"
	CtxKeyAuthSub     ctxKey = "auth_subject"
	ctxKeyTenantClaim ctxKey = "tenant_claim"
)

const (
	legacyUserIDContextKey   = "user_id"
	legacyTenantIDContextKey = "tenant_id"
)

// ChainDeps carries the runtime services the chain needs. Nil-tolerant: a nil
// dependency means the corresponding step degrades to a no-op rather than a
// hard failure, so dev environments without Redis/OPA still serve traffic.
type ChainDeps struct {
	Logger            *logrus.Logger
	Version           string
	JWTSecret         string
	JWTIssuer         string
	RateLimiter       *ratelimit.TierRateLimiter
	PolicyEngine      *policy.PolicyEngine
	PolicyQuery       string
	PolicyEnforce     bool
	DenyOnPolicyError bool
	CORSOrigins       []string
	SkipAuthFor       []string
	// DLP is optional. When non-nil, Inbound() runs after Tenant and
	// before Validate, scanning the request body and either masking,
	// redacting, or 422-ing per tenant policy. When nil, the DLP step
	// is skipped entirely.
	DLP *infmw.DLP
	// AuditWriter is optional. When non-nil the audit step appends
	// HMAC-signed rows to the audit_logs table for every mutating
	// request via AppendAsync (never blocks the handler). When nil
	// the step degrades to the logrus-only legacy behaviour.
	AuditWriter *audit.Writer
	// IPAllowList is optional. When non-nil the chain rejects requests
	// from source IPs that don't match a tenant CIDR rule when the
	// tenant's network_mode is 'private_only'. nil disables the gate.
	IPAllowList IPAllowListLookup
}

// IPAllowListLookup is the read interface the middleware needs from
// network.PgxLoader. Defined locally so tests can pass a fake.
type IPAllowListLookup interface {
	LookupTenant(ctx context.Context, tenantID uuid.UUID) (network.TenantPolicy, error)
}

// Apply attaches the 14-step golden chain (CLAUDE.md) to r.
//
// Ordering is intentional: identity & isolation first, throughput shaping
// next, audit/policy after we know who the caller is, and cosmetics
// (compression, version header) last so they cannot mask earlier failures.
func Apply(r chi.Router, deps ChainDeps) {
	r.Use(chimw.RequestID)              // 1. RequestID
	r.Use(chimw.RealIP)                 // (RealIP feeds Log + Audit)
	r.Use(chimw.Logger)                 // 2. Log
	r.Use(chimw.Recoverer)              // 3. Recovery
	r.Use(corsMiddleware(deps))         // 4. CORS
	r.Use(securityHeaders(deps.Logger)) // 5. Security headers
	r.Use(authMiddleware(deps))         // 6. Auth
	r.Use(fingerprintMiddleware())      // 6a. Device-fingerprint signals -> context
	r.Use(tenantMiddleware())           // 7. Tenant
	r.Use(ipAllowListMiddleware(deps))  // 7a. IP allowlist (private_only tenants only)
	r.Use(rateLimitMiddleware(deps))    // 8. RateLimit
	r.Use(imagePolicyMiddleware(deps))  // 8aa. Image-input policy (block before text DLP runs)
	r.Use(dlpInboundMiddleware(deps))   // 8a. DLP inbound (skipped when DLP nil or path is public)
	r.Use(validateMiddleware())         // 9. Validate (header sanity; OpenAPI hook later)
	r.Use(auditMiddleware(deps))        // 10. Audit (logrus + HMAC writer)
	r.Use(policyMiddleware(deps))       // 11. Policy (OPA)
	r.Use(versionMiddleware(deps))      // 12. Version
	r.Use(dlpOutboundMiddleware(deps))  // 12a. DLP outbound (before Compress so PII isn't gzipped past the scanner)
	r.Use(chimw.Compress(5))            // 13. Compress
	r.Use(metricsMiddleware())          // 14. Metrics
}

func corsMiddleware(deps ChainDeps) func(http.Handler) http.Handler {
	allowed := map[string]struct{}{}
	for _, o := range deps.CORSOrigins {
		allowed[strings.TrimSpace(o)] = struct{}{}
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			if origin != "" {
				if _, ok := allowed[origin]; ok {
					w.Header().Set("Access-Control-Allow-Origin", origin)
					w.Header().Set("Vary", "Origin")
					w.Header().Set("Access-Control-Allow-Credentials", "true")
					w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
					w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Request-ID, X-Tenant-ID")
					w.Header().Set("Access-Control-Max-Age", "600")
				}
			}
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func securityHeaders(logger *logrus.Logger) func(http.Handler) http.Handler {
	cfg := infmw.DefaultSecurityConfig()
	cfg.CSRFEnabled = false // CSRF is delegated to the admin UI; API uses bearer auth.
	sm := infmw.NewSecurityMiddleware(cfg, logger)
	return sm.Middleware
}

func authMiddleware(deps ChainDeps) func(http.Handler) http.Handler {
	skip := buildPathSet(deps.SkipAuthFor)
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if isPathInSet(r.URL.Path, skip) {
				// Even on auth-skipped paths, propagate bypass identity
				// so downstream middlewares (tenant, policy) that demand
				// CtxKeyTenantID / CtxKeyUserID don't 401 a /health probe
				// when LOCAL_AUTH_BYPASS=true.
				if bypassActive() {
					next.ServeHTTP(w, applyBypassToRequest(r))
					return
				}
				next.ServeHTTP(w, r)
				return
			}
			// LOCAL_BYPASS(remove-before-prod): see auth_bypass.go.
			// When LOCAL_AUTH_BYPASS=true and we're not in a prod
			// environment, stamp a synthetic identity and skip JWT
			// validation. Refuses to enable in prod regardless.
			if bypassActive() {
				next.ServeHTTP(w, applyBypassToRequest(r))
				return
			}
			token, err := extractBearerToken(r.Header.Get("Authorization"))
			if err != nil {
				writeErrorJSON(w, http.StatusUnauthorized, "unauthorized")
				return
			}
			claims, err := validateAccessToken(r.Context(), token, deps)
			if err != nil {
				writeErrorJSON(w, http.StatusUnauthorized, "invalid token")
				return
			}
			ctx := context.WithValue(r.Context(), CtxKeyAuthSub, claims.Subject)
			ctx = context.WithValue(ctx, CtxKeyUserID, claims.UserID)
			ctx = context.WithValue(ctx, legacyUserIDContextKey, claims.UserID)
			ctx = context.WithValue(ctx, ctxKeyTenantClaim, claims.TenantID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func tenantMiddleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// LOCAL_BYPASS(remove-before-prod): the bypass already
			// stamped the tenant claim onto the request, so don't
			// re-check the X-Tenant-ID header against itself.
			if bypassActive() {
				next.ServeHTTP(w, r)
				return
			}
			_, hasSubject := r.Context().Value(CtxKeyAuthSub).(string)
			tenantClaim, _ := r.Context().Value(ctxKeyTenantClaim).(string)
			if tenantClaim == "" {
				// Public/bypassed endpoints do not carry auth claims.
				if !hasSubject {
					next.ServeHTTP(w, r)
					return
				}
				writeErrorJSON(w, http.StatusUnauthorized, "missing tenant claim")
				return
			}
			tenantHeader := strings.TrimSpace(r.Header.Get("X-Tenant-ID"))
			if tenantHeader != "" && tenantHeader != tenantClaim {
				writeErrorJSON(w, http.StatusForbidden, "tenant mismatch")
				return
			}
			ctx := context.WithValue(r.Context(), CtxKeyTenantID, tenantClaim)
			ctx = context.WithValue(ctx, legacyTenantIDContextKey, tenantClaim)
			r = r.WithContext(ctx)
			if tenantHeader == "" {
				r.Header.Set("X-Tenant-ID", tenantClaim)
			}
			next.ServeHTTP(w, r)
		})
	}
}

func rateLimitMiddleware(deps ChainDeps) func(http.Handler) http.Handler {
	if deps.RateLimiter == nil {
		return passthrough
	}
	return deps.RateLimiter.Middleware()
}

// fingerprintMiddleware extracts device fingerprint signals from the
// request and stores them in the context. BEAT-PLAN Day 10. The
// fingerprint package's Middleware optionally validates against an
// expected hash; we run in extract-only mode here because the gateway
// auth surface uses JWT, not session cookies, so there's no
// session-stored expected value to compare against. cmd/auth-server
// does the full enforce on its session-based refresh flow.
func fingerprintMiddleware() func(http.Handler) http.Handler {
	return fingerprint.Middleware(fingerprint.Options{
		ClientIP: func(r *http.Request) string {
			// Honors CF-Connecting-IP via the chain's earlier RealIP
			// step; falls back to RemoteAddr otherwise.
			if cf := r.Header.Get("CF-Connecting-IP"); cf != "" {
				return cf
			}
			return r.RemoteAddr
		},
	})
}

// ipAllowListMiddleware enforces the per-tenant IP allowlist for
// tenants whose network_mode is 'private_only'. Public-mode tenants
// pass through. Public paths (health probes / metrics) always pass
// through so probes don't 403 on a misconfigured allowlist.
func ipAllowListMiddleware(deps ChainDeps) func(http.Handler) http.Handler {
	if deps.IPAllowList == nil {
		return passthrough
	}
	skip := buildPathSet(deps.SkipAuthFor)
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if isPathInSet(r.URL.Path, skip) {
				next.ServeHTTP(w, r)
				return
			}
			tenantStr, _ := r.Context().Value(CtxKeyTenantID).(string)
			if tenantStr == "" {
				next.ServeHTTP(w, r)
				return
			}
			tenantID, err := uuid.Parse(tenantStr)
			if err != nil {
				next.ServeHTTP(w, r)
				return
			}
			policy, err := deps.IPAllowList.LookupTenant(r.Context(), tenantID)
			if err != nil {
				// Lookup error -> fail-open in public mode, fail-closed
				// in private. The latter cannot happen here since we'd
				// not know the mode, so default to fail-open + log.
				next.ServeHTTP(w, r)
				return
			}
			if policy.Mode != network.NetworkModePrivateOnly {
				next.ServeHTTP(w, r)
				return
			}
			ip := network.ClientIPFromRequest(r)
			// API-key id is not available here yet (extracted later in
			// auth specifics); pass uuid.Nil so only tenant-wide rules
			// apply at this gate. A second per-key gate can refine.
			if !policy.AllowList.Permit(ip, uuid.Nil) {
				writeErrorJSON(w, http.StatusForbidden, "source IP not in tenant allowlist")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// imagePolicyMiddleware mounts the per-tenant image-input policy
// gate immediately before the text DLP scanner. When the tenant
// policy is `block` the request is refused with an Anthropic-shape
// 422 BEFORE any text scanning happens (so the regex detector
// doesn't mis-classify base64 image payloads as code-secret runs).
// Claude Team C2.
func imagePolicyMiddleware(deps ChainDeps) func(http.Handler) http.Handler {
	if deps.DLP == nil {
		return passthrough
	}
	if deps.DLP.TenantFromCtx == nil {
		deps.DLP.TenantFromCtx = func(ctx context.Context) string {
			v, _ := ctx.Value(CtxKeyTenantID).(string)
			return v
		}
	}
	skip := buildPathSet(deps.SkipAuthFor)
	inner := deps.DLP.EnforceImagePolicy()
	return func(next http.Handler) http.Handler {
		wrapped := inner(next)
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if isPathInSet(r.URL.Path, skip) {
				next.ServeHTTP(w, r)
				return
			}
			wrapped.ServeHTTP(w, r)
		})
	}
}

// dlpInboundMiddleware mounts DLP scanning between RateLimit and
// Validate. Public paths (health probes / metrics) skip DLP — bodies
// there are empty anyway. Tenant context is bridged via the typed
// CtxKeyTenantID so DLP can look up the tenant policy.
func dlpInboundMiddleware(deps ChainDeps) func(http.Handler) http.Handler {
	if deps.DLP == nil {
		return passthrough
	}
	if deps.DLP.TenantFromCtx == nil {
		deps.DLP.TenantFromCtx = func(ctx context.Context) string {
			v, _ := ctx.Value(CtxKeyTenantID).(string)
			return v
		}
	}
	skip := buildPathSet(deps.SkipAuthFor)
	inner := deps.DLP.Inbound()
	return func(next http.Handler) http.Handler {
		wrapped := inner(next)
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if isPathInSet(r.URL.Path, skip) {
				next.ServeHTTP(w, r)
				return
			}
			wrapped.ServeHTTP(w, r)
		})
	}
}

// dlpOutboundMiddleware mounts response-body scanning before Compress
// (step 13) so gzip cannot mask PII patterns from the detector. Same
// public-path skip as inbound — health/metrics responses are noise.
func dlpOutboundMiddleware(deps ChainDeps) func(http.Handler) http.Handler {
	if deps.DLP == nil {
		return passthrough
	}
	if deps.DLP.TenantFromCtx == nil {
		deps.DLP.TenantFromCtx = func(ctx context.Context) string {
			v, _ := ctx.Value(CtxKeyTenantID).(string)
			return v
		}
	}
	skip := buildPathSet(deps.SkipAuthFor)
	inner := deps.DLP.Outbound()
	return func(next http.Handler) http.Handler {
		wrapped := inner(next)
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if isPathInSet(r.URL.Path, skip) {
				next.ServeHTTP(w, r)
				return
			}
			wrapped.ServeHTTP(w, r)
		})
	}
}

func validateMiddleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.ContentLength > 100<<20 {
				http.Error(w, `{"error":"request entity too large"}`, http.StatusRequestEntityTooLarge)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func auditMiddleware(deps ChainDeps) func(http.Handler) http.Handler {
	logger := deps.Logger
	writer := deps.AuditWriter
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			next.ServeHTTP(w, r)
			if isReadOnly(r.Method) {
				return
			}
			tenant, _ := r.Context().Value(CtxKeyTenantID).(string)
			if logger != nil {
				logger.WithFields(logrus.Fields{
					"event":      "audit",
					"method":     r.Method,
					"path":       r.URL.Path,
					"tenant_id":  tenant,
					"remote_ip":  r.RemoteAddr,
					"user_agent": r.UserAgent(),
					"latency_ms": time.Since(start).Milliseconds(),
				}).Info("audit")
			}
			if writer != nil {
				appendAuditRow(writer, r, tenant, time.Since(start))
			}
		})
	}
}

// appendAuditRow forwards a mutation to the HMAC writer. Async drops
// are acceptable (drain log warns); we never want audit to block the
// handler.
func appendAuditRow(w *audit.Writer, r *http.Request, tenantID string, latency time.Duration) {
	tID, err := uuid.Parse(tenantID)
	if err != nil {
		// Public/bypassed paths or test harnesses won't have a tenant
		// claim; skip those — they're already logged via logrus.
		return
	}
	var actor *uuid.UUID
	if uid, ok := r.Context().Value(CtxKeyUserID).(uuid.UUID); ok && uid != uuid.Nil {
		copy := uid
		actor = &copy
	}
	row := audit.Row{
		TenantID:   tID,
		ActorID:    actor,
		ActorType:  "user",
		Action:     auditActionFromMethod(r.Method),
		TargetType: "endpoint",
		TargetID:   r.URL.Path,
		After: map[string]any{
			"method":     r.Method,
			"path":       r.URL.Path,
			"latency_ms": latency.Milliseconds(),
		},
		CreatedAt: time.Now().UTC(),
	}
	_ = w.AppendAsync(row)
}

// auditActionFromMethod maps an HTTP method to one of the audit_action
// enum values defined in migration 002. The enum is intentionally
// small; collapsing free-form HTTP methods to it keeps the INSERT in
// audit.Writer compatible with the live schema.
func auditActionFromMethod(method string) string {
	switch strings.ToUpper(method) {
	case http.MethodPost:
		return "create"
	case http.MethodPut, http.MethodPatch:
		return "update"
	case http.MethodDelete:
		return "delete"
	default:
		return "read"
	}
}

func policyMiddleware(deps ChainDeps) func(http.Handler) http.Handler {
	if deps.PolicyEngine == nil || !deps.PolicyEnforce {
		return passthrough
	}
	query := normalizePolicyQuery(deps.PolicyQuery)
	skip := buildPathSet(deps.SkipAuthFor)
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Public probes (/health, /metrics, /version, ...) are
			// exempt from auth and therefore from policy too. Without
			// this, a probe that bypasses auth still hits this branch
			// without a tenant claim and 401s.
			if isPathInSet(r.URL.Path, skip) {
				next.ServeHTTP(w, r)
				return
			}
			tenantID, _ := r.Context().Value(CtxKeyTenantID).(string)
			userID, _ := r.Context().Value(CtxKeyUserID).(uuid.UUID)
			if tenantID == "" || userID == uuid.Nil {
				writeErrorJSON(w, http.StatusUnauthorized, "missing auth context")
				return
			}
			decision, err := deps.PolicyEngine.EvaluatePolicy(r.Context(), policy.PolicyInput{
				Query:     query,
				TenantID:  tenantID,
				UserID:    userID.String(),
				RequestID: chimw.GetReqID(r.Context()),
				Action:    strings.ToLower(r.Method),
				Resource:  r.URL.Path,
				Context: map[string]interface{}{
					"method":    r.Method,
					"path":      r.URL.Path,
					"tenant_id": tenantID,
					"user_id":   userID.String(),
				},
			})
			if err != nil {
				if deps.DenyOnPolicyError {
					writeErrorJSON(w, http.StatusForbidden, "policy evaluation failed")
					return
				}
				next.ServeHTTP(w, r)
				return
			}
			if !decision.Allowed {
				// BEAT-PLAN S2.2: surface the failing rule name so the
				// admin UI + API clients can show which rule denied,
				// and emit an audit row recording the deny decision.
				reason := decision.Reason
				if reason == "" {
					reason = "forbidden"
				}
				if deps.AuditWriter != nil {
					var actorPtr *uuid.UUID
					if userID != uuid.Nil {
						uid := userID
						actorPtr = &uid
					}
					tID, _ := uuid.Parse(tenantID)
					_ = deps.AuditWriter.AppendAsync(audit.Row{
						TenantID:   tID,
						ActorType:  "user",
						ActorID:    actorPtr,
						Action:     "policy.deny",
						TargetType: "http_request",
						TargetID:   r.URL.Path,
						After: map[string]any{
							"reason":     reason,
							"method":     r.Method,
							"path":       r.URL.Path,
							"request_id": chimw.GetReqID(r.Context()),
						},
					})
				}
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusForbidden)
				_ = json.NewEncoder(w).Encode(map[string]any{
					"error": map[string]any{
						"code":    "POLICY_DENIED",
						"message": "forbidden",
						"reason":  reason,
					},
				})
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func versionMiddleware(deps ChainDeps) func(http.Handler) http.Handler {
	v := deps.Version
	if v == "" {
		v = "dev"
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("X-Gateway-Version", v)
			next.ServeHTTP(w, r)
		})
	}
}

func metricsMiddleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			next.ServeHTTP(w, r)
		})
	}
}

func passthrough(next http.Handler) http.Handler { return next }

func isReadOnly(method string) bool {
	switch method {
	case http.MethodGet, http.MethodHead, http.MethodOptions:
		return true
	}
	return false
}

func buildPathSet(paths []string) map[string]struct{} {
	out := make(map[string]struct{}, len(paths))
	for _, p := range paths {
		out[p] = struct{}{}
	}
	return out
}

func isPathInSet(path string, set map[string]struct{}) bool {
	if _, ok := set[path]; ok {
		return true
	}
	for p := range set {
		if strings.HasSuffix(p, "/*") && strings.HasPrefix(path, strings.TrimSuffix(p, "/*")) {
			return true
		}
	}
	return false
}

type validatedTokenClaims struct {
	Subject  string
	UserID   uuid.UUID
	TenantID string
}

func extractBearerToken(authz string) (string, error) {
	authz = strings.TrimSpace(authz)
	if authz == "" {
		return "", errors.New("authorization header required")
	}
	parts := strings.Fields(authz)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		return "", errors.New("expected Bearer token")
	}
	if strings.TrimSpace(parts[1]) == "" {
		return "", errors.New("empty bearer token")
	}
	return parts[1], nil
}

func validateAccessToken(ctx context.Context, token string, deps ChainDeps) (*validatedTokenClaims, error) {
	secret := strings.TrimSpace(deps.JWTSecret)
	if secret == "" {
		return nil, errors.New("jwt secret is not configured")
	}
	parsed, err := jwt.Parse([]byte(token), jwt.WithValidate(true), jwt.WithKey(jwa.HS256, []byte(secret)))
	if err != nil {
		return nil, err
	}
	if issuer := strings.TrimSpace(deps.JWTIssuer); issuer != "" && parsed.Issuer() != issuer {
		return nil, errors.New("issuer mismatch")
	}
	subject := strings.TrimSpace(parsed.Subject())
	if subject == "" {
		return nil, errors.New("missing subject claim")
	}

	userIDClaim, ok := parsed.Get("user_id")
	if !ok {
		return nil, errors.New("missing user_id claim")
	}
	userID, err := parseUUIDClaim(userIDClaim)
	if err != nil {
		return nil, err
	}

	tenantIDClaim, ok := parsed.Get("tenant_id")
	if !ok {
		return nil, errors.New("missing tenant_id claim")
	}
	tenantID := strings.TrimSpace(claimString(tenantIDClaim))
	if tenantID == "" {
		return nil, errors.New("invalid tenant_id claim")
	}

	return &validatedTokenClaims{
		Subject:  subject,
		UserID:   userID,
		TenantID: tenantID,
	}, nil
}

func parseUUIDClaim(v interface{}) (uuid.UUID, error) {
	id := strings.TrimSpace(claimString(v))
	if id == "" {
		return uuid.Nil, errors.New("empty UUID claim")
	}
	parsed, err := uuid.Parse(id)
	if err != nil {
		return uuid.Nil, err
	}
	return parsed, nil
}

func claimString(v interface{}) string {
	switch t := v.(type) {
	case string:
		return t
	default:
		return ""
	}
}

func normalizePolicyQuery(query string) string {
	query = strings.TrimSpace(query)
	if query == "" {
		return "/sdlc/auth"
	}
	if strings.HasPrefix(query, "/") {
		return query
	}
	return "/" + query
}

func writeErrorJSON(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{
		"error": message,
	})
}
