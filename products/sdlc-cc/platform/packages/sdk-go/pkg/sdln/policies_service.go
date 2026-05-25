package sdln

import (
	"context"
	"fmt"
	"time"
)

// PoliciesService handles policy management operations
type PoliciesService struct {
	*BaseService
}

// NewPoliciesService creates a new policies service
func NewPoliciesService(client *Client) *PoliciesService {
	return &PoliciesService{
		BaseService: NewBaseService(client, "policies", "api/v1/policies"),
	}
}

// Policy represents a security or access policy
type Policy struct {
	ID          string                 `json:"id"`
	TenantID    string                 `json:"tenant_id"`
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Type        string                 `json:"type"`     // access, data, security, compliance
	Category    string                 `json:"category"` // read, write, delete, admin, etc.
	Status      string                 `json:"status"`   // active, inactive, draft, archived
	Rules       []PolicyRule           `json:"rules"`
	Conditions  []PolicyCondition      `json:"conditions"`
	Actions     []PolicyAction         `json:"actions"`
	Effect      string                 `json:"effect"` // allow, deny, log
	Priority    int                    `json:"priority"`
	Metadata    map[string]interface{} `json:"metadata"`
	CreatedBy   string                 `json:"created_by"`
	UpdatedBy   string                 `json:"updated_by"`
	CreatedAt   Timestamp                   `json:"created_at"`
	UpdatedAt   Timestamp                   `json:"updated_at"`
}

// PolicyRule represents a single rule within a policy
type PolicyRule struct {
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	Type        string                 `json:"type"`     // attribute, resource, action, condition
	Operator    string                 `json:"operator"` // equals, not_equals, contains, in, regex
	Field       string                 `json:"field"`
	Value       interface{}            `json:"value"`
	Description string                 `json:"description"`
	Metadata    map[string]interface{} `json:"metadata"`
}

// PolicyCondition represents a condition that must be met
type PolicyCondition struct {
	ID          string      `json:"id"`
	Type        string      `json:"type"`     // time, ip, user, resource, context
	Operator    string      `json:"operator"` // equals, between, in, contains
	Field       string      `json:"field"`
	Value       interface{} `json:"value"`
	Negate      bool        `json:"negate"`
	Description string      `json:"description"`
}

// PolicyAction represents an action to take when policy is triggered
type PolicyAction struct {
	ID          string                 `json:"id"`
	Type        string                 `json:"type"` // allow, deny, log, notify, transform
	Parameters  map[string]interface{} `json:"parameters"`
	Description string                 `json:"description"`
	Async       bool                   `json:"async"`
}

// CreatePolicyRequest represents a request to create a policy
type CreatePolicyRequest struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description,omitempty"`
	Type        string                 `json:"type"`
	Category    string                 `json:"category"`
	Rules       []PolicyRule           `json:"rules"`
	Conditions  []PolicyCondition      `json:"conditions,omitempty"`
	Actions     []PolicyAction         `json:"actions,omitempty"`
	Effect      string                 `json:"effect"`
	Priority    *int                   `json:"priority,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// UpdatePolicyRequest represents a request to update a policy
type UpdatePolicyRequest struct {
	Name        *string                `json:"name,omitempty"`
	Description *string                `json:"description,omitempty"`
	Rules       []PolicyRule           `json:"rules,omitempty"`
	Conditions  []PolicyCondition      `json:"conditions,omitempty"`
	Actions     []PolicyAction         `json:"actions,omitempty"`
	Effect      *string                `json:"effect,omitempty"`
	Priority    *int                   `json:"priority,omitempty"`
	Status      *string                `json:"status,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// PolicyEvaluationRequest represents a policy evaluation request
type PolicyEvaluationRequest struct {
	TenantID   string                 `json:"tenant_id"`
	UserID     string                 `json:"user_id"`
	Resource   string                 `json:"resource"`
	Action     string                 `json:"action"`
	Context    map[string]interface{} `json:"context,omitempty"`
	Attributes map[string]interface{} `json:"attributes,omitempty"`
}

// PolicyEvaluationResult represents the result of policy evaluation
type PolicyEvaluationResult struct {
	Allowed     bool                   `json:"allowed"`
	Effect      string                 `json:"effect"`
	Policies    []PolicyMatch          `json:"policies"`
	Reason      string                 `json:"reason"`
	Context     map[string]interface{} `json:"context"`
	EvaluatedAt Timestamp                   `json:"evaluated_at"`
	Time        time.Duration          `json:"time"`
}

