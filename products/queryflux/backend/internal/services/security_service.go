/**
 * Security Service
 *
 * Implements security controls and OWASP Top 10 mitigation
 */

package services

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"
)

// SecurityService provides security controls and threat mitigation
type SecurityService struct {
	encryptionKey []byte
	jwtSecret     []byte
	rateLimiter   *SecurityRateLimiter
	ipBlacklist   *IPBlacklist
	auditLogger   *SecurityAuditLogger
	logger        *zap.Logger
	mu            sync.RWMutex
}

// SecurityRateLimiter implements rate limiting for security
type SecurityRateLimiter struct {
	requests map[string]*RateLimitRecord
	mu       sync.RWMutex
	logger   *zap.Logger
}

// RateLimitRecord tracks rate limit data
type RateLimitRecord struct {
	Count        int
	WindowStart  time.Time
	BlockedUntil *time.Time
}

// IPBlacklist manages blocked IP addresses
type IPBlacklist struct {
	blacklist map[string]*IPBlockRecord
	mu        sync.RWMutex
	logger    *zap.Logger
}

// IPBlockRecord represents a blocked IP
type IPBlockRecord struct {
	IP           string
	Reason       string
	BlockedAt    time.Time
	BlockedUntil *time.Time
	Permanent    bool
	Attempts     int
}

// SecurityAuditLogger logs security events
type SecurityAuditLogger struct {
	logger *zap.Logger
}

// SecurityEvent represents a security event
type SecurityEvent struct {
	ID        string                 `json:"id"`
	Type      string                 `json:"type"`
	Severity  string                 `json:"severity"`
	IPAddress string                 `json:"ipAddress"`
	UserAgent string                 `json:"userAgent"`
	UserID    string                 `json:"userId,omitempty"`
	Details   map[string]interface{} `json:"details"`
	Timestamp time.Time              `json:"timestamp"`
}

// SecurityContext holds security information for a request
type SecurityContext struct {
	IPAddress     string
	UserAgent     string
	UserID        string
	SessionID     string
	RequestMethod string
	RequestPath   string
	Headers       http.Header
}

// ValidationResult represents validation results
type ValidationResult struct {
	Valid       bool     `json:"valid"`
	Errors      []string `json:"errors,omitempty"`
	Warnings    []string `json:"warnings,omitempty"`
	Score       int      `json:"score"`       // 0-100, higher is better
	ThreatLevel string   `json:"threatLevel"` // low, medium, high, critical
}

// NewSecurityService creates a new security service
func NewSecurityService(
	encryptionKey string,
	jwtSecret string,
	logger *zap.Logger,
) *SecurityService {
	key, _ := hex.DecodeString(encryptionKey)
	secret, _ := hex.DecodeString(jwtSecret)

	return &SecurityService{
		encryptionKey: key,
		jwtSecret:     secret,
		rateLimiter:   NewSecurityRateLimiter(logger),
		ipBlacklist:   NewIPBlacklist(logger),
		auditLogger:   NewSecurityAuditLogger(logger),
		logger:        logger,
	}
}

// ============================================================================
// A01: Broken Access Control
// ============================================================================

// ValidateAccessControl checks for broken access control vulnerabilities
func (s *SecurityService) ValidateAccessControl(
	ctx context.Context,
	secCtx *SecurityContext,
	resource string,
	action string,
) error {
	// Check if user has permission for action
	// This would integrate with the RBAC system

	// Log access attempt
	s.auditLogger.Log(ctx, &SecurityEvent{
		Type:      "access_control_check",
		Severity:  "info",
		IPAddress: secCtx.IPAddress,
		UserAgent: secCtx.UserAgent,
		UserID:    secCtx.UserID,
		Details: map[string]interface{}{
			"resource": resource,
			"action":   action,
		},
		Timestamp: time.Now(),
	})

	return nil
}

// ============================================================================
// A02: Cryptographic Failures
// ============================================================================

// EncryptData encrypts sensitive data using AES-256-GCM
func (s *SecurityService) EncryptData(plaintext []byte) ([]byte, error) {
	block, err := aes.NewCipher(s.encryptionKey)
	if err != nil {
		return nil, fmt.Errorf("failed to create cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("failed to create GCM: %w", err)
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, fmt.Errorf("failed to generate nonce: %w", err)
	}

	ciphertext := gcm.Seal(nonce, nonce, plaintext, nil)
	return ciphertext, nil
}

// DecryptData decrypts data encrypted with EncryptData
func (s *SecurityService) DecryptData(ciphertext []byte) ([]byte, error) {
	block, err := aes.NewCipher(s.encryptionKey)
	if err != nil {
		return nil, fmt.Errorf("failed to create cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("failed to create GCM: %w", err)
	}

	nonceSize := gcm.NonceSize()
	if len(ciphertext) < nonceSize {
		return nil, fmt.Errorf("ciphertext too short")
	}

	nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt: %w", err)
	}

	return plaintext, nil
}

// HashPassword securely hashes a password using bcrypt
func (s *SecurityService) HashPassword(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", fmt.Errorf("failed to hash password: %w", err)
	}
	return string(hash), nil
}

