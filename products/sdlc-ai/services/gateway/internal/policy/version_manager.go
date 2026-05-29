package policy

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"
)

// VersionManager manages policy versioning and rollback capabilities
type VersionManager struct {
	storage  VersionStorage
	logger   Logger
	config   VersionConfig
	mu       sync.RWMutex
	registry map[string]*PolicyVersionChain
}

// VersionConfig represents version manager configuration
type VersionConfig struct {
	MaxVersionsPerChain int           `json:"max_versions_per_chain"`
	AutoVersioning      bool          `json:"auto_versioning"`
	VersionPattern      string        `json:"version_pattern"`
	RollbackTimeout     time.Duration `json:"rollback_timeout"`
	RequireApproval     bool          `json:"require_approval"`
	ApprovalTimeout     time.Duration `json:"approval_timeout"`
}

// VersionStorage interface for storing policy versions
type VersionStorage interface {
	SaveVersion(ctx context.Context, version *PolicyVersion) error
	GetVersion(ctx context.Context, policyName, version string) (*PolicyVersion, error)
	GetLatestVersion(ctx context.Context, policyName string) (*PolicyVersion, error)
	ListVersions(ctx context.Context, policyName string) ([]*PolicyVersion, error)
	DeleteVersion(ctx context.Context, policyName, version string) error
	GetVersionChain(ctx context.Context, policyName string) ([]*PolicyVersion, error)
}

// PolicyVersion represents a version of a policy
type PolicyVersion struct {
	ID            string                 `json:"id"`
	PolicyName    string                 `json:"policy_name"`
	Version       string                 `json:"version"`
	Content       string                 `json:"content"`
	Metadata      map[string]interface{} `json:"metadata"`
	CreatedAt     time.Time              `json:"created_at"`
	CreatedBy     string                 `json:"created_by"`
	Status        VersionStatus          `json:"status"`
	ParentVersion string                 `json:"parent_version,omitempty"`
	Changes       []VersionChange        `json:"changes"`
	Signature     string                 `json:"signature,omitempty"`
	ApprovedBy    string                 `json:"approved_by,omitempty"`
	ApprovedAt    *time.Time             `json:"approved_at,omitempty"`
	Tags          []string               `json:"tags"`
	Changelog     string                 `json:"changelog"`
	IsActive      bool                   `json:"is_active"`
	IsStable      bool                   `json:"is_stable"`
	IsDeprecated  bool                   `json:"is_deprecated"`
}

// VersionStatus represents the status of a policy version
type VersionStatus string

const (
	StatusDraft      VersionStatus = "draft"
	StatusPending    VersionStatus = "pending"
	StatusApproved   VersionStatus = "approved"
	StatusActive     VersionStatus = "active"
	StatusInactive   VersionStatus = "inactive"
	StatusDeprecated VersionStatus = "deprecated"
	StatusArchived   VersionStatus = "archived"
	StatusRollback   VersionStatus = "rollback"
)

// VersionChange represents a change in a policy version
type VersionChange struct {
	Type        ChangeType `json:"type"`
	Description string     `json:"description"`
	RuleName    string     `json:"rule_name,omitempty"`
	OldValue    string     `json:"old_value,omitempty"`
	NewValue    string     `json:"new_value,omitempty"`
	LineNumber  int        `json:"line_number,omitempty"`
}

// ChangeType represents the type of change
type ChangeType string

const (
	ChangeTypeAdd      ChangeType = "add"
	ChangeTypeModify   ChangeType = "modify"
	ChangeTypeRemove   ChangeType = "remove"
	ChangeTypeMove     ChangeType = "move"
	ChangeTypeRename   ChangeType = "rename"
	ChangeTypeReformat ChangeType = "reformat"
)

// PolicyVersionChain represents a chain of policy versions
type PolicyVersionChain struct {
	PolicyName    string           `json:"policy_name"`
	Versions      []*PolicyVersion `json:"versions"`
	ActiveVersion string           `json:"active_version"`
	StableVersion string           `json:"stable_version"`
	CreatedAt     time.Time        `json:"created_at"`
	UpdatedAt     time.Time        `json:"updated_at"`
}