// PolicyMatch represents a matched policy
type PolicyMatch struct {
	PolicyID   string                 `json:"policy_id"`
	PolicyName string                 `json:"policy_name"`
	Effect     string                 `json:"effect"`
	Rules      []MatchedRule          `json:"rules"`
	Reason     string                 `json:"reason"`
	Metadata   map[string]interface{} `json:"metadata"`
}

// MatchedRule represents a matched rule within a policy
type MatchedRule struct {
	RuleID   string      `json:"rule_id"`
	RuleName string      `json:"rule_name"`
	Matched  bool        `json:"matched"`
	Value    interface{} `json:"value"`
	Expected interface{} `json:"expected"`
}

// PolicyTemplate represents a reusable policy template
type PolicyTemplate struct {
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Category    string                 `json:"category"`
	Type        string                 `json:"type"`
	Rules       []PolicyRule           `json:"rules"`
	Conditions  []PolicyCondition      `json:"conditions"`
	Actions     []PolicyAction         `json:"actions"`
	Variables   []TemplateVariable     `json:"variables"`
	Metadata    map[string]interface{} `json:"metadata"`
	CreatedAt   Timestamp                   `json:"created_at"`
	UpdatedAt   Timestamp                   `json:"updated_at"`
}

// TemplateVariable represents a variable in a template
type TemplateVariable struct {
	Name         string      `json:"name"`
	Type         string      `json:"type"` // string, number, boolean, array
	Required     bool        `json:"required"`
	DefaultValue interface{} `json:"default_value,omitempty"`
	Description  string      `json:"description"`
	Options      []string    `json:"options,omitempty"`
}

// Create creates a new policy
func (s *PoliciesService) Create(ctx context.Context, req *CreatePolicyRequest) (*Policy, error) {
	var policy Policy
	err := s.doPost(ctx, "/policies", req, &policy)
	if err != nil {
		return nil, fmt.Errorf("failed to create policy: %w", err)
	}
	return &policy, nil
}

// Get retrieves a policy by ID
func (s *PoliciesService) Get(ctx context.Context, tenantID, policyID string) (*Policy, error) {
	var policy Policy
	err := s.doGet(ctx, fmt.Sprintf("/tenants/%s/policies/%s", tenantID, policyID), &policy)
	if err != nil {
		return nil, fmt.Errorf("failed to get policy: %w", err)
	}
	return &policy, nil
}

// List retrieves policies for a tenant
func (s *PoliciesService) List(ctx context.Context, tenantID string, opts *PolicyListOptions) (*PaginatedResponse[Policy], error) {
	path := fmt.Sprintf("/tenants/%s/policies", tenantID)

	queryParams := make(map[string]interface{})
	if opts != nil {
		if opts.Page != 0 {
			queryParams["page"] = opts.Page
		}
		if opts.PageSize != 0 {
			queryParams["page_size"] = opts.PageSize
		}
		if opts.SortBy != "" {
			queryParams["sort_by"] = opts.SortBy
		}
		if opts.SortDesc {
			queryParams["sort_desc"] = opts.SortDesc
		}
		if opts.Type != "" {
			queryParams["type"] = opts.Type
		}
		if opts.Category != "" {
			queryParams["category"] = opts.Category
		}
		if opts.Status != "" {
			queryParams["status"] = opts.Status
		}
		if opts.Search != "" {
			queryParams["search"] = opts.Search
		}
	}

	if len(queryParams) > 0 {
		path += s.buildQuery(queryParams)
	}

	var response PaginatedResponse[Policy]
	err := s.doGet(ctx, path, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to list policies: %w", err)
	}
	return &response, nil
}

// Update updates a policy
func (s *PoliciesService) Update(ctx context.Context, tenantID, policyID string, req *UpdatePolicyRequest) (*Policy, error) {
	var policy Policy
	err := s.doPatch(ctx, fmt.Sprintf("/tenants/%s/policies/%s", tenantID, policyID), req, &policy)
	if err != nil {
		return nil, fmt.Errorf("failed to update policy: %w", err)
	}
	return &policy, nil
}

// Delete deletes a policy
func (s *PoliciesService) Delete(ctx context.Context, tenantID, policyID string) error {
	err := s.doDelete(ctx, fmt.Sprintf("/tenants/%s/policies/%s", tenantID, policyID))
	if err != nil {
		return fmt.Errorf("failed to delete policy: %w", err)
	}
	return nil
}

