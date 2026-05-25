//go:build ignore

package middleware

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/render"
	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/config"
)

const (
	policyDecisionAllowed   = "allow"
	policyDecisionDenied    = "deny"
	policyDecisionError     = "error"
	policyEvaluationTimeout = 5 * time.Second
)

// PolicyEvaluator defines the interface for policy evaluation
type PolicyEvaluator interface {
	EvaluatePolicy(ctx context.Context, input PolicyEvaluationInput) (*PolicyEvaluationResult, error)
	EvaluateBatch(ctx context.Context, inputs []PolicyEvaluationInput) ([]*PolicyEvaluationResult, error)
	HealthCheck(ctx context.Context) error
	InvalidateCache(ctx context.Context, pattern string) error
}

// PolicyEvaluationInput represents the input for policy evaluation
type PolicyEvaluationInput struct {
	TenantID    uuid.UUID              `json:"tenant_id"`
	UserID      uuid.UUID              `json:"user_id"`
	Role        string                 `json:"role,omitempty"`
	Action      string                 `json:"action"`
	Resource    string                 `json:"resource"`
	Path        string                 `json:"path"`
	Method      string                 `json:"method"`
	IP          string                 `json:"ip,omitempty"`
	UserAgent   string                 `json:"user_agent,omitempty"`
	Headers     map[string]string      `json:"headers,omitempty"`
	QueryParams map[string]string      `json:"query_params,omitempty"`
	RequestBody map[string]interface{} `json:"request_body,omitempty"`
	Context     map[string]interface{} `json:"context,omitempty"`
	RequestID   string                 `json:"request_id"`
	Timestamp   string                 `json:"timestamp"`
}

// CacheKey generates a cache key for the policy evaluation input
func (p PolicyEvaluationInput) CacheKey() string {
	return fmt.Sprintf("policy:%s:%s:%s:%s", p.TenantID, p.UserID, p.Action, p.Resource)
}

// PolicyEvaluationResult represents the result of policy evaluation
type PolicyEvaluationResult struct {
	Allowed           bool                   `json:"allowed"`
	Decision          string                 `json:"decision"`
	Reason            string                 `json:"reason,omitempty"`
	Conditions        []PolicyCondition      `json:"conditions,omitempty"`
	PoliciesEvaluated []string               `json:"policies_evaluated,omitempty"`
	ExecutionTime     time.Duration          `json:"execution_time"`
	CacheHit          bool                   `json:"cache_hit"`
	Metrics           PolicyMetrics          `json:"metrics,omitempty"`
	RawOutput         map[string]interface{} `json:"raw_output,omitempty"`
}

