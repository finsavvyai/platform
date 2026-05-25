package handlers

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/render"
	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
	"go.opentelemetry.io/otel"

	"github.com/sdlc-ai/platform/services/gateway/internal/domain/models"
	"github.com/sdlc-ai/platform/services/gateway/internal/domain/services"
)

// LoginRequest represents the login request body
type LoginRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required"`
	TenantID string `json:"tenant_id" validate:"required,uuid"`
	MFACode  string `json:"mfa_code,omitempty"`
}

// LoginResponse represents the login response
type LoginResponse struct {
	Success bool `json:"success"`
	Data    struct {
		AccessToken  string      `json:"access_token"`
		RefreshToken string      `json:"refresh_token"`
		ExpiresIn    int         `json:"expires_in"`
		TokenType    string      `json:"token_type"`
		User         *UserInfo   `json:"user"`
		Tenant       *TenantInfo `json:"tenant"`
		SessionID    string      `json:"session_id"`
	} `json:"data"`
	Meta ResponseMeta `json:"meta"`
}

// UserInfo represents user information in responses
type UserInfo struct {
	ID            uuid.UUID              `json:"id"`
	TenantID      uuid.UUID              `json:"tenant_id"`
	Email         string                 `json:"email"`
	Role          string                 `json:"role"`
	Permissions   map[string]interface{} `json:"permissions"`
	Metadata      map[string]interface{} `json:"metadata"`
	CreatedAt     time.Time              `json:"created_at"`
	UpdatedAt     time.Time              `json:"updated_at"`
	LastLogin     *time.Time             `json:"last_login"`
	IsActive      bool                   `json:"is_active"`
	MFAEnabled    bool                   `json:"mfa_enabled"`
	EmailVerified bool                   `json:"email_verified"`
	Profile       map[string]interface{} `json:"profile"`
	Preferences   map[string]interface{} `json:"preferences"`
}

// TenantInfo represents tenant information in responses
type TenantInfo struct {
	ID        uuid.UUID              `json:"id"`
	Name      string                 `json:"name"`
	Domain    string                 `json:"domain"`
	Status    string                 `json:"status"`
	Config    map[string]interface{} `json:"config"`
	Settings  map[string]interface{} `json:"settings"`
	CreatedAt time.Time              `json:"created_at"`
	UpdatedAt time.Time              `json:"updated_at"`
}

// LogoutResponse represents the logout response
type LogoutResponse struct {
	Success bool `json:"success"`
	Data    struct {
		Message string `json:"message"`
	} `json:"data"`
	Meta ResponseMeta `json:"meta"`
}

// RefreshTokenRequest represents the refresh token request
type RefreshTokenRequest struct {
	RefreshToken string `json:"refresh_token" validate:"required"`
}

// RefreshTokenResponse represents the refresh token response
type RefreshTokenResponse struct {
	Success bool `json:"success"`
	Data    struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
		TokenType   string `json:"token_type"`
	} `json:"data"`
	Meta ResponseMeta `json:"meta"`
}

// ResponseMeta represents response metadata
type ResponseMeta struct {
	RequestID string `json:"request_id"`
	Timestamp string `json:"timestamp"`
	Version   string `json:"version"`
}

// ErrorResponse represents an error response
type ErrorResponse struct {
	Success bool `json:"success"`
	Error   struct {
		Code    string        `json:"code"`
		Message string        `json:"message"`
		Details []ErrorDetail `json:"details,omitempty"`
	} `json:"error"`
	Meta ResponseMeta `json:"meta"`
}

// ErrorDetail represents a single error detail
type ErrorDetail struct {
	Field   string      `json:"field,omitempty"`
	Message string      `json:"message"`
	Value   interface{} `json:"value,omitempty"`
}