// Evaluate evaluates policies against a request
func (s *PoliciesService) Evaluate(ctx context.Context, req *PolicyEvaluationRequest) (*PolicyEvaluationResult, error) {
	var result PolicyEvaluationResult
	err := s.doPost(ctx, "/evaluate", req, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to evaluate policies: %w", err)
	}
	return &result, nil
}

// BatchEvaluate evaluates multiple requests
func (s *PoliciesService) BatchEvaluate(ctx context.Context, requests []PolicyEvaluationRequest) ([]*PolicyEvaluationResult, error) {
	req := map[string]interface{}{
		"requests": requests,
	}

	var results []*PolicyEvaluationResult
	err := s.doPost(ctx, "/evaluate/batch", req, &results)
	if err != nil {
		return nil, fmt.Errorf("failed to batch evaluate policies: %w", err)
	}
	return results, nil
}

// Activate activates a policy
func (s *PoliciesService) Activate(ctx context.Context, tenantID, policyID string) error {
	err := s.doPost(ctx, fmt.Sprintf("/tenants/%s/policies/%s/activate", tenantID, policyID), nil, nil)
	if err != nil {
		return fmt.Errorf("failed to activate policy: %w", err)
	}
	return nil
}

// Deactivate deactivates a policy
func (s *PoliciesService) Deactivate(ctx context.Context, tenantID, policyID string) error {
	err := s.doPost(ctx, fmt.Sprintf("/tenants/%s/policies/%s/deactivate", tenantID, policyID), nil, nil)
	if err != nil {
		return fmt.Errorf("failed to deactivate policy: %w", err)
	}
	return nil
}

// Test tests a policy against sample data
func (s *PoliciesService) Test(ctx context.Context, tenantID, policyID string, testData map[string]interface{}) (*PolicyTestResult, error) {
	req := map[string]interface{}{
		"test_data": testData,
	}

	var result PolicyTestResult
	err := s.doPost(ctx, fmt.Sprintf("/tenants/%s/policies/%s/test", tenantID, policyID), req, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to test policy: %w", err)
	}
	return &result, nil
}

// GetTemplates retrieves policy templates
func (s *PoliciesService) GetTemplates(ctx context.Context, opts *TemplateListOptions) (*PaginatedResponse[PolicyTemplate], error) {
	path := "/templates"

	queryParams := make(map[string]interface{})
	if opts != nil {
		if opts.Page != 0 {
			queryParams["page"] = opts.Page
		}
		if opts.PageSize != 0 {
			queryParams["page_size"] = opts.PageSize
		}
		if opts.Category != "" {
			queryParams["category"] = opts.Category
		}
		if opts.Type != "" {
			queryParams["type"] = opts.Type
		}
		if opts.Search != "" {
			queryParams["search"] = opts.Search
		}
	}

	if len(queryParams) > 0 {
		path += s.buildQuery(queryParams)
	}

	var response PaginatedResponse[PolicyTemplate]
	err := s.doGet(ctx, path, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to get policy templates: %w", err)
	}
	return &response, nil
}

// CreateFromTemplate creates a policy from a template
func (s *PoliciesService) CreateFromTemplate(ctx context.Context, tenantID, templateID string, variables map[string]interface{}, req *CreatePolicyRequest) (*Policy, error) {
	request := map[string]interface{}{
		"template_id": templateID,
		"variables":   variables,
		"policy":      req,
	}

	var policy Policy
	err := s.doPost(ctx, fmt.Sprintf("/tenants/%s/policies/from-template", tenantID), request, &policy)
	if err != nil {
		return nil, fmt.Errorf("failed to create policy from template: %w", err)
	}
	return &policy, nil
}

// GetPolicyUsage retrieves policy usage statistics
func (s *PoliciesService) GetPolicyUsage(ctx context.Context, tenantID, policyID string, timeRange *TimestampRange) (*PolicyUsage, error) {
	path := fmt.Sprintf("/tenants/%s/policies/%s/usage", tenantID, policyID)

	if timeRange != nil {
		path += s.buildQuery(map[string]interface{}{
			"from": timeRange.From,
			"to":   timeRange.To,
		})
	}

	var usage PolicyUsage
	err := s.doGet(ctx, path, &usage)
	if err != nil {
		return nil, fmt.Errorf("failed to get policy usage: %w", err)
	}
	return &usage, nil
}

