//go:build ignore

package policy

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
	"go.opentelemetry.io/otel"

	"github.com/sdlc-ai/platform/services/gateway/internal/domain/models"
	"github.com/sdlc-ai/platform/services/gateway/internal/domain/repositories"
)

// TenantPolicyLoader handles loading and managing tenant-specific policies
type TenantPolicyLoader struct {
	policyRepo repositories.PolicyRepository
	opaClient  OPAEvaluator
	logger     *logrus.Logger
	metrics    *PolicyMetricsCollector

	// Tenant policy cache
	tenantPolicies map[uuid.UUID][]*models.Policy
	policyMu       sync.RWMutex

	// Loading state
	loadingTenants map[uuid.UUID]bool
	loadingMu      sync.Mutex

	// Configuration
	config TenantPolicyLoaderConfig

	tracerName string
}

// OPAEvaluator defines the interface for evaluating policies with OPA
type OPAEvaluator interface {
	EvaluatePolicy(ctx context.Context, policyPath string, input map[string]interface{}) (*PolicyEvaluationResult, error)
	LoadPolicy(ctx context.Context, policyID string, regoPolicy string) error
	UnloadPolicy(ctx context.Context, policyID string) error
	HealthCheck(ctx context.Context) error
}

// PolicyEvaluationResult represents the result of a policy evaluation
type PolicyEvaluationResult struct {
	Allowed       bool                   `json:"allowed"`
	Decision      string                 `json:"decision"`
	Reason        string                 `json:"reason,omitempty"`
	Conditions    []PolicyCondition      `json:"conditions,omitempty"`
	RawOutput     map[string]interface{} `json:"raw_output,omitempty"`
	ExecutionTime time.Duration          `json:"execution_time"`
}

