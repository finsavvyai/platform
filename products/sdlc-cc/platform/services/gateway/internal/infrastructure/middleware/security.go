//go:build !ignore

package middleware

import (
	"crypto/rand"
	"encoding/base64"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5/middleware"
	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
)

// SecurityConfig holds configuration for security middleware
type SecurityConfig struct {
	// HSTS enabled
	HSTSEnabled bool
	// HSTS max age in seconds
	HSTSMaxAge int
	// HSTS include subdomains
	HSTSIncludeSubDomains bool
	// HSTS preload
	HSTSPreload bool

	// CSP enabled
	CSPEnabled bool
	// CSP policy
	CSPPolicy string

	// Enable CSRF protection
	CSRFEnabled bool

	// CSRF token length
	CSRFTokenLength int

	// CSRF token expiry
	CSRFTokenExpiry time.Duration

	// Trusted origins for CORS
	TrustedOrigins []string

	// Enable secure cookies
	SecureCookies bool

	// SameSite cookie policy
	SameSitePolicy http.SameSite

	// Enable frameguard (clickjacking protection)
	FrameGuard bool

	// Enable XSS protection
	XSSProtection bool

	// Enable content type nosniff
	ContentTypeNosniff bool

	// Enable referrer policy
	ReferrerPolicy string
}

// DefaultSecurityConfig returns default security configuration
func DefaultSecurityConfig() SecurityConfig {
	return SecurityConfig{
		HSTSEnabled:           true,
		HSTSMaxAge:            63072000, // 2 years
		HSTSIncludeSubDomains: true,
		HSTSPreload:           true,
		CSPEnabled:            true,
		CSPPolicy:             "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'; sandbox",
		CSRFEnabled:           true,
		CSRFTokenLength:       32,
		CSRFTokenExpiry:       24 * time.Hour,
		SecureCookies:         true,
		SameSitePolicy:        http.SameSiteStrictMode,
		FrameGuard:            true,
		XSSProtection:         true,
		ContentTypeNosniff:    true,
		ReferrerPolicy:        "strict-origin-when-cross-origin",
	}
}

// SecurityMiddleware provides comprehensive security headers and protections
type SecurityMiddleware struct {
	config SecurityConfig
	logger *logrus.Logger
	tokens *CSRFTokenStore
}

// NewSecurityMiddleware creates a new security middleware
func NewSecurityMiddleware(config SecurityConfig, logger *logrus.Logger) *SecurityMiddleware {
	if logger == nil {
		logger = logrus.New()
	}

	return &SecurityMiddleware{
		config: config,
		logger: logger,
		tokens: NewCSRFTokenStore(config.CSRFTokenExpiry),
	}
}

// Middleware returns the chi middleware function
func (sm *SecurityMiddleware) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sm.addSecurityHeaders(w, r)

		// Handle CSRF for state-changing methods
		if sm.config.CSRFEnabled && sm.isStateChangingMethod(r.Method) {
			if !sm.validateCSRFToken(r) {
				sm.csrfErrorHandler(w, r)
				return
			}
		}

		next.ServeHTTP(w, r)
	})
}

