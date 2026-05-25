package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
	"go.opentelemetry.io/otel"

	"github.com/sdlc-ai/platform/services/gateway/internal/domain/models"
)

// CreateTenantRequest represents the request to create a new tenant
type CreateTenantRequest struct {
	Name         string                 `json:"name" validate:"required"`
	Domain       string                 `json:"domain" validate:"required"`
	Config       map[string]interface{} `json:"config,omitempty"`
	Settings     map[string]interface{} `json:"settings,omitempty"`
	Subscription *SubscriptionInfo      `json:"subscription,omitempty"`
	AdminUser    *AdminUserInfo         `json:"admin_user,omitempty"`
}

// SubscriptionInfo represents subscription information
type SubscriptionInfo struct {
	Plan      string `json:"plan,omitempty"`
	ExpiresAt string `json:"expires_at,omitempty"`
}

// AdminUserInfo represents admin user info for tenant creation
type AdminUserInfo struct {
	Email     string `json:"email" validate:"required,email"`
	Password  string `json:"password" validate:"required,min=8"`
	FirstName string `json:"first_name,omitempty"`
	LastName  string `json:"last_name,omitempty"`
}

// UpdateTenantRequest represents the request to update a tenant
type UpdateTenantRequest struct {
	Name     *string                `json:"name,omitempty"`
	Config   map[string]interface{} `json:"config,omitempty"`
	Settings map[string]interface{} `json:"settings,omitempty"`
	Status   *string                `json:"status,omitempty"`
}

// TenantListResponse represents the response for listing tenants
type TenantListResponse struct {
	Success bool `json:"success"`
	Data    struct {
		Tenants    []map[string]interface{} `json:"tenants"`
		Pagination PaginationInfo           `json:"pagination"`
	} `json:"data"`
	Meta ResponseMeta `json:"meta"`
}

// TenantResponse represents a single tenant response
type TenantResponse struct {
	Success bool                   `json:"success"`
	Data    map[string]interface{} `json:"data"`
	Meta    ResponseMeta           `json:"meta"`
}

// PaginationInfo represents pagination information
type PaginationInfo struct {
	Total       int  `json:"total"`
	Limit       int  `json:"limit"`
	Offset      int  `json:"offset"`
	HasNext     bool `json:"has_next"`
	HasPrev     bool `json:"has_prev"`
	TotalPages  int  `json:"total_pages"`
	CurrentPage int  `json:"current_page"`
}