// RollbackPlan represents a rollback plan
type RollbackPlan struct {
	ID             string                 `json:"id"`
	PolicyName     string                 `json:"policy_name"`
	FromVersion    string                 `json:"from_version"`
	ToVersion      string                 `json:"to_version"`
	Reason         string                 `json:"reason"`
	PlannedAt      time.Time              `json:"planned_at"`
	PlannedBy      string                 `json:"planned_by"`
	ApprovedBy     string                 `json:"approved_by,omitempty"`
	ApprovedAt     *time.Time             `json:"approved_at,omitempty"`
	Status         RollbackStatus         `json:"status"`
	Validation     *RollbackValidation    `json:"validation,omitempty"`
	ImpactAnalysis *ImpactAnalysis        `json:"impact_analysis,omitempty"`
	RollbackAt     *time.Time             `json:"rollback_at,omitempty"`
	CompletedAt    *time.Time             `json:"completed_at,omitempty"`
	ErrorMessage   string                 `json:"error_message,omitempty"`
	Metadata       map[string]interface{} `json:"metadata"`
}

// RollbackStatus represents the status of a rollback
type RollbackStatus string

const (
	RollbackStatusPlanned   RollbackStatus = "planned"
	RollbackStatusApproved  RollbackStatus = "approved"
	RollbackStatusExecuting RollbackStatus = "executing"
	RollbackStatusCompleted RollbackStatus = "completed"
	RollbackStatusFailed    RollbackStatus = "failed"
	RollbackStatusCancelled RollbackStatus = "cancelled"
)

// RollbackValidation represents rollback validation results
type RollbackValidation struct {
	Passed          bool                   `json:"passed"`
	Issues          []ValidationIssue      `json:"issues"`
	Warnings        []ValidationIssue      `json:"warnings"`
	Recommendations []string               `json:"recommendations"`
	ValidatedAt     time.Time              `json:"validated_at"`
	ValidatedBy     string                 `json:"validated_by"`
	Metadata        map[string]interface{} `json:"metadata"`
}

// ValidationIssue represents a validation issue
type ValidationIssue struct {
	Severity   string `json:"severity"`
	Code       string `json:"code"`
	Message    string `json:"message"`
	Suggestion string `json:"suggestion,omitempty"`
	RuleName   string `json:"rule_name,omitempty"`
}

// ImpactAnalysis represents the impact analysis of a rollback
type ImpactAnalysis struct {
	AffectedUsers       int                    `json:"affected_users"`
	AffectedResources   int                    `json:"affected_resources"`
	RiskLevel           string                 `json:"risk_level"`
	EstimatedDowntime   time.Duration          `json:"estimated_downtime"`
	BusinessImpact      string                 `json:"business_impact"`
	Dependencies        []string               `json:"dependencies"`
	CompatibilityIssues []CompatibilityIssue   `json:"compatibility_issues"`
	Recommendations     []string               `json:"recommendations"`
	AnalyzedAt          time.Time              `json:"analyzed_at"`
	AnalyzedBy          string                 `json:"analyzed_by"`
	Metadata            map[string]interface{} `json:"metadata"`
}

// CompatibilityIssue represents a compatibility issue
type CompatibilityIssue struct {
	Type        string `json:"type"`
	Description string `json:"description"`
	Severity    string `json:"severity"`
	Resolution  string `json:"resolution"`
}

// NewVersionManager creates a new version manager
func NewVersionManager(config VersionConfig, storage VersionStorage, logger Logger) *VersionManager {
	return &VersionManager{
		storage:  storage,
		logger:   logger,
		config:   config,
		registry: make(map[string]*PolicyVersionChain),
	}
}

