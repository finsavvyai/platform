package policy

import (
	"context"
	"fmt"
	"regexp"
	"strings"
	"time"
)

// RuleOverlapRule detects overlapping rules within policies
type RuleOverlapRule struct {
	logger Logger
}

// NewRuleOverlapRule creates a new rule overlap detection rule
func NewRuleOverlapRule(logger Logger) *RuleOverlapRule {
	return &RuleOverlapRule{logger: logger}
}

func (r *RuleOverlapRule) GetRuleName() string {
	return "rule_overlap"
}

func (r *RuleOverlapRule) GetRuleType() ConflictType {
	return ConflictTypeRuleOverlap
}

func (r *RuleOverlapRule) DetectConflict(ctx context.Context, bundle *PolicyBundle) ([]Conflict, error) {
	var conflicts []Conflict

	for policyName, policyContent := range bundle.Policies {
		// Parse rules from policy content
		rules := r.extractRules(policyContent)

		// Check for overlapping conditions
		for i, rule1 := range rules {
			for j, rule2 := range rules {
				if i >= j {
					continue
				}

				if r.rulesOverlap(rule1, rule2) {
					conflict := Conflict{
						ID:             fmt.Sprintf("overlap_%s_%d_%d", policyName, i, j),
						Type:           ConflictTypeRuleOverlap,
						Severity:       r.determineOverlapSeverity(rule1, rule2),
						Description:    fmt.Sprintf("Overlapping rules detected in policy %s", policyName),
						Policies:       []string{policyName},
						Rules:          []string{rule1.name, rule2.name},
						Suggestions:    r.generateOverlapSuggestions(rule1, rule2),
						AutoResolvable: true,
						DetectedAt:     time.Now(),
						Metadata: map[string]interface{}{
							"rule1_condition": rule1.condition,
							"rule2_condition": rule2.condition,
						},
					}
					conflicts = append(conflicts, conflict)
				}
			}
		}
	}

	return conflicts, nil
}

// PolicyRule represents a parsed policy rule
type PolicyRule struct {
	name      string
	condition string
	action    string
	line      int
}

// extractRules extracts rules from Rego policy content
func (r *RuleOverlapRule) extractRules(content string) []PolicyRule {
	var rules []PolicyRule

	lines := strings.Split(content, "\n")
	for i, line := range lines {
		line = strings.TrimSpace(line)

		// Match rule definitions
		if strings.HasPrefix(line, "allow {") ||
			strings.HasPrefix(line, "deny {") ||
			strings.HasPrefix(line, "default allow =") ||
			strings.HasPrefix(line, "default deny =") {
			rules = append(rules, PolicyRule{
				name:      fmt.Sprintf("rule_%d", i),
				condition: line,
				action:    strings.Fields(line)[0],
				line:      i,
			})
		}

		// Match function definitions
		if strings.Contains(line, " := ") {
			parts := strings.Split(line, " := ")
			if len(parts) == 2 {
				rules = append(rules, PolicyRule{
					name:      strings.TrimSpace(parts[0]),
					condition: strings.TrimSpace(parts[1]),
					action:    "function",
					line:      i,
				})
			}
		}
	}

	return rules
}

// rulesOverlap checks if two rules have overlapping conditions
func (r *RuleOverlapRule) rulesOverlap(rule1, rule2 PolicyRule) bool {
	// Check if conditions are similar
	if r.conditionsSimilar(rule1.condition, rule2.condition) {
		return true
	}

	// Check if rules target similar resources
	if r.targetsSimilar(rule1.condition, rule2.condition) {
		return true
	}

	// Check if rules have similar actions
	if rule1.action == rule2.action && rule1.action != "function" {
		return true
	}

	return false
}