// ListTenants handles listing tenants with filtering and pagination
func ListTenants(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, span := otel.Tracer("gateway").Start(r.Context(), "ListTenants")
		defer span.End()

		requestID := uuid.New().String()

		// Get user info from context (set by auth middleware)
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

		// Check if user is super admin
		if user.Role != models.RoleSuperAdmin && user.Role != models.RoleTenantAdmin {
			respondWithError(w, http.StatusForbidden, "PERMISSION_DENIED", "You don't have permission to list tenants", requestID)
			return
		}

		// Parse query parameters
		limit := parseIntQueryParam(r, "limit", 50)
		offset := parseIntQueryParam(r, "offset", 0)
		search := r.URL.Query().Get("search")
		status := r.URL.Query().Get("status")
		_ = r.URL.Query().Get("sort")

		// Validate limit
		if limit > 1000 {
			limit = 1000
		}
		if limit < 1 {
			limit = 50
		}

		// Build filter
		filter := &models.TenantFilter{
			Limit:  &limit,
			Offset: &offset,
		}

		if status != "" {
			if tenantStatus := parseTenantStatus(status); tenantStatus != "" {
				filter.Status = &tenantStatus
			}
		}

		// Get tenants
		tenants, err := deps.Repos.Tenant.List(ctx, filter, limit, offset)
		if err != nil {
			logrus.WithError(err).Error("Failed to list tenants")
			respondWithError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to list tenants", requestID)
			return
		}

		// Get total count
		total, err := deps.Repos.Tenant.GetTenantCount(ctx)
		if err != nil {
			logrus.WithError(err).Warn("Failed to get tenant count")
			total = len(tenants)
		}

		// Apply search filter if provided
		var filteredTenants []*models.Tenant
		if search != "" {
			searchLower := strings.ToLower(search)
			for _, tenant := range tenants {
				if strings.Contains(strings.ToLower(tenant.Name), searchLower) ||
					strings.Contains(strings.ToLower(tenant.Domain), searchLower) {
					filteredTenants = append(filteredTenants, tenant)
				}
			}
			tenants = filteredTenants
		}

		// Convert to response format
		tenantList := make([]map[string]interface{}, 0, len(tenants))
		for _, tenant := range tenants {
			tenantList = append(tenantList, convertTenantToMap(tenant))
		}

		// Calculate pagination
		totalPages := (total + limit - 1) / limit
		currentPage := (offset / limit) + 1

		response := TenantListResponse{
			Success: true,
		}
		response.Data.Tenants = tenantList
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

// CreateTenant handles creating a new tenant
func CreateTenant(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, span := otel.Tracer("gateway").Start(r.Context(), "CreateTenant")
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
		if err != nil || user.Role != models.RoleSuperAdmin {
			respondWithError(w, http.StatusForbidden, "PERMISSION_DENIED", "Only super admins can create tenants", requestID)
			return
		}

		var req CreateTenantRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondWithError(w, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid request body", requestID)
			return
		}

		// Validate required fields
		if req.Name == "" {
			respondWithError(w, http.StatusBadRequest, "VALIDATION_ERROR", "Name is required", requestID)
			return
		}
		if req.Domain == "" {
			respondWithError(w, http.StatusBadRequest, "VALIDATION_ERROR", "Domain is required", requestID)
			return
		}

		// Check if domain already exists
		exists, err := deps.Repos.Tenant.CheckDomainExists(ctx, req.Domain)
		if err != nil {
			logrus.WithError(err).Error("Failed to check domain existence")
		} else if exists {
			respondWithError(w, http.StatusConflict, "RESOURCE_EXISTS", "A tenant with this domain already exists", requestID)
			return
		}

		// Create tenant
		tenant := models.NewTenant(req.Name, req.Domain, "")
		if req.Config != nil {
			tenant.Config = models.JSONB(req.Config)
		}
		if req.Settings != nil {
			tenant.Settings = models.JSONB(req.Settings)
		}
		if req.Subscription != nil && req.Subscription.Plan != "" {
			tenant.SubscriptionTier = req.Subscription.Plan
		}

		if err := deps.Repos.Tenant.Create(ctx, tenant); err != nil {
			logrus.WithError(err).Error("Failed to create tenant")
			respondWithError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to create tenant", requestID)
			return
		}

		// Create admin user if provided
		if req.AdminUser != nil {
			// This would typically create the admin user for the tenant
			// For now, we'll just log it
			logrus.WithFields(logrus.Fields{
				"tenant_id":   tenant.ID,
				"admin_email": req.AdminUser.Email,
			}).Info("Admin user creation requested")
		}

		response := TenantResponse{
			Success: true,
		}
		response.Data = convertTenantToMap(tenant)
		response.Meta = ResponseMeta{
			RequestID: requestID,
			Timestamp: timestampNow(),
			Version:   deps.Config.Version,
		}

		renderJSON(w, http.StatusCreated, response)

		logrus.WithFields(logrus.Fields{
			"tenant_id":  tenant.ID,
			"created_by": userID,
			"request_id": requestID,
		}).Info("Tenant created successfully")
	}
}

// GetTenant handles getting a specific tenant
func GetTenant(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, span := otel.Tracer("gateway").Start(r.Context(), "GetTenant")
		defer span.End()

		requestID := uuid.New().String()

		// Get user info from context
		userID, ok := ctx.Value("user_id").(uuid.UUID)
		if !ok {
			respondWithError(w, http.StatusUnauthorized, "UNAUTHORIZED", "User not authenticated", requestID)
			return
		}

		// Get tenant ID from URL
		tenantIDStr := chi.URLParam(r, "id")
		tenantID, err := uuid.Parse(tenantIDStr)
		if err != nil {
			respondWithError(w, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid tenant ID", requestID)
			return
		}

		// Get user to check permissions
		user, err := deps.Repos.User.GetByID(ctx, userID)
		if err != nil {
			respondWithError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Failed to verify user permissions", requestID)
			return
		}

		// Get tenant
		tenant, err := deps.Repos.Tenant.GetByID(ctx, tenantID)
		if err != nil {
			respondWithError(w, http.StatusNotFound, "NOT_FOUND", "Tenant not found", requestID)
			return
		}

		// Check permissions - super admins can view any tenant, others only their own
		if user.Role != models.RoleSuperAdmin && user.TenantID != tenantID {
			respondWithError(w, http.StatusForbidden, "PERMISSION_DENIED", "You don't have permission to view this tenant", requestID)
			return
		}

		response := TenantResponse{
			Success: true,
		}
		response.Data = convertTenantToMap(tenant)
		response.Meta = ResponseMeta{
			RequestID: requestID,
			Timestamp: timestampNow(),
			Version:   deps.Config.Version,
		}

		renderJSON(w, http.StatusOK, response)
	}
}

