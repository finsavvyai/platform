package cqrs

import (
	"context"
	"time"

	"github.com/SDLC/sdln-sdk-go/pkg/shared"
)

// Query represents a query in CQRS pattern
type Query interface {
	GetQueryID() string
	GetUserID() string
	GetTenantID() string
	GetTimestamp() time.Time
	GetMetadata() map[string]interface{}
	Validate() error
}

// QueryHandler represents a query handler
type QueryHandler[T Query, R any] interface {
	Handle(ctx context.Context, query T) (R, error)
	CanHandle(query Query) bool
}

// QueryBus represents query bus interface
type QueryBus interface {
	Execute(ctx context.Context, query Query) (interface{}, error)
	Register(queryType string, handler QueryHandler[Query, interface{}])
}

// ReadModelRepository represents read model repository
type ReadModelRepository interface {
	GetByID(ctx context.Context, id string, tenantID string) (interface{}, error)
	GetByFilter(ctx context.Context, filter map[string]interface{}, tenantID string) ([]interface{}, error)
	GetPaginated(ctx context.Context, filter map[string]interface{}, pagination *shared.Pagination, tenantID string) (*PaginatedResult, error)
	Save(ctx context.Context, model interface{}) error
	Delete(ctx context.Context, id string, tenantID string) error
}

// PaginatedResult represents paginated query results
type PaginatedResult struct {
	Data        interface{}            `json:"data"`
	Pagination  shared.Pagination      `json:"pagination"`
	Metadata    map[string]interface{} `json:"metadata"`
}

// BaseQuery provides base implementation for queries
type BaseQuery struct {
	QueryID   string                 `json:"query_id"`
	UserID    string                 `json:"user_id"`
	TenantID  string                 `json:"tenant_id"`
	Timestamp time.Time              `json:"timestamp"`
	Metadata  map[string]interface{} `json:"metadata"`
}

// GetQueryID returns query ID
func (q *BaseQuery) GetQueryID() string {
	return q.QueryID
}

// GetUserID returns user ID
func (q *BaseQuery) GetUserID() string {
	return q.UserID
}

// GetTenantID returns tenant ID
func (q *BaseQuery) GetTenantID() string {
	return q.TenantID
}

// GetTimestamp returns timestamp
func (q *BaseQuery) GetTimestamp() time.Time {
	return q.Timestamp
}

// GetMetadata returns metadata
func (q *BaseQuery) GetMetadata() map[string]interface{} {
	return q.Metadata
}

// User Queries

// GetUserQuery represents query to get user by ID
type GetUserQuery struct {
	BaseQuery
	UserID    string `json:"user_id"`
	Fields    []string `json:"fields,omitempty"`
	IncludeSessions bool `json:"include_sessions,omitempty"`
}

// Validate validates the get user query
func (q *GetUserQuery) Validate() error {
	if q.UserID == "" {
		return ErrInvalidUserID
	}
	return nil
}

// GetUserResult represents result of get user query
type GetUserResult struct {
	User *shared.UserContext `json:"user"`
}

// GetUserByEmailQuery represents query to get user by email
type GetUserByEmailQuery struct {
	BaseQuery
	Email string `json:"email"`
	Fields []string `json:"fields,omitempty"`
}

// Validate validates the get user by email query
func (q *GetUserByEmailQuery) Validate() error {
	if q.Email == "" {
		return ErrInvalidEmail
	}
	return nil
}

// ListUsersQuery represents query to list users
type ListUsersQuery struct {
	BaseQuery
	Filter     map[string]interface{} `json:"filter,omitempty"`
	Pagination *shared.Pagination      `json:"pagination,omitempty"`
	Sort       *shared.Sort            `json:"sort,omitempty"`
	Search     string                  `json:"search,omitempty"`
	Fields     []string                `json:"fields,omitempty"`
	ActiveOnly bool                    `json:"active_only,omitempty"`
}

// Validate validates the list users query
func (q *ListUsersQuery) Validate() error {
	return nil
}