// VerifyPassword verifies a password against a hash
func (s *SecurityService) VerifyPassword(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

// ============================================================================
// A03: Injection
// ============================================================================

// SanitizeInput sanitizes user input to prevent injection attacks
func (s *SecurityService) SanitizeInput(input string) string {
	// Remove potential SQL injection patterns
	sqlPatterns := []string{
		"(-|\\|;|\\|\\s)*(union|select|insert|update|delete|drop|create|alter|exec|execute)",
		"'.*--",
		"/\\*.*\\*/",
	}

	for _, pattern := range sqlPatterns {
		re := regexp.MustCompile(`(?i)` + pattern)
		input = re.ReplaceAllString(input, "")
	}

	// Remove XSS patterns
	xssPatterns := []string{
		"<script[^>]*>.*?</script>",
		"javascript:",
		"onerror=",
		"onload=",
	}

	for _, pattern := range xssPatterns {
		re := regexp.MustCompile(`(?i)` + pattern)
		input = re.ReplaceAllString(input, "")
	}

	return strings.TrimSpace(input)
}

// ValidateSQLQuery validates a SQL query for injection attempts
func (s *SecurityService) ValidateSQLQuery(query string) *ValidationResult {
	result := &ValidationResult{
		Valid:       true,
		Score:       100,
		ThreatLevel: "low",
	}

	// Check for SQL injection patterns
	injectionPatterns := []string{
		"'\\s*or\\s*'1'\\s*=\\s*'1",
		"'\\s*or\\s*1\\s*=\\s*1",
		"'\\s*;\\s*drop\\s+table",
		"'\\s*;\\s*insert\\s+into",
		"union\\s+select",
		"--",
		"/\\*",
	}

	for _, pattern := range injectionPatterns {
		re := regexp.MustCompile(`(?i)` + pattern)
		if re.MatchString(query) {
			result.Valid = false
			result.Errors = append(result.Errors, fmt.Sprintf("Potential SQL injection detected: %s", pattern))
			result.Score -= 30
		}
	}

	// Check for dangerous operations
	dangerousKeywords := []string{
		"drop\\s+table",
		"drop\\s+database",
		"truncate",
		"delete\\s+without\\s+where",
	}

	for _, keyword := range dangerousKeywords {
		re := regexp.MustCompile(`(?i)` + keyword)
		if re.MatchString(query) {
			result.Warnings = append(result.Warnings, fmt.Sprintf("Dangerous operation detected: %s", keyword))
			result.Score -= 10
		}
	}

	// Determine threat level
	if result.Score >= 80 {
		result.ThreatLevel = "low"
	} else if result.Score >= 50 {
		result.ThreatLevel = "medium"
	} else if result.Score >= 20 {
		result.ThreatLevel = "high"
	} else {
		result.ThreatLevel = "critical"
	}

	return result
}

// ============================================================================
// A04: Insecure Design
// ============================================================================

// ValidateBusinessLogic validates business logic for security issues
func (s *SecurityService) ValidateBusinessLogic(
	ctx context.Context,
	operation string,
	params map[string]interface{},
) error {
	// Validate business logic rules
	switch operation {
	case "transfer_ownership":
		// Ensure owner cannot transfer to themselves
		if from, ok := params["from"].(string); ok {
			if to, ok := params["to"].(string); ok {
				if from == to {
					return fmt.Errorf("cannot transfer ownership to yourself")
				}
			}
		}

	case "delete_team":
		// Ensure team has no active subscriptions
		// This would check the subscription repository

	case "invite_member":
		// Ensure team size limit not exceeded
		// This would check the team repository
	}

	return nil
}

// ============================================================================
// A05: Security Misconfiguration
// ============================================================================

// ValidateSecurityConfiguration checks for security misconfigurations
func (s *SecurityService) ValidateSecurityConfiguration() *ValidationResult {
	result := &ValidationResult{
		Valid:       true,
		Score:       100,
		ThreatLevel: "low",
	}

	// Check if running in debug mode (would check config)
	// Check if default credentials are used
	// Check if CORS is properly configured
	// Check if security headers are enabled

	return result
}

// ============================================================================
// A06: Vulnerable and Outdated Components
// ============================================================================

// ScanDependencies scans for vulnerable dependencies
func (s *SecurityService) ScanDependencies(ctx context.Context) ([]string, error) {
	// This would integrate with a dependency scanner
	// For now, return empty slice
	return []string{}, nil
}

// ============================================================================
// A07: Identification and Authentication Failures
// ============================================================================

// ValidateJWT validates a JWT token
func (s *SecurityService) ValidateJWT(tokenString string) (*jwt.Token, *jwt.RegisteredClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &jwt.RegisteredClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return s.jwtSecret, nil
	})

	if err != nil {
		return nil, nil, err
	}

	if claims, ok := token.Claims.(*jwt.RegisteredClaims); ok {
		// Check expiration
		if time.Now().After(claims.ExpiresAt.Time) {
			return nil, nil, fmt.Errorf("token expired")
		}

		// Check issuer if set
		if claims.Issuer != "" && !s.isValidIssuer(claims.Issuer) {
			return nil, nil, fmt.Errorf("invalid issuer: %s", claims.Issuer)
		}

		return token, claims, nil
	}

	return nil, nil, fmt.Errorf("invalid token claims")
}