// PolicyCondition represents a policy condition
type PolicyCondition struct {
	Name        string                 `json:"name"`
	Type        string                 `json:"type"`
	Value       interface{}            `json:"value"`
	Description string                 `json:"description,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// PolicyMetrics represents policy evaluation metrics
type PolicyMetrics struct {
	EvaluationsTotal int64         `json:"evaluations_total"`
	CacheHitRate     float64       `json:"cache_hit_rate"`
	AvgLatency       time.Duration `json:"avg_latency"`
	LastEvaluation   time.Time     `json:"last_evaluation"`
}

// PolicyDecisionLogger defines the interface for logging policy decisions
type PolicyDecisionLogger interface {
	LogDecision(ctx context.Context, decision *PolicyDecisionLog) error
	LogBatch(ctx context.Context, decisions []*PolicyDecisionLog) error
}

// PolicyDecisionLog represents a policy decision log entry
type PolicyDecisionLog struct {
	ID              uuid.UUID              `json:"id"`
	TenantID        uuid.UUID              `json:"tenant_id"`
	UserID          uuid.UUID              `json:"user_id"`
	RequestID       string                 `json:"request_id"`
	Action          string                 `json:"action"`
	Resource        string                 `json:"resource"`
	Path            string                 `json:"path"`
	Method          string                 `json:"method"`
	Decision        string                 `json:"decision"`
	Reason          string                 `json:"reason,omitempty"`
	InputData       map[string]interface{} `json:"input_data,omitempty"`
	OutputData      map[string]interface{} `json:"output_data,omitempty"`
	ExecutionTimeMs int                    `json:"execution_time_ms"`
	CacheHit        bool                   `json:"cache_hit"`
	Timestamp       time.Time              `json:"timestamp"`
	IPAddress       string                 `json:"ip_address,omitempty"`
	UserAgent       string                 `json:"user_agent,omitempty"`
}

// PolicyEnforcementConfig holds configuration for policy enforcement
type PolicyEnforcementConfig struct {
	Enabled           bool          `json:"enabled"`
	OPAEnabled        bool          `json:"opa_enabled"`
	DecisionLogging   bool          `json:"decision_logging"`
	CacheEnabled      bool          `json:"cache_enabled"`
	CacheTTL          time.Duration `json:"cache_ttl"`
	EvaluationTimeout time.Duration `json:"evaluation_timeout"`
	DenyByDefault     bool          `json:"deny_by_default"`
	SkipPaths         []string      `json:"skip_paths"`
	MetricsEnabled    bool          `json:"metrics_enabled"`
}

// DefaultPolicyEnforcementConfig returns default configuration
func DefaultPolicyEnforcementConfig() PolicyEnforcementConfig {
	return PolicyEnforcementConfig{
		Enabled:           true,
		OPAEnabled:        true,
		DecisionLogging:   true,
		CacheEnabled:      true,
		CacheTTL:          5 * time.Minute,
		EvaluationTimeout: policyEvaluationTimeout,
		DenyByDefault:     true,
		SkipPaths: []string{
			"/health",
			"/healthz",
			"/ready",
			"/readyz",
			"/live",
			"/livez",
			"/metrics",
			"/version",
			"/favicon.ico",
			"/swagger",
			"/docs",
			"/openapi",
		},
		MetricsEnabled: true,
	}
}

// PolicyEnforcementMiddleware creates a policy enforcement middleware
func PolicyEnforcementMiddleware(
	evaluator PolicyEvaluator,
	logger *logrus.Logger,
	decisionLogger PolicyDecisionLogger,
	cfg *config.Config,
) func(http.Handler) http.Handler {
	config := DefaultPolicyEnforcementConfig()

	// Override with config if available
	if cfg != nil && cfg.Monitoring.Enabled {
		config.MetricsEnabled = true
	}

	tracer := otel.Tracer("policy-enforcement")

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := r.Context()
			startTime := time.Now()

			// Check if policy enforcement is enabled
			if !config.Enabled {
				next.ServeHTTP(w, r)
				return
			}

			// Skip policy evaluation for public paths
			if shouldSkipPolicyEnforcement(r.URL.Path, config.SkipPaths) {
				next.ServeHTTP(w, r)
				return
			}

			// Start tracing span
			ctx, span := tracer.Start(ctx, "PolicyEnforcement",
				trace.WithAttributes(
					attribute.String("http.method", r.Method),
					attribute.String("http.path", r.URL.Path),
					attribute.String("http.host", r.Host),
				),
			)
			defer span.End()

			// Extract context from request
			tenantID, userID, role := extractAuthContext(ctx, r)
			requestID := getRequestID(r)

			// If no auth context, deny request
			if tenantID == uuid.Nil {
				span.SetAttributes(attribute.String("policy.decision", policyDecisionDenied))
				span.SetAttributes(attribute.String("policy.reason", "missing_authentication"))

				logger.WithFields(logrus.Fields{
					"request_id": requestID,
					"path":       r.URL.Path,
					"method":     r.Method,
				}).Warn("Policy enforcement denied: missing authentication")

				render.Status(r, http.StatusUnauthorized)
				render.JSON(w, r, map[string]interface{}{
					"error": map[string]interface{}{
						"code":    "UNAUTHORIZED",
						"message": "Authentication required",
					},
					"meta": map[string]interface{}{
						"timestamp":  time.Now().UTC().Format(time.RFC3339),
						"request_id": requestID,
					},
				})
				return
			}

			// Build policy evaluation input
			input := buildPolicyEvaluationInput(r, tenantID, userID, role, requestID)

			// Evaluate policy
			evaluationCtx, cancel := context.WithTimeout(ctx, config.EvaluationTimeout)
			defer cancel()

			result, err := evaluator.EvaluatePolicy(evaluationCtx, input)
			executionTime := time.Since(startTime)

			if err != nil {
				span.SetAttributes(attribute.String("policy.decision", policyDecisionError))
				span.SetAttributes(attribute.String("policy.error", err.Error()))
				span.RecordError(err)

				logger.WithFields(logrus.Fields{
					"tenant_id":   tenantID,
					"user_id":     userID,
					"request_id":  requestID,
					"path":        r.URL.Path,
					"method":      r.Method,
					"error":       err.Error(),
					"duration_ms": executionTime.Milliseconds(),
				}).Error("Policy evaluation failed")

				// Deny by default on error if configured
				if config.DenyByDefault {
					logDecision(ctx, decisionLogger, input, nil, false, err.Error(), executionTime, r, config)
					render.Status(r, http.StatusForbidden)
					render.JSON(w, r, map[string]interface{}{
						"error": map[string]interface{}{
							"code":    "POLICY_EVALUATION_ERROR",
							"message": "Unable to evaluate policy",
						},
						"meta": map[string]interface{}{
							"timestamp":  time.Now().UTC().Format(time.RFC3339),
							"request_id": requestID,
						},
					})
					return
				}
			}

			// Log the decision
			if config.DecisionLogging {
				go logDecision(ctx, decisionLogger, input, result, result != nil && result.Allowed, result.Reason, executionTime, r, config)
			}

			// Update span attributes
			if result != nil {
				span.SetAttributes(attribute.String("policy.decision", result.Decision))
				span.SetAttributes(attribute.Bool("policy.allowed", result.Allowed))
				span.SetAttributes(attribute.Bool("policy.cache_hit", result.CacheHit))
				span.SetAttributes(attribute.Int("policy.execution_time_ms", int(executionTime.Milliseconds())))

				if result.Reason != "" {
					span.SetAttributes(attribute.String("policy.reason", result.Reason))
				}
			}

			// Check if request is allowed
			if result == nil || !result.Allowed {
				reason := policyDecisionDenied
				if result != nil && result.Reason != "" {
					reason = result.Reason
				}

				logger.WithFields(logrus.Fields{
					"tenant_id":   tenantID,
					"user_id":     userID,
					"role":        role,
					"request_id":  requestID,
					"path":        r.URL.Path,
					"method":      r.Method,
					"decision":    reason,
					"duration_ms": executionTime.Milliseconds(),
					"cache_hit":   result != nil && result.CacheHit,
				}).Info("Policy enforcement denied")

				// Set policy-related headers
				w.Header().Set("X-Policy-Decision", "deny")
				w.Header().Set("X-Policy-Reason", reason)

				render.Status(r, http.StatusForbidden)
				render.JSON(w, r, map[string]interface{}{
					"error": map[string]interface{}{
						"code":    "ACCESS_DENIED",
						"message": "Access denied by policy",
						"details": map[string]interface{}{
							"reason": reason,
						},
					},
					"meta": map[string]interface{}{
						"timestamp":  time.Now().UTC().Format(time.RFC3339),
						"request_id": requestID,
					},
				})
				return
			}

			// Request is allowed - add policy headers and continue
			w.Header().Set("X-Policy-Decision", "allow")
			if result.Reason != "" {
				w.Header().Set("X-Policy-Reason", result.Reason)
			}

			logger.WithFields(logrus.Fields{
				"tenant_id":   tenantID,
				"user_id":     userID,
				"role":        role,
				"request_id":  requestID,
				"path":        r.URL.Path,
				"method":      r.Method,
				"decision":    policyDecisionAllowed,
				"duration_ms": executionTime.Milliseconds(),
				"cache_hit":   result.CacheHit,
			}).Debug("Policy enforcement allowed")

			// Store decision in context for downstream handlers
			ctx = context.WithValue(ctx, "policy_decision", result)
			ctx = context.WithValue(ctx, "policy_evaluated_at", startTime)

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// extractAuthContext extracts tenant ID, user ID, and role from the request context
func extractAuthContext(ctx context.Context, r *http.Request) (tenantID, userID uuid.UUID, role string) {
	// Try to get from context first
	if tenantIDVal := ctx.Value("tenant_id"); tenantIDVal != nil {
		if tid, ok := tenantIDVal.(uuid.UUID); ok {
			tenantID = tid
		}
	}
	if userIDVal := ctx.Value("user_id"); userIDVal != nil {
		if uid, ok := userIDVal.(uuid.UUID); ok {
			userID = uid
		}
	}
	if roleVal := ctx.Value("user_role"); roleVal != nil {
		if r, ok := roleVal.(string); ok {
			role = r
		}
	}

	// Try headers as fallback
	if tenantID == uuid.Nil {
		if tenantHeader := r.Header.Get("X-Tenant-ID"); tenantHeader != "" {
			if tid, err := uuid.Parse(tenantHeader); err == nil {
				tenantID = tid
			}
		}
	}

	if userID == uuid.Nil {
		if userHeader := r.Header.Get("X-User-ID"); userHeader != "" {
			if uid, err := uuid.Parse(userHeader); err == nil {
				userID = uid
			}
		}
	}

	if role == "" {
		role = r.Header.Get("X-User-Role")
	}

	return
}

// getRequestID extracts or generates a request ID
func getRequestID(r *http.Request) string {
	if requestID := r.Header.Get("X-Request-ID"); requestID != "" {
		return requestID
	}
	return uuid.New().String()
}

// buildPolicyEvaluationInput builds the policy evaluation input from the request
func buildPolicyEvaluationInput(r *http.Request, tenantID, userID uuid.UUID, role, requestID string) PolicyEvaluationInput {
	// Extract relevant headers
	headers := make(map[string]string)
	relevantHeaders := []string{
		"Authorization", "Content-Type", "Accept", "User-Agent",
		"X-Forwarded-For", "X-Real-IP", "Origin", "Referer",
	}
	for _, header := range relevantHeaders {
		if val := r.Header.Get(header); val != "" {
			headers[header] = val
		}
	}

	// Extract query parameters
	queryParams := make(map[string]string)
	for key, values := range r.URL.Query() {
		if len(values) > 0 {
			queryParams[key] = values[0]
		}
	}

	// Determine action from method and path
	action := determineAction(r.Method, r.URL.Path)

	return PolicyEvaluationInput{
		TenantID:    tenantID,
		UserID:      userID,
		Role:        role,
		Action:      action,
		Resource:    r.URL.Path,
		Path:        r.URL.Path,
		Method:      r.Method,
		IP:          getClientIP(r),
		UserAgent:   r.UserAgent(),
		Headers:     headers,
		QueryParams: queryParams,
		Context: map[string]interface{}{
			"scheme":      getScheme(r),
			"host":        r.Host,
			"remote_addr": r.RemoteAddr,
		},
		RequestID: requestID,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	}
}

// determineAction determines the policy action from method and path
func determineAction(method, path string) string {
	// Common action mappings
	actionMap := map[string]string{
		"GET":    "read",
		"POST":   "create",
		"PUT":    "update",
		"PATCH":  "update",
		"DELETE": "delete",
	}

	action, ok := actionMap[method]
	if !ok {
		action = strings.ToLower(method)
	}

	// Add resource-specific context
	if strings.Contains(path, "/documents/") {
		return action + ":document"
	}
	if strings.Contains(path, "/users/") {
		return action + ":user"
	}
	if strings.Contains(path, "/policies/") {
		return action + ":policy"
	}

	return action
}

// getClientIP extracts the client IP address
func getClientIP(r *http.Request) string {
	// Check for forwarded headers
	if ip := r.Header.Get("X-Forwarded-For"); ip != "" {
		// X-Forwarded-For can contain multiple IPs, take the first one
		if idx := strings.Index(ip, ","); idx != -1 {
			return strings.TrimSpace(ip[:idx])
		}
		return ip
	}
	if ip := r.Header.Get("X-Real-IP"); ip != "" {
		return ip
	}
	return r.RemoteAddr
}

// getScheme determines the request scheme
func getScheme(r *http.Request) string {
	if r.TLS != nil {
		return "https"
	}
	if scheme := r.Header.Get("X-Forwarded-Proto"); scheme != "" {
		return scheme
	}
	return "http"
}

// shouldSkipPolicyEnforcement checks if the path should skip policy enforcement
func shouldSkipPolicyEnforcement(path string, skipPaths []string) bool {
	for _, skipPath := range skipPaths {
		if strings.HasPrefix(path, skipPath) {
			return true
		}
	}
	return false
}

// logDecision logs a policy decision asynchronously
func logDecision(
	ctx context.Context,
	logger PolicyDecisionLogger,
	input PolicyEvaluationInput,
	result *PolicyEvaluationResult,
	allowed bool,
	reason string,
	executionTime time.Duration,
	r *http.Request,
	config PolicyEnforcementConfig,
) {
	if logger == nil || !config.DecisionLogging {
		return
	}

	decision := policyDecisionAllowed
	if !allowed {
		decision = policyDecisionDenied
	}

	var inputData map[string]interface{}
	inData, _ := json.Marshal(input)
	_ = json.Unmarshal(inData, &inputData)

	var outputData map[string]interface{}
	if result != nil {
		outData, _ := json.Marshal(result)
		_ = json.Unmarshal(outData, &outputData)
	}

	log := &PolicyDecisionLog{
		ID:              uuid.New(),
		TenantID:        input.TenantID,
		UserID:          input.UserID,
		RequestID:       input.RequestID,
		Action:          input.Action,
		Resource:        input.Resource,
		Path:            input.Path,
		Method:          input.Method,
		Decision:        decision,
		Reason:          reason,
		InputData:       inputData,
		OutputData:      outputData,
		ExecutionTimeMs: int(executionTime.Milliseconds()),
		CacheHit:        result != nil && result.CacheHit,
		Timestamp:       time.Now(),
		IPAddress:       input.IP,
		UserAgent:       input.UserAgent,
	}

	if err := logger.LogDecision(ctx, log); err != nil {
		logrus.WithError(err).Error("Failed to log policy decision")
	}
}

// GetPolicyDecision retrieves the policy decision from the request context
func GetPolicyDecision(r *http.Request) *PolicyEvaluationResult {
	if decision, ok := r.Context().Value("policy_decision").(*PolicyEvaluationResult); ok {
		return decision
	}
	return nil
}

// IsPolicyAllowed checks if the request was allowed by policy
func IsPolicyAllowed(r *http.Request) bool {
	if decision := GetPolicyDecision(r); decision != nil {
		return decision.Allowed
	}
	return false
}

// TenantPolicyMiddleware creates a middleware for tenant-specific policy loading
func TenantPolicyMiddleware(
	loader TenantPolicyLoader,
	logger *logrus.Logger,
) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := r.Context()

			tenantID, _ := extractAuthContext(ctx, r)
			if tenantID == uuid.Nil {
				next.ServeHTTP(w, r)
				return
			}

			// Load tenant-specific policies
			if err := loader.LoadTenantPolicies(ctx, tenantID); err != nil {
				logger.WithFields(logrus.Fields{
					"tenant_id": tenantID,
					"error":     err.Error(),
				}).Warn("Failed to load tenant policies")
			}

			next.ServeHTTP(w, r)
		})
	}
}

// TenantPolicyLoader defines the interface for loading tenant-specific policies
type TenantPolicyLoader interface {
	LoadTenantPolicies(ctx context.Context, tenantID uuid.UUID) error
	UnloadTenantPolicies(ctx context.Context, tenantID uuid.UUID) error
	GetTenantPolicies(ctx context.Context, tenantID uuid.UUID) ([]string, error)
}

// PolicyCacheInvalidationHandle handles policy cache invalidation requests
func PolicyCacheInvalidationHandle(
	evaluator PolicyEvaluator,
	logger *logrus.Logger,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			render.Status(r, http.StatusMethodNotAllowed)
			render.JSON(w, r, map[string]interface{}{
				"error": "method not allowed",
			})
			return
		}

		var req struct {
			Pattern  string `json:"pattern"`
			TenantID string `json:"tenant_id"`
		}

		if err := render.DecodeJSON(r.Body, &req); err != nil {
			render.Status(r, http.StatusBadRequest)
			render.JSON(w, r, map[string]interface{}{
				"error": "invalid request body",
			})
			return
		}

		pattern := req.Pattern
		if pattern == "" && req.TenantID != "" {
			pattern = "tenant:" + req.TenantID
		}
		if pattern == "" {
			pattern = "*"
		}

		if err := evaluator.InvalidateCache(r.Context(), pattern); err != nil {
			logger.WithError(err).Error("Failed to invalidate policy cache")
			render.Status(r, http.StatusInternalServerError)
			render.JSON(w, r, map[string]interface{}{
				"error": "failed to invalidate cache",
			})
			return
		}

		render.JSON(w, r, map[string]interface{}{
			"message": "cache invalidated",
			"pattern": pattern,
		})
	}
}

// PolicyMetricsHandle returns policy evaluation metrics
func PolicyMetricsHandle(
	evaluator PolicyEvaluator,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// This would return metrics from the evaluator
		// Implementation depends on the specific evaluator interface
		render.JSON(w, r, map[string]interface{}{
			"message": "metrics endpoint",
		})
	}
}

// BatchPolicyEvaluationHandle handles batch policy evaluation requests
func BatchPolicyEvaluationHandle(
	evaluator PolicyEvaluator,
	logger *logrus.Logger,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			render.Status(r, http.StatusMethodNotAllowed)
			render.JSON(w, r, map[string]interface{}{
				"error": "method not allowed",
			})
			return
		}

		var req struct {
			Evaluations []PolicyEvaluationInput `json:"evaluations"`
		}

		if err := render.DecodeJSON(r.Body, &req); err != nil {
			render.Status(r, http.StatusBadRequest)
			render.JSON(w, r, map[string]interface{}{
				"error": "invalid request body",
			})
			return
		}

		results, err := evaluator.EvaluateBatch(r.Context(), req.Evaluations)
		if err != nil {
			logger.WithError(err).Error("Batch policy evaluation failed")
			render.Status(r, http.StatusInternalServerError)
			render.JSON(w, r, map[string]interface{}{
				"error": "evaluation failed",
			})
			return
		}

		render.JSON(w, r, map[string]interface{}{
			"results": results,
			"count":   len(results),
		})
	}
}

// PolicyVersionHeader adds the policy version header to responses
func PolicyVersionHeader(version string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if version != "" {
				w.Header().Set("X-Policy-Version", version)
			}
			next.ServeHTTP(w, r)
		})
	}
}

// ParseTenantIDFromQuery parses tenant ID from query string
func ParseTenantIDFromQuery(r *http.Request) (uuid.UUID, error) {
	tenantIDStr := r.URL.Query().Get("tenant_id")
	if tenantIDStr == "" {
		return uuid.Nil, nil
	}
	return uuid.Parse(tenantIDStr)
}

// SetTenantContext sets tenant context in the request
func SetTenantContext(r *http.Request, tenantID, userID uuid.UUID, role string) *http.Request {
	ctx := r.Context()
	ctx = context.WithValue(ctx, "tenant_id", tenantID)
	ctx = context.WithValue(ctx, "user_id", userID)
	ctx = context.WithValue(ctx, "user_role", role)
	return r.WithContext(ctx)
}

// GetTenantIDFromContext retrieves tenant ID from request context
func GetTenantIDFromContext(r *http.Request) uuid.UUID {
	if tenantID, ok := r.Context().Value("tenant_id").(uuid.UUID); ok {
		return tenantID
	}
	return uuid.Nil
}

// GetUserIDDFromContext retrieves user ID from request context
func GetUserIDFromContext(r *http.Request) uuid.UUID {
	if userID, ok := r.Context().Value("user_id").(uuid.UUID); ok {
		return userID
	}
	return uuid.Nil
}

// GetUserRoleFromContext retrieves user role from request context
func GetUserRoleFromContext(r *http.Request) string {
	if role, ok := r.Context().Value("user_role").(string); ok {
		return role
	}
	return ""
}

// IsAuthenticated checks if the request is authenticated
func IsAuthenticated(r *http.Request) bool {
	return GetTenantIDFromContext(r) != uuid.Nil
}

// RequireAuth is a helper to require authentication
func RequireAuth(w http.ResponseWriter, r *http.Request) bool {
	if !IsAuthenticated(r) {
		render.Status(r, http.StatusUnauthorized)
		render.JSON(w, r, map[string]interface{}{
			"error": map[string]interface{}{
				"code":    "UNAUTHORIZED",
				"message": "Authentication required",
			},
		})
		return false
	}
	return true
}