// CreateVersion creates a new policy version
func (vm *VersionManager) CreateVersion(ctx context.Context, policyName, content, createdBy, changelog string) (*PolicyVersion, error) {
	vm.logger.Info("Creating new policy version", map[string]interface{}{
		"policy": policyName,
		"author": createdBy,
	})

	// Get current version chain
	chain, err := vm.getVersionChain(ctx, policyName)
	if err != nil {
		return nil, fmt.Errorf("failed to get version chain: %w", err)
	}

	// Generate new version
	version := vm.generateVersion(chain)

	// Detect changes
	changes := vm.detectChanges(chain, content)

	// Create version object
	policyVersion := &PolicyVersion{
		ID:           fmt.Sprintf("%s-%s-%d", policyName, version, time.Now().Unix()),
		PolicyName:   policyName,
		Version:      version,
		Content:      content,
		Metadata:     make(map[string]interface{}),
		CreatedAt:    time.Now(),
		CreatedBy:    createdBy,
		Status:       StatusDraft,
		Changes:      changes,
		Changelog:    changelog,
		IsActive:     false,
		IsStable:     false,
		IsDeprecated: false,
	}

	// Set parent version
	if chain != nil && len(chain.Versions) > 0 {
		policyVersion.ParentVersion = chain.ActiveVersion
	}

	// Validate version
	if err := vm.validateVersion(policyVersion); err != nil {
		return nil, fmt.Errorf("version validation failed: %w", err)
	}

	// Save version
	if err := vm.storage.SaveVersion(ctx, policyVersion); err != nil {
		return nil, fmt.Errorf("failed to save version: %w", err)
	}

	// Update registry
	vm.updateRegistry(policyVersion)

	// Clean up old versions if needed
	if err := vm.cleanupOldVersions(ctx, policyName); err != nil {
		vm.logger.Warn("Failed to cleanup old versions", map[string]interface{}{
			"policy": policyName,
			"error":  err.Error(),
		})
	}

	vm.logger.Info("Policy version created", map[string]interface{}{
		"policy":  policyName,
		"version": version,
		"author":  createdBy,
		"changes": len(changes),
	})

	return policyVersion, nil
}

// ApproveVersion approves a policy version
func (vm *VersionManager) ApproveVersion(ctx context.Context, policyName, version, approvedBy string) error {
	vm.logger.Info("Approving policy version", map[string]interface{}{
		"policy":  policyName,
		"version": version,
		"author":  approvedBy,
	})

	// Get version
	policyVersion, err := vm.storage.GetVersion(ctx, policyName, version)
	if err != nil {
		return fmt.Errorf("failed to get version: %w", err)
	}

	// Check if approval is required
	if vm.config.RequireApproval {
		policyVersion.Status = StatusPending
	} else {
		policyVersion.Status = StatusApproved
		policyVersion.IsStable = true
	}

	policyVersion.ApprovedBy = approvedBy
	now := time.Now()
	policyVersion.ApprovedAt = &now

	// Save updated version
	if err := vm.storage.SaveVersion(ctx, policyVersion); err != nil {
		return fmt.Errorf("failed to save approved version: %w", err)
	}

	vm.logger.Info("Policy version approved", map[string]interface{}{
		"policy":  policyName,
		"version": version,
		"author":  approvedBy,
		"status":  policyVersion.Status,
	})

	return nil
}

// ActivateVersion activates a policy version
func (vm *VersionManager) ActivateVersion(ctx context.Context, policyName, version, activatedBy string) error {
	vm.logger.Info("Activating policy version", map[string]interface{}{
		"policy":  policyName,
		"version": version,
		"author":  activatedBy,
	})

	// Get version chain
	chain, err := vm.getVersionChain(ctx, policyName)
	if err != nil {
		return fmt.Errorf("failed to get version chain: %w", err)
	}

	// Deactivate current active version
	if chain != nil && chain.ActiveVersion != "" {
		currentVersion, err := vm.storage.GetVersion(ctx, policyName, chain.ActiveVersion)
		if err == nil {
			currentVersion.IsActive = false
			currentVersion.Status = StatusInactive
			vm.storage.SaveVersion(ctx, currentVersion)
		}
	}

	// Activate new version
	newVersion, err := vm.storage.GetVersion(ctx, policyName, version)
	if err != nil {
		return fmt.Errorf("failed to get version to activate: %w", err)
	}

	newVersion.IsActive = true
	newVersion.Status = StatusActive
	newVersion.IsStable = true

	// Save updated version
	if err := vm.storage.SaveVersion(ctx, newVersion); err != nil {
		return fmt.Errorf("failed to save activated version: %w", err)
	}

	// Update chain
	if chain == nil {
		chain = &PolicyVersionChain{
			PolicyName: policyName,
			Versions:   []*PolicyVersion{},
			CreatedAt:  time.Now(),
		}
	}

	chain.ActiveVersion = version
	chain.UpdatedAt = time.Now()

	// Add to chain if not already present
	found := false
	for _, v := range chain.Versions {
		if v.Version == version {
			found = true
			break
		}
	}

	if !found {
		chain.Versions = append(chain.Versions, newVersion)
	}

	// Update registry
	vm.mu.Lock()
	vm.registry[policyName] = chain
	vm.mu.Unlock()

	vm.logger.Info("Policy version activated", map[string]interface{}{
		"policy":  policyName,
		"version": version,
		"author":  activatedBy,
	})

	return nil
}

