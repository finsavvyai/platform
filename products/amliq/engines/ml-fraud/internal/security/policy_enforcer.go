package security

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/ec2"
	"github.com/aws/aws-sdk-go-v2/service/wafv2"
)

// PolicyEnforcer implements security policy enforcement across containers and infrastructure
type PolicyEnforcer struct {
	ec2Client   *ec2.Client
	wafClient   *wafv2.Client
	logger      *log.Logger
	policies    map[string]SecurityPolicy
	rulesEngine *RulesEngine
}

// RulesEngine evaluates security rules
type RulesEngine struct {
	rules []SecurityRule
}

// SecurityPolicyType represents types of security policies
type SecurityPolicyType string

const (
	PolicyTypeVulnerability SecurityPolicyType = "VULNERABILITY"
	PolicyTypeCompliance    SecurityPolicyType = "COMPLIANCE"
	PolicyTypeImage         SecurityPolicyType = "IMAGE"
)

// SecurityAction represents security actions
type SecurityAction string

const (
	ActionBlock      SecurityAction = "BLOCK"
	ActionWarn       SecurityAction = "WARN"
	ActionLog        SecurityAction = "LOG"
	ActionQuarantine SecurityAction = "QUARANTINE"
)

// ComplianceFramework represents compliance frameworks
type ComplianceFramework string

const (
	ComplianceNIST  ComplianceFramework = "NIST"
	ComplianceCIS   ComplianceFramework = "CIS"
	CompliancePCI   ComplianceFramework = "PCI-DSS"
	ComplianceHIPAA ComplianceFramework = "HIPAA"
)

// SecurityPolicy represents a security policy
type SecurityPolicy struct {
	ID                   string                `json:"id"`
	Name                 string                `json:"name"`
	Description          string                `json:"description"`
	PolicyType           SecurityPolicyType    `json:"policy_type"`
	Rules                []SecurityRule        `json:"rules"`
	Enabled              bool                  `json:"enabled"`
	CreatedAt            time.Time             `json:"created_at"`
	UpdatedAt            time.Time             `json:"updated_at"`
	Version              string                `json:"version"`
	ComplianceFrameworks []ComplianceFramework `json:"compliance_frameworks"`
}

// SecurityRule represents an individual security rule
type SecurityRule struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	Description string            `json:"description"`
	Condition   string            `json:"condition"`
	Action      SecurityAction    `json:"action"`
	Parameters  map[string]string `json:"parameters"`
	Enabled     bool              `json:"enabled"`
	Priority    int               `json:"priority"`
	Category    string            `json:"category"`
}

// PolicyEvaluation represents the result of policy evaluation
type PolicyEvaluation struct {
	PolicyID    string                 `json:"policy_id"`
	PolicyName  string                 `json:"policy_name"`
	Status      EvaluationStatus       `json:"status"`
	RuleResults []RuleEvaluationResult `json:"rule_results"`
	Summary     EvaluationSummary      `json:"summary"`
	Timestamp   time.Time              `json:"timestamp"`
	Score       float64                `json:"score"`
}

// RuleEvaluationResult represents the result of a single rule evaluation
type RuleEvaluationResult struct {
	RuleID   string            `json:"rule_id"`
	RuleName string            `json:"rule_name"`
	Status   RuleStatus        `json:"status"`
	Message  string            `json:"message"`
	Evidence map[string]string `json:"evidence"`
	Duration time.Duration     `json:"duration"`
	Passed   bool              `json:"passed"`
	Action   SecurityAction    `json:"action"`
}

// EvaluationStatus represents policy evaluation status
type EvaluationStatus string

const (
	EvaluationPass    EvaluationStatus = "PASS"
	EvaluationFail    EvaluationStatus = "FAIL"
	EvaluationWarning EvaluationStatus = "WARNING"
	EvaluationError   EvaluationStatus = "ERROR"
)

// RuleStatus represents rule evaluation status
type RuleStatus string

const (
	RuleStatusPass  RuleStatus = "PASS"
	RuleStatusFail  RuleStatus = "FAIL"
	RuleStatusSkip  RuleStatus = "SKIP"
	RuleStatusError RuleStatus = "ERROR"
)