// ListUsersResult represents result of list users query
type ListUsersResult struct {
	Users     []*shared.UserContext `json:"users"`
	Pagination shared.Pagination    `json:"pagination"`
}

// Document Queries

// GetDocumentQuery represents query to get document by ID
type GetDocumentQuery struct {
	BaseQuery
	DocumentID    string   `json:"document_id"`
	Fields        []string `json:"fields,omitempty"`
	IncludeChunks bool     `json:"include_chunks,omitempty"`
	IncludeVector bool     `json:"include_vector,omitempty"`
}

// Validate validates the get document query
func (q *GetDocumentQuery) Validate() error {
	if q.DocumentID == "" {
		return ErrInvalidDocumentID
	}
	return nil
}

// GetDocumentResult represents result of get document query
type GetDocumentResult struct {
	Document *shared.DocumentContext `json:"document"`
}

// ListDocumentsQuery represents query to list documents
type ListDocumentsQuery struct {
	BaseQuery
	Filter     map[string]interface{} `json:"filter,omitempty"`
	Pagination *shared.Pagination      `json:"pagination,omitempty"`
	Sort       *shared.Sort            `json:"sort,omitempty"`
	Search     string                  `json:"search,omitempty"`
	Fields     []string                `json:"fields,omitempty"`
	Tags       []string                `json:"tags,omitempty"`
	Status     string                  `json:"status,omitempty"`
	UserID     string                  `json:"user_id,omitempty"`
}

// Validate validates the list documents query
func (q *ListDocumentsQuery) Validate() error {
	return nil
}

// ListDocumentsResult represents result of list documents query
type ListDocumentsResult struct {
	Documents []*shared.DocumentContext `json:"documents"`
	Pagination shared.Pagination        `json:"pagination"`
}

// SearchDocumentsQuery represents query to search documents using vector similarity
type SearchDocumentsQuery struct {
	BaseQuery
	Query              string    `json:"query"`
	VectorQuery        []float32 `json:"vector_query,omitempty"`
	MaxResults         int       `json:"max_results,omitempty"`
	SimilarityThreshold float64   `json:"similarity_threshold,omitempty"`
	Filter             map[string]interface{} `json:"filter,omitempty"`
	IncludeMetadata    bool      `json:"include_metadata,omitempty"`
}

// Validate validates the search documents query
func (q *SearchDocumentsQuery) Validate() error {
	if q.Query == "" && len(q.VectorQuery) == 0 {
		return ErrInvalidSearchQuery
	}
	return nil
}

// SearchDocumentsResult represents result of search documents query
type SearchDocumentsResult struct {
	Results []*DocumentSearchResult `json:"results"`
	Metadata map[string]interface{} `json:"metadata"`
}

type DocumentSearchResult struct {
	Document   *shared.DocumentContext `json:"document"`
	Score      float64                 `json:"score"`
	Chunks     []*shared.DocumentChunk `json:"chunks,omitempty"`
	Metadata   map[string]interface{}  `json:"metadata"`
}

// RAG Queries

// GetQueryQuery represents query to get RAG query by ID
type GetQueryQuery struct {
	BaseQuery
	QueryID string `json:"query_id"`
	Fields  []string `json:"fields,omitempty"`
}

// Validate validates the get query query
func (q *GetQueryQuery) Validate() error {
	if q.QueryID == "" {
		return ErrInvalidQueryID
	}
	return nil
}

// GetQueryResult represents result of get query query
type GetQueryResult struct {
	Query *shared.RAGContext `json:"query"`
}

// ListQueriesQuery represents query to list RAG queries
type ListQueriesQuery struct {
	BaseQuery
	Filter     map[string]interface{} `json:"filter,omitempty"`
	Pagination *shared.Pagination      `json:"pagination,omitempty"`
	Sort       *shared.Sort            `json:"sort,omitempty"`
	Search     string                  `json:"search,omitempty"`
	Fields     []string                `json:"fields,omitempty"`
	UserID     string                  `json:"user_id,omitempty"`
	Status     string                  `json:"status,omitempty"`
	DateFrom   *time.Time              `json:"date_from,omitempty"`
	DateTo     *time.Time              `json:"date_to,omitempty"`
}