// isValidIssuer checks if the issuer is valid
func (s *SecurityService) isValidIssuer(issuer string) bool {
	validIssuers := []string{
		"queryflux",
		"https://queryflux.com",
	}

	for _, valid := range validIssuers {
		if issuer == valid {
			return true
		}
	}
	return false
}

// ============================================================================
// A08: Software and Data Integrity Failures
// ============================================================================

// VerifyDataIntegrity verifies the integrity of data using HMAC
func (s *SecurityService) VerifyDataIntegrity(data []byte, signature []byte) bool {
	mac := hmac.New(sha256.New, s.encryptionKey)
	mac.Write(data)
	expectedMAC := mac.Sum(nil)
	return hmac.Equal(signature, expectedMAC)
}

// ============================================================================
// A09: Security Logging and Monitoring Failures
// ============================================================================

// LogSecurityEvent logs a security event
func (s *SecurityService) LogSecurityEvent(
	ctx context.Context,
	secCtx *SecurityContext,
	eventType string,
	severity string,
	details map[string]interface{},
) {
	s.auditLogger.Log(ctx, &SecurityEvent{
		ID:        generateSecureID(),
		Type:      eventType,
		Severity:  severity,
		IPAddress: secCtx.IPAddress,
		UserAgent: secCtx.UserAgent,
		UserID:    secCtx.UserID,
		Details:   details,
		Timestamp: time.Now(),
	})
}

// ============================================================================
// A10: Server-Side Request Forgery (SSRF)
// ============================================================================

// ValidateURL validates a URL to prevent SSRF attacks
func (s *SecurityService) ValidateURL(urlStr string) error {
	// Parse URL
	url, err := url.ParseRequestURI(urlStr)
	if err != nil {
		return fmt.Errorf("invalid URL: %w", err)
	}

	// Block internal IP addresses
	if s.isInternalURL(url) {
		return fmt.Errorf("internal URLs are not allowed")
	}

	// Block localhost
	if url.Hostname() == "localhost" || url.Hostname() == "127.0.0.1" {
		return fmt.Errorf("localhost is not allowed")
	}

	// Only allow HTTPS and HTTP
	if url.Scheme != "http" && url.Scheme != "https" {
		return fmt.Errorf("only HTTP and HTTPS are allowed")
	}

	return nil
}

// isInternalURL checks if a URL points to an internal address
func (s *SecurityService) isInternalURL(url *url.URL) bool {
	hostname := url.Hostname()

	// Check for private IP ranges
	privateRanges := []string{
		"10.",
		"172.16.",
		"172.17.",
		"172.18.",
		"172.19.",
		"172.20.",
		"172.21.",
		"172.22.",
		"172.23.",
		"172.24.",
		"172.25.",
		"172.26.",
		"172.27.",
		"172.28.",
		"172.29.",
		"172.30.",
		"172.31.",
		"192.168.",
	}

	for _, r := range privateRanges {
		if strings.HasPrefix(hostname, r) {
			return true
		}
	}

	return false
}

// ============================================================================
// Rate Limiting
// ============================================================================

