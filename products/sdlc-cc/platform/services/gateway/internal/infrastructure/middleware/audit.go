package middleware

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5/middleware"
	"github.com/google/uuid"
	"github.com/sirupsen/logrus"

	"github.com/sdlc-ai/platform/services/gateway/internal/domain/services"
)

// AuditMiddleware provides audit logging for HTTP requests
type AuditMiddleware struct {
	auditService services.AuditService
	logger       *logrus.Logger
	// Config options
	skipPaths         []string
	skipHealthCheck   bool
	logRequestBody    bool
	logResponseBody   bool
	maskSensitiveData bool
}

// AuditMiddlewareConfig configures the audit middleware
type AuditMiddlewareConfig struct {
	SkipPaths         []string
	SkipHealthCheck   bool
	LogRequestBody    bool
	LogResponseBody   bool
	MaskSensitiveData bool
	SensitiveFields   []string // Fields to mask in logs
}

// DefaultAuditMiddlewareConfig returns default configuration
func DefaultAuditMiddlewareConfig() AuditMiddlewareConfig {
	return AuditMiddlewareConfig{
		SkipPaths: []string{
			"/healthz",
			"/health",
			"/metrics",
			"/readyz",
			"/livez",
		},
		SkipHealthCheck:   true,
		LogRequestBody:    false,
		LogResponseBody:   false,
		MaskSensitiveData: true,
		SensitiveFields: []string{
			"password", "token", "secret", "api_key", "credit_card",
			"ssn", "social_security", "pin", "authorization",
		},
	}
}

// NewAuditMiddleware creates a new audit middleware
func NewAuditMiddleware(
	auditService services.AuditService,
	logger *logrus.Logger,
	config AuditMiddlewareConfig,
) *AuditMiddleware {
	if logger == nil {
		logger = logrus.New()
	}

	return &AuditMiddleware{
		auditService:      auditService,
		logger:            logger,
		skipPaths:         config.SkipPaths,
		skipHealthCheck:   config.SkipHealthCheck,
		logRequestBody:    config.LogRequestBody,
		logResponseBody:   config.LogResponseBody,
		maskSensitiveData: config.MaskSensitiveData,
	}
}

// Middleware returns the chi middleware function for audit logging
func (a *AuditMiddleware) Middleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Check if we should skip this path
			if a.shouldSkipPath(r.URL.Path) {
				next.ServeHTTP(w, r)
				return
			}

			// Start timing
			start := time.Now()

			// Wrap response writer to capture status and size
			wrapped := &auditResponseWriter{
				ResponseWriter: w,
				statusCode:     http.StatusOK,
			}

			// Store original body if we need to log it
			var bodyBytes []byte
			if a.logRequestBody && r.Body != nil {
				bodyBytes, _ = r.Body.(interface {
					ReadAll() ([]byte, error)
				}).ReadAll()
			}

			// Process request
			next.ServeHTTP(wrapped, r)

			// Calculate duration
			duration := time.Since(start)

			// Log the request asynchronously
			go a.logRequest(r, wrapped, duration, bodyBytes)
		})
	}
}

// logRequest logs the request details
func (a *AuditMiddleware) logRequest(r *http.Request, w *auditResponseWriter, duration time.Duration, bodyBytes []byte) {
	ctx := r.Context()

	// Extract user information from context
	userID := a.extractUserID(ctx)
	tenantID := a.extractTenantID(ctx)

	// If no tenant ID, skip logging (not an authenticated request)
	if tenantID == uuid.Nil {
		return
	}

	// Create audit event details
	details := a.buildRequestDetails(r, w, duration, bodyBytes)

	// Determine action based on method and path
	action := a.determineAction(r.Method, r.URL.Path)

	// Extract IP address
	ipAddress := a.getClientIP(r)

	// Create context for audit service
	auditCtx := context.WithValue(context.Background(), "user_id", userID)
	auditCtx = context.WithValue(auditCtx, "ip_address", ipAddress)
	auditCtx = context.WithValue(auditCtx, "user_agent", r.UserAgent())

	// Log the action
	if err := a.auditService.LogAction(auditCtx, tenantID, action, details); err != nil {
		a.logger.WithError(err).WithFields(logrus.Fields{
			"tenant_id": tenantID,
			"action":    action,
		}).Error("Failed to log audit entry")
	}

	// Additional logging for sensitive operations
	if a.isSensitiveOperation(r.Method, r.URL.Path) {
		a.logger.WithFields(logrus.Fields{
			"audit_id":   uuid.New().String(),
			"tenant_id":  tenantID.String(),
			"user_id":    userID.String(),
			"method":     r.Method,
			"path":       r.URL.Path,
			"status":     w.statusCode,
			"ip_address": ipAddress.String(),
			"user_agent": r.UserAgent(),
			"duration":   duration.String(),
		}).Info("Sensitive operation audited")
	}
}

