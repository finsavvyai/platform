//go:build ignore

package services

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/trace"

	"github.com/sdlc-ai/platform/services/gateway/internal/domain/models"
)

// PolicyService provides policy management functionality
type PolicyService struct {
	logger       *logrus.Logger
	policyRepo   PolicyRepository
	cache        CacheClient
	auditService AuditService
	config       PolicyServiceConfig
	tracer       trace.Tracer
}

// PolicyRepository defines the interface for policy storage operations
type PolicyRepository interface {
	Create(ctx context.Context, policy *models.Policy) error
	GetByID(ctx context.Context, tenantID, policyID uuid.UUID) (*models.Policy, error)
	GetByName(ctx context.Context, tenantID uuid.UUID, name string) (*models.Policy, error)
	Update(ctx context.Context, tenantID, policyID uuid.UUID, updates interface{}) error
	Delete(ctx context.Context, tenantID, policyID uuid.UUID) error
	List(ctx context.Context, filter *models.PolicyFilter) ([]*models.Policy, error)
	Count(ctx context.Context, filter *models.PolicyFilter) (int, error)
	CreateVersion(ctx context.Context, version *models.PolicyVersion) error
	GetVersions(ctx context.Context, tenantID, policyID uuid.UUID, limit, offset int) ([]*models.PolicyVersion, error)
	GetVersion(ctx context.Context, tenantID, versionID uuid.UUID) (*models.PolicyVersion, error)
}

// CacheClient defines the interface for caching operations
type CacheClient interface {
	Get(ctx context.Context, key string) (interface{}, error)
	Set(ctx context.Context, key string, value interface{}, ttl time.Duration) error
	Delete(ctx context.Context, key string) error
}

// AuditService defines the interface for audit logging
type AuditService interface {
	LogPolicyEvent(ctx context.Context, event *AuditEvent) error
}

// PolicyServiceConfig holds configuration for the policy service
type PolicyServiceConfig struct {
	EnableCache      bool          `json:"enable_cache"`
	CacheTTL         time.Duration `json:"cache_ttl"`
	EnableValidation bool          `json:"enable_validation"`
	EnableTesting    bool          `json:"enable_testing"`
	EnableVersioning bool          `json:"enable_versioning"`
	MaxVersions      int           `json:"max_versions"`
}

// DefaultPolicyServiceConfig returns default configuration
func DefaultPolicyServiceConfig() PolicyServiceConfig {
	return PolicyServiceConfig{
		EnableCache:      true,
		CacheTTL:         time.Hour,
		EnableValidation: true,
		EnableTesting:    true,
		EnableVersioning: true,
		MaxVersions:      10,
	}
}

// NewPolicyService creates a new policy service
func NewPolicyService(
	logger *logrus.Logger,
	policyRepo PolicyRepository,
	cache CacheClient,
	auditService AuditService,
	config PolicyServiceConfig,
) *PolicyService {
	if logger == nil {
		logger = logrus.New()
	}

	if config.CacheTTL == 0 {
		config.CacheTTL = time.Hour
	}

	return &PolicyService{
		logger:       logger,
		policyRepo:   policyRepo,
		cache:        cache,
		auditService: auditService,
		config:       config,
		tracer:       otel.Tracer("policy-service"),
	}
}