// UpdateTenant handles updating a tenant
func UpdateTenant(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, span := otel.Tracer("gateway").Start(r.Context(), "UpdateTenant")
		defer span.End()

		requestID := uuid.New().String()

		// Get user info from context
		userID, ok := ctx.Value("user_id").(uuid.UUID)
		if !ok {
			respondWithError(w, http.StatusUnauthorized, "UNAUTHORIZED", "User not authenticated", requestID)
			return
		}

		// Get tenant ID from URL
		tenantIDStr := chi.URLParam(r, "id")
		tenantID, err := uuid.Parse(tenantIDStr)
		if err != nil {
			respondWithError(w, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid tenant ID", requestID)
			return
		}

		// Get user to check permissions
		user, err := deps.Repos.User.GetByID(ctx, userID)
		if err != nil {
			respondWithError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Failed to verify user permissions", requestID)
			return
		}

		// Check permissions
		if user.Role != models.RoleSuperAdmin && (user.Role != models.RoleTenantAdmin || user.TenantID != tenantID) {
			respondWithError(w, http.StatusForbidden, "PERMISSION_DENIED", "You don't have permission to update this tenant", requestID)
			return
		}

		// Get existing tenant
		tenant, err := deps.Repos.Tenant.GetByID(ctx, tenantID)
		if err != nil {
			respondWithError(w, http.StatusNotFound, "NOT_FOUND", "Tenant not found", requestID)
			return
		}

		var req UpdateTenantRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondWithError(w, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid request body", requestID)
			return
		}

		// Update fields
		updates := make(map[string]interface{})
		if req.Name != nil {
			tenant.Name = *req.Name
			updates["name"] = *req.Name
		}
		if req.Config != nil {
			tenant.Config = models.JSONB(req.Config)
			updates["config"] = req.Config
		}
		if req.Settings != nil {
			tenant.Settings = models.JSONB(req.Settings)
			updates["settings"] = req.Settings
		}
		if req.Status != nil {
			if status := parseTenantStatus(*req.Status); status != "" {
				tenant.Status = status
				updates["status"] = status
			}
		}

		if err := deps.Repos.Tenant.Update(ctx, tenantID, updates); err != nil {
			logrus.WithError(err).Error("Failed to update tenant")
			respondWithError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to update tenant", requestID)
			return
		}

		// Refresh tenant data
		tenant, _ = deps.Repos.Tenant.GetByID(ctx, tenantID)

		response := TenantResponse{
			Success: true,
		}
		response.Data = convertTenantToMap(tenant)
		response.Meta = ResponseMeta{
			RequestID: requestID,
			Timestamp: timestampNow(),
			Version:   deps.Config.Version,
		}

		renderJSON(w, http.StatusOK, response)

		logrus.WithFields(logrus.Fields{
			"tenant_id":  tenantID,
			"updated_by": userID,
			"request_id": requestID,
		}).Info("Tenant updated successfully")
	}
}

