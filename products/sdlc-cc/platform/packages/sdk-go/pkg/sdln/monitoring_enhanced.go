package sdln

import (
	"context"
	"fmt"
	"math"
	"time"
)

// MonitoringEnhanced provides advanced monitoring and alerting capabilities
type MonitoringEnhanced struct {
	*MonitoringService
}

// NewMonitoringEnhanced creates a new enhanced monitoring service
func NewMonitoringEnhanced(client *Client) *MonitoringEnhanced {
	return &MonitoringEnhanced{
		MonitoringService: NewMonitoringService(client),
	}
}

// EnhancedAnomalyDetector represents ML-based anomaly detection
type EnhancedAnomalyDetector struct {
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	Metric      string                 `json:"metric"`
	Algorithm   string                 `json:"algorithm"` // statistical, ml, seasonal
	Sensitivity float64                `json:"sensitivity"` // 0-1
	Window      time.Duration          `json:"window"`
	Threshold   float64                `json:"threshold"`
	Seasonality *time.Duration         `json:"seasonality,omitempty"`
	Enabled     bool                   `json:"enabled"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
	CreatedAt   Timestamp                   `json:"created_at"`
	UpdatedAt   Timestamp                   `json:"updated_at"`
}

// AnomalyDetectionRequest represents a request to create/update anomaly detector
type AnomalyDetectionRequest struct {
	Name        string                 `json:"name"`
	Metric      string                 `json:"metric"`
	Algorithm   string                 `json:"algorithm"`
	Sensitivity float64                `json:"sensitivity"`
	Window      time.Duration          `json:"window"`
	Threshold   float64                `json:"threshold"`
	Seasonality *time.Duration         `json:"seasonality,omitempty"`
	Enabled     *bool                  `json:"enabled,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// DetectedAnomaly represents a detected anomaly
type DetectedAnomaly struct {
	ID           string                 `json:"id"`
	DetectorID   string                 `json:"detector_id"`
	TenantID     string                 `json:"tenant_id"`
	Metric       string                 `json:"metric"`
	Value        float64                `json:"value"`
	Expected     float64                `json:"expected"`
	Deviation    float64                `json:"deviation"`
	Severity     string                 `json:"severity"` // low, medium, high, critical
	Confidence   float64                `json:"confidence"` // 0-1
	Timestamp    Timestamp                   `json:"timestamp"`
	Description  string                 `json:"description"`
	Labels       map[string]string      `json:"labels,omitempty"`
	Annotations  map[string]string      `json:"annotations,omitempty"`
	Context      map[string]interface{} `json:"context,omitempty"`
	Resolved     bool                   `json:"resolved"`
	ResolvedAt   *Timestamp                  `json:"resolved_at,omitempty"`
	ResolvedBy   *string                `json:"resolved_by,omitempty"`
}

// Incident represents a system incident
type Incident struct {
	ID              string                 `json:"id"`
	TenantID        string                 `json:"tenant_id"`
	Title           string                 `json:"title"`
	Description     string                 `json:"description"`
	Severity        string                 `json:"severity"` // P1, P2, P3, P4, P5
	Status          string                 `json:"status"`   // open, investigating, resolved, closed
	Impact          string                 `json:"impact"`   // high, medium, low
	Urgency         string                 `json:"urgency"`  // high, medium, low
	Source          string                 `json:"source"`
	AlertIDs        []string               `json:"alert_ids,omitempty"`
	AnomalyIDs      []string               `json:"anomaly_ids,omitempty"`
	AssignedTo      *string                `json:"assigned_to,omitempty"`
	CreatedBy       string                 `json:"created_by"`
	ResolvedBy      *string                `json:"resolved_by,omitempty"`
	StartTime       Timestamp                   `json:"start_time"`
	EndTime         *Timestamp                  `json:"end_time,omitempty"`
	ResolutionTime  *time.Duration         `json:"resolution_time,omitempty"`
	MTTR            *time.Duration         `json:"mttr,omitempty"`
	RootCause       string                 `json:"root_cause,omitempty"`
	Resolution      string                 `json:"resolution,omitempty"`
	Lessons         string                 `json:"lessons,omitempty"`
	Tags            []string               `json:"tags,omitempty"`
	Labels          map[string]string      `json:"labels,omitempty"`
	Annotations     map[string]string      `json:"annotations,omitempty"`
	CustomFields    map[string]interface{} `json:"custom_fields,omitempty"`
	CreatedAt       Timestamp                   `json:"created_at"`
	UpdatedAt       Timestamp                   `json:"updated_at"`
}

// CreateIncidentRequest represents a request to create an incident
type CreateIncidentRequest struct {
	Title       string                 `json:"title"`
	Description string                 `json:"description"`
	Severity    string                 `json:"severity"`
	Impact      string                 `json:"impact"`
	Urgency     string                 `json:"urgency"`
	Source      string                 `json:"source"`
	AlertIDs    []string               `json:"alert_ids,omitempty"`
	AnomalyIDs  []string               `json:"anomaly_ids,omitempty"`
	AssignedTo  *string                `json:"assigned_to,omitempty"`
	Tags        []string               `json:"tags,omitempty"`
	Labels      map[string]string      `json:"labels,omitempty"`
	Annotations map[string]string      `json:"annotations,omitempty"`
	CustomFields map[string]interface{} `json:"custom_fields,omitempty"`
}

// Runbook represents an automated runbook
type Runbook struct {
	ID          string                 `json:"id"`
	TenantID    string                 `json:"tenant_id"`
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Trigger     RunbookTrigger         `json:"trigger"`
	Steps       []RunbookStep          `json:"steps"`
	Enabled     bool                   `json:"enabled"`
	Version     int                    `json:"version"`
	Author      string                 `json:"author"`
	ApprovedBy  *string                `json:"approved_by,omitempty"`
	Labels      map[string]string      `json:"labels,omitempty"`
	Annotations map[string]string      `json:"annotations,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
	CreatedAt   Timestamp                   `json:"created_at"`
	UpdatedAt   Timestamp                   `json:"updated_at"`
}

// RunbookTrigger defines when a runbook should execute
type RunbookTrigger struct {
	Type       string                 `json:"type"` // alert, anomaly, schedule, manual
	Conditions map[string]interface{} `json:"conditions"`
	Schedule   *ScheduleDefinition    `json:"schedule,omitempty"`
}

// ScheduleDefinition defines a schedule
type ScheduleDefinition struct {
	Type     string            `json:"type"` // cron, interval
	Cron     string            `json:"cron,omitempty"`
	Interval *time.Duration    `json:"interval,omitempty"`
	Timezone string            `json:"timezone"`
}

// RunbookStep represents a step in a runbook
type RunbookStep struct {
	ID         int                    `json:"id"`
	Name       string                 `json:"name"`
	Type       string                 `json:"type"` // action, approval, notification, delay
	Action     *RunbookAction         `json:"action,omitempty"`
	Approval   *RunbookApproval       `json:"approval,omitempty"`
	Notification *RunbookNotification  `json:"notification,omitempty"`
	Delay      *time.Duration         `json:"delay,omitempty"`
	Condition  string                 `json:"condition,omitempty"`
	OnError    string                 `json:"on_error,omitempty"` // stop, continue, retry
	RetryCount int                    `json:"retry_count"`
	Timeout    *time.Duration         `json:"timeout,omitempty"`
	Enabled    bool                   `json:"enabled"`
}

// RunbookAction defines an action to execute
type RunbookAction struct {
	Type       string                 `json:"type"` // api, script, query, alert
	Target     string                 `json:"target"`
	Method     string                 `json:"method,omitempty"`
	Parameters map[string]interface{} `json:"parameters"`
	Headers    map[string]string      `json:"headers,omitempty"`
	Body       interface{}            `json:"body,omitempty"`
}

// RunbookApproval defines an approval step
type RunbookApproval struct {
	RequiredApprovals int                    `json:"required_approvals"`
	Approvers         []string               `json:"approvers"`
	Timeout           *time.Duration         `json:"timeout,omitempty"`
	ApprovalMessage   string                 `json:"approval_message"`
}

// RunbookNotification defines a notification
type RunbookNotification struct {
	Channels []string               `json:"channels"` // email, slack, teams, pagerduty
	Template string                 `json:"template"`
	Data     map[string]interface{} `json:"data,omitempty"`
}

// RunbookExecution represents a runbook execution
type RunbookExecution struct {
	ID          string                 `json:"id"`
	RunbookID   string                 `json:"runbook_id"`
	TenantID    string                 `json:"tenant_id"`
	Trigger     RunbookTrigger         `json:"trigger"`
	Status      string                 `json:"status"` // pending, running, completed, failed, cancelled
	StartedAt   Timestamp                   `json:"started_at"`
	CompletedAt *Timestamp                  `json:"completed_at,omitempty"`
	Duration    *time.Duration         `json:"duration,omitempty"`
	Steps       []StepExecution        `json:"steps"`
	Output      string                 `json:"output,omitempty"`
	Error       string                 `json:"error,omitempty"`
	TriggeredBy string                 `json:"triggered_by"`
	Labels      map[string]string      `json:"labels,omitempty"`
	Annotations map[string]string      `json:"annotations,omitempty"`
	CreatedAt   Timestamp                   `json:"created_at"`
	UpdatedAt   Timestamp                   `json:"updated_at"`
}

// StepExecution represents the execution of a runbook step
type StepExecution struct {
	StepID      int                    `json:"step_id"`
	Name        string                 `json:"name"`
	Status      string                 `json:"status"` // pending, running, completed, failed, skipped
	StartedAt   *Timestamp                  `json:"started_at,omitempty"`
	CompletedAt *Timestamp                  `json:"completed_at,omitempty"`
	Duration    *time.Duration         `json:"duration,omitempty"`
	Output      string                 `json:"output,omitempty"`
	Error       string                 `json:"error,omitempty"`
	RetryCount  int                    `json:"retry_count"`
	Attempts    int                    `json:"attempts"`
}

// CapacityPlan represents a capacity planning report
type CapacityPlan struct {
	ID              string                 `json:"id"`
	TenantID        string                 `json:"tenant_id"`
	Name            string                 `json:"name"`
	Description     string                 `json:"description"`
	TimeRange       TimestampRange         `json:"time_range"`
	CurrentCapacity []ResourceCapacity     `json:"current_capacity"`
	PredictedDemand []ResourceDemand       `json:"predicted_demand"`
	Recommendations []CapacityRecommendation `json:"recommendations"`
	Summary         CapacitySummary        `json:"summary"`
	GeneratedAt     Timestamp                   `json:"generated_at"`
	ValidUntil      Timestamp                   `json:"valid_until"`
}

// ResourceCapacity represents current resource capacity
type ResourceCapacity struct {
	Resource   string                 `json:"resource"`
	Type       string                 `json:"type"` // cpu, memory, disk, network, requests
	Current    float64                `json:"current"`
	Maximum    float64                `json:"maximum"`
	Utilization float64               `json:"utilization"` // percentage
	Unit       string                 `json:"unit"`
	Region     string                 `json:"region,omitempty"`
	Metadata   map[string]interface{} `json:"metadata,omitempty"`
}

// ResourceDemand represents predicted resource demand
type ResourceDemand struct {
	Resource    string      `json:"resource"`
	Type        string      `json:"type"`
	Timestamp   Timestamp   `json:"timestamp"`
	Predicted   float64     `json:"predicted"`
	Confidence  float64     `json:"confidence"` // 0-1
	UpperBound  float64     `json:"upper_bound"`
	LowerBound  float64     `json:"lower_bound"`
	Seasonality string      `json:"seasonality,omitempty"`
	Trend       string      `json:"trend"` // increasing, decreasing, stable
}

// CapacityRecommendation represents a capacity recommendation
type CapacityRecommendation struct {
	Resource       string                 `json:"resource"`
	Type           string                 `json:"type"`
	Action         string                 `json:"action"` // scale_up, scale_down, optimize, migrate
	Priority       string                 `json:"priority"` // critical, high, medium, low
	Timeframe      *time.Duration         `json:"timeframe,omitempty"`
	CostImpact     float64                `json:"cost_impact"`
	PerformanceImpact string              `json:"performance_impact"`
	Description    string                 `json:"description"`
	Implementation map[string]interface{} `json:"implementation,omitempty"`
	Justification  string                 `json:"justification"`
}

// CapacitySummary provides a summary of capacity planning
type CapacitySummary struct {
	OverallStatus      string                 `json:"overall_status"` // healthy, warning, critical
	CriticalResources  []string               `json:"critical_resources"`
	ScalingNeeds       []string               `json:"scaling_needs"`
	CostOptimization   []string               `json:"cost_optimization"`
	RiskFactors        []string               `json:"risk_factors"`
	NextReview         Timestamp                   `json:"next_review"`
	Metadata           map[string]interface{} `json:"metadata,omitempty"`
}

// BusinessMetrics represents business-level metrics
type BusinessMetrics struct {
	TenantID      string                     `json:"tenant_id"`
	TimeRange     TimestampRange             `json:"time_range"`
	UserMetrics   UserBusinessMetrics        `json:"user_metrics"`
	RevenueMetrics RevenueBusinessMetrics    `json:"revenue_metrics"`
	UsageMetrics   UsageBusinessMetrics       `json:"usage_metrics"`
	QualityMetrics QualityBusinessMetrics    `json:"quality_metrics"`
	SLAMetrics    SLABusinessMetrics         `json:"sla_metrics"`
	Summary       BusinessMetricsSummary     `json:"summary"`
	GeneratedAt   Timestamp                       `json:"generated_at"`
}

// UserBusinessMetrics represents user-related business metrics
type UserBusinessMetrics struct {
	TotalUsers        int64                `json:"total_users"`
	ActiveUsers       int64                `json:"active_users"`
	NewUsers          int64                `json:"new_users"`
	ChurnedUsers      int64                `json:"churned_users"`
	RetentionRate     float64              `json:"retention_rate"`
	EngagementScore   float64              `json:"engagement_score"`
	SessionDuration   time.Duration        `json:"session_duration"`
	PageViews         int64                `json:"page_views"`
	BounceRate        float64              `json:"bounce_rate"`
	ConversionRate    float64              `json:"conversion_rate"`
	Cohorts           map[string]CohortMetrics `json:"cohorts,omitempty"`
}

// CohortMetrics represents metrics for a user cohort
type CohortMetrics struct {
	CohortID    string    `json:"cohort_id"`
	Size        int64     `json:"size"`
	StartDate   Timestamp `json:"start_date"`
	Retention   []float64 `json:"retention"` // retention by period
	LTV         float64   `json:"ltv"` // lifetime value
	CAC         float64   `json:"cac"` // customer acquisition cost
}

// RevenueBusinessMetrics represents revenue-related metrics
type RevenueBusinessMetrics struct {
	TotalRevenue    float64               `json:"total_revenue"`
	MRR             float64               `json:"mrr"` // monthly recurring revenue
	ARR             float64               `json:"arr"` // annual recurring revenue
	ARPU            float64               `json:"arpu"` // average revenue per user
	GrowthRate      float64               `json:"growth_rate"`
	ChurnRate       float64               `json:"churn_rate"`
	NetRevenue      float64               `json:"net_revenue"`
	RevenueByTier   map[string]float64    `json:"revenue_by_tier"`
	RevenueByRegion map[string]float64    `json:"revenue_by_region"`
	Forecasts       []RevenueForecast     `json:"forecasts,omitempty"`
}

// RevenueForecast represents a revenue forecast
type RevenueForecast struct {
	Period     string  `json:"period"`
	Predicted  float64 `json:"predicted"`
	Confidence float64 `json:"confidence"`
	UpperBound float64 `json:"upper_bound"`
	LowerBound float64 `json:"lower_bound"`
}

// UsageBusinessMetrics represents usage-related business metrics
type UsageBusinessMetrics struct {
	APIRequests        int64                    `json:"api_requests"`
	DocumentUploads    int64                    `json:"document_uploads"`
	LLMCalls           int64                    `json:"llm_calls"`
	TokenUsage         int64                    `json:"token_usage"`
	StorageUsed        int64                    `json:"storage_used"`
	ProcessingTime     time.Duration            `json:"processing_time"`
	SuccessRate        float64                  `json:"success_rate"`
	ErrorRate          float64                  `json:"error_rate"`
	UsageByFeature     map[string]int64         `json:"usage_by_feature"`
	UsageByPlan        map[string]int64         `json:"usage_by_plan"`
	PeakUsage          []UsagePeak              `json:"peak_usage,omitempty"`
}

// UsagePeak represents a usage peak
type UsagePeak struct {
	Timestamp Timestamp `json:"timestamp"`
	Metric    string    `json:"metric"`
	Value     int64     `json:"value"`
}

// QualityBusinessMetrics represents quality-related business metrics
type QualityBusinessMetrics struct {
	Uptime            float64              `json:"uptime"`
	Availability      float64              `json:"availability"`
	ErrorRate         float64              `json:"error_rate"`
	Latency           LatencyMetrics       `json:"latency"`
	SatisfactionScore float64              `json:"satisfaction_score"`
	SupportTickets    int64                `json:"support_tickets"`
	BugsReported      int64                `json:"bugs_reported"`
	BugsResolved      int64                `json:"bugs_resolved"`
	MeanTimeToRecover time.Duration        `json:"mean_time_to_recover"`
	QualityScore      float64              `json:"quality_score"`
}

// LatencyMetrics represents latency metrics
type LatencyMetrics struct {
	P50 time.Duration `json:"p50"`
	P90 time.Duration `json:"p90"`
	P95 time.Duration `json:"p95"`
	P99 time.Duration `json:"p99"`
}

// SLABusinessMetrics represents SLA-related business metrics
type SLABusinessMetrics struct {
	OverallCompliance float64                    `json:"overall_compliance"`
	SLAs              []SLAMetric                `json:"slas"`
	Breaches          []SLABreach                `json:"breaches,omitempty"`
	Penalties         float64                    `json:"penalties"`
	CreditsIssued     float64                    `json:"credits_issued"`
	NextReview        Timestamp                      `json:"next_review"`
}

// SLAMetric represents an individual SLA metric
type SLAMetric struct {
	ID          string        `json:"id"`
	Name        string        `json:"name"`
	Target      float64       `json:"target"`
	Actual      float64       `json:"actual"`
	Compliance  float64       `json:"compliance"`
	Period      time.Duration `json:"period"`
	MetricType  string        `json:"metric_type"`
}

// SLABreach represents an SLA breach
type SLABreach struct {
	SLAID       string    `json:"sla_id"`
	StartTime   Timestamp `json:"start_time"`
	EndTime     *Timestamp `json:"end_time,omitempty"`
	Duration    time.Duration `json:"duration"`
	Impact      string    `json:"impact"`
	Severity    string    `json:"severity"`
	Notified    bool      `json:"notified"`
	Resolved    bool      `json:"resolved"`
}

// BusinessMetricsSummary provides a summary of business metrics
type BusinessMetricsSummary struct {
	OverallScore      float64   `json:"overall_score"`
	Health            string    `json:"health"` // excellent, good, fair, poor
	KeyInsights       []string  `json:"key_insights"`
	RiskFactors       []string  `json:"risk_factors"`
	Opportunities     []string  `json:"opportunities"`
	Trends            []string  `json:"trends"`
	Recommendations   []string  `json:"recommendations"`
	NextActions       []string  `json:"next_actions"`
}

// CreateEnhancedAnomalyDetector creates an anomaly detector
func (m *MonitoringEnhanced) CreateEnhancedAnomalyDetector(ctx context.Context, tenantID string, req *AnomalyDetectionRequest) (*EnhancedAnomalyDetector, error) {
	var detector EnhancedAnomalyDetector
	err := m.doPost(ctx, fmt.Sprintf("/tenants/%s/anomaly-detectors", tenantID), req, &detector)
	if err != nil {
		return nil, fmt.Errorf("failed to create anomaly detector: %w", err)
	}
	return &detector, nil
}

// GetEnhancedAnomalyDetector retrieves an anomaly detector
func (m *MonitoringEnhanced) GetEnhancedAnomalyDetector(ctx context.Context, tenantID, detectorID string) (*EnhancedAnomalyDetector, error) {
	var detector EnhancedAnomalyDetector
	err := m.doGet(ctx, fmt.Sprintf("/tenants/%s/anomaly-detectors/%s", tenantID, detectorID), &detector)
	if err != nil {
		return nil, fmt.Errorf("failed to get anomaly detector: %w", err)
	}
	return &detector, nil
}

// ListEnhancedAnomalyDetectors retrieves anomaly detectors
func (m *MonitoringEnhanced) ListEnhancedAnomalyDetectors(ctx context.Context, tenantID string, opts *ListOptions) (*PaginatedResponse[EnhancedAnomalyDetector], error) {
	path := fmt.Sprintf("/tenants/%s/anomaly-detectors", tenantID)
	if opts != nil {
		path += m.buildQuery(map[string]interface{}{
			"page":      opts.Page,
			"page_size": opts.PageSize,
			"sort_by":   opts.SortBy,
			"sort_desc": opts.SortDesc,
		})
	}

	var response PaginatedResponse[EnhancedAnomalyDetector]
	err := m.doGet(ctx, path, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to list anomaly detectors: %w", err)
	}
	return &response, nil
}

// UpdateEnhancedAnomalyDetector updates an anomaly detector
func (m *MonitoringEnhanced) UpdateEnhancedAnomalyDetector(ctx context.Context, tenantID, detectorID string, req *AnomalyDetectionRequest) (*EnhancedAnomalyDetector, error) {
	var detector EnhancedAnomalyDetector
	err := m.doPatch(ctx, fmt.Sprintf("/tenants/%s/anomaly-detectors/%s", tenantID, detectorID), req, &detector)
	if err != nil {
		return nil, fmt.Errorf("failed to update anomaly detector: %w", err)
	}
	return &detector, nil
}

// DeleteEnhancedAnomalyDetector deletes an anomaly detector
func (m *MonitoringEnhanced) DeleteEnhancedAnomalyDetector(ctx context.Context, tenantID, detectorID string) error {
	err := m.doDelete(ctx, fmt.Sprintf("/tenants/%s/anomaly-detectors/%s", tenantID, detectorID))
	if err != nil {
		return fmt.Errorf("failed to delete anomaly detector: %w", err)
	}
	return nil
}

// ListAnomalies retrieves detected anomalies
func (m *MonitoringEnhanced) ListAnomalies(ctx context.Context, tenantID string, opts *AnomalyListOptions) (*PaginatedResponse[DetectedAnomaly], error) {
	path := fmt.Sprintf("/tenants/%s/anomalies", tenantID)

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
		if opts.DetectorID != "" {
			queryParams["detector_id"] = opts.DetectorID
		}
		if opts.Metric != "" {
			queryParams["metric"] = opts.Metric
		}
		if opts.Severity != "" {
			queryParams["severity"] = opts.Severity
		}
		if opts.Resolved != nil {
			queryParams["resolved"] = *opts.Resolved
		}
		if opts.TimeRange != nil {
			queryParams["from"] = opts.TimeRange.From
			queryParams["to"] = opts.TimeRange.To
		}
	}

	if len(queryParams) > 0 {
		path += m.buildQuery(queryParams)
	}

	var response PaginatedResponse[DetectedAnomaly]
	err := m.doGet(ctx, path, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to list anomalies: %w", err)
	}
	return &response, nil
}

// CreateIncident creates a new incident
func (m *MonitoringEnhanced) CreateIncident(ctx context.Context, tenantID string, req *CreateIncidentRequest) (*Incident, error) {
	var incident Incident
	err := m.doPost(ctx, fmt.Sprintf("/tenants/%s/incidents", tenantID), req, &incident)
	if err != nil {
		return nil, fmt.Errorf("failed to create incident: %w", err)
	}
	return &incident, nil
}

// GetIncident retrieves an incident
func (m *MonitoringEnhanced) GetIncident(ctx context.Context, tenantID, incidentID string) (*Incident, error) {
	var incident Incident
	err := m.doGet(ctx, fmt.Sprintf("/tenants/%s/incidents/%s", tenantID, incidentID), &incident)
	if err != nil {
		return nil, fmt.Errorf("failed to get incident: %w", err)
	}
	return &incident, nil
}

// ListIncidents retrieves incidents
func (m *MonitoringEnhanced) ListIncidents(ctx context.Context, tenantID string, opts *IncidentListOptions) (*PaginatedResponse[Incident], error) {
	path := fmt.Sprintf("/tenants/%s/incidents", tenantID)

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
		if opts.Status != "" {
			queryParams["status"] = opts.Status
		}
		if opts.Severity != "" {
			queryParams["severity"] = opts.Severity
		}
		if opts.Impact != "" {
			queryParams["impact"] = opts.Impact
		}
		if opts.AssignedTo != "" {
			queryParams["assigned_to"] = opts.AssignedTo
		}
		if opts.TimeRange != nil {
			queryParams["from"] = opts.TimeRange.From
			queryParams["to"] = opts.TimeRange.To
		}
	}

	if len(queryParams) > 0 {
		path += m.buildQuery(queryParams)
	}

	var response PaginatedResponse[Incident]
	err := m.doGet(ctx, path, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to list incidents: %w", err)
	}
	return &response, nil
}

// UpdateIncident updates an incident
func (m *MonitoringEnhanced) UpdateIncident(ctx context.Context, tenantID, incidentID string, incident *Incident) (*Incident, error) {
	var result Incident
	err := m.doPatch(ctx, fmt.Sprintf("/tenants/%s/incidents/%s", tenantID, incidentID), incident, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to update incident: %w", err)
	}
	return &result, nil
}

// ResolveIncident resolves an incident
func (m *MonitoringEnhanced) ResolveIncident(ctx context.Context, tenantID, incidentID, resolution string) error {
	req := map[string]interface{}{
		"resolution": resolution,
		"status":     "resolved",
		"end_time":   time.Now(),
	}

	err := m.doPost(ctx, fmt.Sprintf("/tenants/%s/incidents/%s/resolve", tenantID, incidentID), req, nil)
	if err != nil {
		return fmt.Errorf("failed to resolve incident: %w", err)
	}
	return nil
}

// CreateRunbook creates a runbook
func (m *MonitoringEnhanced) CreateRunbook(ctx context.Context, tenantID string, runbook *Runbook) (*Runbook, error) {
	var result Runbook
	err := m.doPost(ctx, fmt.Sprintf("/tenants/%s/runbooks", tenantID), runbook, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to create runbook: %w", err)
	}
	return &result, nil
}

// GetRunbook retrieves a runbook
func (m *MonitoringEnhanced) GetRunbook(ctx context.Context, tenantID, runbookID string) (*Runbook, error) {
	var runbook Runbook
	err := m.doGet(ctx, fmt.Sprintf("/tenants/%s/runbooks/%s", tenantID, runbookID), &runbook)
	if err != nil {
		return nil, fmt.Errorf("failed to get runbook: %w", err)
	}
	return &runbook, nil
}

// ListRunbooks retrieves runbooks
func (m *MonitoringEnhanced) ListRunbooks(ctx context.Context, tenantID string, opts *ListOptions) (*PaginatedResponse[Runbook], error) {
	path := fmt.Sprintf("/tenants/%s/runbooks", tenantID)
	if opts != nil {
		path += m.buildQuery(map[string]interface{}{
			"page":      opts.Page,
			"page_size": opts.PageSize,
			"sort_by":   opts.SortBy,
			"sort_desc": opts.SortDesc,
		})
	}

	var response PaginatedResponse[Runbook]
	err := m.doGet(ctx, path, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to list runbooks: %w", err)
	}
	return &response, nil
}

// ExecuteRunbook executes a runbook
func (m *MonitoringEnhanced) ExecuteRunbook(ctx context.Context, tenantID, runbookID string, trigger RunbookTrigger, triggeredBy string) (*RunbookExecution, error) {
	req := map[string]interface{}{
		"trigger":     trigger,
		"triggered_by": triggeredBy,
	}

	var execution RunbookExecution
	err := m.doPost(ctx, fmt.Sprintf("/tenants/%s/runbooks/%s/execute", tenantID, runbookID), req, &execution)
	if err != nil {
		return nil, fmt.Errorf("failed to execute runbook: %w", err)
	}
	return &execution, nil
}

// GetRunbookExecution retrieves a runbook execution
func (m *MonitoringEnhanced) GetRunbookExecution(ctx context.Context, tenantID, executionID string) (*RunbookExecution, error) {
	var execution RunbookExecution
	err := m.doGet(ctx, fmt.Sprintf("/tenants/%s/runbook-executions/%s", tenantID, executionID), &execution)
	if err != nil {
		return nil, fmt.Errorf("failed to get runbook execution: %w", err)
	}
	return &execution, nil
}

// ListRunbookExecutions retrieves runbook executions
func (m *MonitoringEnhanced) ListRunbookExecutions(ctx context.Context, tenantID string, opts *ExecutionListOptions) (*PaginatedResponse[RunbookExecution], error) {
	path := fmt.Sprintf("/tenants/%s/runbook-executions", tenantID)

	queryParams := make(map[string]interface{})
	if opts != nil {
		if opts.Page != 0 {
			queryParams["page"] = opts.Page
		}
		if opts.PageSize != 0 {
			queryParams["page_size"] = opts.PageSize
		}
		if opts.RunbookID != "" {
			queryParams["runbook_id"] = opts.RunbookID
		}
		if opts.Status != "" {
			queryParams["status"] = opts.Status
		}
		if opts.TimeRange != nil {
			queryParams["from"] = opts.TimeRange.From
			queryParams["to"] = opts.TimeRange.To
		}
	}

	if len(queryParams) > 0 {
		path += m.buildQuery(queryParams)
	}

	var response PaginatedResponse[RunbookExecution]
	err := m.doGet(ctx, path, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to list runbook executions: %w", err)
	}
	return &response, nil
}

// GenerateCapacityPlan generates a capacity plan
func (m *MonitoringEnhanced) GenerateCapacityPlan(ctx context.Context, tenantID string, timeRange TimestampRange, options *CapacityPlanningOptions) (*CapacityPlan, error) {
	path := fmt.Sprintf("/tenants/%s/capacity-planning", tenantID)

	req := map[string]interface{}{
		"time_range": timeRange,
	}
	if options != nil {
		req["options"] = options
	}

	var plan CapacityPlan
	err := m.doPost(ctx, path, req, &plan)
	if err != nil {
		return nil, fmt.Errorf("failed to generate capacity plan: %w", err)
	}
	return &plan, nil
}

// GetBusinessMetrics retrieves business metrics
func (m *MonitoringEnhanced) GetBusinessMetrics(ctx context.Context, tenantID string, timeRange TimestampRange, metrics []string) (*BusinessMetrics, error) {
	path := fmt.Sprintf("/tenants/%s/business-metrics", tenantID)

	queryParams := map[string]interface{}{
		"from": timeRange.From,
		"to":   timeRange.To,
	}
	if len(metrics) > 0 {
		queryParams["metrics"] = metrics
	}

	path += m.buildQuery(queryParams)

	var businessMetrics BusinessMetrics
	err := m.doGet(ctx, path, &businessMetrics)
	if err != nil {
		return nil, fmt.Errorf("failed to get business metrics: %w", err)
	}
	return &businessMetrics, nil
}

// AnomalyListOptions represents options for listing anomalies
type AnomalyListOptions struct {
	Page        int             `json:"page,omitempty"`
	PageSize    int             `json:"page_size,omitempty"`
	SortBy      string          `json:"sort_by,omitempty"`
	SortDesc    bool            `json:"sort_desc,omitempty"`
	DetectorID  string          `json:"detector_id,omitempty"`
	Metric      string          `json:"metric,omitempty"`
	Severity    string          `json:"severity,omitempty"`
	Resolved    *bool           `json:"resolved,omitempty"`
	TimeRange   *TimestampRange `json:"time_range,omitempty"`
}

// IncidentListOptions represents options for listing incidents
type IncidentListOptions struct {
	Page       int             `json:"page,omitempty"`
	PageSize   int             `json:"page_size,omitempty"`
	SortBy     string          `json:"sort_by,omitempty"`
	SortDesc   bool            `json:"sort_desc,omitempty"`
	Status     string          `json:"status,omitempty"`
	Severity   string          `json:"severity,omitempty"`
	Impact     string          `json:"impact,omitempty"`
	AssignedTo string          `json:"assigned_to,omitempty"`
	TimeRange  *TimestampRange `json:"time_range,omitempty"`
}

// ExecutionListOptions represents options for listing runbook executions
type ExecutionListOptions struct {
	Page      int             `json:"page,omitempty"`
	PageSize  int             `json:"page_size,omitempty"`
	RunbookID string          `json:"runbook_id,omitempty"`
	Status    string          `json:"status,omitempty"`
	TimeRange *TimestampRange `json:"time_range,omitempty"`
}

// CapacityPlanningOptions represents options for capacity planning
type CapacityPlanningOptions struct {
	PredictionHorizon *time.Duration `json:"prediction_horizon,omitempty"`
	GrowthRate        *float64       `json:"growth_rate,omitempty"`
	Seasonality       *bool          `json:"seasonality,omitempty"`
	IncludeCosts      *bool          `json:"include_costs,omitempty"`
	ConfidenceLevel   *float64       `json:"confidence_level,omitempty"`
	Resources         []string       `json:"resources,omitempty"`
}

// CalculateSeasonality detects seasonality in metrics
func CalculateSeasonality(data []float64, interval time.Duration) (bool, time.Duration, float64) {
	if len(data) < 24 {
		return false, 0, 0
	}

	// Simple seasonality detection using autocorrelation
	maxLag := len(data) / 2
	bestLag := 0
	bestCorr := 0.0

	for lag := 6; lag < maxLag; lag++ {
		corr := autocorrelation(data, lag)
		if corr > bestCorr {
			bestCorr = corr
			bestLag = lag
		}
	}

	if bestCorr > 0.7 {
		seasonality := time.Duration(bestLag) * interval
		return true, seasonality, bestCorr
	}

	return false, 0, 0
}

// autocorrelation calculates autocorrelation for a given lag
func autocorrelation(data []float64, lag int) float64 {
	n := len(data)
	if lag >= n {
		return 0
	}

	mean := 0.0
	for _, v := range data {
		mean += v
	}
	mean /= float64(n)

	var numerator, denominator float64
	for i := 0; i < n-lag; i++ {
		numerator += (data[i] - mean) * (data[i+lag] - mean)
	}
	for i := 0; i < n; i++ {
		denominator += (data[i] - mean) * (data[i] - mean)
	}

	if denominator == 0 {
		return 0
	}

	return numerator / denominator
}

// DetectAnomalies detects anomalies using statistical methods
func DetectAnomalies(data []float64, sensitivity float64) []int {
	if len(data) < 10 {
		return nil
	}

	// Calculate rolling statistics
	windowSize := min(20, len(data)/4)
	anomalies := []int{}

	for i := windowSize; i < len(data); i++ {
		window := data[i-windowSize : i]
		mean, std := calculateMeanStd(window)

		// Z-score anomaly detection
		zScore := math.Abs((data[i] - mean) / std)
		threshold := 3.0 - (sensitivity * 2.0) // Adjust threshold based on sensitivity

		if zScore > threshold {
			anomalies = append(anomalies, i)
		}
	}

	return anomalies
}

// calculateMeanStd calculates mean and standard deviation
func calculateMeanStd(data []float64) (mean, std float64) {
	n := float64(len(data))
	sum := 0.0
	for _, v := range data {
		sum += v
	}
	mean = sum / n

	sumSq := 0.0
	for _, v := range data {
		diff := v - mean
		sumSq += diff * diff
	}
	std = math.Sqrt(sumSq / n)
	return
}