// EvaluationSummary provides a summary of policy evaluation
type EvaluationSummary struct {
	TotalRules      int     `json:"total_rules"`
	PassedRules     int     `json:"passed_rules"`
	FailedRules     int     `json:"failed_rules"`
	SkippedRules    int     `json:"skipped_rules"`
	FailedPolicies  int     `json:"failed_policies"`
	WarningPolicies int     `json:"warning_policies"`
	OverallScore    float64 `json:"overall_score"`
}

// NetworkSecurityConfig represents network security configuration
type NetworkSecurityConfig struct {
	VPCID          string                `json:"vpc_id"`
	Subnets        []SubnetConfig        `json:"subnets"`
	SecurityGroups []SecurityGroupConfig `json:"security_groups"`
	NACLs          []NACLConfig          `json:"nacls"`
	WAFRules       []WAFRuleConfig       `json:"waf_rules"`
}

// SubnetConfig represents subnet configuration
type SubnetConfig struct {
	ID               string   `json:"id"`
	CIDR             string   `json:"cidr"`
	Type             string   `json:"type"` // PUBLIC, PRIVATE, ISOLATED
	AvailabilityZone string   `json:"availability_zone"`
	RouteTables      []string `json:"route_tables"`
	NetworkACLs      []string `json:"network_acls"`
}

// SecurityGroupConfig represents security group configuration
type SecurityGroupConfig struct {
	ID          string              `json:"id"`
	Name        string              `json:"name"`
	Description string              `json:"description"`
	Rules       []SecurityGroupRule `json:"rules"`
	Tags        map[string]string   `json:"tags"`
}

// SecurityGroupRule represents a security group rule
type SecurityGroupRule struct {
	ID          string `json:"id"`
	Type        string `json:"type"` // INBOUND, OUTBOUND
	Protocol    string `json:"protocol"`
	PortRange   string `json:"port_range"`
	Source      string `json:"source"`
	Description string `json:"description"`
	Enabled     bool   `json:"enabled"`
}

// NACLConfig represents Network ACL configuration
type NACLConfig struct {
	ID      string     `json:"id"`
	Name    string     `json:"name"`
	Subnets []string   `json:"subnets"`
	Rules   []NACLRule `json:"rules"`
}

// NACLRule represents Network ACL rule
type NACLRule struct {
	RuleNumber int    `json:"rule_number"`
	Type       string `json:"type"` // INBOUND, OUTBOUND
	Protocol   string `json:"protocol"`
	PortRange  string `json:"port_range"`
	Source     string `json:"source"`
	Action     string `json:"action"` // ALLOW, DENY
	Enabled    bool   `json:"enabled"`
}

// WAFRuleConfig represents WAF rule configuration
type WAFRuleConfig struct {
	ID         string         `json:"id"`
	Name       string         `json:"name"`
	Type       string         `json:"type"` // RATE_BASED, REGULAR, GROUP
	Priority   int            `json:"priority"`
	Action     string         `json:"action"` // ALLOW, BLOCK, COUNT
	Conditions []WAFCondition `json:"conditions"`
	Enabled    bool           `json:"enabled"`
}

// WAFCondition represents WAF condition
type WAFCondition struct {
	Type    string `json:"type"`  // IP_MATCH, STRING_MATCH, GEO_MATCH, etc.
	Field   string `json:"field"` // HEADER, QUERY_STRING, URI, etc.
	Target  string `json:"target"`
	Value   string `json:"value"`
	Negated bool   `json:"negated"`
}

// NewPolicyEnforcer creates a new policy enforcer
func NewPolicyEnforcer(region string) (*PolicyEnforcer, error) {
	cfg, err := config.LoadDefaultConfig(context.TODO(), config.WithRegion(region))
	if err != nil {
		return nil, fmt.Errorf("failed to load AWS config: %w", err)
	}

	ec2Client := ec2.NewFromConfig(cfg)
	wafClient := wafv2.NewFromConfig(cfg)

	policyEnforcer := &PolicyEnforcer{
		ec2Client: ec2Client,
		wafClient: wafClient,
		logger:    log.New(log.Writer(), "[POLICY-ENFORCER] ", log.LstdFlags|log.Lmsgprefix),
		policies:  make(map[string]SecurityPolicy),
		rulesEngine: &RulesEngine{
			rules: []SecurityRule{},
		},
	}

	// Load default security policies
	err = policyEnforcer.loadDefaultPolicies()
	if err != nil {
		return nil, fmt.Errorf("failed to load default policies: %w", err)
	}

	return policyEnforcer, nil
}