// Login handles user login requests
func Login(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, span := otel.Tracer("gateway").Start(r.Context(), "Login")
		defer span.End()

		requestID := uuid.New().String()

		var req LoginRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondWithError(w, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid request body", requestID)
			return
		}

		// Validate required fields
		if req.Email == "" {
			respondWithError(w, http.StatusBadRequest, "VALIDATION_ERROR", "Email is required", requestID)
			return
		}
		if req.Password == "" {
			respondWithError(w, http.StatusBadRequest, "VALIDATION_ERROR", "Password is required", requestID)
			return
		}
		if req.TenantID == "" {
			respondWithError(w, http.StatusBadRequest, "VALIDATION_ERROR", "Tenant ID is required", requestID)
			return
		}

		// Parse tenant ID
		tenantUUID, err := uuid.Parse(req.TenantID)
		if err != nil {
			respondWithError(w, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid tenant ID format", requestID)
			return
		}
		if deps.AuthService == nil {
			respondWithError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "Authentication service is not configured", requestID)
			return
		}

		// Authenticate using authentication service
		authReq := &services.AuthenticationRequest{
			Email:             req.Email,
			Password:          req.Password,
			TenantID:          req.TenantID,
			MFACode:           req.MFACode,
			DeviceFingerprint: r.Header.Get("X-Device-Fingerprint"),
			UserAgent:         r.UserAgent(),
			IPAddress:         getClientIP(r),
		}

		authResp, err := deps.AuthService.Authenticate(ctx, authReq)
		if err != nil {
			logrus.WithError(err).WithFields(logrus.Fields{
				"email":      req.Email,
				"tenant_id":  req.TenantID,
				"request_id": requestID,
			}).Warn("Authentication failed")

			if strings.Contains(err.Error(), "not found") || strings.Contains(err.Error(), "credentials") {
				respondWithError(w, http.StatusUnauthorized, "INVALID_CREDENTIALS", "Invalid email or password", requestID)
			} else if strings.Contains(err.Error(), "locked") {
				respondWithError(w, http.StatusForbidden, "ACCOUNT_LOCKED", "Account is temporarily locked due to multiple failed login attempts", requestID)
			} else if strings.Contains(err.Error(), "disabled") {
				respondWithError(w, http.StatusForbidden, "ACCOUNT_DISABLED", "Account is disabled", requestID)
			} else {
				respondWithError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Authentication failed", requestID)
			}
			return
		}

		// AuthenticationService enforces MFA challenges/verification via MFACode.
		if authResp.RequiresMFA {
			respondWithError(w, http.StatusUnauthorized, "MFA_REQUIRED", "Multi-factor authentication code required", requestID)
			return
		}

		// Get tenant info
		tenant, err := deps.Repos.Tenant.GetByID(ctx, tenantUUID)
		if err != nil {
			logrus.WithError(err).WithField("tenant_id", tenantUUID).Error("Failed to get tenant")
			// Continue anyway, we have the user info
		}

		// Build response
		response := LoginResponse{
			Success: true,
		}
		response.Data.AccessToken = authResp.TokenPair.AccessToken
		response.Data.RefreshToken = authResp.TokenPair.RefreshToken
		response.Data.ExpiresIn = int(time.Until(authResp.TokenPair.ExpiresAt).Seconds())
		response.Data.TokenType = "Bearer"
		response.Data.SessionID = authResp.SessionID
		response.Data.User = convertUserInfo(authResp.User)
		if tenant != nil {
			response.Data.Tenant = convertTenantInfo(tenant)
		}
		response.Meta = ResponseMeta{
			RequestID: requestID,
			Timestamp: time.Now().Format(time.RFC3339),
			Version:   deps.Config.Version,
		}

		render.JSON(w, r, response)

		logrus.WithFields(logrus.Fields{
			"user_id":    authResp.User.ID,
			"tenant_id":  authResp.User.TenantID,
			"email":      authResp.User.Email,
			"request_id": requestID,
		}).Info("User logged in successfully")
	}
}

// Logout handles user logout requests
func Logout(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, span := otel.Tracer("gateway").Start(r.Context(), "Logout")
		defer span.End()

		requestID := uuid.New().String()
		if deps.AuthService == nil {
			respondWithError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "Authentication service is not configured", requestID)
			return
		}

		// Get user info from context (set by auth middleware)
		userID, ok := ctx.Value("user_id").(uuid.UUID)
		if !ok {
			respondWithError(w, http.StatusUnauthorized, "UNAUTHORIZED", "User not authenticated", requestID)
			return
		}

		// Get tokens from request
		accessToken := r.Header.Get("Authorization")
		if strings.HasPrefix(accessToken, "Bearer ") {
			accessToken = strings.TrimPrefix(accessToken, "Bearer ")
		}

		var refreshToken string
		if r.Body != nil {
			var body struct {
				RefreshToken string `json:"refresh_token"`
			}
			// Body is optional on logout; ignore decode errors (empty/missing body
			// means no refresh token to revoke), but log for observability.
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil && err != io.EOF {
				logrus.WithError(err).Debug("Logout: optional refresh_token body could not be decoded")
			}
			refreshToken = body.RefreshToken
		}

		// Logout using authentication service
		err := deps.AuthService.Logout(ctx, accessToken, refreshToken, userID)
		if err != nil {
			logrus.WithError(err).WithField("user_id", userID).Error("Logout failed")
		}

		response := LogoutResponse{
			Success: true,
		}
		response.Data.Message = "Successfully logged out"
		response.Meta = ResponseMeta{
			RequestID: requestID,
			Timestamp: time.Now().Format(time.RFC3339),
			Version:   deps.Config.Version,
		}

		render.JSON(w, r, response)

		logrus.WithFields(logrus.Fields{
			"user_id":    userID,
			"request_id": requestID,
		}).Info("User logged out successfully")
	}
}

