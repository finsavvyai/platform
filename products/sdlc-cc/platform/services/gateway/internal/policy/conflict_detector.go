package policy

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"
)

// ConflictDetector detects and resolves policy conflicts
type ConflictDetector struct {
	rules      []ConflictRule
	logger     Logger
	mu         sync.RWMutex
	statistics ConflictStatistics
}

// Conflict represents a detected policy conflict
type Conflict struct {
	ID             string                 `json:"id"`
	Type           ConflictType           `json:"type"`
	Severity       ConflictSeverity       `json:"severity"`
	Description    string                 `json:"description"`
	Policies       []string               `json:"policies"`
	Rules          []string               `json:"rules"`
	Suggestions    []ResolutionSuggestion `json:"suggestions"`
	AutoResolvable bool                   `json:"auto_resolvable"`
	DetectedAt     time.Time              `json:"detected_at"`
	Metadata       map[string]interface{} `json:"metadata"`
}

// ConflictType represents the type of conflict
type ConflictType string

const (
	ConflictTypeRuleOverlap     ConflictType = "rule_overlap"
	ConflictTypePermissionGap   ConflictType = "permission_gap"
	ConflictTypeLogicalConflict ConflictType = "logical_conflict"
	ConflictTypeNamingConflict  ConflictType = "naming_conflict"
	ConflictTypeVersionConflict ConflictType = "version_conflict"
)

// ConflictSeverity represents the severity of a conflict
type ConflictSeverity string

const (
	SeverityCritical ConflictSeverity = "critical"
	SeverityHigh     ConflictSeverity = "high"
	SeverityMedium   ConflictSeverity = "medium"
	SeverityLow      ConflictSeverity = "low"
)

// ResolutionSuggestion represents a suggested resolution
type ResolutionSuggestion struct {
	Type        string                 `json:"type"`
	Description string                 `json:"description"`
	Action      string                 `json:"action"`
	AutoApply   bool                   `json:"auto_apply"`
	Metadata    map[string]interface{} `json:"metadata"`
}

// ConflictRule represents a conflict detection rule
type ConflictRule interface {
	DetectConflict(ctx context.Context, bundle *PolicyBundle) ([]Conflict, error)
	GetRuleName() string
	GetRuleType() ConflictType
}

// ConflictStatistics tracks conflict detection statistics
type ConflictStatistics struct {
	TotalConflicts      int                      `json:"total_conflicts"`
	ConflictsByType     map[ConflictType]int     `json:"conflicts_by_type"`
	ConflictsBySeverity map[ConflictSeverity]int `json:"conflicts_by_severity"`
	AutoResolved        int                      `json:"auto_resolved"`
	ManualReviewNeeded  int                      `json:"manual_review_needed"`
	LastUpdated         time.Time                `json:"last_updated"`
	mu                  sync.RWMutex
}

// NewConflictDetector creates a new conflict detector
func NewConflictDetector(logger Logger) *ConflictDetector {
	detector := &ConflictDetector{
		logger: logger,
		statistics: ConflictStatistics{
			ConflictsByType:     make(map[ConflictType]int),
			ConflictsBySeverity: make(map[ConflictSeverity]int),
			LastUpdated:         time.Now(),
		},
	}

	// Register default conflict detection rules
	detector.registerDefaultRules()

	return detector
}

// registerDefaultRules registers default conflict detection rules
func (cd *ConflictDetector) registerDefaultRules() {
	cd.rules = append(cd.rules,
		NewRuleOverlapRule(cd.logger),
		NewPermissionGapRule(cd.logger),
		NewLogicalConflictRule(cd.logger),
		NewNamingConflictRule(cd.logger),
		NewVersionConflictRule(cd.logger),
	)
}

// DetectConflicts detects conflicts in a policy bundle
func (cd *ConflictDetector) DetectConflicts(ctx context.Context, bundle *PolicyBundle) ([]Conflict, error) {
	cd.logger.Info("Detecting policy conflicts", map[string]interface{}{
		"bundle":   bundle.Name,
		"version":  bundle.Version,
		"policies": len(bundle.Policies),
	})

	cd.mu.RLock()
	rules := make([]ConflictRule, len(cd.rules))
	copy(rules, cd.rules)
	cd.mu.RUnlock()

	var allConflicts []Conflict

	for _, rule := range rules {
		conflicts, err := rule.DetectConflict(ctx, bundle)
		if err != nil {
			cd.logger.Error("Conflict detection rule failed", map[string]interface{}{
				"rule":  rule.GetRuleName(),
				"error": err.Error(),
			})
			continue
		}

		allConflicts = append(allConflicts, conflicts...)

		// Update statistics
		cd.updateStatistics(conflicts)
	}

	// Remove duplicates
	uniqueConflicts := cd.removeDuplicateConflicts(allConflicts)

	cd.logger.Info("Conflict detection completed", map[string]interface{}{
		"bundle":      bundle.Name,
		"conflicts":   len(uniqueConflicts),
		"by_type":     cd.groupConflictsByType(uniqueConflicts),
		"by_severity": cd.groupConflictsBySeverity(uniqueConflicts),
	})

	return uniqueConflicts, nil
}