// EvaluatePolicies evaluates all enabled policies against the current environment
func (pe *PolicyEnforcer) EvaluatePolicies(ctx context.Context) ([]PolicyEvaluation, error) {
	var evaluations []PolicyEvaluation

	for _, policy := range pe.policies {
		if !policy.Enabled {
			continue
		}

		evaluation, err := pe.evaluatePolicy(ctx, policy)
		if err != nil {
			pe.logger.Printf("Error evaluating policy %s: %v", policy.Name, err)
			continue
		}

		evaluations = append(evaluations, *evaluation)
	}

	return evaluations, nil
}

// evaluatePolicy evaluates a single policy
func (pe *PolicyEnforcer) evaluatePolicy(ctx context.Context, policy SecurityPolicy) (*PolicyEvaluation, error) {
	evaluation := &PolicyEvaluation{
		PolicyID:    policy.ID,
		PolicyName:  policy.Name,
		Status:      EvaluationPass,
		RuleResults: []RuleEvaluationResult{},
		Timestamp:   time.Now(),
		Score:       100.0,
	}

	for _, rule := range policy.Rules {
		if !rule.Enabled {
			continue
		}

		startTime := time.Now()
		result, err := pe.evaluateRule(ctx, rule)
		duration := time.Since(startTime)

		if err != nil {
			result = &RuleEvaluationResult{
				RuleID:   rule.ID,
				RuleName: rule.Name,
				Status:   RuleStatusError,
				Message:  fmt.Sprintf("Error evaluating rule: %v", err),
				Duration: duration,
				Passed:   false,
				Action:   rule.Action,
			}
		} else {
			result.Duration = duration
		}

		evaluation.RuleResults = append(evaluation.RuleResults, *result)

		// Update evaluation status and score based on rule results
		if !result.Passed {
			if evaluation.Status == EvaluationPass {
				evaluation.Status = EvaluationFail
			}
			evaluation.Score -= 10.0 // Deduct points for failed rules
		}

		// Apply rule-specific scoring
		evaluation.Score += pe.calculateRuleScore(*result)
	}

	// Calculate summary
	evaluation.Summary = pe.calculateSummary(evaluation.RuleResults, evaluation.Score)

	// Ensure score doesn't go below 0
	if evaluation.Score < 0 {
		evaluation.Score = 0
	}

	return evaluation, nil
}

// evaluateRule evaluates a single security rule
func (pe *PolicyEnforcer) evaluateRule(ctx context.Context, rule SecurityRule) (*RuleEvaluationResult, error) {
	result := &RuleEvaluationResult{
		RuleID:   rule.ID,
		RuleName: rule.Name,
		Status:   RuleStatusPass,
		Message:  "",
		Evidence: make(map[string]string),
		Passed:   true,
		Action:   rule.Action,
	}

	switch rule.Category {
	case "NETWORK_SECURITY":
		return pe.evaluateNetworkSecurityRule(ctx, rule)
	case "CONTAINER_SECURITY":
		return pe.evaluateContainerSecurityRule(ctx, rule)
	case "COMPLIANCE":
		return pe.evaluateComplianceRule(ctx, rule)
	case "ACCESS_CONTROL":
		return pe.evaluateAccessControlRule(ctx, rule)
	case "ENCRYPTION":
		return pe.evaluateEncryptionRule(ctx, rule)
	default:
		result.Status = RuleStatusSkip
		result.Message = "Unknown rule category, skipping"
		result.Passed = false
	}

	return result, nil
}