// CreatePolicy creates a new policy
func (s *PolicyService) CreatePolicy(ctx context.Context, req *CreatePolicyRequest) (*models.Policy, error) {
	ctx, span := s.tracer.Start(ctx, "CreatePolicy")
	defer span.End()

	// Validate request
	if err := s.validateCreatePolicyRequest(ctx, req); err != nil {
		s.logger.WithError(err).Error("Policy creation validation failed")
		return nil, fmt.Errorf("validation failed: %w", err)
	}

	// Check for policy name conflicts
	existing, err := s.policyRepo.GetByName(ctx, req.TenantID, req.Name)
	if err == nil && existing != nil {
		return nil, fmt.Errorf("policy with name '%s' already exists", req.Name)
	}

	// Validate Rego policy syntax
	if s.config.EnableValidation {
		if err := s.validateRegoPolicy(ctx, req.RegoPolicy); err != nil {
			return nil, fmt.Errorf("invalid Rego policy: %w", err)
		}
	}

	// Create policy model
	policy := models.NewPolicy(
		req.TenantID,
		req.CreatedBy,
		req.Name,
		req.Description,
		req.Type,
		req.RegoPolicy,
	)

	// Add metadata if provided
	if req.Metadata != nil {
		policy.Metadata = models.JSONB(req.Metadata)
	}

	// Save policy to database
	if err := s.policyRepo.Create(ctx, policy); err != nil {
		s.logger.WithError(err).Error("Failed to create policy in database")
		return nil, fmt.Errorf("failed to create policy: %w", err)
	}

	// Invalidate cache
	s.invalidatePolicyCache(ctx, policy.TenantID, policy.ID)

	// Log audit event
	if err := s.auditService.LogPolicyEvent(ctx, &AuditEvent{
		Action:     "policy_created",
		TenantID:   policy.TenantID,
		UserID:     req.CreatedBy,
		ResourceID: policy.ID.String(),
		Details: map[string]interface{}{
			"policy_name": policy.Name,
			"policy_type": policy.Type,
		},
	}); err != nil {
		s.logger.WithError(err).Warn("Failed to log audit event")
	}

	s.logger.WithFields(logrus.Fields{
		"policy_id":   policy.ID,
		"tenant_id":   policy.TenantID,
		"policy_name": policy.Name,
		"created_by":  req.CreatedBy,
	}).Info("Policy created successfully")

	return policy, nil
}

// GetPolicy retrieves a policy by ID
func (s *PolicyService) GetPolicy(ctx context.Context, tenantID, policyID uuid.UUID) (*models.Policy, error) {
	ctx, span := s.tracer.Start(ctx, "GetPolicy")
	defer span.End()

	// Check cache first
	if s.cache != nil && s.config.EnableCache {
		cacheKey := s.getPolicyCacheKey(tenantID, policyID)
		if cached, err := s.cache.Get(ctx, cacheKey); err == nil && cached != nil {
			if policy, ok := cached.(*models.Policy); ok {
				return policy, nil
			}
		}
	}

	// Retrieve from database
	policy, err := s.policyRepo.GetByID(ctx, tenantID, policyID)
	if err != nil {
		return nil, fmt.Errorf("failed to get policy: %w", err)
	}

	// Cache the result
	if s.cache != nil && s.config.EnableCache {
		cacheKey := s.getPolicyCacheKey(tenantID, policyID)
		_ = s.cache.Set(ctx, cacheKey, policy, s.config.CacheTTL)
	}

	return policy, nil
}

// UpdatePolicy updates an existing policy
func (s *PolicyService) UpdatePolicy(ctx context.Context, tenantID, policyID uuid.UUID, req *UpdatePolicyRequest) (*models.Policy, error) {
	ctx, span := s.tracer.Start(ctx, "UpdatePolicy")
	defer span.End()

	// Get existing policy
	existing, err := s.policyRepo.GetByID(ctx, tenantID, policyID)
	if err != nil {
		return nil, fmt.Errorf("policy not found: %w", err)
	}

	// Validate request
	if err := s.validateUpdatePolicyRequest(ctx, req); err != nil {
		return nil, fmt.Errorf("validation failed: %w", err)
	}

	// Check for name conflicts (if name is being changed)
	if req.Name != nil && *req.Name != existing.Name {
		conflict, err := s.policyRepo.GetByName(ctx, tenantID, *req.Name)
		if err == nil && conflict != nil && conflict.ID != policyID {
			return nil, fmt.Errorf("policy with name '%s' already exists", *req.Name)
		}
	}

	// Validate Rego policy syntax (if being updated)
	if req.RegoPolicy != nil && *req.RegoPolicy != existing.RegoPolicy {
		if s.config.EnableValidation {
			if err := s.validateRegoPolicy(ctx, *req.RegoPolicy); err != nil {
				return nil, fmt.Errorf("invalid Rego policy: %w", err)
			}
		}
	}

	// Create policy version backup (if versioning is enabled)
	var versionBackup *models.PolicyVersion
	if s.config.EnableVersioning {
		versionBackup = s.createPolicyVersion(existing)
	}

	// Build update map
	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.Type != nil {
		updates["type"] = *req.Type
	}
	if req.RegoPolicy != nil {
		updates["rego_policy"] = *req.RegoPolicy
	}
	if req.IsActive != nil {
		updates["is_active"] = *req.IsActive
	}
	if req.Metadata != nil {
		updates["metadata"] = models.JSONB(req.Metadata)
	}

	// Update policy
	if err := s.policyRepo.Update(ctx, tenantID, policyID, updates); err != nil {
		s.logger.WithError(err).Error("Failed to update policy in database")
		return nil, fmt.Errorf("failed to update policy: %w", err)
	}

	// Save policy version backup
	if versionBackup != nil {
		if err := s.policyRepo.CreateVersion(ctx, versionBackup); err != nil {
			s.logger.WithError(err).Warn("Failed to create policy version backup")
		}
	}

	// Invalidate cache
	s.invalidatePolicyCache(ctx, tenantID, policyID)

	// Log audit event
	if err := s.auditService.LogPolicyEvent(ctx, &AuditEvent{
		Action:     "policy_updated",
		TenantID:   tenantID,
		UserID:     req.UpdatedBy,
		ResourceID: policyID.String(),
		Details: map[string]interface{}{
			"policy_name": existing.Name,
			"changes":     req,
		},
	}); err != nil {
		s.logger.WithError(err).Warn("Failed to log audit event")
	}

	// Get updated policy
	updated, err := s.policyRepo.GetByID(ctx, tenantID, policyID)
	if err != nil {
		return nil, fmt.Errorf("failed to get updated policy: %w", err)
	}

	s.logger.WithFields(logrus.Fields{
		"policy_id":   policyID,
		"tenant_id":   tenantID,
		"policy_name": existing.Name,
		"updated_by":  req.UpdatedBy,
	}).Info("Policy updated successfully")

	return updated, nil
}