// Validate validates the list queries query
func (q *ListQueriesQuery) Validate() error {
	return nil
}

// ListQueriesResult represents result of list queries query
type ListQueriesResult struct {
	Queries    []*shared.RAGContext `json:"queries"`
	Pagination shared.Pagination    `json:"pagination"`
}

// GetQueryAnalyticsQuery represents query to get query analytics
type GetQueryAnalyticsQuery struct {
	BaseQuery
	DateFrom   time.Time `json:"date_from"`
	DateTo     time.Time `json:"date_to"`
	Granularity string   `json:"granularity"` // hour, day, week, month
	GroupBy    []string  `json:"group_by,omitempty"`
	Filters    map[string]interface{} `json:"filters,omitempty"`
}

// Validate validates the get query analytics query
func (q *GetQueryAnalyticsQuery) Validate() error {
	if q.DateFrom.IsZero() {
		return ErrInvalidDateFrom
	}
	if q.DateTo.IsZero() {
		return ErrInvalidDateTo
	}
	if q.DateFrom.After(q.DateTo) {
		return ErrInvalidDateRange
	}
	return nil
}

// GetQueryAnalyticsResult represents result of query analytics
type GetQueryAnalyticsResult struct {
	Analytics *QueryAnalytics `json:"analytics"`
}

type QueryAnalytics struct {
	TotalQueries      int64                    `json:"total_queries"`
	UniqueUsers       int64                    `json:"unique_users"`
	AverageResponseTime float64                `json:"average_response_time"`
	TokenUsage        *TokenUsageAnalytics     `json:"token_usage"`
	PopularQueries    []PopularQuery           `json:"popular_queries"`
	TimelineData      []TimelineDataPoint      `json:"timeline_data"`
	UserMetrics       map[string]interface{}   `json:"user_metrics"`
}

type TokenUsageAnalytics struct {
	TotalInputTokens  int64 `json:"total_input_tokens"`
	TotalOutputTokens int64 `json:"total_output_tokens"`
	TotalTokens       int64 `json:"total_tokens"`
	AverageTokensPerQuery float64 `json:"average_tokens_per_query"`
}

type PopularQuery struct {
	Query      string `json:"query"`
	Count      int64  `json:"count"`
	UniqueUsers int64 `json:"unique_users"`
}

type TimelineDataPoint struct {
	Timestamp  time.Time `json:"timestamp"`
	Queries    int64     `json:"queries"`
	Users      int64     `json:"users"`
	Tokens     int64     `json:"tokens"`
	ResponseTime float64 `json:"response_time"`
}

// Tenant Queries

// GetTenantQuery represents query to get tenant by ID
type GetTenantQuery struct {
	BaseQuery
	TenantID string   `json:"tenant_id"`
	Fields   []string `json:"fields,omitempty"`
}

// Validate validates the get tenant query
func (q *GetTenantQuery) Validate() error {
	if q.TenantID == "" {
		return ErrInvalidTenantID
	}
	return nil
}

// GetTenantResult represents result of get tenant query
type GetTenantResult struct {
	Tenant *shared.TenantContext `json:"tenant"`
}

// GetTenantByDomainQuery represents query to get tenant by domain
type GetTenantByDomainQuery struct {
	BaseQuery
	Domain string `json:"domain"`
	Fields []string `json:"fields,omitempty"`
}

// Validate validates the get tenant by domain query
func (q *GetTenantByDomainQuery) Validate() error {
	if q.Domain == "" {
		return ErrInvalidDomain
	}
	return nil
}