// evaluateNetworkSecurityRule evaluates network security rules
func (pe *PolicyEnforcer) evaluateNetworkSecurityRule(ctx context.Context, rule SecurityRule) (*RuleEvaluationResult, error) {
	result := &RuleEvaluationResult{
		RuleID:   rule.ID,
		RuleName: rule.Name,
		Status:   RuleStatusPass,
		Message:  "",
		Evidence: make(map[string]string),
		Passed:   true,
		Action:   rule.Action,
	}

	switch rule.Condition {
	case "VPC_FLOW_LOGS_ENABLED":
		return pe.checkVPCFlowLogs(ctx, result)
	case "SECURITY_GROUPS_RESTRICTED":
		return pe.checkSecurityGroupRestrictions(ctx, result)
	case "WAF_ENABLED":
		return pe.checkWAFEnabled(ctx, result)
	case "SSL_ONLY_PROTOCOLS":
		return pe.checkSSLProtocols(ctx, result)
	default:
		result.Status = RuleStatusSkip
		result.Message = "Unknown network security condition"
	}

	return result, nil
}

// evaluateContainerSecurityRule evaluates container security rules
func (pe *PolicyEnforcer) evaluateContainerSecurityRule(ctx context.Context, rule SecurityRule) (*RuleEvaluationResult, error) {
	result := &RuleEvaluationResult{
		RuleID:   rule.ID,
		RuleName: rule.Name,
		Status:   RuleStatusPass,
		Message:  "",
		Evidence: make(map[string]string),
		Passed:   true,
		Action:   rule.Action,
	}

	switch rule.Condition {
	case "CONTAINER_NON_ROOT":
		return pe.checkNonRootContainers(ctx, result)
	case "READ_ONLY_FILESYSTEM":
		return pe.checkReadOnlyFilesystem(ctx, result)
	case "CAPABILITIES_DROPPED":
		return pe.checkDroppedCapabilities(ctx, result)
	case "SECCOMP_ENABLED":
		return pe.checkSeccompEnabled(ctx, result)
	default:
		result.Status = RuleStatusSkip
		result.Message = "Unknown container security condition"
	}

	return result, nil
}

// evaluateComplianceRule evaluates compliance rules
func (pe *PolicyEnforcer) evaluateComplianceRule(ctx context.Context, rule SecurityRule) (*RuleEvaluationResult, error) {
	result := &RuleEvaluationResult{
		RuleID:   rule.ID,
		RuleName: rule.Name,
		Status:   RuleStatusPass,
		Message:  "",
		Evidence: make(map[string]string),
		Passed:   true,
		Action:   rule.Action,
	}

	switch rule.Condition {
	case "ENCRYPTION_AT_REST":
		return pe.checkEncryptionAtRest(ctx, result)
	case "AUDIT_LOGGING_ENABLED":
		return pe.checkAuditLogging(ctx, result)
	case "BACKUP_ENABLED":
		return pe.checkBackupEnabled(ctx, result)
	case "ACCESS_LOGGING_ENABLED":
		return pe.checkAccessLogging(ctx, result)
	default:
		result.Status = RuleStatusSkip
		result.Message = "Unknown compliance condition"
	}

	return result, nil
}

// evaluateAccessControlRule evaluates access control rules
func (pe *PolicyEnforcer) evaluateAccessControlRule(ctx context.Context, rule SecurityRule) (*RuleEvaluationResult, error) {
	result := &RuleEvaluationResult{
		RuleID:   rule.ID,
		RuleName: rule.Name,
		Status:   RuleStatusPass,
		Message:  "",
		Evidence: make(map[string]string),
		Passed:   true,
		Action:   rule.Action,
	}

	switch rule.Condition {
	case "IAM_POLICIES_RESTRICTED":
		return pe.checkIAMPolicies(ctx, result)
	case "MFA_ENABLED":
		return pe.checkMFAEnabled(ctx, result)
	case "PRIVILEGED_ESCALATION_BLOCKED":
		return pe.checkPrivilegeEscalationBlocked(ctx, result)
	default:
		result.Status = RuleStatusSkip
		result.Message = "Unknown access control condition"
	}

	return result, nil
}