// GetPolicyMetrics retrieves policy performance metrics
func (s *PoliciesService) GetPolicyMetrics(ctx context.Context, tenantID string, timeRange *TimestampRange) (*PolicyMetrics, error) {
	path := fmt.Sprintf("/tenants/%s/policies/metrics", tenantID)

	if timeRange != nil {
		path += s.buildQuery(map[string]interface{}{
			"from": timeRange.From,
			"to":   timeRange.To,
		})
	}

	var metrics PolicyMetrics
	err := s.doGet(ctx, path, &metrics)
	if err != nil {
		return nil, fmt.Errorf("failed to get policy metrics: %w", err)
	}
	return &metrics, nil
}

// PolicyListOptions represents options for listing policies
type PolicyListOptions struct {
	Page     int    `json:"page,omitempty"`
	PageSize int    `json:"page_size,omitempty"`
	SortBy   string `json:"sort_by,omitempty"`
	SortDesc bool   `json:"sort_desc,omitempty"`
	Type     string `json:"type,omitempty"`
	Category string `json:"category,omitempty"`
	Status   string `json:"status,omitempty"`
	Search   string `json:"search,omitempty"`
}

// TemplateListOptions represents options for listing templates
type TemplateListOptions struct {
	Page     int    `json:"page,omitempty"`
	PageSize int    `json:"page_size,omitempty"`
	Category string `json:"category,omitempty"`
	Type     string `json:"type,omitempty"`
	Search   string `json:"search,omitempty"`
}

// PolicyTestResult represents the result of policy testing
type PolicyTestResult struct {
	PolicyID string                 `json:"policy_id"`
	Passed   bool                   `json:"passed"`
	Results  []TestCaseResult       `json:"results"`
	Errors   []string               `json:"errors,omitempty"`
	Warnings []string               `json:"warnings,omitempty"`
	Metadata map[string]interface{} `json:"metadata"`
	TestedAt Timestamp                   `json:"tested_at"`
	Time     time.Duration          `json:"time"`
}

// TestCaseResult represents a single test case result
type TestCaseResult struct {
	TestCase string                 `json:"test_case"`
	Input    map[string]interface{} `json:"input"`
	Expected bool                   `json:"expected"`
	Actual   bool                   `json:"actual"`
	Passed   bool                   `json:"passed"`
	Reason   string                 `json:"reason"`
	Time     time.Duration          `json:"time"`
}

// PolicyUsage represents policy usage statistics
type PolicyUsage struct {
	PolicyID        string          `json:"policy_id"`
	TenantID        string          `json:"tenant_id"`
	EvaluationCount int64           `json:"evaluation_count"`
	AllowCount      int64           `json:"allow_count"`
	DenyCount       int64           `json:"deny_count"`
	LastError       *Timestamp           `json:"last_error,omitempty"`
	AvgEvalTime     time.Duration   `json:"avg_eval_time"`
	TopUsers        []UserUsage     `json:"top_users"`
	TopResources    []ResourceUsage `json:"top_resources"`
	TimeRange       TimeRange       `json:"time_range"`
}

// UserUsage represents usage by a user
type UserUsage struct {
	UserID   string `json:"user_id"`
	Count    int64  `json:"count"`
	LastUsed Timestamp   `json:"last_used"`
}

// ResourceUsage represents usage by a resource
type ResourceUsage struct {
	Resource string `json:"resource"`
	Count    int64  `json:"count"`
	LastUsed Timestamp   `json:"last_used"`
}

// PolicyMetrics represents policy performance metrics
type PolicyMetrics struct {
	TenantID          string            `json:"tenant_id"`
	TotalPolicies     int               `json:"total_policies"`
	ActivePolicies    int               `json:"active_policies"`
	TotalEvaluations  int64             `json:"total_evaluations"`
	AvgEvaluationTime time.Duration     `json:"avg_evaluation_time"`
	ErrorRate         float64           `json:"error_rate"`
	TopPolicyTypes    []PolicyTypeStats `json:"top_policy_types"`
	TopResources      []ResourceUsage   `json:"top_resources"`
	TimeRange         TimeRange         `json:"time_range"`
}

// PolicyTypeStats represents statistics by policy type
type PolicyTypeStats struct {
	Type        string  `json:"type"`
	Count       int     `json:"count"`
	Evaluations int64   `json:"evaluations"`
	ErrorRate   float64 `json:"error_rate"`
}

// TimeRange represents a time range
type TimeRange struct {
	From Timestamp `json:"from"`
	To   Timestamp `json:"to"`
}