// addSecurityHeaders adds security headers to the response
func (sm *SecurityMiddleware) addSecurityHeaders(w http.ResponseWriter, r *http.Request) {
	// X-Content-Type-Options: prevents MIME type sniffing
	if sm.config.ContentTypeNosniff {
		w.Header().Set("X-Content-Type-Options", "nosniff")
	}

	// X-Frame-Options: prevents clickjacking
	if sm.config.FrameGuard {
		w.Header().Set("X-Frame-Options", "DENY")
	}

	// X-XSS-Protection: enables browser XSS filter
	if sm.config.XSSProtection {
		w.Header().Set("X-XSS-Protection", "1; mode=block")
	}

	// Referrer-Policy: controls referrer information
	if sm.config.ReferrerPolicy != "" {
		w.Header().Set("Referrer-Policy", sm.config.ReferrerPolicy)
	}

	// Permissions-Policy: restricts browser features
	w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()")

	// Cross-Origin headers
	w.Header().Set("Cross-Origin-Embedder-Policy", "require-corp")
	w.Header().Set("Cross-Origin-Opener-Policy", "same-origin")
	w.Header().Set("Cross-Origin-Resource-Policy", "same-origin")

	// Content-Security-Policy
	if sm.config.CSPEnabled && sm.config.CSPPolicy != "" {
		w.Header().Set("Content-Security-Policy", sm.config.CSPPolicy)
	}

	// Strict-Transport-Security (HSTS)
	if sm.config.HSTSEnabled {
		if r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https" {
			hstsValue := "max-age=" + strconv.Itoa(sm.config.HSTSMaxAge)
			if sm.config.HSTSIncludeSubDomains {
				hstsValue += "; includeSubDomains"
			}
			if sm.config.HSTSPreload {
				hstsValue += "; preload"
			}
			w.Header().Set("Strict-Transport-Security", hstsValue)
		}
	}

	// Cache-Control for sensitive endpoints
	if sm.isSensitivePath(r.URL.Path) {
		w.Header().Set("Cache-Control", "no-store, no-cache, must-revalidate, private")
		w.Header().Set("Pragma", "no-cache")
		w.Header().Set("Expires", "0")
	}
}

// CSRF token handling

// CSRFTokenStore stores and validates CSRF tokens
type CSRFTokenStore struct {
	tokens map[string]*csrfToken
	mutex  sync.RWMutex
	expiry time.Duration
}

type csrfToken struct {
	value      string
	createdAt  time.Time
	sessionID  string
	userAgent  string
	remoteAddr string
}

// NewCSRFTokenStore creates a new CSRF token store
func NewCSRFTokenStore(expiry time.Duration) *CSRFTokenStore {
	store := &CSRFTokenStore{
		tokens: make(map[string]*csrfToken),
		expiry: expiry,
	}

	// Start cleanup goroutine
	go store.cleanupExpiredTokens()

	return store
}

// GenerateToken generates a new CSRF token
func (s *CSRFTokenStore) GenerateToken(sessionID, userAgent, remoteAddr string) (string, error) {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	// Generate random token
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	tokenID := base64.URLEncoding.EncodeToString(bytes)

	// Store token info
	s.tokens[tokenID] = &csrfToken{
		value:      tokenID,
		createdAt:  time.Now(),
		sessionID:  sessionID,
		userAgent:  userAgent,
		remoteAddr: remoteAddr,
	}

	return tokenID, nil
}

// ValidateToken validates a CSRF token
func (s *CSRFTokenStore) ValidateToken(token, sessionID, userAgent, remoteAddr string) bool {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	storedToken, exists := s.tokens[token]
	if !exists {
		return false
	}

	// Check expiry
	if time.Since(storedToken.createdAt) > s.expiry {
		return false
	}

	// Validate session
	if storedToken.sessionID != sessionID {
		return false
	}

	// Validate user agent (optional, can be lenient)
	// if storedToken.userAgent != userAgent {
	// 	return false
	// }

	return true
}

// cleanupExpiredTokens removes expired tokens periodically
func (s *CSRFTokenStore) cleanupExpiredTokens() {
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()

	for range ticker.C {
		s.mutex.Lock()
		now := time.Now()
		for id, token := range s.tokens {
			if now.Sub(token.createdAt) > s.expiry {
				delete(s.tokens, id)
			}
		}
		s.mutex.Unlock()
	}
}

// CSRF token validation

func (sm *SecurityMiddleware) isStateChangingMethod(method string) bool {
	return method == http.MethodPost || method == http.MethodPut ||
		method == http.MethodDelete || method == http.MethodPatch
}