// DeleteTenant handles deleting a tenant
func DeleteTenant(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, span := otel.Tracer("gateway").Start(r.Context(), "DeleteTenant")
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
		if err != nil || user.Role != models.RoleSuperAdmin {
			respondWithError(w, http.StatusForbidden, "PERMISSION_DENIED", "Only super admins can delete tenants", requestID)
			return
		}

		// Get tenant ID from URL
		tenantIDStr := chi.URLParam(r, "id")
		tenantID, err := uuid.Parse(tenantIDStr)
		if err != nil {
			respondWithError(w, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid tenant ID", requestID)
			return
		}

		// Check if force delete is requested
		forceStr := r.URL.Query().Get("force")
		force := forceStr == "true" || forceStr == "1"

		// Check if tenant exists
		_, err = deps.Repos.Tenant.GetByID(ctx, tenantID)
		if err != nil {
			respondWithError(w, http.StatusNotFound, "NOT_FOUND", "Tenant not found", requestID)
			return
		}

		// Check if tenant has active resources (unless force delete)
		if !force {
			// Check for users
			userCount, err := deps.Repos.User.GetUserCount(ctx, tenantID)
			if err == nil && userCount > 0 {
				respondWithError(w, http.StatusConflict, "RESOURCE_CONFLICT", "Cannot delete tenant with active users. Use force=true to override", requestID)
				return
			}

			// Check for documents
			docCount, err := deps.Repos.Document.GetDocumentCount(ctx, tenantID)
			if err == nil && docCount > 0 {
				respondWithError(w, http.StatusConflict, "RESOURCE_CONFLICT", "Cannot delete tenant with existing documents. Use force=true to override", requestID)
				return
			}
		}

		// Delete tenant
		if err := deps.Repos.Tenant.Delete(ctx, tenantID); err != nil {
			logrus.WithError(err).Error("Failed to delete tenant")
			respondWithError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to delete tenant", requestID)
			return
		}

		w.WriteHeader(http.StatusNoContent)

		logrus.WithFields(logrus.Fields{
			"tenant_id":  tenantID,
			"deleted_by": userID,
			"force":      force,
			"request_id": requestID,
		}).Info("Tenant deleted successfully")
	}
}

// Helper functions

func convertTenantToMap(tenant *models.Tenant) map[string]interface{} {
	config := make(map[string]interface{})
	if tenant.Config != nil {
		config = tenant.Config
	}

	settings := make(map[string]interface{})
	if tenant.Settings != nil {
		settings = tenant.Settings
	}

	metadata := make(map[string]interface{})
	if tenant.Metadata != nil {
		metadata = tenant.Metadata
	}

	retentionPolicy := make(map[string]interface{})
	if tenant.RetentionPolicy != nil {
		retentionPolicy = tenant.RetentionPolicy
	}

	resourceLimits := make(map[string]interface{})
	if tenant.ResourceLimits != nil {
		resourceLimits = tenant.ResourceLimits
	}

	complianceRequirements := make(map[string]interface{})
	if tenant.ComplianceRequirements != nil {
		complianceRequirements = tenant.ComplianceRequirements
	}

	billingInfo := make(map[string]interface{})
	if tenant.BillingInfo != nil {
		billingInfo = tenant.BillingInfo
	}

	return map[string]interface{}{
		"id":                      tenant.ID,
		"name":                    tenant.Name,
		"domain":                  tenant.Domain,
		"status":                  string(tenant.Status),
		"config":                  config,
		"settings":                settings,
		"subscription_tier":       tenant.SubscriptionTier,
		"data_region":             tenant.DataRegion,
		"contact_email":           tenant.ContactEmail,
		"billing_info":            billingInfo,
		"created_at":              tenant.CreatedAt,
		"updated_at":              tenant.UpdatedAt,
		"metadata":                metadata,
		"retention_policy":        retentionPolicy,
		"resource_limits":         resourceLimits,
		"compliance_requirements": complianceRequirements,
		"subscription": map[string]interface{}{
			"plan":       tenant.SubscriptionTier,
			"expires_at": "", // Would come from subscription table
		},
		"usage": map[string]interface{}{
			"users":      0, // Would come from actual usage stats
			"documents":  0,
			"storage_gb": 0,
		},
	}
}

func parseTenantStatus(status string) models.TenantStatus {
	switch models.TenantStatus(status) {
	case models.TenantStatusActive, models.TenantStatusSuspended,
		models.TenantStatusTrial, models.TenantStatusDeleted:
		return models.TenantStatus(status)
	}
	return ""
}

func parseIntQueryParam(r *http.Request, key string, defaultValue int) int {
	value := r.URL.Query().Get(key)
	if value == "" {
		return defaultValue
	}
	if intValue, err := strconv.Atoi(value); err == nil {
		return intValue
	}
	return defaultValue
}