// PlanRollback creates a rollback plan
func (vm *VersionManager) PlanRollback(ctx context.Context, policyName, fromVersion, toVersion, reason, plannedBy string) (*RollbackPlan, error) {
	vm.logger.Info("Planning rollback", map[string]interface{}{
		"policy":       policyName,
		"from_version": fromVersion,
		"to_version":   toVersion,
		"reason":       reason,
		"author":       plannedBy,
	})

	// Validate versions exist
	_, err := vm.storage.GetVersion(ctx, policyName, fromVersion)
	if err != nil {
		return nil, fmt.Errorf("from version not found: %w", err)
	}

	_, err = vm.storage.GetVersion(ctx, policyName, toVersion)
	if err != nil {
		return nil, fmt.Errorf("to version not found: %w", err)
	}

	// Create rollback plan
	plan := &RollbackPlan{
		ID:          fmt.Sprintf("rollback-%s-%d", policyName, time.Now().Unix()),
		PolicyName:  policyName,
		FromVersion: fromVersion,
		ToVersion:   toVersion,
		Reason:      reason,
		PlannedAt:   time.Now(),
		PlannedBy:   plannedBy,
		Status:      RollbackStatusPlanned,
		Metadata:    make(map[string]interface{}),
	}

	// Perform validation
	validation, err := vm.validateRollback(ctx, plan)
	if err != nil {
		return nil, fmt.Errorf("rollback validation failed: %w", err)
	}
	plan.Validation = validation

	// Perform impact analysis
	impact, err := vm.analyzeRollbackImpact(ctx, plan)
	if err != nil {
		vm.logger.Warn("Impact analysis failed", map[string]interface{}{
			"policy": policyName,
			"error":  err.Error(),
		})
	} else {
		plan.ImpactAnalysis = impact
	}

	vm.logger.Info("Rollback plan created", map[string]interface{}{
		"policy":       policyName,
		"from_version": fromVersion,
		"to_version":   toVersion,
		"plan_id":      plan.ID,
		"validation":   validation.Passed,
	})

	return plan, nil
}

// ExecuteRollback executes a rollback plan
func (vm *VersionManager) ExecuteRollback(ctx context.Context, planID, executedBy string) error {
	vm.logger.Info("Executing rollback", map[string]interface{}{
		"plan_id": planID,
		"author":  executedBy,
	})

	// TODO: Implement rollback plan storage and retrieval
	// For now, implement basic rollback logic

	// This would typically:
	// 1. Load the rollback plan from storage
	// 2. Validate the plan is still valid
	// 3. Execute the rollback (deactivate from version, activate to version)
	// 4. Update plan status
	// 5. Send notifications
	// 6. Log the rollback

	return fmt.Errorf("rollback execution not yet implemented")
}

// ListVersions lists all versions of a policy
func (vm *VersionManager) ListVersions(ctx context.Context, policyName string) ([]*PolicyVersion, error) {
	return vm.storage.ListVersions(ctx, policyName)
}

// GetVersion gets a specific version of a policy
func (vm *VersionManager) GetVersion(ctx context.Context, policyName, version string) (*PolicyVersion, error) {
	return vm.storage.GetVersion(ctx, policyName, version)
}

// GetActiveVersion gets the active version of a policy
func (vm *VersionManager) GetActiveVersion(ctx context.Context, policyName string) (*PolicyVersion, error) {
	return vm.storage.GetLatestVersion(ctx, policyName)
}

// Deprecated marks a version as deprecated
func (vm *VersionManager) Deprecated(ctx context.Context, policyName, version, reason string) error {
	policyVersion, err := vm.storage.GetVersion(ctx, policyName, version)
	if err != nil {
		return fmt.Errorf("failed to get version: %w", err)
	}

	policyVersion.IsDeprecated = true
	policyVersion.Status = StatusDeprecated
	policyVersion.Metadata["deprecation_reason"] = reason
	policyVersion.Metadata["deprecated_at"] = time.Now()

	return vm.storage.SaveVersion(ctx, policyVersion)
}