// DeletePolicy deletes a policy
func (s *PolicyService) DeletePolicy(ctx context.Context, tenantID, policyID, deletedBy uuid.UUID) error {
	ctx, span := s.tracer.Start(ctx, "DeletePolicy")
	defer span.End()

	// Get policy for audit logging
	policy, err := s.policyRepo.GetByID(ctx, tenantID, policyID)
	if err != nil {
		return fmt.Errorf("policy not found: %w", err)
	}

	// Check if policy can be deleted (not in use)
	if err := s.validatePolicyDeletion(ctx, policy); err != nil {
		return fmt.Errorf("cannot delete policy: %w", err)
	}

	// Delete policy
	if err := s.policyRepo.Delete(ctx, tenantID, policyID); err != nil {
		s.logger.WithError(err).Error("Failed to delete policy from database")
		return fmt.Errorf("failed to delete policy: %w", err)
	}

	// Invalidate cache
	s.invalidatePolicyCache(ctx, tenantID, policyID)

	// Log audit event
	if err := s.auditService.LogPolicyEvent(ctx, &AuditEvent{
		Action:     "policy_deleted",
		TenantID:   tenantID,
		UserID:     deletedBy,
		ResourceID: policyID.String(),
		Details: map[string]interface{}{
			"policy_name": policy.Name,
			"policy_type": policy.Type,
		},
	}); err != nil {
		s.logger.WithError(err).Warn("Failed to log audit event")
	}

	s.logger.WithFields(logrus.Fields{
		"policy_id":   policyID,
		"tenant_id":   tenantID,
		"policy_name": policy.Name,
		"deleted_by":  deletedBy,
	}).Info("Policy deleted successfully")

	return nil
}

// ListPolicies retrieves policies with filtering and pagination
func (s *PolicyService) ListPolicies(ctx context.Context, req *ListPoliciesRequest) (*ListPoliciesResponse, error) {
	ctx, span := s.tracer.Start(ctx, "ListPolicies")
	defer span.End()

	// Build filter
	filter := &models.PolicyFilter{
		TenantID: &req.TenantID,
		Type:     req.Type,
		IsActive: req.IsActive,
		Search:   req.Search,
		Limit:    &req.Limit,
		Offset:   &req.Offset,
	}

	// Get policies
	policies, err := s.policyRepo.List(ctx, filter)
	if err != nil {
		return nil, fmt.Errorf("failed to list policies: %w", err)
	}

	// Get total count
	total, err := s.policyRepo.Count(ctx, filter)
	if err != nil {
		s.logger.WithError(err).Warn("Failed to get total count")
		total = 0
	}

	return &ListPoliciesResponse{
		Policies: policies,
		Total:    total,
		Limit:    req.Limit,
		Offset:   req.Offset,
	}, nil
}