// conditionsSimilar checks if two conditions are similar
func (r *RuleOverlapRule) conditionsSimilar(cond1, cond2 string) bool {
	// Simple similarity check - can be enhanced with NLP
	cond1Lower := strings.ToLower(cond1)
	cond2Lower := strings.ToLower(cond2)

	// Check for common patterns
	patterns := []string{
		`user\.\w+`,
		`resource\.\w+`,
		`input\.\w+`,
		`\w+\s*==\s*`,
		`\w+\s*>\s*`,
		`\w+\s*<\s*`,
	}

	for _, pattern := range patterns {
		re1, err1 := regexp.Compile(pattern)
		re2, err2 := regexp.Compile(pattern)

		if err1 == nil && err2 == nil {
			matches1 := re1.FindAllString(cond1Lower, -1)
			matches2 := re2.FindAllString(cond2Lower, -1)

			// If conditions share multiple similar patterns, they might overlap
			if len(matches1) > 0 && len(matches2) > 0 {
				common := 0
				for _, m1 := range matches1 {
					for _, m2 := range matches2 {
						if m1 == m2 {
							common++
						}
					}
				}

				if common >= 2 {
					return true
				}
			}
		}
	}

	return false
}

// targetsSimilar checks if rules target similar resources
func (r *RuleOverlapRule) targetsSimilar(cond1, cond2 string) bool {
	// Extract resource references from conditions
	resources1 := r.extractResources(cond1)
	resources2 := r.extractResources(cond2)

	// Check for common resources
	for _, res1 := range resources1 {
		for _, res2 := range resources2 {
			if res1 == res2 {
				return true
			}
		}
	}

	return false
}

// extractResources extracts resource references from a condition
func (r *RuleOverlapRule) extractResources(condition string) []string {
	var resources []string

	// Common resource patterns
	patterns := []string{
		`resource\.(\w+)`,
		`input\.resource\.(\w+)`,
		`document\.(\w+)`,
		`data\.(\w+)`,
	}

	for _, pattern := range patterns {
		re, err := regexp.Compile(pattern)
		if err == nil {
			matches := re.FindAllStringSubmatch(condition, -1)
			for _, match := range matches {
				if len(match) > 1 {
					resources = append(resources, match[1])
				}
			}
		}
	}

	return resources
}

// determineOverlapSeverity determines the severity of rule overlap
func (r *RuleOverlapRule) determineOverlapSeverity(rule1, rule2 PolicyRule) ConflictSeverity {
	// Critical if both are allow/deny rules with similar conditions
	if (rule1.action == "allow" || rule1.action == "deny") &&
		(rule2.action == "allow" || rule2.action == "deny") {
		return SeverityCritical
	}

	// High if one is allow and other is deny
	if (rule1.action == "allow" && rule2.action == "deny") ||
		(rule1.action == "deny" && rule2.action == "allow") {
		return SeverityHigh
	}

	// Medium if both are functions
	if rule1.action == "function" && rule2.action == "function" {
		return SeverityMedium
	}

	return SeverityLow
}

// generateOverlapSuggestions generates suggestions for resolving rule overlap
func (r *RuleOverlapRule) generateOverlapSuggestions(rule1, rule2 PolicyRule) []ResolutionSuggestion {
	suggestions := []ResolutionSuggestion{
		{
			Type:        "rule_priority",
			Description: "Set rule priority to resolve overlap",
			Action:      "Add priority metadata to determine which rule takes precedence",
			AutoApply:   true,
		},
		{
			Type:        "rule_merge",
			Description: "Merge overlapping rules into a single rule",
			Action:      "Combine conditions and actions from both rules",
			AutoApply:   true,
		},
		{
			Type:        "rule_removal",
			Description: "Remove redundant rule",
			Action:      "Remove the less specific rule",
			AutoApply:   false,
		},
	}

	return suggestions
}

// PermissionGapRule detects permission gaps in policies
type PermissionGapRule struct {
	logger Logger
}

// NewPermissionGapRule creates a new permission gap detection rule
func NewPermissionGapRule(logger Logger) *PermissionGapRule {
	return &PermissionGapRule{logger: logger}
}

func (r *PermissionGapRule) GetRuleName() string {
	return "permission_gap"
}

func (r *PermissionGapRule) GetRuleType() ConflictType {
	return ConflictTypePermissionGap
}