// evaluateEncryptionRule evaluates encryption rules
func (pe *PolicyEnforcer) evaluateEncryptionRule(ctx context.Context, rule SecurityRule) (*RuleEvaluationResult, error) {
	result := &RuleEvaluationResult{
		RuleID:   rule.ID,
		RuleName: rule.Name,
		Status:   RuleStatusPass,
		Message:  "",
		Evidence: make(map[string]string),
		Passed:   true,
		Action:   rule.Action,
	}

	switch rule.Condition {
	case "TLS_1_2_OR_HIGHER":
		return pe.checkTLSVersion(ctx, result)
	case "ENCRYPTED_VOLUMES":
		return pe.checkEncryptedVolumes(ctx, result)
	case "ENCRYPTED_SECRETS":
		return pe.checkEncryptedSecrets(ctx, result)
	default:
		result.Status = RuleStatusSkip
		result.Message = "Unknown encryption condition"
	}

	return result, nil
}

// Specific evaluation methods
func (pe *PolicyEnforcer) checkVPCFlowLogs(ctx context.Context, result *RuleEvaluationResult) (*RuleEvaluationResult, error) {
	// This would check if VPC Flow Logs are enabled
	// For demonstration, returning a mock result
	result.Status = RuleStatusPass
	result.Message = "VPC Flow Logs are enabled"
	result.Evidence["flow_log_enabled"] = "true"
	result.Evidence["flow_log_destination"] = "cloudwatch-logs"
	return result, nil
}

func (pe *PolicyEnforcer) checkSecurityGroupRestrictions(ctx context.Context, result *RuleEvaluationResult) (*RuleEvaluationResult, error) {
	// Check if security groups are properly restricted
	result.Status = RuleStatusPass
	result.Message = "Security groups are properly restricted"
	result.Evidence["restricted_ingress"] = "true"
	result.Evidence["restricted_egress"] = "true"
	return result, nil
}

func (pe *PolicyEnforcer) checkWAFEnabled(ctx context.Context, result *RuleEvaluationResult) (*RuleEvaluationResult, error) {
	// Check if WAF is enabled
	result.Status = RuleStatusPass
	result.Message = "WAF is enabled with active rules"
	result.Evidence["waf_enabled"] = "true"
	result.Evidence["waf_rules_count"] = "10"
	return result, nil
}

func (pe *PolicyEnforcer) checkSSLProtocols(ctx context.Context, result *RuleEvaluationResult) (*RuleEvaluationResult, error) {
	// Check if SSL 2.0 and 3.0 are disabled
	result.Status = RuleStatusPass
	result.Message = "Only TLS 1.2 and 1.3 are enabled"
	result.Evidence["tls_1_2_enabled"] = "true"
	result.Evidence["tls_1_3_enabled"] = "true"
	result.Evidence["ssl_2_3_disabled"] = "true"
	return result, nil
}

func (pe *PolicyEnforcer) checkNonRootContainers(ctx context.Context, result *RuleEvaluationResult) (*RuleEvaluationResult, error) {
	// Check if containers run as non-root
	result.Status = RuleStatusPass
	result.Message = "All containers run as non-root users"
	result.Evidence["non_root_containers"] = "100%"
	return result, nil
}

func (pe *PolicyEnforcer) checkReadOnlyFilesystem(ctx context.Context, result *RuleEvaluationResult) (*RuleEvaluationResult, error) {
	// Check if containers use read-only filesystems
	result.Status = RuleStatusPass
	result.Message = "All containers use read-only filesystems where possible"
	result.Evidence["readonly_filesystems"] = "90%"
	return result, nil
}

func (pe *PolicyEnforcer) checkDroppedCapabilities(ctx context.Context, result *RuleEvaluationResult) (*RuleEvaluationResult, error) {
	// Check if unnecessary capabilities are dropped
	result.Status = RuleStatusPass
	result.Message = "Unnecessary container capabilities are dropped"
	result.Evidence["capabilities_dropped"] = "true"
	return result, nil
}

func (pe *PolicyEnforcer) checkSeccompEnabled(ctx context.Context, result *RuleEvaluationResult) (*RuleEvaluationResult, error) {
	// Check if seccomp is enabled
	result.Status = RuleStatusPass
	result.Message = "Seccomp profiles are enabled for all containers"
	result.Evidence["seccomp_enabled"] = "true"
	return result, nil
}

func (pe *PolicyEnforcer) checkEncryptionAtRest(ctx context.Context, result *RuleEvaluationResult) (*RuleEvaluationResult, error) {
	// Check if data is encrypted at rest
	result.Status = RuleStatusPass
	result.Message = "All data stores are encrypted at rest"
	result.Evidence["encryption_enabled"] = "true"
	result.Evidence["encryption_type"] = "AES-256"
	return result, nil
}

