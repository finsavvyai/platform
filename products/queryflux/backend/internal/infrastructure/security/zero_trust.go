package security

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"go.uber.org/zap"
)

// ZeroTrustMiddleware implements zero-trust security principles
type ZeroTrustMiddleware struct {
	authService        AuthService
	rateLimiter       RateLimiter
	threatDetector    ThreatDetector
	auditLogger       AuditLogger
	config            ZeroTrustConfig
	logger            *zap.Logger
}

// ZeroTrustConfig represents zero-trust configuration
type ZeroTrustConfig struct {
	MaxSessionDuration    time.Duration `json:"max_session_duration"`
	RequireMFA           bool          `json:"require_mfa"`
	AllowedIPRanges      []string      `json:"allowed_ip_ranges"`
	DeviceTrustRequired  bool          `json:"device_trust_required"`
	LocationVerification bool          `json:"location_verification"`
	AnomalyDetection     bool          `json:"anomaly_detection"`
	EncryptionRequired   bool          `json:"encryption_required"`
	MinPasswordStrength  int           `json:"min_password_strength"`
	MaxFailedAttempts    int           `json:"max_failed_attempts"`
	LockoutDuration      time.Duration `json:"lockout_duration"`
}

// AuthService handles authentication and authorization
type AuthService interface {
	ValidateToken(ctx context.Context, token string) (*AuthClaims, error)
	CheckPermissions(ctx context.Context, userID string, resource, action string) error
	RecordLoginAttempt(ctx context.Context, attempt LoginAttempt) error
	IsUserLocked(ctx context.Context, userID string) (bool, error)
}

// RateLimiter provides rate limiting functionality
type RateLimiter interface {
	Allow(ctx context.Context, key string) (bool, time.Duration)
	Block(ctx context.Context, key string, duration time.Duration) error
}

// ThreatDetector detects potential threats
type ThreatDetector interface {
	AnalyzeRequest(ctx context.Context, req *http.Request) (*ThreatAssessment, error)
	AnomalyScore(ctx context.Context, userID string, request RequestPattern) (float64, error)
	BlockIP(ctx context.Context, ip string, reason string) error
}

// AuthClaims represents JWT claims
type AuthClaims struct {
	UserID       string            `json:"user_id"`
	Email        string            `json:"email"`
	Roles        []string          `json:"roles"`
	Permissions  []string          `json:"permissions"`
	DeviceID     string            `json:"device_id"`
	SessionID    string            `json:"session_id"`
	TenantID     string            `json:"tenant_id"`
	LastActivity time.Time         `json:"last_activity"`
	Claims       map[string]string `json:"claims"`
	jwt.RegisteredClaims
}

// LoginAttempt represents a login attempt
type LoginAttempt struct {
	UserID    string    `json:"user_id"`
	IP        string    `json:"ip"`
	UserAgent string    `json:"user_agent"`
	Success   bool      `json:"success"`
	Timestamp time.Time `json:"timestamp"`
	Reason    string    `json:"reason,omitempty"`
}

// ThreatAssessment represents a threat assessment
type ThreatAssessment struct {
	Score          float64            `json:"score"`
	Threats        []string           `json:"threats"`
	RiskLevel      RiskLevel          `json:"risk_level"`
	Recommendations []string          `json:"recommendations"`
	BlockRequest   bool              `json:"block_request"`
	Reason         string            `json:"reason,omitempty"`
	Metadata       map[string]string `json:"metadata"`
}

// RiskLevel represents risk levels
type RiskLevel string

const (
	RiskLevelLow      RiskLevel = "low"
	RiskLevelMedium   RiskLevel = "medium"
	RiskLevelHigh     RiskLevel = "high"
	RiskLevelCritical RiskLevel = "critical"
)

// RequestPattern represents a request pattern for anomaly detection
type RequestPattern struct {
	UserID      string    `json:"user_id"`
	IP          string    `json:"ip"`
	Resource    string    `json:"resource"`
	Action      string    `json:"action"`
	Timestamp   time.Time `json:"timestamp"`
	UserAgent   string    `json:"user_agent"`
	Location    string    `json:"location"`
	DeviceFingerprint string `json:"device_fingerprint"`
}