// TagVersion adds tags to a version
func (vm *VersionManager) TagVersion(ctx context.Context, policyName, version string, tags []string) error {
	policyVersion, err := vm.storage.GetVersion(ctx, policyName, version)
	if err != nil {
		return fmt.Errorf("failed to get version: %w", err)
	}

	policyVersion.Tags = append(policyVersion.Tags, tags...)

	return vm.storage.SaveVersion(ctx, policyVersion)
}

// generateVersion generates a new version number
func (vm *VersionManager) generateVersion(chain *PolicyVersionChain) string {
	if chain == nil || len(chain.Versions) == 0 {
		return "1.0.0"
	}

	latest := chain.Versions[len(chain.Versions)-1]

	// Parse semantic version
	parts := strings.Split(latest.Version, ".")
	if len(parts) != 3 {
		return "1.0.0"
	}

	// Increment patch version
	major := parts[0]
	minor := parts[1]

	// Simple increment - reset patch for new changes
	return fmt.Sprintf("%s.%s.%s", major, minor, "0")
}

// detectChanges detects changes between versions
func (vm *VersionManager) detectChanges(chain *PolicyVersionChain, newContent string) []VersionChange {
	var changes []VersionChange

	if chain == nil || len(chain.Versions) == 0 {
		// Initial version
		changes = append(changes, VersionChange{
			Type:        ChangeTypeAdd,
			Description: "Initial policy version",
		})
		return changes
	}

	latest := chain.Versions[len(chain.Versions)-1]
	oldContent := latest.Content

	// Simple line-by-line comparison
	oldLines := strings.Split(oldContent, "\n")
	newLines := strings.Split(newContent, "\n")

	// Find added lines
	for i, line := range newLines {
		if i >= len(oldLines) || oldLines[i] != line {
			changes = append(changes, VersionChange{
				Type:        ChangeTypeAdd,
				Description: "Added line",
				NewValue:    line,
				LineNumber:  i + 1,
			})
		}
	}

	// Find removed lines
	for i, line := range oldLines {
		if i >= len(newLines) || newLines[i] != line {
			changes = append(changes, VersionChange{
				Type:        ChangeTypeRemove,
				Description: "Removed line",
				OldValue:    line,
				LineNumber:  i + 1,
			})
		}
	}

	return changes
}

// validateVersion validates a policy version
func (vm *VersionManager) validateVersion(version *PolicyVersion) error {
	// Basic validation
	if version.PolicyName == "" {
		return fmt.Errorf("policy name is required")
	}

	if version.Version == "" {
		return fmt.Errorf("version is required")
	}

	if version.Content == "" {
		return fmt.Errorf("content is required")
	}

	if version.CreatedBy == "" {
		return fmt.Errorf("created by is required")
	}

	// TODO: Add more validation:
	// - Rego syntax validation
	// - Policy semantic validation
	// - Security validation
	// - Size limits

	return nil
}

// validateRollback validates a rollback plan
func (vm *VersionManager) validateRollback(ctx context.Context, plan *RollbackPlan) (*RollbackValidation, error) {
	validation := &RollbackValidation{
		Passed:      true,
		Issues:      []ValidationIssue{},
		Warnings:    []ValidationIssue{},
		ValidatedAt: time.Now(),
		ValidatedBy: "system",
	}

	// Check if versions exist
	fromVersion, err := vm.storage.GetVersion(ctx, plan.PolicyName, plan.FromVersion)
	if err != nil {
		validation.Issues = append(validation.Issues, ValidationIssue{
			Severity: "error",
			Code:     "VERSION_NOT_FOUND",
			Message:  fmt.Sprintf("From version %s not found", plan.FromVersion),
		})
		validation.Passed = false
	}

	toVersion, err := vm.storage.GetVersion(ctx, plan.PolicyName, plan.ToVersion)
	if err != nil {
		validation.Issues = append(validation.Issues, ValidationIssue{
			Severity: "error",
			Code:     "VERSION_NOT_FOUND",
			Message:  fmt.Sprintf("To version %s not found", plan.ToVersion),
		})
		validation.Passed = false
	}

	// Check if rollback is backwards compatible
	if fromVersion != nil && toVersion != nil {
		if !vm.isBackwardsCompatible(fromVersion, toVersion) {
			validation.Issues = append(validation.Issues, ValidationIssue{
				Severity:   "warning",
				Code:       "COMPATIBILITY_RISK",
				Message:    "Rollback may not be backwards compatible",
				Suggestion: "Test rollback in staging environment first",
			})
		}
	}

	return validation, nil
}