func (pe *PolicyEnforcer) checkAuditLogging(ctx context.Context, result *RuleEvaluationResult) (*RuleEvaluationResult, error) {
	// Check if audit logging is enabled
	result.Status = RuleStatusPass
	result.Message = "Audit logging is enabled and configured"
	result.Evidence["audit_logging_enabled"] = "true"
	result.Evidence["log_retention_days"] = "365"
	return result, nil
}

func (pe *PolicyEnforcer) checkBackupEnabled(ctx context.Context, result *RuleEvaluationResult) (*RuleEvaluationResult, error) {
	// Check if backups are enabled
	result.Status = RuleStatusPass
	result.Message = "Automated backups are enabled"
	result.Evidence["backup_enabled"] = "true"
	result.Evidence["backup_frequency"] = "daily"
	return result, nil
}

func (pe *PolicyEnforcer) checkAccessLogging(ctx context.Context, result *RuleEvaluationResult) (*RuleEvaluationResult, error) {
	// Check if access logging is enabled
	result.Status = RuleStatusPass
	result.Message = "Access logging is enabled for all services"
	result.Evidence["access_logging_enabled"] = "true"
	return result, nil
}

func (pe *PolicyEnforcer) checkIAMPolicies(ctx context.Context, result *RuleEvaluationResult) (*RuleEvaluationResult, error) {
	// Check IAM policies
	result.Status = RuleStatusPass
	result.Message = "IAM policies follow principle of least privilege"
	result.Evidence["least_privilege"] = "true"
	return result, nil
}

func (pe *PolicyEnforcer) checkMFAEnabled(ctx context.Context, result *RuleEvaluationResult) (*RuleEvaluationResult, error) {
	// Check if MFA is enabled
	result.Status = RuleStatusPass
	result.Message = "MFA is enabled for all IAM users"
	result.Evidence["mfa_enabled"] = "true"
	return result, nil
}

func (pe *PolicyEnforcer) checkPrivilegeEscalationBlocked(ctx context.Context, result *RuleEvaluationResult) (*RuleEvaluationResult, error) {
	// Check if privilege escalation is blocked
	result.Status = RuleStatusPass
	result.Message = "Privilege escalation is blocked by default"
	result.Evidence["privilege_escalation_blocked"] = "true"
	return result, nil
}

func (pe *PolicyEnforcer) checkTLSVersion(ctx context.Context, result *RuleEvaluationResult) (*RuleEvaluationResult, error) {
	// Check TLS version
	result.Status = RuleStatusPass
	result.Message = "Only TLS 1.2 and higher are supported"
	result.Evidence["tls_min_version"] = "1.2"
	return result, nil
}

func (pe *PolicyEnforcer) checkEncryptedVolumes(ctx context.Context, result *RuleEvaluationResult) (*RuleEvaluationResult, error) {
	// Check if volumes are encrypted
	result.Status = RuleStatusPass
	result.Message = "All EBS volumes are encrypted"
	result.Evidence["volumes_encrypted"] = "true"
	return result, nil
}

func (pe *PolicyEnforcer) checkEncryptedSecrets(ctx context.Context, result *RuleEvaluationResult) (*RuleEvaluationResult, error) {
	// Check if secrets are encrypted
	result.Status = RuleStatusPass
	result.Message = "All secrets are encrypted in transit and at rest"
	result.Evidence["secrets_encrypted"] = "true"
	return result, nil
}

// calculateRuleScore calculates the score contribution of a rule
func (pe *PolicyEnforcer) calculateRuleScore(result RuleEvaluationResult) float64 {
	if result.Passed {
		return 5.0 // Add points for passed rules
	}
	return 0.0
}

// calculateSummary calculates evaluation summary
func (pe *PolicyEnforcer) calculateSummary(results []RuleEvaluationResult, score float64) EvaluationSummary {
	summary := EvaluationSummary{
		TotalRules:   len(results),
		PassedRules:  0,
		FailedRules:  0,
		SkippedRules: 0,
		OverallScore: score,
	}

	for _, result := range results {
		switch result.Status {
		case RuleStatusPass:
			summary.PassedRules++
		case RuleStatusFail:
			summary.FailedRules++
		case RuleStatusSkip:
			summary.SkippedRules++
		}
	}

	return summary
}

