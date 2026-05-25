package middleware

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/mcpoverflow/api-service/internal/config"
	"github.com/mcpoverflow/api-service/internal/models"
)

// SSOService handles Single Sign-On operations
type SSOService struct {
	config   *config.Config
	sessions map[string]*SSOSession
}

// SSOSession represents a cross-domain SSO session
type SSOSession struct {
	SessionID    string          `json:"session_id"`
	UserID       string          `json:"user_id"`
	Email        string          `json:"email"`
	Role         models.UserRole `json:"role"`
	Origins      []string        `json:"origins"`
	CreatedAt    time.Time       `json:"created_at"`
	ExpiresAt    time.Time       `json:"expires_at"`
	LastAccessed time.Time       `json:"last_accessed"`
}

// NewSSOService creates a new SSO service
func NewSSOService(cfg *config.Config) *SSOService {
	svc := &SSOService{
		config:   cfg,
		sessions: make(map[string]*SSOSession),
	}

	// Start cleanup goroutine for expired sessions
	go svc.cleanupExpiredSessions()

	return svc
}

// RequireCrossDomainAuth enforces cross-domain authentication
func RequireCrossDomainAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get SSO service from context
		SSO, exists := c.MustGet("sso").(*SSOService)
		if !exists {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "SSO service not available",
				"code":  "SSO_UNAVAILABLE",
			})
			c.Abort()
			return
		}

		// Check for session cookie
		sessionCookie, err := c.Cookie("mcpoverflow_sso")
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "SSO session required",
				"code":  "SSO_REQUIRED",
			})
			c.Abort()
			return
		}

		// Validate session
		session, err := SSO.ValidateSession(sessionCookie)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Invalid SSO session",
				"code":  "INVALID_SSO_SESSION",
				"details": gin.H{
					"error": err.Error(),
				},
			})
			c.Abort()
			return
		}

		// Check if this domain is allowed for the session
		origin := c.GetHeader("Origin")
		if origin != "" && !SSO.IsOriginAllowed(session, origin) {
			c.JSON(http.StatusForbidden, gin.H{
				"error": "Origin not allowed for this session",
				"code":  "ORIGIN_NOT_ALLOWED",
			})
			c.Abort()
			return
		}

		// Update last accessed time
		session.LastAccessed = time.Now()
		SSO.sessions[session.SessionID] = session

		// Set user context
		c.Set("user_id", session.UserID)
		c.Set("email", session.Email)
		c.Set("role", session.Role)
		c.Set("session_id", session.SessionID)
		c.Set("sso_authenticated", true)

		c.Next()
	}
}

// CreateSSOSession creates a new SSO session
func (s *SSOService) CreateSSOSession(userID, email string, role models.UserRole, origins []string) (*SSOSession, error) {
	sessionID := s.generateSessionID()

	session := &SSOSession{
		SessionID:    sessionID,
		UserID:       userID,
		Email:        email,
		Role:         role,
		Origins:      origins,
		CreatedAt:    time.Now(),
		ExpiresAt:    time.Now().Add(24 * time.Hour), // 24 hours
		LastAccessed: time.Now(),
	}

	s.sessions[sessionID] = session
	return session, nil
}

// ValidateSession validates an SSO session
func (s *SSOService) ValidateSession(sessionID string) (*SSOSession, error) {
	session, exists := s.sessions[sessionID]
	if !exists {
		return nil, fmt.Errorf("session not found")
	}

	if time.Now().After(session.ExpiresAt) {
		delete(s.sessions, sessionID)
		return nil, fmt.Errorf("session expired")
	}

	return session, nil
}

// IsOriginAllowed checks if an origin is allowed for a session
func (s *SSOService) IsOriginAllowed(session *SSOSession, origin string) bool {
	if len(session.Origins) == 0 {
		// If no specific origins, allow all configured domains
		return s.isConfiguredDomain(origin)
	}

	for _, allowedOrigin := range session.Origins {
		if s.isOriginMatch(allowedOrigin, origin) {
			return true
		}
	}

	return false
}

// isConfiguredDomain checks if an origin matches any configured domain
func (s *SSOService) isConfiguredDomain(origin string) bool {
	domains := []string{
		s.config.Domains.Marketing.URL,
		s.config.Domains.Developer.URL,
		s.config.Domains.AI.URL,
		s.config.Domains.Docs.URL,
	}

	for _, domain := range domains {
		if domain != "" && s.isOriginMatch(domain, origin) {
			return true
		}
	}

	return false
}

// isOriginMatch checks if an origin matches a domain pattern
func (s *SSOService) isOriginMatch(pattern, origin string) bool {
	// Simple origin matching - in production, use more sophisticated matching
	return strings.HasPrefix(origin, pattern) || strings.HasPrefix(pattern, origin)
}

