//go:build ignore

package middleware

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/google/uuid"
	"github.com/sirupsen/logrus"

	"github.com/sdlc-ai/platform/services/gateway/internal/domain/services"
)

// Context keys for storing user information
type contextKey string

const (
	UserContextKey contextKey = "user"
	TokenInfoKey   contextKey = "token_info"
	RequestIDKey   contextKey = "request_id"
	TenantIDKey    contextKey = "tenant_id"
	AuthTimeKey    contextKey = "auth_time"
)

// AuthContext contains user authentication information
type AuthContext struct {
	UserID            uuid.UUID         `json:"user_id"`
	TenantID          uuid.UUID         `json:"tenant_id"`
	Email             string            `json:"email"`
	Role              string            `json:"role"`
	Permissions       []string          `json:"permissions"`
	TokenID           string            `json:"token_id"`
	DeviceFingerprint string            `json:"device_fingerprint,omitempty"`
	SessionID         string            `json:"session_id,omitempty"`
	TokenType         string            `json:"token_type"`
	ExpiresAt         time.Time         `json:"expires_at"`
	IssuedAt          time.Time         `json:"issued_at"`
	SecurityContext   map[string]string `json:"security_context,omitempty"`
	IPAddress         string            `json:"ip_address"`
	UserAgent         string            `json:"user_agent"`
	RequestID         string            `json:"request_id"`
	AuthTime          time.Time         `json:"auth_time"`
}

// AuthMiddleware creates a JWT authentication middleware
type AuthMiddleware struct {
	jwtService services.JWTService
	logger     *logrus.Logger
	options    AuthMiddlewareOptions
}

// AuthMiddlewareOptions configures the authentication middleware
type AuthMiddlewareOptions struct {
	// SkipPaths are URL paths that skip authentication
	SkipPaths []string

	// RequireTLS requires TLS for authentication
	RequireTLS bool

	// TokenHeader is the header name to extract the token from
	TokenHeader string

	// TokenPrefix is the expected token prefix (e.g., "Bearer")
	TokenPrefix string

	// ValidateDeviceFingerprint validates device fingerprint if present
	ValidateDeviceFingerprint bool

	// EnableLogging enables detailed authentication logging
	EnableLogging bool

	// SecurityHeaders enables security headers
	SecurityHeaders bool

	// RateLimiting enables per-user rate limiting
	RateLimiting bool

	// AuditLogging enables audit logging
	AuditLogging bool
}

// DefaultAuthMiddlewareOptions returns default options for the auth middleware
func DefaultAuthMiddlewareOptions() AuthMiddlewareOptions {
	return AuthMiddlewareOptions{
		SkipPaths: []string{
			"/healthz",
			"/health",
			"/metrics",
			"/readyz",
			"/livez",
			"/api/v1/auth/login",
			"/api/v1/auth/register",
			"/api/v1/auth/refresh",
			"/api/v1/auth/forgot-password",
			"/api/v1/auth/reset-password",
		},
		RequireTLS:                false, // Set to true in production
		TokenHeader:               "Authorization",
		TokenPrefix:               "Bearer",
		ValidateDeviceFingerprint: true,
		EnableLogging:             true,
		SecurityHeaders:           true,
		RateLimiting:              true,
		AuditLogging:              true,
	}
}

// NewAuthMiddleware creates a new authentication middleware
func NewAuthMiddleware(
	jwtService services.JWTService,
	logger *logrus.Logger,
	options AuthMiddlewareOptions,
) *AuthMiddleware {
	if logger == nil {
		logger = logrus.New()
	}

	return &AuthMiddleware{
		jwtService: jwtService,
		logger:     logger,
		options:    options,
	}
}