// ListTenantsQuery represents query to list tenants
type ListTenantsQuery struct {
	BaseQuery
	Filter     map[string]interface{} `json:"filter,omitempty"`
	Pagination *shared.Pagination      `json:"pagination,omitempty"`
	Sort       *shared.Sort            `json:"sort,omitempty"`
	Search     string                  `json:"search,omitempty"`
	Fields     []string                `json:"fields,omitempty"`
	Status     string                  `json:"status,omitempty"`
	Plan       string                  `json:"plan,omitempty"`
}

// Validate validates the list tenants query
func (q *ListTenantsQuery) Validate() error {
	return nil
}

// ListTenantsResult represents result of list tenants query
type ListTenantsResult struct {
	Tenants    []*shared.TenantContext `json:"tenants"`
	Pagination shared.Pagination        `json:"pagination"`
}

// GetTenantUsageQuery represents query to get tenant usage statistics
type GetTenantUsageQuery struct {
	BaseQuery
	TenantID string    `json:"tenant_id"`
	DateFrom time.Time `json:"date_from"`
	DateTo   time.Time `json:"date_to"`
	Metrics  []string  `json:"metrics"`
}

// Validate validates the get tenant usage query
func (q *GetTenantUsageQuery) Validate() error {
	if q.TenantID == "" {
		return ErrInvalidTenantID
	}
	if q.DateFrom.IsZero() {
		return ErrInvalidDateFrom
	}
	if q.DateTo.IsZero() {
		return ErrInvalidDateTo
	}
	return nil
}

// GetTenantUsageResult represents result of tenant usage query
type GetTenantUsageResult struct {
	Usage *TenantUsage `json:"usage"`
}

type TenantUsage struct {
	Users       *UsageMetrics `json:"users"`
	Documents   *UsageMetrics `json:"documents"`
	Storage     *UsageMetrics `json:"storage"`
	Queries     *UsageMetrics `json:"queries"`
	Tokens      *UsageMetrics `json:"tokens"`
	Cost        *CostMetrics  `json:"cost"`
}

type UsageMetrics struct {
	Current int64   `json:"current"`
	Limit   int64   `json:"limit"`
	Percent float64 `json:"percent"`
	Trend   []TrendDataPoint `json:"trend"`
}

type CostMetrics struct {
	CurrentAmount float64 `json:"current_amount"`
	Currency      string  `json:"currency"`
	Budget        float64 `json:"budget"`
	Forecast      float64 `json:"forecast"`
}

type TrendDataPoint struct {
	Date   time.Time `json:"date"`
	Value  int64     `json:"value"`
}

// Policy Queries

// GetPolicyQuery represents query to get policy by ID
type GetPolicyQuery struct {
	BaseQuery
	PolicyID string   `json:"policy_id"`
	Fields   []string `json:"fields,omitempty"`
}

// Validate validates the get policy query
func (q *GetPolicyQuery) Validate() error {
	if q.PolicyID == "" {
		return ErrInvalidPolicyID
	}
	return nil
}

// GetPolicyResult represents result of get policy query
type GetPolicyResult struct {
	Policy *shared.PolicyContext `json:"policy"`
}

// ListPoliciesQuery represents query to list policies
type ListPoliciesQuery struct {
	BaseQuery
	Filter     map[string]interface{} `json:"filter,omitempty"`
	Pagination *shared.Pagination      `json:"pagination,omitempty"`
	Sort       *shared.Sort            `json:"sort,omitempty"`
	Search     string                  `json:"search,omitempty"`
	Fields     []string                `json:"fields,omitempty"`
	Type       string                  `json:"type,omitempty"`
	Status     string                  `json:"status,omitempty"`
	Enabled    *bool                   `json:"enabled,omitempty"`
}

// Validate validates the list policies query
func (q *ListPoliciesQuery) Validate() error {
	return nil
}

// ListPoliciesResult represents result of list policies query
type ListPoliciesResult struct {
	Policies  []*shared.PolicyContext `json:"policies"`
	Pagination shared.Pagination       `json:"pagination"`
}