// ActivatePolicy activates a policy
func (s *PolicyService) ActivatePolicy(ctx context.Context, tenantID, policyID, activatedBy uuid.UUID) error {
	return s.setPolicyActive(ctx, tenantID, policyID, true, activatedBy)
}

// DeactivatePolicy deactivates a policy
func (s *PolicyService) DeactivatePolicy(ctx context.Context, tenantID, policyID, deactivatedBy uuid.UUID) error {
	return s.setPolicyActive(ctx, tenantID, policyID, false, deactivatedBy)
}

// GetPolicyVersions retrieves version history for a policy
func (s *PolicyService) GetPolicyVersions(ctx context.Context, tenantID, policyID uuid.UUID, limit, offset int) ([]*models.PolicyVersion, error) {
	if !s.config.EnableVersioning {
		return nil, fmt.Errorf("policy versioning is not enabled")
	}

	return s.policyRepo.GetVersions(ctx, tenantID, policyID, limit, offset)
}

// RestorePolicyVersion restores a policy to a previous version
func (s *PolicyService) RestorePolicyVersion(ctx context.Context, tenantID, policyID, versionID, restoredBy uuid.UUID) error {
	if !s.config.EnableVersioning {
		return fmt.Errorf("policy versioning is not enabled")
	}

	// Get policy version
	version, err := s.policyRepo.GetVersion(ctx, tenantID, versionID)
	if err != nil {
		return fmt.Errorf("policy version not found: %w", err)
	}

	// Validate that version belongs to the policy
	if version.PolicyID != policyID {
		return fmt.Errorf("policy version does not belong to the specified policy")
	}

	// Create backup of current version before restore
	current, err := s.policyRepo.GetByID(ctx, tenantID, policyID)
	if err != nil {
		return fmt.Errorf("failed to get current policy: %w", err)
	}

	currentVersion := s.createPolicyVersion(current)
	if err := s.policyRepo.CreateVersion(ctx, currentVersion); err != nil {
		s.logger.WithError(err).Warn("Failed to create backup of current policy version")
	}

	// Restore policy to version
	updates := map[string]interface{}{
		"name":        version.Name,
		"description": version.Description,
		"type":        version.Type,
		"rego_policy": version.RegoPolicy,
		"metadata":    version.Metadata,
	}

	if err := s.policyRepo.Update(ctx, tenantID, policyID, updates); err != nil {
		return fmt.Errorf("failed to restore policy version: %w", err)
	}

	// Invalidate cache
	s.invalidatePolicyCache(ctx, tenantID, policyID)

	// Log audit event
	if err := s.auditService.LogPolicyEvent(ctx, &AuditEvent{
		Action:     "policy_restored",
		TenantID:   tenantID,
		UserID:     restoredBy,
		ResourceID: policyID.String(),
		Details: map[string]interface{}{
			"policy_name":   version.Name,
			"restored_to":   version.Version,
			"restored_from": current.Version,
		},
	}); err != nil {
		s.logger.WithError(err).Warn("Failed to log audit event")
	}

	s.logger.WithFields(logrus.Fields{
		"policy_id":   policyID,
		"tenant_id":   tenantID,
		"version_id":  versionID,
		"restored_by": restoredBy,
	}).Info("Policy version restored successfully")

	return nil
}

// Private helper methods

func (s *PolicyService) validateCreatePolicyRequest(ctx context.Context, req *CreatePolicyRequest) error {
	if req.TenantID == uuid.Nil {
		return fmt.Errorf("tenant ID is required")
	}
	if req.CreatedBy == uuid.Nil {
		return fmt.Errorf("created by user ID is required")
	}
	if req.Name == "" {
		return fmt.Errorf("policy name is required")
	}
	if req.Type == "" {
		return fmt.Errorf("policy type is required")
	}
	if req.RegoPolicy == "" {
		return fmt.Errorf("Rego policy content is required")
	}
	return nil
}

func (s *PolicyService) validateUpdatePolicyRequest(ctx context.Context, req *UpdatePolicyRequest) error {
	if req.UpdatedBy == uuid.Nil {
		return fmt.Errorf("updated by user ID is required")
	}
	return nil
}