func (r *PermissionGapRule) DetectConflict(ctx context.Context, bundle *PolicyBundle) ([]Conflict, error) {
	var conflicts []Conflict

	// Analyze authorization policies
	for policyName, policyContent := range bundle.Policies {
		if strings.Contains(policyName, "auth") || strings.Contains(policyName, "access") {
			gaps := r.analyzePermissionGaps(policyContent, policyName)
			conflicts = append(conflicts, gaps...)
		}
	}

	return conflicts, nil
}

// analyzePermissionGaps analyzes a policy for permission gaps
func (r *PermissionGapRule) analyzePermissionGaps(content, policyName string) []Conflict {
	var conflicts []Conflict

	// Check for common permission gaps
	gaps := []struct {
		name        string
		description string
		check       func(string) bool
		severity    ConflictSeverity
	}{
		{
			name:        "missing_tenant_isolation",
			description: "Policy lacks tenant isolation checks",
			check:       r.hasTenantIsolation,
			severity:    SeverityCritical,
		},
		{
			name:        "missing_role_hierarchy",
			description: "Policy lacks proper role hierarchy enforcement",
			check:       r.hasRoleHierarchy,
			severity:    SeverityHigh,
		},
		{
			name:        "missing_time_restrictions",
			description: "Policy lacks time-based access restrictions",
			check:       r.hasTimeRestrictions,
			severity:    SeverityMedium,
		},
		{
			name:        "missing_geographic_restrictions",
			description: "Policy lacks geographic access restrictions",
			check:       r.hasGeographicRestrictions,
			severity:    SeverityMedium,
		},
		{
			name:        "missing_mfa_requirements",
			description: "Policy lacks MFA requirements for sensitive operations",
			check:       r.hasMFARequirements,
			severity:    SeverityHigh,
		},
	}

	for _, gap := range gaps {
		if !gap.check(content) {
			conflict := Conflict{
				ID:             fmt.Sprintf("gap_%s_%s", policyName, gap.name),
				Type:           ConflictTypePermissionGap,
				Severity:       gap.severity,
				Description:    gap.description,
				Policies:       []string{policyName},
				Rules:          []string{gap.name},
				Suggestions:    r.generateGapSuggestions(gap.name),
				AutoResolvable: true,
				DetectedAt:     time.Now(),
				Metadata: map[string]interface{}{
					"gap_type": gap.name,
				},
			}
			conflicts = append(conflicts, conflict)
		}
	}

	return conflicts
}

// Permission gap check functions
func (r *PermissionGapRule) hasTenantIsolation(content string) bool {
	patterns := []string{
		`tenant_id`,
		`tenant\.id`,
		`input\.tenant`,
		`user\.tenant_id`,
	}

	for _, pattern := range patterns {
		if matched, _ := regexp.MatchString(pattern, content); matched {
			return true
		}
	}
	return false
}

func (r *PermissionGapRule) hasRoleHierarchy(content string) bool {
	patterns := []string{
		`role_hierarchy`,
		`role_permissions`,
		`clearance_level`,
		`role\s*==\s*["']admin["']`,
	}

	for _, pattern := range patterns {
		if matched, _ := regexp.MatchString(pattern, content); matched {
			return true
		}
	}
	return false
}

func (r *PermissionGapRule) hasTimeRestrictions(content string) bool {
	patterns := []string{
		`time\.(hour|day|weekday)`,
		`business_hours`,
		`time_based`,
		`time_restrictions`,
	}

	for _, pattern := range patterns {
		if matched, _ := regexp.MatchString(pattern, content); matched {
			return true
		}
	}
	return false
}

func (r *PermissionGapRule) hasGeographicRestrictions(content string) bool {
	patterns := []string{
		`geographic`,
		`location\.country`,
		`allowed_countries`,
		`geographic_restrictions`,
	}

	for _, pattern := range patterns {
		if matched, _ := regexp.MatchString(pattern, content); matched {
			return true
		}
	}
	return false
}