// NewZeroTrustMiddleware creates a new zero-trust middleware
func NewZeroTrustMiddleware(
	authService AuthService,
	rateLimiter RateLimiter,
	threatDetector ThreatDetector,
	auditLogger AuditLogger,
	config ZeroTrustConfig,
	logger *zap.Logger,
) *ZeroTrustMiddleware {
	return &ZeroTrustMiddleware{
		authService:     authService,
		rateLimiter:    rateLimiter,
		threatDetector: threatDetector,
		auditLogger:    auditLogger,
		config:         config,
		logger:         logger,
	}
}

// Middleware returns the HTTP middleware function
func (z *ZeroTrustMiddleware) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		startTime := time.Now()

		// 1. Extract and validate token
		claims, err := z.extractAndValidateToken(ctx, r)
		if err != nil {
			z.logger.Error("Token validation failed",
				zap.String("ip", getClientIP(r)),
				zap.Error(err))
			z.writeErrorResponse(w, http.StatusUnauthorized, err.Error())
			return
		}

		// 2. Check if user is locked out
		locked, err := z.authService.IsUserLocked(ctx, claims.UserID)
		if err != nil {
			z.logger.Error("Failed to check lockout status",
				zap.String("user_id", claims.UserID),
				zap.Error(err))
			z.writeErrorResponse(w, http.StatusInternalServerError, "Internal server error")
			return
		}

		if locked {
			z.logger.Warn("Locked user attempted access",
				zap.String("user_id", claims.UserID),
				zap.String("ip", getClientIP(r)))
			z.writeErrorResponse(w, http.StatusForbidden, "Account locked")
			return
		}

		// 3. Perform threat detection
		threatAssessment, err := z.threatDetector.AnalyzeRequest(ctx, r)
		if err != nil {
			z.logger.Error("Threat detection failed",
				zap.String("user_id", claims.UserID),
				zap.Error(err))
		}

		if threatAssessment != nil && threatAssessment.BlockRequest {
			z.logger.Warn("Request blocked due to threat",
				zap.String("user_id", claims.UserID),
				zap.String("reason", threatAssessment.Reason),
				zap.Float64("score", threatAssessment.Score))

			// Block IP if critical threat
			if threatAssessment.RiskLevel == RiskLevelCritical {
				z.threatDetector.BlockIP(ctx, getClientIP(r), threatAssessment.Reason)
			}

			z.writeErrorResponse(w, http.StatusForbidden, "Request blocked")
			return
		}

		// 4. Check rate limiting
		allowed, retryAfter := z.rateLimiter.Allow(ctx, "auth:"+claims.UserID)
		if !allowed {
			z.logger.Warn("Rate limit exceeded",
				zap.String("user_id", claims.UserID),
				zap.String("ip", getClientIP(r)))

			w.Header().Set("Retry-After", retryAfter.String())
			z.writeErrorResponse(w, http.StatusTooManyRequests, "Rate limit exceeded")
			return
		}

		// 5. Verify device trust if required
		if z.config.DeviceTrustRequired {
			if !z.verifyDeviceTrust(ctx, claims, r) {
				z.logger.Warn("Untrusted device access attempt",
					zap.String("user_id", claims.UserID),
					zap.String("device_id", claims.DeviceID))
				z.writeErrorResponse(w, http.StatusForbidden, "Untrusted device")
				return
			}
		}

		// 6. Check IP restrictions
		if !z.isIPAllowed(getClientIP(r)) {
			z.logger.Warn("Access from unauthorized IP",
				zap.String("user_id", claims.UserID),
				zap.String("ip", getClientIP(r)))
			z.writeErrorResponse(w, http.StatusForbidden, "Unauthorized IP address")
			return
		}

		// 7. Check session validity
		if !z.isSessionValid(claims) {
			z.logger.Warn("Invalid session",
				zap.String("user_id", claims.UserID),
				zap.String("session_id", claims.SessionID))
			z.writeErrorResponse(w, http.StatusUnauthorized, "Session expired")
			return
		}

		// 8. Check resource permissions
		resource := r.URL.Path
		action := r.Method
		if err := z.authService.CheckPermissions(ctx, claims.UserID, resource, action); err != nil {
			z.logger.Warn("Insufficient permissions",
				zap.String("user_id", claims.UserID),
				zap.String("resource", resource),
				zap.String("action", action),
				zap.Error(err))
			z.writeErrorResponse(w, http.StatusForbidden, "Insufficient permissions")
			return
		}

		// 9. Update last activity
		claims.LastActivity = time.Now()

		// 10. Add claims to context
		ctx = context.WithValue(ctx, "auth_claims", claims)
		ctx = context.WithValue(ctx, "threat_assessment", threatAssessment)

		// 11. Log successful access
		if err := z.auditLogger.LogAccess(ctx, "access_granted", map[string]interface{}{
			"user_id":    claims.UserID,
			"resource":   resource,
			"action":     action,
			"ip":         getClientIP(r),
			"user_agent": r.Header.Get("User-Agent"),
			"duration":   time.Since(startTime),
		}); err != nil {
			z.logger.Error("Failed to log access", zap.Error(err))
		}

		// 12. Add security headers
		z.addSecurityHeaders(w)

		// 13. Call next handler
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// extractAndValidateToken extracts and validates JWT token
func (z *ZeroTrustMiddleware) extractAndValidateToken(ctx context.Context, r *http.Request) (*AuthClaims, error) {
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		return nil, fmt.Errorf("missing authorization header")
	}

	if !strings.HasPrefix(authHeader, "Bearer ") {
		return nil, fmt.Errorf("invalid authorization header format")
	}

	token := strings.TrimPrefix(authHeader, "Bearer ")
	if token == "" {
		return nil, fmt.Errorf("missing token")
	}

	claims, err := z.authService.ValidateToken(ctx, token)
	if err != nil {
		return nil, fmt.Errorf("invalid token: %w", err)
	}

	return claims, nil
}