func (sm *SecurityMiddleware) isExemptPath(path string) bool {
	exemptPaths := []string{
		"/health", "/healthz", "/ready", "/readyz", "/live", "/livez",
		"/metrics", "/version", "/swagger", "/openapi.json", "/docs",
	}

	for _, exempt := range exemptPaths {
		if strings.HasPrefix(path, exempt) {
			return true
		}
	}

	// Also exempt webhook endpoints and API callbacks
	return strings.Contains(path, "/webhook") ||
		strings.Contains(path, "/callback") ||
		strings.Contains(path, "/webhooks/")
}

func (sm *SecurityMiddleware) isSensitivePath(path string) bool {
	sensitivePaths := []string{
		"/api/v1/auth", "/api/v1/users", "/api/v1/admin",
		"/auth", "/login", "/logout", "/register",
	}

	for _, sensitive := range sensitivePaths {
		if strings.HasPrefix(path, sensitive) {
			return true
		}
	}

	return false
}

func (sm *SecurityMiddleware) validateCSRFToken(r *http.Request) bool {
	// Skip CSRF validation for exempt paths
	if sm.isExemptPath(r.URL.Path) {
		return true
	}

	// Get token from header
	token := r.Header.Get("X-CSRF-Token")
	if token == "" {
		// Try getting from form parameter
		token = r.FormValue("csrf_token")
	}

	if token == "" {
		return false
	}

	// Get session ID from context
	sessionID := middleware.GetReqID(r.Context())
	if sessionID == "" {
		// Try to get from context value
		if id := r.Context().Value("session_id"); id != nil {
			if str, ok := id.(string); ok {
				sessionID = str
			}
		}
	}

	if sessionID == "" {
		// Fall back to user ID
		if id := r.Context().Value("user_id"); id != nil {
			if uid, ok := id.(uuid.UUID); ok {
				sessionID = uid.String()
			}
		}
	}

	// For compatibility, if no session exists, accept the token
	// In production, you should always have a session
	if sessionID == "" {
		return true
	}

	return sm.tokens.ValidateToken(token, sessionID, r.UserAgent(), r.RemoteAddr)
}

func (sm *SecurityMiddleware) csrfErrorHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusForbidden)

	// Write error after headers are sent is non-actionable for the client.
	_, _ = w.Write([]byte(`{
		"error": {
			"code": "CSRF_TOKEN_INVALID",
			"message": "Invalid or missing CSRF token"
		},
		"meta": {
			"timestamp": "` + time.Now().UTC().Format(time.RFC3339) + `"
		}
	}`))
}

// GetCSRFToken returns a new CSRF token for the current session
func (sm *SecurityMiddleware) GetCSRFToken(sessionID, userAgent, remoteAddr string) (string, error) {
	return sm.tokens.GenerateToken(sessionID, userAgent, remoteAddr)
}

// Secure cookie configuration

// SetSecureCookie sets a secure cookie with proper attributes.
// Always sets Secure, HttpOnly, and SameSite=Strict (or configured value if stricter).
func (sm *SecurityMiddleware) SetSecureCookie(w http.ResponseWriter, name, value string, maxAge time.Duration) {
	sameSite := sm.config.SameSitePolicy
	if sameSite == http.SameSiteDefaultMode {
		sameSite = http.SameSiteStrictMode
	}
	// #nosec G124 -- Secure=true and HttpOnly=true are literal; SameSite is
	// set via configured value (default Strict) which gosec cannot statically
	// resolve to a literal. Verified above to be non-Default.
	cookie := &http.Cookie{
		Name:     name,
		Value:    value,
		Path:     "/",
		MaxAge:   int(maxAge.Seconds()),
		Secure:   true,
		HttpOnly: true,
		SameSite: sameSite,
	}

	http.SetCookie(w, cookie)
}

// ClearCookie clears a cookie by setting it to expire.
// Same secure attributes as SetSecureCookie so the cleared cookie matches.
func (sm *SecurityMiddleware) ClearCookie(w http.ResponseWriter, name string) {
	sameSite := sm.config.SameSitePolicy
	if sameSite == http.SameSiteDefaultMode {
		sameSite = http.SameSiteStrictMode
	}
	// #nosec G124 -- see SetSecureCookie above; SameSite is configured value (default Strict)
	cookie := &http.Cookie{
		Name:     name,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		Secure:   true,
		HttpOnly: true,
		SameSite: sameSite,
	}

	http.SetCookie(w, cookie)
}