func (r *PermissionGapRule) hasMFARequirements(content string) bool {
	patterns := []string{
		`mfa`,
		`multi_factor`,
		`2fa`,
		`two_factor`,
	}

	for _, pattern := range patterns {
		if matched, _ := regexp.MatchString(pattern, content); matched {
			return true
		}
	}
	return false
}

// generateGapSuggestions generates suggestions for resolving permission gaps
func (r *PermissionGapRule) generateGapSuggestions(gapType string) []ResolutionSuggestion {
	suggestions := []ResolutionSuggestion{
		{
			Type:        "add_security_check",
			Description: fmt.Sprintf("Add missing security check for %s", gapType),
			Action:      "Add appropriate security controls to the policy",
			AutoApply:   true,
		},
	}

	return suggestions
}

// LogicalConflictRule detects logical conflicts in policies
type LogicalConflictRule struct {
	logger Logger
}

// NewLogicalConflictRule creates a new logical conflict detection rule
func NewLogicalConflictRule(logger Logger) *LogicalConflictRule {
	return &LogicalConflictRule{logger: logger}
}

func (r *LogicalConflictRule) GetRuleName() string {
	return "logical_conflict"
}

func (r *LogicalConflictRule) GetRuleType() ConflictType {
	return ConflictTypeLogicalConflict
}

func (r *LogicalConflictRule) DetectConflict(ctx context.Context, bundle *PolicyBundle) ([]Conflict, error) {
	var conflicts []Conflict

	for policyName, policyContent := range bundle.Policies {
		// Check for allow all followed by deny all
		if r.hasConflictingDefaults(policyContent) {
			conflict := Conflict{
				ID:          fmt.Sprintf("logical_conflict_%s", policyName),
				Type:        ConflictTypeLogicalConflict,
				Severity:    SeverityCritical,
				Description: "Policy has conflicting default statements",
				Policies:    []string{policyName},
				Rules:       []string{"default_allow", "default_deny"},
				Suggestions: []ResolutionSuggestion{
					{
						Type:        "remove_conflict",
						Description: "Remove conflicting default statement",
						Action:      "Keep only one default statement (prefer deny by default)",
						AutoApply:   true,
					},
				},
				AutoResolvable: true,
				DetectedAt:     time.Now(),
			}
			conflicts = append(conflicts, conflict)
		}

		// Check for unreachable rules
		unreachable := r.findUnreachableRules(policyContent)
		if len(unreachable) > 0 {
			conflict := Conflict{
				ID:          fmt.Sprintf("unreachable_%s", policyName),
				Type:        ConflictTypeLogicalConflict,
				Severity:    SeverityMedium,
				Description: fmt.Sprintf("Policy contains %d unreachable rules", len(unreachable)),
				Policies:    []string{policyName},
				Rules:       unreachable,
				Suggestions: []ResolutionSuggestion{
					{
						Type:        "remove_unreachable",
						Description: "Remove unreachable rules",
						Action:      "Delete rules that can never be evaluated",
						AutoApply:   true,
					},
				},
				AutoResolvable: true,
				DetectedAt:     time.Now(),
			}
			conflicts = append(conflicts, conflict)
		}
	}

	return conflicts, nil
}

// hasConflictingDefaults checks for conflicting default statements
func (r *LogicalConflictRule) hasConflictingDefaults(content string) bool {
	hasAllowDefault := strings.Contains(content, "default allow = true")
	hasDenyDefault := strings.Contains(content, "default deny = true") ||
		strings.Contains(content, "default allow = false")

	return hasAllowDefault && hasDenyDefault
}