// verifyDeviceTrust verifies device trust
func (z *ZeroTrustMiddleware) verifyDeviceTrust(ctx context.Context, claims *AuthClaims, r *http.Request) bool {
	// Check device fingerprint
	deviceFingerprint := z.generateDeviceFingerprint(r)

	// In a real implementation, check against device registry
	return deviceFingerprint == claims.DeviceID
}

// isIPAllowed checks if IP is in allowed range
func (z *ZeroTrustMiddleware) isIPAllowed(ip string) bool {
	if len(z.config.AllowedIPRanges) == 0 {
		return true // No restrictions
	}

	// Check against allowed IP ranges
	for _, allowedRange := range z.config.AllowedIPRanges {
		if z.isIPInRange(ip, allowedRange) {
			return true
		}
	}

	return false
}

// isIPInRange checks if IP is in CIDR range
func (z *ZeroTrustMiddleware) isIPInRange(ip, rangeStr string) bool {
	// Implementation for IP range checking
	// Use net.ParseCIDR for CIDR ranges
	return true // Simplified for example
}

// isSessionValid checks session validity
func (z *ZeroTrustMiddleware) isSessionValid(claims *AuthClaims) bool {
	if time.Since(claims.LastActivity) > z.config.MaxSessionDuration {
		return false
	}

	// Check other session validation rules
	return true
}

// generateDeviceFingerprint generates device fingerprint
func (z *ZeroTrustMiddleware) generateDeviceFingerprint(r *http.Request) string {
	userAgent := r.Header.Get("User-Agent")
	accept := r.Header.Get("Accept")
	acceptEncoding := r.Header.Get("Accept-Encoding")
	acceptLanguage := r.Header.Get("Accept-Language")

	// Generate fingerprint from headers
	fingerprint := fmt.Sprintf("%s|%s|%s|%s",
		userAgent, accept, acceptEncoding, acceptLanguage)

	// In a real implementation, use a proper hash function
	return fingerprint
}

// addSecurityHeaders adds security headers to response
func (z *ZeroTrustMiddleware) addSecurityHeaders(w http.ResponseWriter) {
	headers := map[string]string{
		"X-Content-Type-Options":   "nosniff",
		"X-Frame-Options":          "DENY",
		"X-XSS-Protection":         "1; mode=block",
		"Strict-Transport-Security": "max-age=31536000; includeSubDomains",
		"Content-Security-Policy":   "default-src 'self'",
		"Referrer-Policy":          "strict-origin-when-cross-origin",
		"Permissions-Policy":       "geolocation=(), microphone=(), camera=()",
	}

	for key, value := range headers {
		w.Header().Set(key, value)
	}
}

// writeErrorResponse writes error response
func (z *ZeroTrustMiddleware) writeErrorResponse(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	w.Write([]byte(fmt.Sprintf(`{"error": "%s"}`, message)))
}

// getClientIP extracts client IP from request
func getClientIP(r *http.Request) string {
	// Check X-Forwarded-For header
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		ips := strings.Split(xff, ",")
		return strings.TrimSpace(ips[0])
	}

	// Check X-Real-IP header
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return xri
	}

	return r.RemoteAddr
}