// buildRequestDetails constructs the details map for the audit log
func (a *AuditMiddleware) buildRequestDetails(r *http.Request, w *auditResponseWriter, duration time.Duration, bodyBytes []byte) map[string]interface{} {
	details := make(map[string]interface{})

	details["method"] = r.Method
	details["path"] = r.URL.Path
	details["query_params"] = r.URL.RawQuery
	details["status_code"] = w.statusCode
	details["duration_ms"] = duration.Milliseconds()
	details["request_id"] = middleware.GetReqID(r.Context())

	// Add headers (sanitized)
	headers := make(map[string]string)
	for name, values := range r.Header {
		if !a.isSensitiveHeader(name) {
			headers[name] = strings.Join(values, ", ")
		} else {
			headers[name] = "***REDACTED***"
		}
	}
	details["headers"] = headers

	// Add body if enabled
	if a.logRequestBody && len(bodyBytes) > 0 {
		if a.maskSensitiveData {
			details["body"] = a.maskSensitiveFields(bodyBytes)
		} else {
			details["body"] = string(bodyBytes)
		}
	}

	// Add response size
	details["response_size_bytes"] = w.responseSize

	return details
}

// AuditAuthMiddleware logs authentication events
type AuditAuthMiddleware struct {
	auditService services.AuditService
	logger       *logrus.Logger
}

// NewAuditAuthMiddleware creates middleware for logging authentication events
func NewAuditAuthMiddleware(auditService services.AuditService, logger *logrus.Logger) *AuditAuthMiddleware {
	if logger == nil {
		logger = logrus.New()
	}
	return &AuditAuthMiddleware{
		auditService: auditService,
		logger:       logger,
	}
}

// LogLogin logs a successful login
func (m *AuditAuthMiddleware) LogLogin(ctx context.Context, event services.AuthEvent) error {
	event.EventType = "login"
	event.Success = true
	event.Timestamp = time.Now()

	if err := m.auditService.LogAuthentication(ctx, event); err != nil {
		m.logger.WithError(err).WithField("user_id", event.UserID).Error("Failed to log login")
		return err
	}

	m.logger.WithFields(logrus.Fields{
		"user_id":    event.UserID,
		"tenant_id":  event.TenantID,
		"ip_address": event.IPAddress.String(),
		"method":     event.LoginMethod,
	}).Info("Login successful")

	return nil
}

// LogFailedLogin logs a failed login attempt
func (m *AuditAuthMiddleware) LogFailedLogin(ctx context.Context, tenantID, userID uuid.UUID, reason string, ipAddress net.IP, userAgent string) error {
	event := services.AuthEvent{
		TenantID:      tenantID,
		UserID:        userID,
		EventType:     "login",
		Success:       false,
		FailureReason: reason,
		IPAddress:     ipAddress,
		UserAgent:     userAgent,
		Timestamp:     time.Now(),
	}

	if err := m.auditService.LogAuthentication(ctx, event); err != nil {
		m.logger.WithError(err).WithField("user_id", userID).Error("Failed to log failed login")
		return err
	}

	m.logger.WithFields(logrus.Fields{
		"user_id":    userID,
		"tenant_id":  tenantID,
		"reason":     reason,
		"ip_address": ipAddress.String(),
	}).Warn("Failed login attempt logged")

	return nil
}