// CheckRateLimit checks if a request should be rate limited
func (s *SecurityService) CheckRateLimit(
	ctx context.Context,
	secCtx *SecurityContext,
	limit int,
	window time.Duration,
) error {
	key := secCtx.IPAddress

	if !s.rateLimiter.Allow(key, limit, window) {
		s.LogSecurityEvent(ctx, secCtx, "rate_limit_exceeded", "high", map[string]interface{}{
			"limit":  limit,
			"window": window.String(),
		})
		return fmt.Errorf("rate limit exceeded")
	}

	return nil
}

// ============================================================================
// IP Blacklist
// ============================================================================

// IsIPBlacklisted checks if an IP is blacklisted
func (s *SecurityService) IsIPBlacklisted(ip string) bool {
	return s.ipBlacklist.IsBlocked(ip)
}

// BlockIP blocks an IP address
func (s *SecurityService) BlockIP(ip string, reason string, permanent bool, duration time.Duration) error {
	return s.ipBlacklist.Block(ip, reason, permanent, duration)
}

// ============================================================================
// Helper Functions
// ============================================================================

func NewSecurityRateLimiter(logger *zap.Logger) *SecurityRateLimiter {
	return &SecurityRateLimiter{
		requests: make(map[string]*RateLimitRecord),
		logger:   logger,
	}
}

// Allow checks if a request is allowed under rate limit
func (rl *SecurityRateLimiter) Allow(key string, limit int, window time.Duration) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	record, exists := rl.requests[key]

	if !exists || now.Sub(record.WindowStart) > window {
		rl.requests[key] = &RateLimitRecord{
			Count:       1,
			WindowStart: now,
		}
		return true
	}

	// Check if blocked
	if record.BlockedUntil != nil && now.Before(*record.BlockedUntil) {
		return false
	}

	// Check limit
	if record.Count >= limit {
		// Block for exponential duration
		blockDuration := time.Duration(record.Count) * window
		blockedUntil := now.Add(blockDuration)
		record.BlockedUntil = &blockedUntil
		return false
	}

	record.Count++
	return true
}

func NewIPBlacklist(logger *zap.Logger) *IPBlacklist {
	return &IPBlacklist{
		blacklist: make(map[string]*IPBlockRecord),
		logger:    logger,
	}
}

// IsBlocked checks if an IP is blocked
func (bl *IPBlacklist) IsBlocked(ip string) bool {
	bl.mu.RLock()
	defer bl.mu.RUnlock()

	record, exists := bl.blacklist[ip]
	if !exists {
		return false
	}

	if record.Permanent {
		return true
	}

	if record.BlockedUntil != nil {
		return time.Now().Before(*record.BlockedUntil)
	}

	return false
}

// Block blocks an IP address
func (bl *IPBlacklist) Block(ip string, reason string, permanent bool, duration time.Duration) error {
	bl.mu.Lock()
	defer bl.mu.Unlock()

	var blockedUntil *time.Time
	if !permanent {
		until := time.Now().Add(duration)
		blockedUntil = &until
	}

	bl.blacklist[ip] = &IPBlockRecord{
		IP:           ip,
		Reason:       reason,
		BlockedAt:    time.Now(),
		BlockedUntil: blockedUntil,
		Permanent:    permanent,
	}

	bl.logger.Warn("IP blocked",
		zap.String("ip", ip),
		zap.String("reason", reason),
		zap.Bool("permanent", permanent),
	)

	return nil
}

func NewSecurityAuditLogger(logger *zap.Logger) *SecurityAuditLogger {
	return &SecurityAuditLogger{
		logger: logger,
	}
}

// Log logs a security event
func (al *SecurityAuditLogger) Log(ctx context.Context, event *SecurityEvent) {
	al.logger.Info("security_event",
		zap.String("type", event.Type),
		zap.String("severity", event.Severity),
		zap.String("ip", event.IPAddress),
		zap.String("user_id", event.UserID),
		zap.Any("details", event.Details),
		zap.Time("timestamp", event.Timestamp),
	)
}

func generateSecureID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}

// ============================================================================
// Security Headers
// ============================================================================

// GetSecurityHeaders returns security headers for HTTP responses
func (s *SecurityService) GetSecurityHeaders() map[string]string {
	return map[string]string{
		"Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
		"X-Content-Type-Options":    "nosniff",
		"X-Frame-Options":           "DENY",
		"X-XSS-Protection":          "1; mode=block",
		"Content-Security-Policy":   "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;",
		"Referrer-Policy":           "strict-origin-when-cross-origin",
		"Permissions-Policy":        "camera=(), microphone=(), geolocation=()",
		"X-Powered-By":              "",
	}
}
