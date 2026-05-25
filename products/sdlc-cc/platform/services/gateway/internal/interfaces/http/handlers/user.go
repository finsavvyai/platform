package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
	"go.opentelemetry.io/otel"
	"golang.org/x/crypto/bcrypt"

	"github.com/sdlc-ai/platform/services/gateway/internal/domain/models"
)

// CreateUserRequest represents the request to create a new user
type CreateUserRequest struct {
	Email          string                 `json:"email" validate:"required,email"`
	Password       string                 `json:"password" validate:"required,min=8"`
	Role           string                 `json:"role,omitempty"`
	Permissions    map[string]interface{} `json:"permissions,omitempty"`
	Metadata       map[string]interface{} `json:"metadata,omitempty"`
	Profile        map[string]interface{} `json:"profile,omitempty"`
	Preferences    map[string]interface{} `json:"preferences,omitempty"`
	PhoneNumber    string                 `json:"phone_number,omitempty"`
	SendInvitation bool                   `json:"send_invitation,omitempty"`
}

// UpdateUserRequest represents the request to update a user
type UpdateUserRequest struct {
	Email         *string                `json:"email,omitempty"`
	Role          *string                `json:"role,omitempty"`
	Permissions   map[string]interface{} `json:"permissions,omitempty"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
	IsActive      *bool                  `json:"is_active,omitempty"`
	MFAEnabled    *bool                  `json:"mfa_enabled,omitempty"`
	Profile       map[string]interface{} `json:"profile,omitempty"`
	Preferences   map[string]interface{} `json:"preferences,omitempty"`
	PhoneNumber   *string                `json:"phone_number,omitempty"`
	PhoneVerified *bool                  `json:"phone_verified,omitempty"`
	EmailVerified *bool                  `json:"email_verified,omitempty"`
}

// UserListResponse represents the response for listing users
type UserListResponse struct {
	Success bool `json:"success"`
	Data    struct {
		Users      []map[string]interface{} `json:"users"`
		Pagination PaginationInfo           `json:"pagination"`
	} `json:"data"`
	Meta ResponseMeta `json:"meta"`
}

// UserResponse represents a single user response
type UserResponse struct {
	Success bool                   `json:"success"`
	Data    map[string]interface{} `json:"data"`
	Meta    ResponseMeta           `json:"meta"`
}

// ListUsers handles listing users with filtering and pagination
func ListUsers(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, span := otel.Tracer("gateway").Start(r.Context(), "ListUsers")
		defer span.End()

		requestID := uuid.New().String()

		// Get user info from context
		userID, ok := ctx.Value("user_id").(uuid.UUID)
		if !ok {
			respondWithError(w, http.StatusUnauthorized, "UNAUTHORIZED", "User not authenticated", requestID)
			return
		}

		// Get user to check permissions and tenant
		user, err := deps.Repos.User.GetByID(ctx, userID)
		if err != nil {
			respondWithError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Failed to verify user permissions", requestID)
			return
		}

		// Parse query parameters
		limit := parseIntQueryParam(r, "limit", 50)
		offset := parseIntQueryParam(r, "offset", 0)
		search := r.URL.Query().Get("search")
		role := r.URL.Query().Get("role")
		isActiveStr := r.URL.Query().Get("is_active")
		emailVerifiedStr := r.URL.Query().Get("email_verified")

		// Validate limit
		if limit > 1000 {
			limit = 1000
		}
		if limit < 1 {
			limit = 50
		}

		// Build filter
		filter := &models.UserFilter{
			TenantID: &user.TenantID,
			Limit:    &limit,
			Offset:   &offset,
		}

		if role != "" {
			if userRole := parseUserRole(role); userRole != "" {
				filter.Role = &userRole
			}
		}

		if isActiveStr != "" {
			if isActive := isActiveStr == "true" || isActiveStr == "1"; isActive || isActiveStr == "false" || isActiveStr == "0" {
				filter.IsActive = &isActive
			}
		}

		if emailVerifiedStr != "" {
			if emailVerified := emailVerifiedStr == "true" || emailVerifiedStr == "1"; emailVerified || emailVerifiedStr == "false" || emailVerifiedStr == "0" {
				filter.EmailVerified = &emailVerified
			}
		}

		if search != "" {
			filter.Search = &search
		}

		// Get users
		users, err := deps.Repos.User.GetByTenant(ctx, user.TenantID, *filter)
		if err != nil {
			logrus.WithError(err).Error("Failed to list users")
			respondWithError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to list users", requestID)
			return
		}

		// Get total count
		total, err := deps.Repos.User.GetUserCount(ctx, user.TenantID)
		if err != nil {
			logrus.WithError(err).Warn("Failed to get user count")
			total = len(users)
		}

		// Convert to response format
		userList := make([]map[string]interface{}, 0, len(users))
		for _, u := range users {
			userList = append(userList, convertUserToMap(u))
		}

		// Calculate pagination
		totalPages := (total + limit - 1) / limit
		currentPage := (offset / limit) + 1

		response := UserListResponse{
			Success: true,
		}
		response.Data.Users = userList
		response.Data.Pagination = PaginationInfo{
			Total:       total,
			Limit:       limit,
			Offset:      offset,
			HasNext:     offset+limit < total,
			HasPrev:     offset > 0,
			TotalPages:  totalPages,
			CurrentPage: currentPage,
		}
		response.Meta = ResponseMeta{
			RequestID: requestID,
			Timestamp: timestampNow(),
			Version:   deps.Config.Version,
		}

		renderJSON(w, http.StatusOK, response)
	}
}

// CreateUser handles creating a new user
func CreateUser(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, span := otel.Tracer("gateway").Start(r.Context(), "CreateUser")
		defer span.End()

		requestID := uuid.New().String()

		// Get user info from context
		userID, ok := ctx.Value("user_id").(uuid.UUID)
		if !ok {
			respondWithError(w, http.StatusUnauthorized, "UNAUTHORIZED", "User not authenticated", requestID)
			return
		}

		// Get user to check permissions
		user, err := deps.Repos.User.GetByID(ctx, userID)
		if err != nil {
			respondWithError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Failed to verify user permissions", requestID)
			return
		}

		// Check if user has permission to create users
		if !canManageUsers(user) {
			respondWithError(w, http.StatusForbidden, "PERMISSION_DENIED", "You don't have permission to create users", requestID)
			return
		}

		var req CreateUserRequest
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
		if len(req.Password) < 8 {
			respondWithError(w, http.StatusBadRequest, "VALIDATION_ERROR", "Password must be at least 8 characters", requestID)
			return
		}

		// Check if user with email already exists
		existingUser, err := deps.Repos.User.GetByEmail(ctx, user.TenantID, req.Email)
		if err == nil && existingUser != nil {
			respondWithError(w, http.StatusConflict, "RESOURCE_EXISTS", "A user with this email already exists", requestID)
			return
		}

		// Hash password
		passwordHash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			logrus.WithError(err).Error("Failed to hash password")
			respondWithError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to process password", requestID)
			return
		}

		// Parse role
		role := models.RoleUser
		if req.Role != "" {
			role = parseUserRole(req.Role)
			if role == "" {
				role = models.RoleUser
			}
		}

		// Non-admins can't create admin users
		if !user.IsAdmin() && (role == models.RoleTenantAdmin || role == models.RoleSuperAdmin) {
			respondWithError(w, http.StatusForbidden, "PERMISSION_DENIED", "You don't have permission to create admin users", requestID)
			return
		}

		// Create user
		newUser := models.NewUser(user.TenantID, req.Email, string(passwordHash), role)
		newUser.Permissions = models.JSONB(req.Permissions)
		newUser.Metadata = models.JSONB(req.Metadata)
		newUser.Profile = models.JSONB(req.Profile)
		newUser.Preferences = models.JSONB(req.Preferences)
		newUser.PhoneNumber = req.PhoneNumber
		newUser.EmailVerified = false // Requires verification

		if err := deps.Repos.User.Create(ctx, newUser); err != nil {
			logrus.WithError(err).Error("Failed to create user")
			respondWithError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to create user", requestID)
			return
		}

		// Send invitation if requested
		if req.SendInvitation {
			// TODO: Implement invitation email sending
			logrus.WithField("user_id", newUser.ID).Info("Invitation email sending requested")
		}

		response := UserResponse{
			Success: true,
		}
		response.Data = convertUserToMap(newUser)
		response.Meta = ResponseMeta{
			RequestID: requestID,
			Timestamp: timestampNow(),
			Version:   deps.Config.Version,
		}

		renderJSON(w, http.StatusCreated, response)

		logrus.WithFields(logrus.Fields{
			"user_id":    newUser.ID,
			"tenant_id":  newUser.TenantID,
			"created_by": userID,
			"request_id": requestID,
		}).Info("User created successfully")
	}
}

// GetUser handles getting a specific user
func GetUser(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, span := otel.Tracer("gateway").Start(r.Context(), "GetUser")
		defer span.End()

		requestID := uuid.New().String()

		// Get user info from context
		userID, ok := ctx.Value("user_id").(uuid.UUID)
		if !ok {
			respondWithError(w, http.StatusUnauthorized, "UNAUTHORIZED", "User not authenticated", requestID)
			return
		}

		// Get user ID from URL
		targetUserIDStr := chi.URLParam(r, "id")
		targetUserID, err := uuid.Parse(targetUserIDStr)
		if err != nil {
			respondWithError(w, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid user ID", requestID)
			return
		}

		// Get requesting user to check permissions
		requestingUser, err := deps.Repos.User.GetByID(ctx, userID)
		if err != nil {
			respondWithError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Failed to verify user permissions", requestID)
			return
		}

		// Get target user
		targetUser, err := deps.Repos.User.GetByID(ctx, targetUserID)
		if err != nil {
			respondWithError(w, http.StatusNotFound, "NOT_FOUND", "User not found", requestID)
			return
		}

		// Check permissions - users can view their own profile, admins can view any user in their tenant
		if userID != targetUserID && !canManageUsers(requestingUser) {
			respondWithError(w, http.StatusForbidden, "PERMISSION_DENIED", "You don't have permission to view this user", requestID)
			return
		}

		// Check tenant access
		if requestingUser.TenantID != targetUser.TenantID && requestingUser.Role != models.RoleSuperAdmin {
			respondWithError(w, http.StatusForbidden, "PERMISSION_DENIED", "You don't have permission to view users from other tenants", requestID)
			return
		}

		response := UserResponse{
			Success: true,
		}
		response.Data = convertUserToMap(targetUser)
		response.Meta = ResponseMeta{
			RequestID: requestID,
			Timestamp: timestampNow(),
			Version:   deps.Config.Version,
		}

		renderJSON(w, http.StatusOK, response)
	}
}

// UpdateUser handles updating a user
func UpdateUser(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, span := otel.Tracer("gateway").Start(r.Context(), "UpdateUser")
		defer span.End()

		requestID := uuid.New().String()

		// Get user info from context
		userID, ok := ctx.Value("user_id").(uuid.UUID)
		if !ok {
			respondWithError(w, http.StatusUnauthorized, "UNAUTHORIZED", "User not authenticated", requestID)
			return
		}

		// Get user ID from URL
		targetUserIDStr := chi.URLParam(r, "id")
		targetUserID, err := uuid.Parse(targetUserIDStr)
		if err != nil {
			respondWithError(w, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid user ID", requestID)
			return
		}

		// Get requesting user to check permissions
		requestingUser, err := deps.Repos.User.GetByID(ctx, userID)
		if err != nil {
			respondWithError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Failed to verify user permissions", requestID)
			return
		}

		// Get target user
		targetUser, err := deps.Repos.User.GetByID(ctx, targetUserID)
		if err != nil {
			respondWithError(w, http.StatusNotFound, "NOT_FOUND", "User not found", requestID)
			return
		}

		// Check permissions - users can update their own profile (limited fields), admins can update any
		isSelfUpdate := userID == targetUserID
		if !isSelfUpdate && !canManageUsers(requestingUser) {
			respondWithError(w, http.StatusForbidden, "PERMISSION_DENIED", "You don't have permission to update this user", requestID)
			return
		}

		var req UpdateUserRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondWithError(w, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid request body", requestID)
			return
		}

		// Build updates map
		updates := make(map[string]interface{})

		if req.Email != nil {
			// Only admins can change email
			if !isSelfUpdate && !canManageUsers(requestingUser) {
				respondWithError(w, http.StatusForbidden, "PERMISSION_DENIED", "You don't have permission to change email", requestID)
				return
			}
			targetUser.Email = *req.Email
			updates["email"] = *req.Email
		}

		if req.Role != nil {
			// Only admins can change role
			if !canManageUsers(requestingUser) {
				respondWithError(w, http.StatusForbidden, "PERMISSION_DENIED", "You don't have permission to change role", requestID)
				return
			}
			newRole := parseUserRole(*req.Role)
			if newRole == "" {
				respondWithError(w, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid role", requestID)
				return
			}
			targetUser.Role = newRole
			updates["role"] = newRole
		}

		if req.Permissions != nil {
			// Only admins can change permissions
			if !canManageUsers(requestingUser) {
				respondWithError(w, http.StatusForbidden, "PERMISSION_DENIED", "You don't have permission to change permissions", requestID)
				return
			}
			targetUser.Permissions = models.JSONB(req.Permissions)
			updates["permissions"] = req.Permissions
		}

		if req.Metadata != nil {
			targetUser.Metadata = models.JSONB(req.Metadata)
			updates["metadata"] = req.Metadata
		}

		if req.IsActive != nil && canManageUsers(requestingUser) {
			targetUser.IsActive = *req.IsActive
			updates["is_active"] = *req.IsActive
		}

		if req.MFAEnabled != nil && canManageUsers(requestingUser) {
			targetUser.MFAEnabled = *req.MFAEnabled
			updates["mfa_enabled"] = *req.MFAEnabled
		}

		if req.Profile != nil {
			targetUser.Profile = models.JSONB(req.Profile)
			updates["profile"] = req.Profile
		}

		if req.Preferences != nil {
			targetUser.Preferences = models.JSONB(req.Preferences)
			updates["preferences"] = req.Preferences
		}

		if req.PhoneNumber != nil {
			targetUser.PhoneNumber = *req.PhoneNumber
			updates["phone_number"] = *req.PhoneNumber
		}

		if req.PhoneVerified != nil && canManageUsers(requestingUser) {
			targetUser.PhoneVerified = *req.PhoneVerified
			updates["phone_verified"] = *req.PhoneVerified
		}

		if req.EmailVerified != nil && canManageUsers(requestingUser) {
			targetUser.EmailVerified = *req.EmailVerified
			updates["email_verified"] = *req.EmailVerified
		}

		if err := deps.Repos.User.Update(ctx, targetUserID, updates); err != nil {
			logrus.WithError(err).Error("Failed to update user")
			respondWithError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to update user", requestID)
			return
		}

		// Refresh user data
		targetUser, _ = deps.Repos.User.GetByID(ctx, targetUserID)

		response := UserResponse{
			Success: true,
		}
		response.Data = convertUserToMap(targetUser)
		response.Meta = ResponseMeta{
			RequestID: requestID,
			Timestamp: timestampNow(),
			Version:   deps.Config.Version,
		}

		renderJSON(w, http.StatusOK, response)

		logrus.WithFields(logrus.Fields{
			"user_id":    targetUserID,
			"updated_by": userID,
			"request_id": requestID,
		}).Info("User updated successfully")
	}
}

// DeleteUser handles deleting a user
func DeleteUser(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, span := otel.Tracer("gateway").Start(r.Context(), "DeleteUser")
		defer span.End()

		requestID := uuid.New().String()

		// Get user info from context
		userID, ok := ctx.Value("user_id").(uuid.UUID)
		if !ok {
			respondWithError(w, http.StatusUnauthorized, "UNAUTHORIZED", "User not authenticated", requestID)
			return
		}

		// Get user to check permissions
		user, err := deps.Repos.User.GetByID(ctx, userID)
		if err != nil || !canManageUsers(user) {
			respondWithError(w, http.StatusForbidden, "PERMISSION_DENIED", "You don't have permission to delete users", requestID)
			return
		}

		// Get user ID from URL
		targetUserIDStr := chi.URLParam(r, "id")
		targetUserID, err := uuid.Parse(targetUserIDStr)
		if err != nil {
			respondWithError(w, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid user ID", requestID)
			return
		}

		// Prevent self-deletion
		if userID == targetUserID {
			respondWithError(w, http.StatusBadRequest, "VALIDATION_ERROR", "You cannot delete your own account", requestID)
			return
		}

		// Check if user exists
		targetUser, err := deps.Repos.User.GetByID(ctx, targetUserID)
		if err != nil {
			respondWithError(w, http.StatusNotFound, "NOT_FOUND", "User not found", requestID)
			return
		}

		// Check tenant access
		if user.TenantID != targetUser.TenantID && user.Role != models.RoleSuperAdmin {
			respondWithError(w, http.StatusForbidden, "PERMISSION_DENIED", "You don't have permission to delete users from other tenants", requestID)
			return
		}

		// Delete user
		if err := deps.Repos.User.Delete(ctx, targetUserID); err != nil {
			logrus.WithError(err).Error("Failed to delete user")
			respondWithError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to delete user", requestID)
			return
		}

		w.WriteHeader(http.StatusNoContent)

		logrus.WithFields(logrus.Fields{
			"user_id":    targetUserID,
			"deleted_by": userID,
			"request_id": requestID,
		}).Info("User deleted successfully")
	}
}

// Helper functions

func convertUserToMap(user *models.User) map[string]interface{} {
	permissions := make(map[string]interface{})
	if user.Permissions != nil {
		permissions = user.Permissions
	}

	metadata := make(map[string]interface{})
	if user.Metadata != nil {
		metadata = user.Metadata
	}

	profile := make(map[string]interface{})
	if user.Profile != nil {
		profile = user.Profile
	}

	preferences := make(map[string]interface{})
	if user.Preferences != nil {
		preferences = user.Preferences
	}

	return map[string]interface{}{
		"id":                    user.ID,
		"tenant_id":             user.TenantID,
		"email":                 user.Email,
		"role":                  string(user.Role),
		"permissions":           permissions,
		"metadata":              metadata,
		"created_at":            user.CreatedAt,
		"updated_at":            user.UpdatedAt,
		"last_login":            user.LastLogin,
		"is_active":             user.IsActive,
		"mfa_enabled":           user.MFAEnabled,
		"email_verified":        user.EmailVerified,
		"phone_number":          user.PhoneNumber,
		"phone_verified":        user.PhoneVerified,
		"failed_login_attempts": user.FailedLoginAttempts,
		"locked_until":          user.LockedUntil,
		"profile":               profile,
		"preferences":           preferences,
	}
}

func parseUserRole(role string) models.UserRole {
	switch models.UserRole(role) {
	case models.RoleSuperAdmin, models.RoleTenantAdmin,
		models.RoleDataScientist, models.RoleAnalyst,
		models.RoleViewer, models.RoleUser:
		return models.UserRole(role)
	}
	return ""
}

func canManageUsers(user *models.User) bool {
	return user.IsAdmin() || user.HasPermission("users:write")
}