// LogLogout logs a logout event
func (m *AuditAuthMiddleware) LogLogout(ctx context.Context, tenantID, userID uuid.UUID, ipAddress net.IP, userAgent string) error {
	event := services.AuthEvent{
		TenantID:  tenantID,
		UserID:    userID,
		EventType: "logout",
		Success:   true,
		IPAddress: ipAddress,
		UserAgent: userAgent,
		Timestamp: time.Now(),
	}

	if err := m.auditService.LogAuthentication(ctx, event); err != nil {
		m.logger.WithError(err).WithField("user_id", userID).Error("Failed to log logout")
		return err
	}

	return nil
}

// AuditAuthorizationMiddleware logs authorization events
type AuditAuthorizationMiddleware struct {
	auditService services.AuditService
	logger       *logrus.Logger
}

// NewAuditAuthorizationMiddleware creates middleware for logging authorization events
func NewAuditAuthorizationMiddleware(auditService services.AuditService, logger *logrus.Logger) *AuditAuthorizationMiddleware {
	if logger == nil {
		logger = logrus.New()
	}
	return &AuditAuthorizationMiddleware{
		auditService: auditService,
		logger:       logger,
	}
}

// LogAccessGranted logs successful authorization
func (m *AuditAuthorizationMiddleware) LogAccessGranted(ctx context.Context, event services.AuthzEvent) error {
	event.Decision = "allow"
	event.Timestamp = time.Now()

	if err := m.auditService.LogAuthorization(ctx, event); err != nil {
		m.logger.WithError(err).Error("Failed to log authorization grant")
		return err
	}

	return nil
}

// LogAccessDenied logs denied authorization
func (m *AuditAuthorizationMiddleware) LogAccessDenied(ctx context.Context, event services.AuthzEvent) error {
	event.Decision = "deny"
	event.Timestamp = time.Now()

	if err := m.auditService.LogAuthorization(ctx, event); err != nil {
		m.logger.WithError(err).Error("Failed to log authorization denial")
		return err
	}

	m.logger.WithFields(logrus.Fields{
		"tenant_id":     event.TenantID,
		"user_id":       event.UserID,
		"resource_type": event.ResourceType,
		"resource_id":   event.ResourceID,
		"action":        event.Action,
		"reason":        event.DeniedReason,
		"ip_address":    event.IPAddress.String(),
	}).Warn("Access denied")

	return nil
}

// AuditDataAccessMiddleware logs data access events
type AuditDataAccessMiddleware struct {
	auditService services.AuditService
	logger       *logrus.Logger
}

// NewAuditDataAccessMiddleware creates middleware for logging data access events
func NewAuditDataAccessMiddleware(auditService services.AuditService, logger *logrus.Logger) *AuditDataAccessMiddleware {
	if logger == nil {
		logger = logrus.New()
	}
	return &AuditDataAccessMiddleware{
		auditService: auditService,
		logger:       logger,
	}
}

// LogDocumentRead logs document read operations
func (m *AuditDataAccessMiddleware) LogDocumentRead(ctx context.Context, event services.DataAccessEvent) error {
	event.Operation = "read"
	event.Timestamp = time.Now()

	if err := m.auditService.LogDataAccess(ctx, event); err != nil {
		m.logger.WithError(err).Error("Failed to log document read")
		return err
	}

	return nil
}

// LogDocumentWrite logs document write operations
func (m *AuditDataAccessMiddleware) LogDocumentWrite(ctx context.Context, event services.DataAccessEvent) error {
	event.Operation = "write"
	event.Timestamp = time.Now()

	if err := m.auditService.LogDataAccess(ctx, event); err != nil {
		m.logger.WithError(err).Error("Failed to log document write")
		return err
	}

	m.logger.WithFields(logrus.Fields{
		"tenant_id":     event.TenantID,
		"user_id":       event.UserID,
		"resource_type": event.ResourceType,
		"resource_id":   event.ResourceID,
		"sensitivity":   event.DataSensitivity,
	}).Info("Document write logged")

	return nil
}