// findUnreachableRules finds rules that can never be reached
func (r *LogicalConflictRule) findUnreachableRules(content string) []string {
	var unreachable []string

	// Look for rules after return statements or after unconditional allow/deny
	lines := strings.Split(content, "\n")
	for i, line := range lines {
		line = strings.TrimSpace(line)

		// Check for unconditional return
		if strings.Contains(line, "return") && !strings.Contains(line, "if") {
			// Rules after this are unreachable
			if i < len(lines)-1 {
				for j := i + 1; j < len(lines); j++ {
					nextLine := strings.TrimSpace(lines[j])
					if nextLine != "" && !strings.HasPrefix(nextLine, "#") {
						unreachable = append(unreachable, fmt.Sprintf("rule_%d", j))
					}
				}
				break
			}
		}
	}

	return unreachable
}

// NamingConflictRule detects naming conflicts
type NamingConflictRule struct {
	logger Logger
}

// NewNamingConflictRule creates a new naming conflict detection rule
func NewNamingConflictRule(logger Logger) *NamingConflictRule {
	return &NamingConflictRule{logger: logger}
}

func (r *NamingConflictRule) GetRuleName() string {
	return "naming_conflict"
}

func (r *NamingConflictRule) GetRuleType() ConflictType {
	return ConflictTypeNamingConflict
}

func (r *NamingConflictRule) DetectConflict(ctx context.Context, bundle *PolicyBundle) ([]Conflict, error) {
	var conflicts []Conflict

	// Check for duplicate policy names
	policyNames := make(map[string][]string)
	for name := range bundle.Policies {
		baseName := strings.Split(name, ".")[0]
		policyNames[baseName] = append(policyNames[baseName], name)
	}

	for baseName, variants := range policyNames {
		if len(variants) > 1 {
			conflict := Conflict{
				ID:          fmt.Sprintf("naming_conflict_%s", baseName),
				Type:        ConflictTypeNamingConflict,
				Severity:    SeverityMedium,
				Description: fmt.Sprintf("Multiple policies with similar names: %s", strings.Join(variants, ", ")),
				Policies:    variants,
				Rules:       []string{"naming_convention"},
				Suggestions: []ResolutionSuggestion{
					{
						Type:        "rename_policy",
						Description: "Rename policies to follow naming conventions",
						Action:      "Use descriptive, unique names for each policy",
						AutoApply:   true,
					},
				},
				AutoResolvable: true,
				DetectedAt:     time.Now(),
			}
			conflicts = append(conflicts, conflict)
		}
	}

	return conflicts, nil
}

// VersionConflictRule detects version conflicts
type VersionConflictRule struct {
	logger Logger
}

// NewVersionConflictRule creates a new version conflict detection rule
func NewVersionConflictRule(logger Logger) *VersionConflictRule {
	return &VersionConflictRule{logger: logger}
}

func (r *VersionConflictRule) GetRuleName() string {
	return "version_conflict"
}

func (r *VersionConflictRule) GetRuleType() ConflictType {
	return ConflictTypeVersionConflict
}

func (r *VersionConflictRule) DetectConflict(ctx context.Context, bundle *PolicyBundle) ([]Conflict, error) {
	var conflicts []Conflict

	// Check version format consistency
	if !r.isValidVersion(bundle.Version) {
		conflict := Conflict{
			ID:          fmt.Sprintf("version_conflict_%s", bundle.Name),
			Type:        ConflictTypeVersionConflict,
			Severity:    SeverityLow,
			Description: fmt.Sprintf("Invalid version format: %s", bundle.Version),
			Policies:    []string{bundle.Name},
			Rules:       []string{"version_format"},
			Suggestions: []ResolutionSuggestion{
				{
					Type:        "fix_version",
					Description: "Fix version format to follow semantic versioning",
					Action:      "Use format like v1.0.0 or 1.0.0",
					AutoApply:   true,
				},
			},
			AutoResolvable: true,
			DetectedAt:     time.Now(),
		}
		conflicts = append(conflicts, conflict)
	}

	return conflicts, nil
}

// isValidVersion checks if a version string is valid
func (r *VersionConflictRule) isValidVersion(version string) bool {
	// Semantic versioning pattern
	semverPattern := `^v?\d+\.\d+\.\d+(-[a-zA-Z0-9\-]+)?$`
	matched, _ := regexp.MatchString(semverPattern, version)
	return matched
}