// RefreshToken handles token refresh requests
func RefreshToken(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, span := otel.Tracer("gateway").Start(r.Context(), "RefreshToken")
		defer span.End()

		requestID := uuid.New().String()

		var req RefreshTokenRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondWithError(w, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid request body", requestID)
			return
		}
		if deps.AuthService == nil {
			respondWithError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "Authentication service is not configured", requestID)
			return
		}

		if req.RefreshToken == "" {
			respondWithError(w, http.StatusBadRequest, "VALIDATION_ERROR", "Refresh token is required", requestID)
			return
		}

		// Refresh token using authentication service
		tokenPair, err := deps.AuthService.RefreshToken(ctx, req.RefreshToken, r.Header.Get("X-Device-Fingerprint"))
		if err != nil {
			logrus.WithError(err).WithField("request_id", requestID).Warn("Token refresh failed")
			if strings.Contains(err.Error(), "invalid") || strings.Contains(err.Error(), "expired") {
				respondWithError(w, http.StatusUnauthorized, "INVALID_TOKEN", "Invalid or expired refresh token", requestID)
			} else {
				respondWithError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to refresh token", requestID)
			}
			return
		}

		response := RefreshTokenResponse{
			Success: true,
		}
		response.Data.AccessToken = tokenPair.AccessToken
		response.Data.ExpiresIn = int(time.Until(tokenPair.ExpiresAt).Seconds())
		response.Data.TokenType = "Bearer"
		response.Meta = ResponseMeta{
			RequestID: requestID,
			Timestamp: time.Now().Format(time.RFC3339),
			Version:   deps.Config.Version,
		}

		render.JSON(w, r, response)
	}
}

// GetCurrentUser handles requests to get the current authenticated user
func GetCurrentUser(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, span := otel.Tracer("gateway").Start(r.Context(), "GetCurrentUser")
		defer span.End()

		requestID := uuid.New().String()

		// Get user info from context (set by auth middleware)
		userID, ok := ctx.Value("user_id").(uuid.UUID)
		if !ok {
			respondWithError(w, http.StatusUnauthorized, "UNAUTHORIZED", "User not authenticated", requestID)
			return
		}

		// Get user from repository
		user, err := deps.Repos.User.GetByID(ctx, userID)
		if err != nil {
			logrus.WithError(err).WithField("user_id", userID).Error("Failed to get user")
			respondWithError(w, http.StatusNotFound, "NOT_FOUND", "User not found", requestID)
			return
		}

		// Build response
		response := map[string]interface{}{
			"success": true,
			"data":    convertUserModelToUserInfo(user),
			"meta": ResponseMeta{
				RequestID: requestID,
				Timestamp: time.Now().Format(time.RFC3339),
				Version:   deps.Config.Version,
			},
		}

		render.JSON(w, r, response)
	}
}

// Helper functions

func respondWithError(w http.ResponseWriter, status int, code, message, requestID string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)

	errorResp := ErrorResponse{
		Success: false,
	}
	errorResp.Error.Code = code
	errorResp.Error.Message = message
	errorResp.Meta = ResponseMeta{
		RequestID: requestID,
		Timestamp: time.Now().Format(time.RFC3339),
		Version:   "v1",
	}

	// Encode error after headers/status sent is non-actionable for the client.
	_ = json.NewEncoder(w).Encode(errorResp)
}

func convertUserInfo(user *services.UserInfo) *UserInfo {
	if user == nil {
		return nil
	}

	permissions := make(map[string]interface{})
	if len(user.Permissions) > 0 {
		permissions["permissions"] = user.Permissions
	}

	return &UserInfo{
		ID:            user.ID,
		TenantID:      user.TenantID,
		Email:         user.Email,
		Role:          user.Role,
		Permissions:   permissions,
		Metadata:      map[string]interface{}{},
		CreatedAt:     user.CreatedAt,
		UpdatedAt:     user.CreatedAt, // UserInfo doesn't have UpdatedAt
		LastLogin:     user.LastLogin,
		IsActive:      true, // UserInfo doesn't have IsActive
		MFAEnabled:    user.MFAEnabled,
		EmailVerified: user.EmailVerified,
		Profile:       convertStringMapToInterfaceMap(user.Profile),
		Preferences:   map[string]interface{}{},
	}
}