// LogDocumentDelete logs document delete operations
func (m *AuditDataAccessMiddleware) LogDocumentDelete(ctx context.Context, event services.DataAccessEvent) error {
	event.Operation = "delete"
	event.Timestamp = time.Now()

	if err := m.auditService.LogDataAccess(ctx, event); err != nil {
		m.logger.WithError(err).Error("Failed to log document delete")
		return err
	}

	m.logger.WithFields(logrus.Fields{
		"tenant_id":     event.TenantID,
		"user_id":       event.UserID,
		"resource_type": event.ResourceType,
		"resource_id":   event.ResourceID,
	}).Warn("Document delete logged")

	return nil
}

// AuditAdminMiddleware logs administrative actions
type AuditAdminMiddleware struct {
	auditService services.AuditService
	logger       *logrus.Logger
}

// NewAuditAdminMiddleware creates middleware for logging admin actions
func NewAuditAdminMiddleware(auditService services.AuditService, logger *logrus.Logger) *AuditAdminMiddleware {
	if logger == nil {
		logger = logrus.New()
	}
	return &AuditAdminMiddleware{
		auditService: auditService,
		logger:       logger,
	}
}

// LogUserModification logs user modification actions
func (m *AuditAdminMiddleware) LogUserModification(ctx context.Context, event services.AdminEvent) error {
	event.Action = "user_modified"
	event.Timestamp = time.Now()

	if err := m.auditService.LogAdminAction(ctx, event); err != nil {
		m.logger.WithError(err).Error("Failed to log user modification")
		return err
	}

	m.logger.WithFields(logrus.Fields{
		"tenant_id":   event.TenantID,
		"admin_id":    event.UserID,
		"target_type": event.TargetType,
		"target_id":   event.TargetID,
		"reason":      event.Reason,
	}).Info("User modification logged")

	return nil
}

// LogUserDeletion logs user deletion actions
func (m *AuditAdminMiddleware) LogUserDeletion(ctx context.Context, event services.AdminEvent) error {
	event.Action = "user_deleted"
	event.Timestamp = time.Now()

	if err := m.auditService.LogAdminAction(ctx, event); err != nil {
		m.logger.WithError(err).Error("Failed to log user deletion")
		return err
	}

	m.logger.WithFields(logrus.Fields{
		"tenant_id": event.TenantID,
		"admin_id":  event.UserID,
		"target_id": event.TargetID,
		"reason":    event.Reason,
	}).Warn("User deletion logged")

	return nil
}

// LogTenantModification logs tenant modification actions
func (m *AuditAdminMiddleware) LogTenantModification(ctx context.Context, event services.AdminEvent) error {
	event.Action = "tenant_modified"
	event.Timestamp = time.Now()

	if err := m.auditService.LogAdminAction(ctx, event); err != nil {
		m.logger.WithError(err).Error("Failed to log tenant modification")
		return err
	}

	m.logger.WithFields(logrus.Fields{
		"tenant_id": event.TenantID,
		"admin_id":  event.UserID,
		"target_id": event.TargetID,
	}).Info("Tenant modification logged")

	return nil
}

// LogPolicyChange logs policy changes
func (m *AuditAdminMiddleware) LogPolicyChange(ctx context.Context, event services.AdminEvent) error {
	event.Action = "policy_changed"
	event.Timestamp = time.Now()

	if err := m.auditService.LogAdminAction(ctx, event); err != nil {
		m.logger.WithError(err).Error("Failed to log policy change")
		return err
	}

	m.logger.WithFields(logrus.Fields{
		"tenant_id": event.TenantID,
		"admin_id":  event.UserID,
		"target_id": event.TargetID,
	}).Info("Policy change logged")

	return nil
}

// Helper methods

// auditResponseWriter wraps http.ResponseWriter to capture status code and response size
type auditResponseWriter struct {
	http.ResponseWriter
	statusCode   int
	responseSize int64
}

func (w *auditResponseWriter) WriteHeader(statusCode int) {
	w.statusCode = statusCode
	w.ResponseWriter.WriteHeader(statusCode)
}

func (w *auditResponseWriter) Write(b []byte) (int, error) {
	n, err := w.ResponseWriter.Write(b)
	w.responseSize += int64(n)
	return n, err
}

