package services

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/sirupsen/logrus"

	"github.com/sdlc-ai/platform/services/gateway/internal/domain/models"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/cache"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/opa"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/storage"
)

// PolicyService provides policy management functionality
type PolicyService struct {
	logger       *logrus.Logger
	policyRepo   storage.PolicyRepository
	cache        *cache.RedisCache
	opaClient    *opa.OPAClient
	auditService AuditService
	config       PolicyServiceConfig
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

// NewPolicyService creates a new policy service
func NewPolicyService(
	logger *logrus.Logger,
	policyRepo storage.PolicyRepository,
	cache *cache.RedisCache,
	opaClient *opa.OPAClient,
	auditService AuditService,
	config PolicyServiceConfig,
) *PolicyService {
	if logger == nil {
		logger = logrus.New()
	}

	return &PolicyService{
		logger:       logger,
		policyRepo:   policyRepo,
		cache:        cache,
		opaClient:    opaClient,
		auditService: auditService,
		config:       config,
	}
}

// CreatePolicy creates a new policy
func (s *PolicyService) CreatePolicy(ctx context.Context, req *CreatePolicyRequest) (*models.Policy, error) {
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
	if err := s.validateRegoPolicy(ctx, req.RegoPolicy); err != nil {
		return nil, fmt.Errorf("invalid Rego policy: %w", err)
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
	// Check cache first
	if s.cache != nil {
		cacheKey := s.getPolicyCacheKey(tenantID, policyID)
		if cached, err := s.cache.Get(ctx, cacheKey); err == nil && cached != "" {
			var policy models.Policy
			if err := json.Unmarshal([]byte(cached), &policy); err == nil {
				return &policy, nil
			}
		}
	}

	// Retrieve from database
	policy, err := s.policyRepo.GetByID(ctx, tenantID, policyID)
	if err != nil {
		return nil, fmt.Errorf("failed to get policy: %w", err)
	}

	// Cache the result
	if s.cache != nil {
		cacheKey := s.getPolicyCacheKey(tenantID, policyID)
		policyData, _ := json.Marshal(policy)
		s.cache.Set(ctx, cacheKey, string(policyData), time.Hour)
	}

	return policy, nil
}

// UpdatePolicy updates an existing policy
func (s *PolicyService) UpdatePolicy(ctx context.Context, tenantID, policyID uuid.UUID, req *UpdatePolicyRequest) (*models.Policy, error) {
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
		if err := s.validateRegoPolicy(ctx, *req.RegoPolicy); err != nil {
			return nil, fmt.Errorf("invalid Rego policy: %w", err)
		}
	}

	// Create policy version backup (if versioning is enabled)
	var versionBackup *models.PolicyVersion
	if s.config.EnableVersioning {
		versionBackup = s.createPolicyVersion(existing)
	}

	// Apply updates
	updates := &models.PolicyUpdate{}
	if req.Name != nil {
		updates.Name = req.Name
	}
	if req.Description != nil {
		updates.Description = req.Description
	}
	if req.Type != nil {
		updates.Type = req.Type
	}
	if req.RegoPolicy != nil {
		updates.RegoPolicy = req.RegoPolicy
	}
	if req.IsActive != nil {
		updates.IsActive = req.IsActive
	}
	if req.Metadata != nil {
		metadata := models.JSONB(req.Metadata)
		updates.Metadata = &metadata
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
		Total:    int(total),
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

// TestPolicy tests a policy with sample input
func (s *PolicyService) TestPolicy(ctx context.Context, tenantID, policyID uuid.UUID, testInput map[string]interface{}, testedBy uuid.UUID) (*PolicyTestResult, error) {
	// Get policy
	policy, err := s.policyRepo.GetByID(ctx, tenantID, policyID)
	if err != nil {
		return nil, fmt.Errorf("policy not found: %w", err)
	}

	// Test policy with OPA
	startTime := time.Now()
	response, err := s.opaClient.EvaluateResourcePolicy(ctx, policy, testInput)
	executionTime := time.Since(startTime)

	if err != nil {
		return &PolicyTestResult{
			Success:       false,
			Error:         err.Error(),
			ExecutionTime: executionTime,
			TestedBy:      testedBy,
			TestedAt:      time.Now(),
		}, nil
	}

	// Log test event
	if err := s.auditService.LogPolicyEvent(ctx, &AuditEvent{
		Action:     "policy_tested",
		TenantID:   tenantID,
		UserID:     testedBy,
		ResourceID: policyID.String(),
		Details: map[string]interface{}{
			"policy_name":    policy.Name,
			"decision":       response.Decision,
			"execution_time": executionTime.Milliseconds(),
		},
	}); err != nil {
		s.logger.WithError(err).Warn("Failed to log audit event")
	}

	return &PolicyTestResult{
		Success:       true,
		Decision:      response.Decision,
		Reason:        response.Reason,
		Result:        response.Result,
		ExecutionTime: executionTime,
		TestedBy:      testedBy,
		TestedAt:      time.Now(),
	}, nil
}

// GetPolicyVersions retrieves version history for a policy
func (s *PolicyService) GetPolicyVersions(ctx context.Context, tenantID, policyID uuid.UUID, limit, offset int) ([]*models.PolicyVersion, error) {
	if !s.config.EnableVersioning {
		return nil, fmt.Errorf("policy versioning is not enabled")
	}

	return s.policyRepo.GetVersions(ctx, tenantID, policyID, limit, offset)
}

// RestorePolicyVersion restores a policy to a previous version
func (s *PolicyService) RestorePolicyVersion(ctx context.Context, tenantID, policyID, versionID uuid.UUID, restoredBy uuid.UUID) error {
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
	updates := &models.PolicyUpdate{
		Name:        &version.Name,
		Description: &version.Description,
		Type:        &version.Type,
		RegoPolicy:  &version.RegoPolicy,
		Metadata:    &version.Metadata,
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
	updates := &models.PolicyUpdate{
		IsActive: &active,
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
	if s.cache == nil {
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

type PolicyTestResult struct {
	Success       bool          `json:"success"`
	Decision      bool          `json:"decision,omitempty"`
	Reason        string        `json:"reason,omitempty"`
	Result        interface{}   `json:"result,omitempty"`
	Error         string        `json:"error,omitempty"`
	ExecutionTime time.Duration `json:"execution_time"`
	TestedBy      uuid.UUID     `json:"tested_by"`
	TestedAt      time.Time     `json:"tested_at"`
}

// AuditService defines the interface for audit logging
type AuditService interface {
	LogPolicyEvent(ctx context.Context, event *AuditEvent) error
}

// AuditEvent represents an audit log entry
type AuditEvent struct {
	Action     string                 `json:"action"`
	TenantID   uuid.UUID              `json:"tenant_id"`
	UserID     uuid.UUID              `json:"user_id"`
	ResourceID string                 `json:"resource_id"`
	Details    map[string]interface{} `json:"details"`
}