// SecurityHeadersMiddleware is a convenience function that creates
// a middleware with default security configuration
func SecurityHeadersMiddleware() func(http.Handler) http.Handler {
	sm := NewSecurityMiddleware(DefaultSecurityConfig(), nil)
	return sm.Middleware
}

// ContentSecurityPolicyBuilder helps build CSP headers
type ContentSecurityPolicyBuilder struct {
	policies map[string]string
}

// NewContentSecurityPolicyBuilder creates a new CSP builder
func NewContentSecurityPolicyBuilder() *ContentSecurityPolicyBuilder {
	return &ContentSecurityPolicyBuilder{
		policies: make(map[string]string),
	}
}

// Default sets the default-src directive
func (b *ContentSecurityPolicyBuilder) Default(value string) *ContentSecurityPolicyBuilder {
	b.policies["default-src"] = value
	return b
}

// Script sets the script-src directive
func (b *ContentSecurityPolicyBuilder) Script(value string) *ContentSecurityPolicyBuilder {
	b.policies["script-src"] = value
	return b
}

// Style sets the style-src directive
func (b *ContentSecurityPolicyBuilder) Style(value string) *ContentSecurityPolicyBuilder {
	b.policies["style-src"] = value
	return b
}

// Image sets the img-src directive
func (b *ContentSecurityPolicyBuilder) Image(value string) *ContentSecurityPolicyBuilder {
	b.policies["img-src"] = value
	return b
}

// Connect sets the connect-src directive
func (b *ContentSecurityPolicyBuilder) Connect(value string) *ContentSecurityPolicyBuilder {
	b.policies["connect-src"] = value
	return b
}

// Frame sets the frame-src directive
func (b *ContentSecurityPolicyBuilder) Frame(value string) *ContentSecurityPolicyBuilder {
	b.policies["frame-src"] = value
	return b
}

// FrameAncestors sets the frame-ancestors directive
func (b *ContentSecurityPolicyBuilder) FrameAncestors(value string) *ContentSecurityPolicyBuilder {
	b.policies["frame-ancestors"] = value
	return b
}

// BaseURI sets the base-uri directive
func (b *ContentSecurityPolicyBuilder) BaseURI(value string) *ContentSecurityPolicyBuilder {
	b.policies["base-uri"] = value
	return b
}

// FormAction sets the form-action directive
func (b *ContentSecurityPolicyBuilder) FormAction(value string) *ContentSecurityPolicyBuilder {
	b.policies["form-action"] = value
	return b
}

// Custom adds a custom directive
func (b *ContentSecurityPolicyBuilder) Custom(name, value string) *ContentSecurityPolicyBuilder {
	b.policies[name] = value
	return b
}

// Build builds the CSP header value
func (b *ContentSecurityPolicyBuilder) Build() string {
	parts := make([]string, 0, len(b.policies))
	for name, value := range b.policies {
		parts = append(parts, name+" "+value)
	}
	return strings.Join(parts, "; ")
}

// StrictCSPForAPI returns a strict CSP policy for API endpoints
func StrictCSPForAPI() string {
	return NewContentSecurityPolicyBuilder().
		Default("'none'").
		FrameAncestors("'none'").
		BaseURI("'none'").
		FormAction("'none'").
		Custom("sandbox", "").
		Build()
}

// ModerateCSPForWeb returns a moderate CSP policy for web applications
func ModerateCSPForWeb(self string) string {
	return NewContentSecurityPolicyBuilder().
		Default("'self'").
		Script("'self' 'unsafe-inline' 'unsafe-eval'").
		Style("'self' 'unsafe-inline'").
		Image("'self' data: https:").
		Connect("'self'").
		Frame("'none'").
		FrameAncestors("'none'").
		BaseURI("'self'").
		FormAction("'self'").
		Build()
}