func (a *AuditMiddleware) shouldSkipPath(path string) bool {
	for _, skipPath := range a.skipPaths {
		if strings.HasPrefix(path, skipPath) {
			return true
		}
	}
	return false
}

func (a *AuditMiddleware) extractUserID(ctx context.Context) uuid.UUID {
	if userID, ok := ctx.Value("user_id").(uuid.UUID); ok {
		return userID
	}
	return uuid.Nil
}

func (a *AuditMiddleware) extractTenantID(ctx context.Context) uuid.UUID {
	if tenantID, ok := ctx.Value("tenant_id").(uuid.UUID); ok {
		return tenantID
	}
	return uuid.Nil
}

func (a *AuditMiddleware) determineAction(method, path string) string {
	// Determine action based on HTTP method and path
	parts := strings.Split(strings.Trim(path, "/"), "/")

	var resourceType string
	if len(parts) > 0 {
		resourceType = parts[0]
	}

	actionMap := map[string]string{
		"GET":    "read",
		"POST":   "create",
		"PUT":    "update",
		"PATCH":  "update",
		"DELETE": "delete",
	}

	if action, ok := actionMap[method]; ok {
		if resourceType != "" {
			return fmt.Sprintf("%s.%s", resourceType, action)
		}
		return action
	}

	return "unknown"
}

func (a *AuditMiddleware) getClientIP(r *http.Request) net.IP {
	// Check X-Forwarded-For header first
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		ips := strings.Split(xff, ",")
		if ip := net.ParseIP(strings.TrimSpace(ips[0])); ip != nil {
			return ip
		}
	}

	// Check X-Real-IP header
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		if ip := net.ParseIP(xri); ip != nil {
			return ip
		}
	}

	// Parse RemoteAddr
	if ip, _, err := net.SplitHostPort(r.RemoteAddr); err == nil {
		if parsedIP := net.ParseIP(ip); parsedIP != nil {
			return parsedIP
		}
	}

	return nil
}

func (a *AuditMiddleware) isSensitiveOperation(method, path string) bool {
	sensitivePaths := []string{
		"/api/v1/users",
		"/api/v1/admin",
		"/api/v1/policies",
		"/api/v1/config",
		"/api/v1/api-keys",
	}

	for _, sp := range sensitivePaths {
		if strings.HasPrefix(path, sp) {
			return true
		}
	}

	// All non-GET requests are considered sensitive
	return method != "GET"
}

func (a *AuditMiddleware) isSensitiveHeader(name string) bool {
	sensitiveHeaders := []string{
		"authorization", "cookie", "set-cookie",
		"x-api-key", "x-auth-token",
	}

	lowerName := strings.ToLower(name)
	for _, sh := range sensitiveHeaders {
		if lowerName == strings.ToLower(sh) {
			return true
		}
	}
	return false
}

func (a *AuditMiddleware) maskSensitiveFields(data []byte) string {
	var obj map[string]interface{}
	if err := json.Unmarshal(data, &obj); err != nil {
		return string(data) // Return original if not valid JSON
	}

	sensitiveFields := []string{
		"password", "token", "secret", "api_key", "credit_card",
		"ssn", "social_security", "pin", "authorization",
	}

	for key, value := range obj {
		for _, sensitive := range sensitiveFields {
			if strings.Contains(strings.ToLower(key), sensitive) {
				obj[key] = "***REDACTED***"
				break
			}
			// Recursively mask nested objects
			if nestedObj, ok := value.(map[string]interface{}); ok {
				obj[key] = a.maskSensitiveMap(nestedObj, sensitiveFields)
			}
		}
	}

	masked, _ := json.Marshal(obj)
	return string(masked)
}

func (a *AuditMiddleware) maskSensitiveMap(obj map[string]interface{}, sensitiveFields []string) map[string]interface{} {
	for key, value := range obj {
		for _, sensitive := range sensitiveFields {
			if strings.Contains(strings.ToLower(key), sensitive) {
				obj[key] = "***REDACTED***"
				break
			}
			if nestedObj, ok := value.(map[string]interface{}); ok {
				obj[key] = a.maskSensitiveMap(nestedObj, sensitiveFields)
			}
		}
	}
	return obj
}