// PolicyCondition represents a policy condition
type PolicyCondition struct {
	Name        string                 `json:"name"`
	Type        string                 `json:"type"`
	Value       interface{}            `json:"value"`
	Description string                 `json:"description,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// TenantPolicyLoaderConfig holds configuration for tenant policy loading
type TenantPolicyLoaderConfig struct {
	CacheEnabled         bool          `json:"cache_enabled"`
	CacheTTL             time.Duration `json:"cache_ttl"`
	ReloadInterval       time.Duration `json:"reload_interval"`
	MaxConcurrentLoads   int           `json:"max_concurrent_loads"`
	EnableMetrics        bool          `json:"enable_metrics"`
	PolicyPathTemplate   string        `json:"policy_path_template"`
	TenantIsolation      bool          `json:"tenant_isolation"`
	DefaultPolicyEnabled bool          `json:"default_policy_enabled"`
}

// DefaultTenantPolicyLoaderConfig returns default configuration
func DefaultTenantPolicyLoaderConfig() TenantPolicyLoaderConfig {
	return TenantPolicyLoaderConfig{
		CacheEnabled:         true,
		CacheTTL:             30 * time.Minute,
		ReloadInterval:       5 * time.Minute,
		MaxConcurrentLoads:   10,
		EnableMetrics:        true,
		PolicyPathTemplate:   "/v1/policies/%s/%s", // tenant_id, policy_name
		TenantIsolation:      true,
		DefaultPolicyEnabled: true,
	}
}

// NewTenantPolicyLoader creates a new tenant policy loader
func NewTenantPolicyLoader(
	policyRepo repositories.PolicyRepository,
	opaClient OPAEvaluator,
	logger *logrus.Logger,
	metrics *PolicyMetricsCollector,
	config TenantPolicyLoaderConfig,
) *TenantPolicyLoader {
	if logger == nil {
		logger = logrus.New()
	}

	if config.CacheTTL == 0 {
		config.CacheTTL = 30 * time.Minute
	}

	tpl := &TenantPolicyLoader{
		policyRepo:     policyRepo,
		opaClient:      opaClient,
		logger:         logger,
		metrics:        metrics,
		tenantPolicies: make(map[uuid.UUID][]*models.Policy),
		loadingTenants: make(map[uuid.UUID]bool),
		config:         config,
		tracerName:     "tenant-policy-loader",
	}

	// Start background reload if configured
	if config.ReloadInterval > 0 {
		go tpl.backgroundReload()
	}

	return tpl
}

// LoadTenantPolicies loads all active policies for a tenant
func (tpl *TenantPolicyLoader) LoadTenantPolicies(ctx context.Context, tenantID uuid.UUID) error {
	ctx, span := otel.Tracer(tpl.tracerName).Start(ctx, "LoadTenantPolicies")
	defer span.End()

	// Check if already loading
	if tpl.isTenantLoading(tenantID) {
		tpl.logger.WithField("tenant_id", tenantID).Debug("Tenant policies already loading")
		return nil
	}

	// Mark as loading
	tpl.setTenantLoading(tenantID, true)
	defer tpl.setTenantLoading(tenantID, false)

	startTime := time.Now()

	// Query active policies for tenant
	filter := &models.PolicyFilter{
		TenantID: &tenantID,
		IsActive: boolPtr(true),
	}

	policies, err := tpl.policyRepo.GetByTenant(ctx, tenantID, *filter)
	if err != nil {
		tpl.logger.WithFields(logrus.Fields{
			"tenant_id": tenantID,
			"error":     err.Error(),
		}).Error("Failed to query tenant policies")
		return fmt.Errorf("failed to query policies: %w", err)
	}

	tpl.logger.WithFields(logrus.Fields{
		"tenant_id":    tenantID,
		"policy_count": len(policies),
		"duration_ms":  time.Since(startTime).Milliseconds(),
	}).Info("Loaded tenant policies from database")

	// Load each policy into OPA
	var loadedCount int
	var failedCount int

	for _, policy := range policies {
		if err := tpl.loadPolicyIntoOPA(ctx, policy); err != nil {
			tpl.logger.WithFields(logrus.Fields{
				"tenant_id": tenantID,
				"policy_id": policy.ID,
				"name":      policy.Name,
				"error":     err.Error(),
			}).Error("Failed to load policy into OPA")
			failedCount++
			continue
		}
		loadedCount++
	}

	// Cache the policies
	if tpl.config.CacheEnabled {
		tpl.cacheTenantPolicies(tenantID, policies)
	}

	// Record metrics
	if tpl.metrics != nil && tpl.config.EnableMetrics {
		tpl.metrics.RecordPolicyLoad(tenantID.String(), "all", time.Since(startTime))
	}

	tpl.logger.WithFields(logrus.Fields{
		"tenant_id":   tenantID,
		"loaded":      loadedCount,
		"failed":      failedCount,
		"duration_ms": time.Since(startTime).Milliseconds(),
	}).Info("Tenant policies loaded into OPA")

	return nil
}

// UnloadTenantPolicies unloads all policies for a tenant
func (tpl *TenantPolicyLoader) UnloadTenantPolicies(ctx context.Context, tenantID uuid.UUID) error {
	ctx, span := otel.Tracer(tpl.tracerName).Start(ctx, "UnloadTenantPolicies")
	defer span.End()

	// Get cached policies
	tpl.policyMu.RLock()
	policies, exists := tpl.tenantPolicies[tenantID]
	tpl.policyMu.RUnlock()

	if !exists {
		// Try to load from database first
		filter := &models.PolicyFilter{
			TenantID: &tenantID,
			IsActive: boolPtr(true),
		}

		var err error
		policies, err = tpl.policyRepo.GetByTenant(ctx, tenantID, *filter)
		if err != nil {
			return fmt.Errorf("failed to query policies for unloading: %w", err)
		}

		if len(policies) == 0 {
			return nil
		}
	}

	// Unload each policy
	var unloadedCount int
	for _, policy := range policies {
		policyID := tpl.generatePolicyID(policy)
		if err := tpl.opaClient.UnloadPolicy(ctx, policyID); err != nil {
			tpl.logger.WithFields(logrus.Fields{
				"tenant_id": tenantID,
				"policy_id": policy.ID,
				"name":      policy.Name,
				"error":     err.Error(),
			}).Warn("Failed to unload policy from OPA")
			continue
		}
		unloadedCount++
	}

	// Remove from cache
	tpl.policyMu.Lock()
	delete(tpl.tenantPolicies, tenantID)
	tpl.policyMu.Unlock()

	tpl.logger.WithFields(logrus.Fields{
		"tenant_id": tenantID,
		"unloaded":  unloadedCount,
	}).Info("Tenant policies unloaded")

	return nil
}

// GetTenantPolicies returns the cached policies for a tenant
func (tpl *TenantPolicyLoader) GetTenantPolicies(ctx context.Context, tenantID uuid.UUID) ([]*models.Policy, error) {
	// Check cache first
	if tpl.config.CacheEnabled {
		tpl.policyMu.RLock()
		policies, exists := tpl.tenantPolicies[tenantID]
		tpl.policyMu.RUnlock()

		if exists {
			return policies, nil
		}
	}

	// Load from database
	filter := &models.PolicyFilter{
		TenantID: &tenantID,
		IsActive: boolPtr(true),
	}

	policies, err := tpl.policyRepo.GetByTenant(ctx, tenantID, *filter)
	if err != nil {
		return nil, fmt.Errorf("failed to get tenant policies: %w", err)
	}

	return policies, nil
}

// LoadPolicy loads a single policy for a tenant
func (tpl *TenantPolicyLoader) LoadPolicy(ctx context.Context, tenantID uuid.UUID, policyID uuid.UUID) error {
	ctx, span := otel.Tracer(tpl.tracerName).Start(ctx, "LoadPolicy")
	defer span.End()

	policy, err := tpl.policyRepo.GetByID(ctx, tenantID, policyID)
	if err != nil {
		return fmt.Errorf("failed to get policy: %w", err)
	}

	if err := tpl.loadPolicyIntoOPA(ctx, policy); err != nil {
		return fmt.Errorf("failed to load policy into OPA: %w", err)
	}

	// Update cache
	if tpl.config.CacheEnabled {
		tpl.policyMu.Lock()
		defer tpl.policyMu.Unlock()

		policies := tpl.tenantPolicies[tenantID]
		found := false
		for i, p := range policies {
			if p.ID == policyID {
				policies[i] = policy
				found = true
				break
			}
		}
		if !found {
			policies = append(policies, policy)
		}
		tpl.tenantPolicies[tenantID] = policies
	}

	tpl.logger.WithFields(logrus.Fields{
		"tenant_id": tenantID,
		"policy_id": policyID,
		"name":      policy.Name,
	}).Info("Policy loaded")

	return nil
}

// UnloadPolicy unloads a single policy for a tenant
func (tpl *TenantPolicyLoader) UnloadPolicy(ctx context.Context, tenantID uuid.UUID, policyID uuid.UUID) error {
	ctx, span := otel.Tracer(tpl.tracerName).Start(ctx, "UnloadPolicy")
	defer span.End()

	policy, err := tpl.policyRepo.GetByID(ctx, tenantID, policyID)
	if err != nil {
		return fmt.Errorf("failed to get policy: %w", err)
	}

	opaPolicyID := tpl.generatePolicyID(policy)
	if err := tpl.opaClient.UnloadPolicy(ctx, opaPolicyID); err != nil {
		return fmt.Errorf("failed to unload policy from OPA: %w", err)
	}

	// Update cache
	if tpl.config.CacheEnabled {
		tpl.policyMu.Lock()
		defer tpl.policyMu.Unlock()

		policies := tpl.tenantPolicies[tenantID]
		for i, p := range policies {
			if p.ID == policyID {
				tpl.tenantPolicies[tenantID] = append(policies[:i], policies[i+1:]...)
				break
			}
		}
	}

	tpl.logger.WithFields(logrus.Fields{
		"tenant_id": tenantID,
		"policy_id": policyID,
		"name":      policy.Name,
	}).Info("Policy unloaded")

	return nil
}

// ReloadTenantPolicies reloads all policies for a tenant
func (tpl *TenantPolicyLoader) ReloadTenantPolicies(ctx context.Context, tenantID uuid.UUID) error {
	// Unload first
	if err := tpl.UnloadTenantPolicies(ctx, tenantID); err != nil {
		tpl.logger.WithError(err).Warn("Failed to unload policies before reload")
	}

	// Load again
	return tpl.LoadTenantPolicies(ctx, tenantID)
}

// ReloadAll reloads all cached tenant policies
func (tpl *TenantPolicyLoader) ReloadAll(ctx context.Context) error {
	tpl.policyMu.RLock()
	tenantIDs := make([]uuid.UUID, 0, len(tpl.tenantPolicies))
	for tenantID := range tpl.tenantPolicies {
		tenantIDs = append(tenantIDs, tenantID)
	}
	tpl.policyMu.RUnlock()

	var lastErr error
	for _, tenantID := range tenantIDs {
		if err := tpl.ReloadTenantPolicies(ctx, tenantID); err != nil {
			tpl.logger.WithFields(logrus.Fields{
				"tenant_id": tenantID,
				"error":     err.Error(),
			}).Error("Failed to reload tenant policies")
			lastErr = err
		}
	}

	return lastErr
}

// GetActiveTenants returns a list of tenant IDs with loaded policies
func (tpl *TenantPolicyLoader) GetActiveTenants() []uuid.UUID {
	tpl.policyMu.RLock()
	defer tpl.policyMu.RUnlock()

	tenants := make([]uuid.UUID, 0, len(tpl.tenantPolicies))
	for tenantID := range tpl.tenantPolicies {
		tenants = append(tenants, tenantID)
	}
	return tenants
}

// GetPolicyCount returns the number of policies loaded for a tenant
func (tpl *TenantPolicyLoader) GetPolicyCount(tenantID uuid.UUID) int {
	tpl.policyMu.RLock()
	defer tpl.policyMu.RUnlock()

	if policies, exists := tpl.tenantPolicies[tenantID]; exists {
		return len(policies)
	}
	return 0
}

// HealthCheck checks the health of the policy loader
func (tpl *TenantPolicyLoader) HealthCheck(ctx context.Context) error {
	// Check OPA connection
	if err := tpl.opaClient.HealthCheck(ctx); err != nil {
		return fmt.Errorf("OPA health check failed: %w", err)
	}

	return nil
}

// Close cleans up resources
func (tpl *TenantPolicyLoader) Close(ctx context.Context) error {
	// Unload all tenant policies
	tenants := tpl.GetActiveTenants()
	for _, tenantID := range tenants {
		if err := tpl.UnloadTenantPolicies(ctx, tenantID); err != nil {
			tpl.logger.WithFields(logrus.Fields{
				"tenant_id": tenantID,
				"error":     err.Error(),
			}).Error("Failed to unload tenant policies during close")
		}
	}

	tpl.logger.Info("Tenant policy loader closed")
	return nil
}

// loadPolicyIntoOPA loads a single policy into OPA
func (tpl *TenantPolicyLoader) loadPolicyIntoOPA(ctx context.Context, policy *models.Policy) error {
	policyID := tpl.generatePolicyID(policy)

	// Add tenant context to the policy
	regoWithTenant := tpl.addTenantContext(policy)

	if err := tpl.opaClient.LoadPolicy(ctx, policyID, regoWithTenant); err != nil {
		return fmt.Errorf("failed to load policy %s: %w", policyID, err)
	}

	return nil
}

// generatePolicyID generates a unique policy ID for OPA
func (tpl *TenantPolicyLoader) generatePolicyID(policy *models.Policy) string {
	return fmt.Sprintf("%s_%s_%d", policy.TenantID, policy.Name, policy.Version)
}

// addTenantContext adds tenant-specific context to the Rego policy
func (tpl *TenantPolicyLoader) addTenantContext(policy *models.Policy) string {
	// Add tenant metadata as comments at the top of the policy
	header := fmt.Sprintf(`
# Tenant: %s
# Policy: %s
# Version: %d
# Type: %s
# Created At: %s
# Updated At: %s

`, policy.TenantID, policy.Name, policy.Version, policy.Type,
		policy.CreatedAt.Format(time.RFC3339),
		policy.UpdatedAt.Format(time.RFC3339))

	return header + policy.RegoPolicy
}

// cacheTenantPolicies caches policies for a tenant
func (tpl *TenantPolicyLoader) cacheTenantPolicies(tenantID uuid.UUID, policies []*models.Policy) {
	tpl.policyMu.Lock()
	defer tpl.policyMu.Unlock()

	tpl.tenantPolicies[tenantID] = make([]*models.Policy, len(policies))
	copy(tpl.tenantPolicies[tenantID], policies)
}

// isTenantLoading checks if a tenant's policies are currently being loaded
func (tpl *TenantPolicyLoader) isTenantLoading(tenantID uuid.UUID) bool {
	tpl.loadingMu.Lock()
	defer tpl.loadingMu.Unlock()
	return tpl.loadingTenants[tenantID]
}

// setTenantLoading sets the loading state for a tenant
func (tpl *TenantPolicyLoader) setTenantLoading(tenantID uuid.UUID, loading bool) {
	tpl.loadingMu.Lock()
	defer tpl.loadingMu.Unlock()

	if loading {
		tpl.loadingTenants[tenantID] = true
	} else {
		delete(tpl.loadingTenants, tenantID)
	}
}

// backgroundReload periodically reloads tenant policies
func (tpl *TenantPolicyLoader) backgroundReload() {
	ticker := time.NewTicker(tpl.config.ReloadInterval)
	defer ticker.Stop()

	for range ticker.C {
		ctx := context.Background()
		if err := tpl.ReloadAll(ctx); err != nil {
			tpl.logger.WithError(err).Error("Background reload failed")
		}
	}
}

// PolicyMetricsCollector is an interface for recording policy metrics
type PolicyMetricsCollector interface {
	RecordPolicyLoad(tenantID, policyID string, duration time.Duration)
}

// boolPtr returns a pointer to a bool
func boolPtr(b bool) *bool {
	return &b
}