// EvaluatePolicyQuery represents query to evaluate policy against resource
type EvaluatePolicyQuery struct {
	BaseQuery
	PolicyID   string                 `json:"policy_id"`
	ResourceID string                 `json:"resource_id"`
	Action     string                 `json:"action"`
	Context    map[string]interface{} `json:"context"`
}

// Validate validates the evaluate policy query
func (q *EvaluatePolicyQuery) Validate() error {
	if q.PolicyID == "" {
		return ErrInvalidPolicyID
	}
	if q.ResourceID == "" {
		return ErrInvalidResourceID
	}
	if q.Action == "" {
		return ErrInvalidAction
	}
	return nil
}

// EvaluatePolicyResult represents result of policy evaluation
type EvaluatePolicyResult struct {
	Allowed   bool                   `json:"allowed"`
	Action    string                 `json:"action"`
	Reason    string                 `json:"reason"`
	Rules     []RuleEvaluationResult `json:"rules"`
	Metadata  map[string]interface{} `json:"metadata"`
}

type RuleEvaluationResult struct {
	RuleID    string `json:"rule_id"`
	RuleName  string `json:"rule_name"`
	Condition string `json:"condition"`
	Result    bool   `json:"result"`
	Action    string `json:"action_applied"`
	Reason    string `json:"reason"`
}

// Payment Queries (PCI DSS Compliance)

// GetPaymentMethodQuery represents query to get payment method by ID
type GetPaymentMethodQuery struct {
	BaseQuery
	TokenID string   `json:"token_id"`
	Fields  []string `json:"fields,omitempty"`
}

// Validate validates the get payment method query
func (q *GetPaymentMethodQuery) Validate() error {
	if q.TokenID == "" {
		return ErrInvalidTokenID
	}
	return nil
}

// GetPaymentMethodResult represents result of get payment method query
type GetPaymentMethodResult struct {
	PaymentMethod *shared.PaymentMethod `json:"payment_method"`
}

// ListPaymentMethodsQuery represents query to list payment methods
type ListPaymentMethodsQuery struct {
	BaseQuery
	Filter     map[string]interface{} `json:"filter,omitempty"`
	Pagination *shared.Pagination      `json:"pagination,omitempty"`
	Sort       *shared.Sort            `json:"sort,omitempty"`
	Fields     []string                `json:"fields,omitempty"`
	Type       string                  `json:"type,omitempty"`
	Status     string                  `json:"status,omitempty"`
}

// Validate validates the list payment methods query
func (q *ListPaymentMethodsQuery) Validate() error {
	return nil
}

// ListPaymentMethodsResult represents result of list payment methods query
type ListPaymentMethodsResult struct {
	PaymentMethods []*shared.PaymentMethod `json:"payment_methods"`
	Pagination     shared.Pagination        `json:"pagination"`
}

// GetPaymentQuery represents query to get payment by ID
type GetPaymentQuery struct {
	BaseQuery
	PaymentID string   `json:"payment_id"`
	Fields    []string `json:"fields,omitempty"`
}

// Validate validates the get payment query
func (q *GetPaymentQuery) Validate() error {
	if q.PaymentID == "" {
		return ErrInvalidPaymentID
	}
	return nil
}

// GetPaymentResult represents result of get payment query
type GetPaymentResult struct {
	Payment *shared.PaymentContext `json:"payment"`
}

// ListPaymentsQuery represents query to list payments
type ListPaymentsQuery struct {
	BaseQuery
	Filter     map[string]interface{} `json:"filter,omitempty"`
	Pagination *shared.Pagination      `json:"pagination,omitempty"`
	Sort       *shared.Sort            `json:"sort,omitempty"`
	Search     string                  `json:"search,omitempty"`
	Fields     []string                `json:"fields,omitempty"`
	Status     string                  `json:"status,omitempty"`
	UserID     string                  `json:"user_id,omitempty"`
	DateFrom   *time.Time              `json:"date_from,omitempty"`
	DateTo     *time.Time              `json:"date_to,omitempty"`
}