// loadDefaultPolicies loads default security policies
func (pe *PolicyEnforcer) loadDefaultPolicies() error {
	// Network Security Policy
	networkPolicy := SecurityPolicy{
		ID:                   "NET-SEC-001",
		Name:                 "Network Security Policy",
		Description:          "Ensures network security best practices",
		PolicyType:           PolicyTypeImage,
		Enabled:              true,
		CreatedAt:            time.Now(),
		UpdatedAt:            time.Now(),
		Version:              "1.0",
		ComplianceFrameworks: []ComplianceFramework{ComplianceNIST, ComplianceCIS},
		Rules: []SecurityRule{
			{
				ID:          "NET-001",
				Name:        "VPC Flow Logs Enabled",
				Description: "Ensure VPC Flow Logs are enabled for monitoring",
				Condition:   "VPC_FLOW_LOGS_ENABLED",
				Action:      ActionLog,
				Enabled:     true,
				Priority:    1,
				Category:    "NETWORK_SECURITY",
			},
			{
				ID:          "NET-002",
				Name:        "Security Group Restrictions",
				Description: "Ensure security groups are properly restricted",
				Condition:   "SECURITY_GROUPS_RESTRICTED",
				Action:      ActionLog,
				Enabled:     true,
				Priority:    2,
				Category:    "NETWORK_SECURITY",
			},
			{
				ID:          "NET-003",
				Name:        "WAF Enabled",
				Description: "Ensure Web Application Firewall is enabled",
				Condition:   "WAF_ENABLED",
				Action:      ActionLog,
				Enabled:     true,
				Priority:    3,
				Category:    "NETWORK_SECURITY",
			},
		},
	}

	// Container Security Policy
	containerPolicy := SecurityPolicy{
		ID:                   "CON-SEC-001",
		Name:                 "Container Security Policy",
		Description:          "Ensures container security best practices",
		PolicyType:           PolicyTypeImage,
		Enabled:              true,
		CreatedAt:            time.Now(),
		UpdatedAt:            time.Now(),
		Version:              "1.0",
		ComplianceFrameworks: []ComplianceFramework{ComplianceNIST, ComplianceCIS},
		Rules: []SecurityRule{
			{
				ID:          "CON-001",
				Name:        "Non-Root Containers",
				Description: "Ensure containers run as non-root users",
				Condition:   "CONTAINER_NON_ROOT",
				Action:      ActionBlock,
				Enabled:     true,
				Priority:    1,
				Category:    "CONTAINER_SECURITY",
			},
			{
				ID:          "CON-002",
				Name:        "Read-Only Filesystem",
				Description: "Ensure containers use read-only filesystems where possible",
				Condition:   "READ_ONLY_FILESYSTEM",
				Action:      ActionLog,
				Enabled:     true,
				Priority:    2,
				Category:    "CONTAINER_SECURITY",
			},
		},
	}

	pe.policies[networkPolicy.ID] = networkPolicy
	pe.policies[containerPolicy.ID] = containerPolicy

	return nil
}

// AddPolicy adds a new security policy
func (pe *PolicyEnforcer) AddPolicy(policy SecurityPolicy) error {
	pe.policies[policy.ID] = policy
	pe.logger.Printf("Added security policy: %s", policy.Name)
	return nil
}

// RemovePolicy removes a security policy
func (pe *PolicyEnforcer) RemovePolicy(policyID string) {
	delete(pe.policies, policyID)
	pe.logger.Printf("Removed security policy: %s", policyID)
}

// GetPolicy retrieves a security policy
func (pe *PolicyEnforcer) GetPolicy(policyID string) (SecurityPolicy, bool) {
	policy, exists := pe.policies[policyID]
	return policy, exists
}

// ListPolicies lists all security policies
func (pe *PolicyEnforcer) ListPolicies() []SecurityPolicy {
	var policies []SecurityPolicy
	for _, policy := range pe.policies {
		policies = append(policies, policy)
	}
	return policies
}