// SetSSOCookie sets the SSO session cookie
func (s *SSOService) SetSSOCookie(c *gin.Context, session *SSOSession) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(
		"mcpoverflow_sso",
		session.SessionID,
		int(session.ExpiresAt.Sub(time.Now()).Seconds()), // maxAge
		"/",                 // path
		s.getCookieDomain(), // domain
		true,                // secure
		true,                // httpOnly
	)
}

// ClearSSOCookie clears the SSO session cookie
func (s *SSOService) ClearSSOCookie(c *gin.Context) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(
		"mcpoverflow_sso",
		"",
		-1, // maxAge
		"/",
		s.getCookieDomain(),
		true,
		true,
	)
}

// getCookieDomain returns the appropriate cookie domain
func (s *SSOService) getCookieDomain() string {
	// Extract the top-level domain from configured domains
	// For now, return empty to use current domain
	return ""
}

// generateSessionID generates a secure session ID
func (s *SSOService) generateSessionID() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		// Fallback to timestamp-based ID
		return fmt.Sprintf("session_%d", time.Now().UnixNano())
	}
	return hex.EncodeToString(b)
}

// cleanupExpiredSessions removes expired sessions
func (s *SSOService) cleanupExpiredSessions() {
	ticker := time.NewTicker(10 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		now := time.Now()
		for sessionID, session := range s.sessions {
			if now.After(session.ExpiresAt) {
				delete(s.sessions, sessionID)
			}
		}
	}
}

// DeleteSession deletes an SSO session
func (s *SSOService) DeleteSession(sessionID string) error {
	delete(s.sessions, sessionID)
	return nil
}

// GetSession retrieves an SSO session by ID
func (s *SSOService) GetSession(sessionID string) (*SSOSession, error) {
	session, exists := s.sessions[sessionID]
	if !exists {
		return nil, fmt.Errorf("session not found")
	}
	return session, nil
}

// UpdateSessionOrigins updates the allowed origins for a session
func (s *SSOService) UpdateSessionOrigins(sessionID string, origins []string) error {
	session, err := s.GetSession(sessionID)
	if err != nil {
		return err
	}

	session.Origins = origins
	s.sessions[sessionID] = session
	return nil
}

// ValidateCrossDomainRequest validates that a cross-domain request is authorized
func ValidateCrossDomainRequest(c *gin.Context) bool {
	origin := c.GetHeader("Origin")
	if origin == "" {
		return false // Not a cross-domain request
	}

	// Check against configured domains
	domains := []string{
		c.GetString("DOMAIN_MARKETING_URL"),
		c.GetString("DOMAIN_DEVELOPER_URL"),
		c.GetString("DOMAIN_AI_URL"),
		c.GetString("DOMAIN_DOCS_URL"),
	}

	for _, domain := range domains {
		if domain != "" && (origin == domain || strings.HasPrefix(origin, domain)) {
			return true
		}
	}

	return false
}

// SetCORSHeaders sets appropriate CORS headers for cross-domain requests
func SetCORSHeaders(c *gin.Context, allowedOrigins []string) {
	origin := c.GetHeader("Origin")

	// Check if the origin is allowed
	allowed := false
	for _, allowedOrigin := range allowedOrigins {
		if origin == allowedOrigin || allowedOrigin == "*" {
			allowed = true
			break
		}
	}

	if allowed {
		c.Header("Access-Control-Allow-Origin", origin)
	} else {
		c.Header("Access-Control-Allow-Origin", "")
	}

	c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
	c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Authorization, X-Requested-With, X-Session-ID")
	c.Header("Access-Control-Allow-Credentials", "true")
	c.Header("Access-Control-Max-Age", "86400")

	// Handle preflight requests
	if c.Request.Method == "OPTIONS" {
		c.AbortWithStatus(http.StatusNoContent)
		return
	}
}

// GenerateSessionToken generates a signed session token
func (s *SSOService) GenerateSessionToken(session *SSOSession) (string, error) {
	// Create a simple HMAC-based token
	data := fmt.Sprintf("%s|%s|%s|%d", session.SessionID, session.UserID, session.Email, session.ExpiresAt.Unix())

	h := hmac.New(sha256.New, []byte(s.config.JWT.Secret))
	h.Write([]byte(data))
	return hex.EncodeToString(h.Sum(nil)), nil
}

// ValidateSessionToken validates a session token
func (s *SSOService) ValidateSessionToken(token string) (*SSOSession, error) {
	// This is a simplified validation
	// In production, implement proper token validation
	sessionID := strings.Split(token, "|")[0]
	return s.GetSession(sessionID)
}

// Middleware returns a gin middleware for cross-domain authentication
func (s *SSOService) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Store SSO service in context
		c.Set("sso", s)
		c.Next()
	}
}