func (s *PolicyService) validateRegoPolicy(ctx context.Context, regoPolicy string) error {
	// TODO: Implement Rego syntax validation
	// This could involve using the OPA SDK to validate the policy
	return nil
}

func (s *PolicyService) validatePolicyDeletion(ctx context.Context, policy *models.Policy) error {
	// Check if policy is referenced by other resources
	if policy.IsActive {
		return fmt.Errorf("cannot delete active policy")
	}
	// Add more validation as needed
	return nil
}

func (s *PolicyService) setPolicyActive(ctx context.Context, tenantID, policyID uuid.UUID, active bool, changedBy uuid.UUID) error {
	ctx, span := s.tracer.Start(ctx, "SetPolicyActive")
	defer span.End()

	updates := map[string]interface{}{
		"is_active": active,
	}

	if err := s.policyRepo.Update(ctx, tenantID, policyID, updates); err != nil {
		return fmt.Errorf("failed to update policy status: %w", err)
	}

	// Invalidate cache
	s.invalidatePolicyCache(ctx, tenantID, policyID)

	// Log audit event
	action := "policy_deactivated"
	if active {
		action = "policy_activated"
	}

	if err := s.auditService.LogPolicyEvent(ctx, &AuditEvent{
		Action:     action,
		TenantID:   tenantID,
		UserID:     changedBy,
		ResourceID: policyID.String(),
		Details: map[string]interface{}{
			"active": active,
		},
	}); err != nil {
		s.logger.WithError(err).Warn("Failed to log audit event")
	}

	return nil
}

func (s *PolicyService) createPolicyVersion(policy *models.Policy) *models.PolicyVersion {
	return &models.PolicyVersion{
		ID:          uuid.New(),
		PolicyID:    policy.ID,
		TenantID:    policy.TenantID,
		Name:        policy.Name,
		Description: policy.Description,
		Type:        policy.Type,
		RegoPolicy:  policy.RegoPolicy,
		Version:     policy.Version,
		CreatedBy:   policy.CreatedBy,
		CreatedAt:   policy.CreatedAt,
		Metadata:    policy.Metadata,
	}
}

func (s *PolicyService) invalidatePolicyCache(ctx context.Context, tenantID, policyID uuid.UUID) {
	if s.cache == nil || !s.config.EnableCache {
		return
	}

	cacheKey := s.getPolicyCacheKey(tenantID, policyID)
	if err := s.cache.Delete(ctx, cacheKey); err != nil {
		s.logger.WithError(err).Warn("Failed to invalidate policy cache")
	}
}

func (s *PolicyService) getPolicyCacheKey(tenantID, policyID uuid.UUID) string {
	return fmt.Sprintf("policy:%s:%s", tenantID, policyID)
}

// Request/Response models

type CreatePolicyRequest struct {
	TenantID    uuid.UUID              `json:"tenant_id"`
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Type        models.PolicyType      `json:"type"`
	RegoPolicy  string                 `json:"rego_policy"`
	CreatedBy   uuid.UUID              `json:"created_by"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

type UpdatePolicyRequest struct {
	Name        *string                `json:"name,omitempty"`
	Description *string                `json:"description,omitempty"`
	Type        *models.PolicyType     `json:"type,omitempty"`
	RegoPolicy  *string                `json:"rego_policy,omitempty"`
	IsActive    *bool                  `json:"is_active,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
	UpdatedBy   uuid.UUID              `json:"updated_by"`
}

type ListPoliciesRequest struct {
	TenantID uuid.UUID          `json:"tenant_id"`
	Type     *models.PolicyType `json:"type,omitempty"`
	IsActive *bool              `json:"is_active,omitempty"`
	Search   *string            `json:"search,omitempty"`
	Limit    int                `json:"limit"`
	Offset   int                `json:"offset"`
}

type ListPoliciesResponse struct {
	Policies []*models.Policy `json:"policies"`
	Total    int              `json:"total"`
	Limit    int              `json:"limit"`
	Offset   int              `json:"offset"`
}

type AuditEvent struct {
	Action     string                 `json:"action"`
	TenantID   uuid.UUID              `json:"tenant_id"`
	UserID     uuid.UUID              `json:"user_id"`
	ResourceID string                 `json:"resource_id"`
	Details    map[string]interface{} `json:"details"`
}