// Validate validates the list payments query
func (q *ListPaymentsQuery) Validate() error {
	return nil
}

// ListPaymentsResult represents result of list payments query
type ListPaymentsResult struct {
	Payments   []*shared.PaymentContext `json:"payments"`
	Pagination shared.Pagination        `json:"pagination"`
}

// GetPaymentAnalyticsQuery represents query to get payment analytics
type GetPaymentAnalyticsQuery struct {
	BaseQuery
	TenantID   string    `json:"tenant_id"`
	DateFrom   time.Time `json:"date_from"`
	DateTo     time.Time `json:"date_to"`
	Granularity string   `json:"granularity"` // hour, day, week, month
	GroupBy    []string  `json:"group_by,omitempty"`
}

// Validate validates the get payment analytics query
func (q *GetPaymentAnalyticsQuery) Validate() error {
	if q.DateFrom.IsZero() {
		return ErrInvalidDateFrom
	}
	if q.DateTo.IsZero() {
		return ErrInvalidDateTo
	}
	return nil
}

// GetPaymentAnalyticsResult represents result of payment analytics query
type GetPaymentAnalyticsResult struct {
	Analytics *PaymentAnalytics `json:"analytics"`
}

type PaymentAnalytics struct {
	TotalRevenue    float64                `json:"total_revenue"`
	Currency        string                 `json:"currency"`
	TotalPayments   int64                  `json:"total_payments"`
	SuccessfulRate  float64                `json:"successful_rate"`
	AverageAmount   float64                `json:"average_amount"`
	RefundRate      float64                `json:"refund_rate"`
	TimelineData    []PaymentTimelineData  `json:"timeline_data"`
	PaymentMethods  []PaymentMethodStats   `json:"payment_methods"`
}

type PaymentTimelineData struct {
	Timestamp    time.Time `json:"timestamp"`
	Revenue      float64   `json:"revenue"`
	Payments     int64     `json:"payments"`
	SuccessfulRate float64 `json:"successful_rate"`
}

type PaymentMethodStats struct {
	Type           string  `json:"type"`
	Count          int64   `json:"count"`
	Revenue        float64 `json:"revenue"`
	SuccessRate    float64 `json:"success_rate"`
}

// Security Queries

// GetSecurityIncidentQuery represents query to get security incident by ID
type GetSecurityIncidentQuery struct {
	BaseQuery
	IncidentID string   `json:"incident_id"`
	Fields     []string `json:"fields,omitempty"`
}

// Validate validates the get security incident query
func (q *GetSecurityIncidentQuery) Validate() error {
	if q.IncidentID == "" {
		return ErrInvalidIncidentID
	}
	return nil
}

// GetSecurityIncidentResult represents result of get security incident query
type GetSecurityIncidentResult struct {
	Incident *shared.SecurityContext `json:"incident"`
}

// ListSecurityIncidentsQuery represents query to list security incidents
type ListSecurityIncidentsQuery struct {
	BaseQuery
	Filter     map[string]interface{} `json:"filter,omitempty"`
	Pagination *shared.Pagination      `json:"pagination,omitempty"`
	Sort       *shared.Sort            `json:"sort,omitempty"`
	Search     string                  `json:"search,omitempty"`
	Fields     []string                `json:"fields,omitempty"`
	Type       string                  `json:"type,omitempty"`
	Severity   string                  `json:"severity,omitempty"`
	Status     string                  `json:"status,omitempty"`
	DateFrom   *time.Time              `json:"date_from,omitempty"`
	DateTo     *time.Time              `json:"date_to,omitempty"`
}

// Validate validates the list security incidents query
func (q *ListSecurityIncidentsQuery) Validate() error {
	return nil
}

// ListSecurityIncidentsResult represents result of list security incidents query
type ListSecurityIncidentsResult struct {
	Incidents  []*shared.SecurityContext `json:"incidents"`
	Pagination shared.Pagination         `json:"pagination"`
}