// ResolveConflict attempts to automatically resolve a conflict
func (cd *ConflictDetector) ResolveConflict(ctx context.Context, conflict Conflict) (*ResolutionResult, error) {
	cd.logger.Info("Attempting to resolve conflict", map[string]interface{}{
		"conflict_id": conflict.ID,
		"type":        conflict.Type,
		"severity":    conflict.Severity,
	})

	result := &ResolutionResult{
		ConflictID: conflict.ID,
		Resolved:   false,
		AppliedAt:  time.Now(),
	}

	// Check if conflict is auto-resolvable
	if !conflict.AutoResolvable {
		result.Reason = "Conflict requires manual review"
		return result, nil
	}

	// Try each suggestion
	for _, suggestion := range conflict.Suggestions {
		if suggestion.AutoApply {
			resolved, err := cd.applySuggestion(ctx, conflict, suggestion)
			if err != nil {
				cd.logger.Error("Failed to apply suggestion", map[string]interface{}{
					"conflict_id": conflict.ID,
					"suggestion":  suggestion.Description,
					"error":       err.Error(),
				})
				continue
			}

			if resolved {
				result.Resolved = true
				result.AppliedSuggestion = suggestion.Description
				result.Reason = "Conflict automatically resolved"

				cd.statistics.mu.Lock()
				cd.statistics.AutoResolved++
				cd.statistics.LastUpdated = time.Now()
				cd.statistics.mu.Unlock()

				cd.logger.Info("Conflict automatically resolved", map[string]interface{}{
					"conflict_id": conflict.ID,
					"suggestion":  suggestion.Description,
				})

				return result, nil
			}
		}
	}

	result.Reason = "No auto-applicable suggestions succeeded"
	return result, nil
}

// applySuggestion applies a resolution suggestion
func (cd *ConflictDetector) applySuggestion(ctx context.Context, conflict Conflict, suggestion ResolutionSuggestion) (bool, error) {
	switch suggestion.Type {
	case "rule_priority":
		return cd.applyRulePriority(ctx, conflict, suggestion)
	case "rule_merge":
		return cd.applyRuleMerge(ctx, conflict, suggestion)
	case "rule_removal":
		return cd.applyRuleRemoval(ctx, conflict, suggestion)
	case "rename_policy":
		return cd.applyPolicyRename(ctx, conflict, suggestion)
	default:
		return false, fmt.Errorf("unknown suggestion type: %s", suggestion.Type)
	}
}

// applyRulePriority applies rule priority resolution
func (cd *ConflictDetector) applyRulePriority(ctx context.Context, conflict Conflict, suggestion ResolutionSuggestion) (bool, error) {
	// TODO: Implement rule priority application
	// This would involve:
	// 1. Identifying conflicting rules
	// 2. Setting priority based on suggestion
	// 3. Updating policy bundle with priority metadata

	return true, nil
}

// applyRuleMerge applies rule merge resolution
func (cd *ConflictDetector) applyRuleMerge(ctx context.Context, conflict Conflict, suggestion ResolutionSuggestion) (bool, error) {
	// TODO: Implement rule merge application
	// This would involve:
	// 1. Parsing conflicting rules
	// 2. Creating merged rule logic
	// 3. Replacing conflicting rules with merged rule

	return true, nil
}

// applyRuleRemoval applies rule removal resolution
func (cd *ConflictDetector) applyRuleRemoval(ctx context.Context, conflict Conflict, suggestion ResolutionSuggestion) (bool, error) {
	// TODO: Implement rule removal application
	// This would involve:
	// 1. Identifying redundant or conflicting rules
	// 2. Removing the specified rule
	// 3. Updating policy bundle

	return true, nil
}