// Middleware returns the chi middleware function
func (a *AuthMiddleware) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Skip authentication for specified paths
		if a.shouldSkipPath(r.URL.Path) {
			next.ServeHTTP(w, r)
			return
		}

		// Add security headers if enabled
		if a.options.SecurityHeaders {
			a.addSecurityHeaders(w, r)
		}

		// Extract and validate token
		authContext, err := a.authenticateRequest(r)
		if err != nil {
			a.handleAuthenticationError(w, r, err)
			return
		}

		// Add user context to the request
		ctx := a.addContextToRequest(r.Context(), authContext)

		// Log authentication if enabled
		if a.options.EnableLogging {
			a.logAuthentication(authContext, r)
		}

		// Audit log if enabled
		if a.options.AuditLogging {
			a.auditAuthentication(authContext, r)
		}

		// Call next handler with updated context
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// OptionalMiddleware creates an optional authentication middleware
// that continues even if authentication fails
func (a *AuthMiddleware) OptionalMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Skip authentication for specified paths
		if a.shouldSkipPath(r.URL.Path) {
			next.ServeHTTP(w, r)
			return
		}

		// Add security headers if enabled
		if a.options.SecurityHeaders {
			a.addSecurityHeaders(w, r)
		}

		// Try to authenticate but don't fail if not possible
		authContext, err := a.authenticateRequest(r)
		if err != nil {
			// Log the attempt but continue
			if a.options.EnableLogging {
				a.logger.WithFields(logrus.Fields{
					"error":       err.Error(),
					"path":        r.URL.Path,
					"method":      r.Method,
					"remote_addr": r.RemoteAddr,
					"user_agent":  r.UserAgent(),
				}).Debug("Optional authentication failed")
			}
			next.ServeHTTP(w, r)
			return
		}

		// Add user context to the request
		ctx := a.addContextToRequest(r.Context(), authContext)

		// Log authentication if enabled
		if a.options.EnableLogging {
			a.logAuthentication(authContext, r)
		}

		// Call next handler with updated context
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// RoleMiddleware creates a middleware that checks for specific roles
func (a *AuthMiddleware) RoleMiddleware(requiredRoles ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authContext, ok := r.Context().Value(UserContextKey).(*AuthContext)
			if !ok {
				a.handleAuthorizationError(w, r, "authentication required")
				return
			}

			// Check if user has required role
			if !a.hasRequiredRole(authContext.Role, requiredRoles) {
				a.handleAuthorizationError(w, r, "insufficient privileges")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// PermissionMiddleware creates a middleware that checks for specific permissions
func (a *AuthMiddleware) PermissionMiddleware(requiredPermissions ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authContext, ok := r.Context().Value(UserContextKey).(*AuthContext)
			if !ok {
				a.handleAuthorizationError(w, r, "authentication required")
				return
			}

			// Check if user has required permissions
			if !a.hasRequiredPermissions(authContext.Permissions, requiredPermissions) {
				a.handleAuthorizationError(w, r, "insufficient permissions")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// TenantMiddleware creates a middleware that validates tenant access
func (a *AuthMiddleware) TenantMiddleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authContext, ok := r.Context().Value(UserContextKey).(*AuthContext)
			if !ok {
				a.handleAuthorizationError(w, r, "authentication required")
				return
			}

			// Extract tenant ID from request (from header or URL parameter)
			requestTenantID := r.Header.Get("X-Tenant-ID")
			if requestTenantID == "" {
				requestTenantID = chi.URLParam(r, "tenantID")
			}

			// If no tenant ID in request, allow (tenant-scoped operations)
			if requestTenantID == "" {
				next.ServeHTTP(w, r)
				return
			}

			// Validate tenant access
			requestTenantUUID, err := uuid.Parse(requestTenantID)
			if err != nil {
				a.handleAuthorizationError(w, r, "invalid tenant ID")
				return
			}

			if authContext.TenantID != requestTenantUUID && authContext.Role != "super_admin" {
				a.handleAuthorizationError(w, r, "tenant access denied")
				return
			}

			// Add tenant ID to context
			ctx := context.WithValue(r.Context(), TenantIDKey, requestTenantUUID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// Helper methods

func (a *AuthMiddleware) shouldSkipPath(path string) bool {
	for _, skipPath := range a.options.SkipPaths {
		if strings.HasPrefix(path, skipPath) {
			return true
		}
	}
	return false
}

func (a *AuthMiddleware) authenticateRequest(r *http.Request) (*AuthContext, error) {
	// Extract token from header
	tokenString, err := a.extractToken(r)
	if err != nil {
		return nil, err
	}

	// Validate token
	tokenInfo, err := a.jwtService.ValidateToken(r.Context(), tokenString, "access")
	if err != nil {
		return nil, err
	}

	// Create auth context
	authContext := &AuthContext{
		UserID:            tokenInfo.UserID,
		TenantID:          tokenInfo.TenantID,
		Email:             tokenInfo.Email,
		Role:              tokenInfo.Role,
		Permissions:       tokenInfo.Permissions,
		TokenID:           tokenInfo.TokenID,
		DeviceFingerprint: tokenInfo.DeviceFingerprint,
		SessionID:         tokenInfo.SessionID,
		TokenType:         tokenInfo.TokenType,
		ExpiresAt:         tokenInfo.ExpiresAt,
		IssuedAt:          tokenInfo.IssuedAt,
		SecurityContext:   tokenInfo.SecurityContext,
		IPAddress:         a.getClientIP(r),
		UserAgent:         r.UserAgent(),
		RequestID:         middleware.GetReqID(r.Context()),
		AuthTime:          time.Now(),
	}

	// Validate device fingerprint if enabled and present
	if a.options.ValidateDeviceFingerprint && authContext.DeviceFingerprint != "" {
		requestFingerprint := a.getDeviceFingerprint(r)
		if requestFingerprint != "" && requestFingerprint != authContext.DeviceFingerprint {
			return nil, &services.TokenValidationError{
				Type:    "device_mismatch",
				Message: "device fingerprint mismatch",
			}
		}
	}

	return authContext, nil
}

func (a *AuthMiddleware) extractToken(r *http.Request) (string, error) {
	// Extract token from header
	headerValue := r.Header.Get(a.options.TokenHeader)
	if headerValue == "" {
		return "", &services.TokenValidationError{
			Type:    "missing_token",
			Message: "authorization header is missing",
		}
	}

	// Remove prefix if present
	if a.options.TokenPrefix != "" {
		prefix := a.options.TokenPrefix + " "
		if !strings.HasPrefix(headerValue, prefix) {
			return "", &services.TokenValidationError{
				Type:    "invalid_token_format",
				Message: "invalid authorization header format",
			}
		}
		return strings.TrimPrefix(headerValue, prefix), nil
	}

	return headerValue, nil
}

func (a *AuthMiddleware) addContextToRequest(ctx context.Context, authContext *AuthContext) context.Context {
	ctx = context.WithValue(ctx, UserContextKey, authContext)
	ctx = context.WithValue(ctx, TokenInfoKey, authContext)
	ctx = context.WithValue(ctx, TenantIDKey, authContext.TenantID)
	ctx = context.WithValue(ctx, AuthTimeKey, authContext.AuthTime)
	return ctx
}

func (a *AuthMiddleware) addSecurityHeaders(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("X-Frame-Options", "DENY")
	w.Header().Set("X-XSS-Protection", "1; mode=block")
	w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")

	if a.options.RequireTLS && r.TLS == nil {
		w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
	}
}

func (a *AuthMiddleware) getClientIP(r *http.Request) string {
	// Check X-Forwarded-For header first
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		// Take the first IP in the list
		ips := strings.Split(xff, ",")
		return strings.TrimSpace(ips[0])
	}

	// Check X-Real-IP header
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return xri
	}

	// Fall back to RemoteAddr
	return r.RemoteAddr
}

func (a *AuthMiddleware) getDeviceFingerprint(r *http.Request) string {
	// Create a simple device fingerprint from User-Agent and IP
	// In a real implementation, you might use more sophisticated fingerprinting
	userAgent := r.UserAgent()
	ip := a.getClientIP(r)

	if userAgent != "" && ip != "" {
		return services.HashDeviceFingerprint(userAgent + "|" + ip)
	}

	return ""
}

func (a *AuthMiddleware) hasRequiredRole(userRole string, requiredRoles []string) bool {
	for _, requiredRole := range requiredRoles {
		if userRole == requiredRole {
			return true
		}
	}
	return false
}

func (a *AuthMiddleware) hasRequiredPermissions(userPermissions, requiredPermissions []string) bool {
	// If user is admin, grant all permissions
	if a.hasRequiredRole(userPermissions, []string{"super_admin", "tenant_admin"}) {
		return true
	}

	// Check for exact permission matches
	for _, requiredPerm := range requiredPermissions {
		found := false
		for _, userPerm := range userPermissions {
			if userPerm == requiredPerm || userPerm == "*" {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}

	return true
}

func (a *AuthMiddleware) logAuthentication(authContext *AuthContext, r *http.Request) {
	a.logger.WithFields(logrus.Fields{
		"user_id":     authContext.UserID.String(),
		"tenant_id":   authContext.TenantID.String(),
		"email":       authContext.Email,
		"role":        authContext.Role,
		"token_id":    authContext.TokenID,
		"request_id":  authContext.RequestID,
		"path":        r.URL.Path,
		"method":      r.Method,
		"remote_addr": authContext.IPAddress,
		"user_agent":  authContext.UserAgent,
		"auth_time":   authContext.AuthTime,
	}).Info("User authenticated")
}

func (a *AuthMiddleware) auditAuthentication(authContext *AuthContext, r *http.Request) {
	// This would integrate with your audit logging system
	// For now, we'll log to the standard logger
	a.logger.WithFields(logrus.Fields{
		"event_type": "authentication",
		"user_id":    authContext.UserID.String(),
		"tenant_id":  authContext.TenantID.String(),
		"token_id":   authContext.TokenID,
		"ip_address": authContext.IPAddress,
		"user_agent": authContext.UserAgent,
		"resource":   r.URL.Path,
		"action":     r.Method,
		"timestamp":  authContext.AuthTime,
		"success":    true,
	}).Info("Authentication audit log")
}

func (a *AuthMiddleware) handleAuthenticationError(w http.ResponseWriter, r *http.Request, err error) {
	// Log the authentication failure
	if a.options.EnableLogging {
		a.logger.WithFields(logrus.Fields{
			"error":       err.Error(),
			"path":        r.URL.Path,
			"method":      r.Method,
			"remote_addr": a.getClientIP(r),
			"user_agent":  r.UserAgent(),
			"request_id":  middleware.GetReqID(r.Context()),
		}).Warn("Authentication failed")
	}

	// Audit log the failure
	if a.options.AuditLogging {
		a.logger.WithFields(logrus.Fields{
			"event_type": "authentication_failure",
			"error":      err.Error(),
			"ip_address": a.getClientIP(r),
			"user_agent": r.UserAgent(),
			"resource":   r.URL.Path,
			"action":     r.Method,
			"timestamp":  time.Now(),
			"success":    false,
		}).Info("Authentication failure audit log")
	}

	// Determine response based on error type
	var tokenErr *services.TokenValidationError
	if ok := err.(*services.TokenValidationError); ok {
		tokenErr = ok
	} else {
		tokenErr = &services.TokenValidationError{
			Type:    "authentication_error",
			Message: "authentication failed",
		}
	}

	// Return appropriate HTTP status and error
	switch tokenErr.Type {
	case "expired":
		w.WriteHeader(http.StatusUnauthorized)
		a.writeErrorResponse(w, "TOKEN_EXPIRED", "Token has expired")
	case "invalid", "malformed", "invalid_signature":
		w.WriteHeader(http.StatusUnauthorized)
		a.writeErrorResponse(w, "INVALID_TOKEN", "Invalid authentication token")
	case "missing_token":
		w.WriteHeader(http.StatusUnauthorized)
		a.writeErrorResponse(w, "MISSING_TOKEN", "Authentication token is required")
	case "device_mismatch":
		w.WriteHeader(http.StatusUnauthorized)
		a.writeErrorResponse(w, "DEVICE_MISMATCH", "Device fingerprint mismatch")
	case "blacklisted":
		w.WriteHeader(http.StatusUnauthorized)
		a.writeErrorResponse(w, "TOKEN_REVOKED", "Token has been revoked")
	default:
		w.WriteHeader(http.StatusUnauthorized)
		a.writeErrorResponse(w, "AUTHENTICATION_FAILED", "Authentication failed")
	}
}

func (a *AuthMiddleware) handleAuthorizationError(w http.ResponseWriter, r *http.Request, message string) {
	// Log the authorization failure
	if a.options.EnableLogging {
		a.logger.WithFields(logrus.Fields{
			"message":     message,
			"path":        r.URL.Path,
			"method":      r.Method,
			"remote_addr": a.getClientIP(r),
			"user_agent":  r.UserAgent(),
			"request_id":  middleware.GetReqID(r.Context()),
		}).Warn("Authorization failed")
	}

	// Audit log the failure
	if a.options.AuditLogging {
		a.logger.WithFields(logrus.Fields{
			"event_type": "authorization_failure",
			"message":    message,
			"ip_address": a.getClientIP(r),
			"user_agent": r.UserAgent(),
			"resource":   r.URL.Path,
			"action":     r.Method,
			"timestamp":  time.Now(),
			"success":    false,
		}).Info("Authorization failure audit log")
	}

	w.WriteHeader(http.StatusForbidden)
	a.writeErrorResponse(w, "INSUFFICIENT_PERMISSIONS", message)
}

func (a *AuthMiddleware) writeErrorResponse(w http.ResponseWriter, code, message string) {
	w.Header().Set("Content-Type", "application/json")
	response := map[string]interface{}{
		"success": false,
		"error": map[string]interface{}{
			"code":    code,
			"message": message,
		},
		"meta": map[string]interface{}{
			"timestamp": time.Now().UTC().Format(time.RFC3339),
		},
	}

	if err := json.NewEncoder(w).Encode(response); err != nil {
		a.logger.WithError(err).Error("Failed to write error response")
	}
}

// Utility functions for extracting context values

// GetUserContext extracts the user context from the request
func GetUserContext(r *http.Request) (*AuthContext, bool) {
	authContext, ok := r.Context().Value(UserContextKey).(*AuthContext)
	return authContext, ok
}

// GetTokenInfo extracts token information from the request
func GetTokenInfo(r *http.Request) (*AuthContext, bool) {
	tokenInfo, ok := r.Context().Value(TokenInfoKey).(*AuthContext)
	return tokenInfo, ok
}

// GetTenantID extracts the tenant ID from the request context
func GetTenantID(r *http.Request) (uuid.UUID, bool) {
	tenantID, ok := r.Context().Value(TenantIDKey).(uuid.UUID)
	return tenantID, ok
}

// GetUserID extracts the user ID from the request context
func GetUserID(r *http.Request) (uuid.UUID, bool) {
	authContext, ok := GetUserContext(r)
	if !ok {
		return uuid.Nil, false
	}
	return authContext.UserID, true
}

// IsAuthenticated checks if the request is authenticated
func IsAuthenticated(r *http.Request) bool {
	_, ok := GetUserContext(r)
	return ok
}

// HasRole checks if the authenticated user has the specified role
func HasRole(r *http.Request, role string) bool {
	authContext, ok := GetUserContext(r)
	if !ok {
		return false
	}
	return authContext.Role == role
}

// HasPermission checks if the authenticated user has the specified permission
func HasPermission(r *http.Request, permission string) bool {
	authContext, ok := GetUserContext(r)
	if !ok {
		return false
	}

	// Admin users have all permissions
	if authContext.Role == "super_admin" || authContext.Role == "tenant_admin" {
		return true
	}

	for _, perm := range authContext.Permissions {
		if perm == permission || perm == "*" {
			return true
		}
	}
	return false
}