// GetSecurityAnalyticsQuery represents query to get security analytics
type GetSecurityAnalyticsQuery struct {
	BaseQuery
	TenantID   string    `json:"tenant_id"`
	DateFrom   time.Time `json:"date_from"`
	DateTo     time.Time `json:"date_to"`
	Metrics    []string  `json:"metrics"`
}

// Validate validates the get security analytics query
func (q *GetSecurityAnalyticsQuery) Validate() error {
	if q.DateFrom.IsZero() {
		return ErrInvalidDateFrom
	}
	if q.DateTo.IsZero() {
		return ErrInvalidDateTo
	}
	return nil
}

// GetSecurityAnalyticsResult represents result of security analytics query
type GetSecurityAnalyticsResult struct {
	Analytics *SecurityAnalytics `json:"analytics"`
}

type SecurityAnalytics struct {
	TotalIncidents      int64                       `json:"total_incidents"`
	IncidentsByType     map[string]int64            `json:"incidents_by_type"`
	IncidentsBySeverity map[string]int64            `json:"incidents_by_severity"`
	AverageResolutionTime float64                  `json:"average_resolution_time"`
	TimelineData        []SecurityTimelineData     `json:"timeline_data"`
	TopThreats          []ThreatSummary            `json:"top_threats"`
	UserMetrics         map[string]interface{}      `json:"user_metrics"`
}

type SecurityTimelineData struct {
	Timestamp   time.Time `json:"timestamp"`
	Incidents   int64     `json:"incidents"`
	Resolved    int64     `json:"resolved"`
	Severity    string    `json:"severity"`
}

type ThreatSummary struct {
	Type        string  `json:"type"`
	Count       int64   `json:"count"`
	Severity    string  `json:"severity"`
	Trend       float64 `json:"trend"` // percentage change
}

// Health Queries

// GetHealthStatusQuery represents query to get system health status
type GetHealthStatusQuery struct {
	BaseQuery
	Services   []string `json:"services,omitempty"`
	DeepCheck  bool     `json:"deep_check,omitempty"`
}

// Validate validates the get health status query
func (q *GetHealthStatusQuery) Validate() error {
	return nil
}

// GetHealthStatusResult represents result of health status query
type GetHealthStatusResult struct {
	Health *shared.HealthStatus `json:"health"`
}

// Additional error definitions
var (
	// Query errors
	ErrInvalidUserID      = NewQueryError("INVALID_USER_ID", "Invalid user ID")
	ErrInvalidQueryID     = NewQueryError("INVALID_QUERY_ID", "Invalid query ID")
	ErrInvalidSearchQuery = NewQueryError("INVALID_SEARCH_QUERY", "Invalid search query")
	ErrInvalidPolicyID    = NewQueryError("INVALID_POLICY_ID", "Invalid policy ID")
	ErrInvalidResourceID  = NewQueryError("INVALID_RESOURCE_ID", "Invalid resource ID")
	ErrInvalidAction      = NewQueryError("INVALID_ACTION", "Invalid action")
	ErrInvalidDomain      = NewQueryError("INVALID_DOMAIN", "Invalid domain")
	ErrInvalidDateFrom    = NewQueryError("INVALID_DATE_FROM", "Invalid date from")
	ErrInvalidDateTo      = NewQueryError("INVALID_DATE_TO", "Invalid date to")
	ErrInvalidDateRange   = NewQueryError("INVALID_DATE_RANGE", "Invalid date range")
	ErrInvalidIncidentID  = NewQueryError("INVALID_INCIDENT_ID", "Invalid incident ID")
)

// QueryError represents a query validation error
type QueryError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// Error implements error interface
func (e *QueryError) Error() string {
	return e.Message
}

// NewQueryError creates a new query error
func NewQueryError(code, message string) *QueryError {
	return &QueryError{
		Code:    code,
		Message: message,
	}
}