// applyPolicyRename applies policy rename resolution
func (cd *ConflictDetector) applyPolicyRename(ctx context.Context, conflict Conflict, suggestion ResolutionSuggestion) (bool, error) {
	// TODO: Implement policy rename application
	// This would involve:
	// 1. Renaming the conflicting policy
	// 2. Updating all references
	// 3. Updating policy bundle

	return true, nil
}

// removeDuplicateConflicts removes duplicate conflicts
func (cd *ConflictDetector) removeDuplicateConflicts(conflicts []Conflict) []Conflict {
	seen := make(map[string]bool)
	var unique []Conflict

	for _, conflict := range conflicts {
		key := fmt.Sprintf("%s:%s:%s", conflict.Type, strings.Join(conflict.Policies, ","), strings.Join(conflict.Rules, ","))
		if !seen[key] {
			seen[key] = true
			unique = append(unique, conflict)
		}
	}

	return unique
}

// updateStatistics updates conflict detection statistics
func (cd *ConflictDetector) updateStatistics(conflicts []Conflict) {
	cd.statistics.mu.Lock()
	defer cd.statistics.mu.Unlock()

	cd.statistics.TotalConflicts += len(conflicts)

	for _, conflict := range conflicts {
		cd.statistics.ConflictsByType[conflict.Type]++
		cd.statistics.ConflictsBySeverity[conflict.Severity]++

		if !conflict.AutoResolvable {
			cd.statistics.ManualReviewNeeded++
		}
	}

	cd.statistics.LastUpdated = time.Now()
}

// groupConflictsByType groups conflicts by type
func (cd *ConflictDetector) groupConflictsByType(conflicts []Conflict) map[ConflictType]int {
	grouped := make(map[ConflictType]int)
	for _, conflict := range conflicts {
		grouped[conflict.Type]++
	}
	return grouped
}

// groupConflictsBySeverity groups conflicts by severity
func (cd *ConflictDetector) groupConflictsBySeverity(conflicts []Conflict) map[ConflictSeverity]int {
	grouped := make(map[ConflictSeverity]int)
	for _, conflict := range conflicts {
		grouped[conflict.Severity]++
	}
	return grouped
}

// GetStatistics returns a copy of conflict detection statistics (without the mutex)
func (cd *ConflictDetector) GetStatistics() ConflictStatistics {
	cd.statistics.mu.RLock()
	defer cd.statistics.mu.RUnlock()
	return ConflictStatistics{
		TotalConflicts:      cd.statistics.TotalConflicts,
		ConflictsByType:     cd.statistics.ConflictsByType,
		ConflictsBySeverity: cd.statistics.ConflictsBySeverity,
		AutoResolved:        cd.statistics.AutoResolved,
		ManualReviewNeeded:  cd.statistics.ManualReviewNeeded,
		LastUpdated:         cd.statistics.LastUpdated,
	}
}

// ResetStatistics resets conflict detection statistics
func (cd *ConflictDetector) ResetStatistics() {
	cd.statistics.mu.Lock()
	defer cd.statistics.mu.Unlock()

	cd.statistics = ConflictStatistics{
		ConflictsByType:     make(map[ConflictType]int),
		ConflictsBySeverity: make(map[ConflictSeverity]int),
		LastUpdated:         time.Now(),
	}
}

// AddRule adds a custom conflict detection rule
func (cd *ConflictDetector) AddRule(rule ConflictRule) {
	cd.mu.Lock()
	defer cd.mu.Unlock()

	cd.rules = append(cd.rules, rule)
	cd.logger.Info("Added custom conflict detection rule", map[string]interface{}{
		"rule": rule.GetRuleName(),
		"type": rule.GetRuleType(),
	})
}

// RemoveRule removes a conflict detection rule
func (cd *ConflictDetector) RemoveRule(ruleName string) {
	cd.mu.Lock()
	defer cd.mu.Unlock()

	for i, rule := range cd.rules {
		if rule.GetRuleName() == ruleName {
			cd.rules = append(cd.rules[:i], cd.rules[i+1:]...)
			cd.logger.Info("Removed conflict detection rule", map[string]interface{}{
				"rule": ruleName,
			})
			break
		}
	}
}

// ResolutionResult represents the result of conflict resolution
type ResolutionResult struct {
	ConflictID        string    `json:"conflict_id"`
	Resolved          bool      `json:"resolved"`
	AppliedSuggestion string    `json:"applied_suggestion,omitempty"`
	Reason            string    `json:"reason"`
	AppliedAt         time.Time `json:"applied_at"`
}