// analyzeRollbackImpact analyzes the impact of a rollback
func (vm *VersionManager) analyzeRollbackImpact(ctx context.Context, plan *RollbackPlan) (*ImpactAnalysis, error) {
	analysis := &ImpactAnalysis{
		AffectedUsers:       0, // TODO: Calculate from usage data
		AffectedResources:   0, // TODO: Calculate from policy content
		RiskLevel:           "medium",
		EstimatedDowntime:   5 * time.Minute,
		BusinessImpact:      "low",
		Dependencies:        []string{},
		CompatibilityIssues: []CompatibilityIssue{},
		Recommendations:     []string{},
		AnalyzedAt:          time.Now(),
		AnalyzedBy:          "system",
	}

	// TODO: Implement comprehensive impact analysis
	// - Count affected users based on policy scope
	// - Identify dependent policies
	// - Assess business impact
	// - Estimate downtime
	// - Check compatibility issues

	return analysis, nil
}

// isBackwardsCompatible checks if rollback is backwards compatible
func (vm *VersionManager) isBackwardsCompatible(fromVersion, toVersion *PolicyVersion) bool {
	// Simple check - could be enhanced with semantic analysis
	// For now, assume rollbacks to previous versions are compatible
	return true
}

// getVersionChain gets the version chain for a policy
func (vm *VersionManager) getVersionChain(ctx context.Context, policyName string) (*PolicyVersionChain, error) {
	vm.mu.RLock()
	chain, exists := vm.registry[policyName]
	vm.mu.RUnlock()

	if exists {
		return chain, nil
	}

	// Load from storage
	versions, err := vm.storage.ListVersions(ctx, policyName)
	if err != nil {
		return nil, err
	}

	chain = &PolicyVersionChain{
		PolicyName: policyName,
		Versions:   versions,
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}

	// Find active version
	for _, version := range versions {
		if version.IsActive {
			chain.ActiveVersion = version.Version
		}
		if version.IsStable {
			chain.StableVersion = version.Version
		}
	}

	// Cache in registry
	vm.mu.Lock()
	vm.registry[policyName] = chain
	vm.mu.Unlock()

	return chain, nil
}

// updateRegistry updates the version registry
func (vm *VersionManager) updateRegistry(version *PolicyVersion) {
	vm.mu.Lock()
	defer vm.mu.Unlock()

	chain, exists := vm.registry[version.PolicyName]
	if !exists {
		chain = &PolicyVersionChain{
			PolicyName: version.PolicyName,
			Versions:   []*PolicyVersion{},
			CreatedAt:  time.Now(),
		}
	}

	chain.Versions = append(chain.Versions, version)
	chain.UpdatedAt = time.Now()

	vm.registry[version.PolicyName] = chain
}

// cleanupOldVersions removes old versions if exceeds limit
func (vm *VersionManager) cleanupOldVersions(ctx context.Context, policyName string) error {
	if vm.config.MaxVersionsPerChain <= 0 {
		return nil
	}

	versions, err := vm.storage.ListVersions(ctx, policyName)
	if err != nil {
		return err
	}

	if len(versions) <= vm.config.MaxVersionsPerChain {
		return nil
	}

	// Sort by creation time
	// TODO: Implement sorting

	// Remove oldest versions, keeping active and stable versions
	toRemove := len(versions) - vm.config.MaxVersionsPerChain
	for i := 0; i < toRemove; i++ {
		version := versions[i]
		if !version.IsActive && !version.IsStable {
			if err := vm.storage.DeleteVersion(ctx, policyName, version.Version); err != nil {
				vm.logger.Warn("Failed to delete old version", map[string]interface{}{
					"policy":  policyName,
					"version": version.Version,
					"error":   err.Error(),
				})
			}
		}
	}

	return nil
}