func convertUserModelToUserInfo(user *models.User) map[string]interface{} {
	permissions := make(map[string]interface{})
	if user.Permissions != nil {
		permissions = user.Permissions
	}

	profile := make(map[string]interface{})
	if user.Profile != nil {
		profile = user.Profile
	}

	preferences := make(map[string]interface{})
	if user.Preferences != nil {
		preferences = user.Preferences
	}

	metadata := make(map[string]interface{})
	if user.Metadata != nil {
		metadata = user.Metadata
	}

	return map[string]interface{}{
		"id":             user.ID,
		"tenant_id":      user.TenantID,
		"email":          user.Email,
		"role":           string(user.Role),
		"permissions":    permissions,
		"metadata":       metadata,
		"created_at":     user.CreatedAt,
		"updated_at":     user.UpdatedAt,
		"last_login":     user.LastLogin,
		"is_active":      user.IsActive,
		"mfa_enabled":    user.MFAEnabled,
		"email_verified": user.EmailVerified,
		"phone_number":   user.PhoneNumber,
		"phone_verified": user.PhoneVerified,
		"profile":        profile,
		"preferences":    preferences,
	}
}

func convertTenantInfo(tenant *models.Tenant) *TenantInfo {
	config := make(map[string]interface{})
	if tenant.Config != nil {
		config = tenant.Config
	}

	settings := make(map[string]interface{})
	if tenant.Settings != nil {
		settings = tenant.Settings
	}

	return &TenantInfo{
		ID:        tenant.ID,
		Name:      tenant.Name,
		Domain:    tenant.Domain,
		Status:    string(tenant.Status),
		Config:    config,
		Settings:  settings,
		CreatedAt: tenant.CreatedAt,
		UpdatedAt: tenant.UpdatedAt,
	}
}

func getClientIP(r *http.Request) string {
	// Check X-Forwarded-For header first
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		// Take the first IP if multiple are present
		if idx := strings.Index(xff, ","); idx != -1 {
			return strings.TrimSpace(xff[:idx])
		}
		return xff
	}

	// Check X-Real-IP header
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return xri
	}

	// Fall back to RemoteAddr
	return r.RemoteAddr
}

// ValidateAuthRequest validates an authentication request
func validateAuthRequest(req *LoginRequest) error {
	var errors []ErrorDetail

	if req.Email == "" {
		errors = append(errors, ErrorDetail{
			Field:   "email",
			Message: "Email is required",
		})
	}

	if req.Password == "" {
		errors = append(errors, ErrorDetail{
			Field:   "password",
			Message: "Password is required",
		})
	}

	if req.TenantID == "" {
		errors = append(errors, ErrorDetail{
			Field:   "tenant_id",
			Message: "Tenant ID is required",
		})
	} else if _, err := uuid.Parse(req.TenantID); err != nil {
		errors = append(errors, ErrorDetail{
			Field:   "tenant_id",
			Message: "Tenant ID must be a valid UUID",
			Value:   req.TenantID,
		})
	}

	if len(errors) > 0 {
		return &ValidationError{Errors: errors}
	}

	return nil
}

// ValidationError represents a validation error
type ValidationError struct {
	Errors []ErrorDetail
}

func (ve *ValidationError) Error() string {
	return "validation failed"
}

// HandleError is a generic error handler for handlers
func HandleError(w http.ResponseWriter, r *http.Request, err error, statusCode int, message string) {
	requestID := uuid.New().String()

	logrus.WithError(err).WithFields(logrus.Fields{
		"status":     statusCode,
		"message":    message,
		"request_id": requestID,
	}).Error("Handler error")

	respondWithError(w, statusCode, "INTERNAL_ERROR", message, requestID)
}

// IsNotFound checks if an error is a "not found" error
func IsNotFound(err error) bool {
	return err != nil && (errors.Is(err, err) || strings.Contains(err.Error(), "not found"))
}

// IsUnauthorized checks if an error is an "unauthorized" error
func IsUnauthorized(err error) bool {
	return err != nil && (strings.Contains(err.Error(), "unauthorized") ||
		strings.Contains(err.Error(), "authentication") ||
		strings.Contains(err.Error(), "forbidden"))
}

// convertStringMapToInterfaceMap converts a map[string]string to map[string]interface{}
func convertStringMapToInterfaceMap(m map[string]string) map[string]interface{} {
	result := make(map[string]interface{}, len(m))
	for k, v := range m {
		result[k] = v
	}
	return result
}
