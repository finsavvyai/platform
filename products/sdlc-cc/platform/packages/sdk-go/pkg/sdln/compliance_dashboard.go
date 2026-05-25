package sdln

import (
	"context"
	"fmt"
	"time"
)

// ComplianceDashboard provides real-time compliance status and visualization
type ComplianceDashboard struct {
	*BaseService
	auditService  *AuditService
	gdprManager   *GDPRManager
	retentionMgr  *RetentionManager
	classifier    *DataClassifier
	refreshTicker *time.Ticker
}

// NewComplianceDashboard creates a new compliance dashboard
func NewComplianceDashboard(client *Client) *ComplianceDashboard {
	return &ComplianceDashboard{
		BaseService:   NewBaseService(client, "compliance", "api/v1/compliance"),
		auditService:  NewAuditService(client, nil), // Mock storage for demo
		gdprManager:   NewGDPRManager(nil),
		retentionMgr:  NewRetentionManager(nil),
		classifier:    NewDataClassifier(),
		refreshTicker: time.NewTicker(5 * time.Minute), // Refresh every 5 minutes
	}
}

// ComplianceDashboardConfig represents dashboard configuration
type ComplianceDashboardConfig struct {
	TenantID            string                   `json:"tenant_id"`
	EnabledModules      []string                 `json:"enabled_modules"` // audit_logs, compliance_reports, data_governance, gdpr, retention, risk_monitoring
	WidgetConfiguration map[string]*WidgetConfig `json:"widget_config"`
	AlertingEnabled     bool                     `json:"alerting_enabled"`
	ScheduledReports    []ScheduledReport        `json:"scheduled_reports"`
	Theme               DashboardTheme           `json:"theme"`
}

// WidgetConfig represents configuration for dashboard widgets
type WidgetConfig struct {
	ID            string                 `json:"id"`
	Type          string                 `json:"type"` // chart, table, metric, alert
	Title         string                 `json:"title"`
	Description   string                 `json:"description"`
	DataSources   []string               `json:"data_sources"`
	Configuration map[string]interface{} `json:"configuration"`
	RefreshRate   string                 `json:"refresh_rate"` // 5m, 15m, 1h, 24h
	Enabled       bool                   `json:"enabled"`
}

// DashboardTheme represents dashboard styling theme
type DashboardTheme struct {
	PrimaryColor   string `json:"primary_color"`
	SecondaryColor string `json:"secondary_color"`
	Background     string `json:"background"`
	TextColor      string `json:"text_color"`
	BorderRadius   string `json:"border_radius"`
	FontFamily     string `json:"font_family"`
}

// ScheduledReport represents a scheduled compliance report
type ScheduledReport struct {
	ID           string     `json:"id"`
	Type         string     `json:"type"` // gdpr, hipaa, sox, custom
	Name         string     `json:"name"`
	Schedule     string     `json:"schedule"` // cron expression
	Format       string     `json:"format"`   // pdf, csv, json
	Recipients   []string   `json:"recipients"`
	EmailSubject string     `json:"email_subject"`
	Enabled      bool       `json:"enabled"`
	LastRun      *Timestamp `json:"last_run,omitempty"`
	NextRun      *Timestamp `json:"next_run"`
	CreatedAt    Timestamp  `json:"created_at"`
}

// DashboardData represents the complete dashboard data structure
type DashboardData struct {
	TenantID          string                    `json:"tenant_id"`
	Timestamp         Timestamp                 `json:"timestamp"`
	Overview          *ComplianceOverview       `json:"overview"`
	AuditMetrics      *AuditMetrics             `json:"audit_metrics"`
	ComplianceReports []ComplianceReportSummary `json:"compliance_reports"`
	GDPRMetrics       *GDPRMetrics              `json:"gdpr_metrics"`
	DataGovernance    *DataGovernanceMetrics    `json:"data_governance"`
	RetentionMetrics  *RetentionMetrics         `json:"retention_metrics"`
	RiskMetrics       *RiskMetrics              `json:"risk_metrics"`
	Alerts            []ComplianceAlert         `json:"alerts"`
	Widgets           []WidgetData              `json:"widgets"`
	LastAssessment    Timestamp                 `json:"last_assessment"`
	NextAssessment    Timestamp                 `json:"next_assessment"`
}

// ComplianceOverview provides high-level compliance status
type ComplianceOverview struct {
	OverallScore       float64    `json:"overall_score"` // 0.0-1.0
	Status             string     `json:"status"`        // compliant, at_risk, non_compliant
	ActivePolicies     int64      `json:"active_policies"`
	TotalPolicies      int64      `json:"total_policies"`
	CriticalViolations int64      `json:"critical_violations"`
	HighViolations     int64      `json:"high_violations"`
	MediumViolations   int64      `json:"medium_violations"`
	LowViolations      int64      `json:"low_violations"`
	LastAssessment     *Timestamp `json:"last_assessment"`
	AssessmentsToday   int64      `json:"assessments_today"`
	NextAssessment     *Timestamp `json:"next_assessment"`
}

// AuditMetrics provides audit log metrics
type AuditMetrics struct {
	TotalLogs         int64            `json:"total_logs"`
	LogsToday         int64            `json:"logs_today"`
	LogsThisWeek      int64            `json:"logs_this_week"`
	LogsThisMonth     int64            `json:"logs_this_month"`
	AverageLogsPerDay float64          `json:"average_logs_per_day"`
	TopEventTypes     []EventTypeCount `json:"top_event_types"`
	TopUsers          []UserActivity   `json:"top_users"`
	TopIPAddresses    []IPActivity     `json:"top_ip_addresses"`
	SecurityEvents    int64            `json:"security_events"`
	FailedLogins      int64            `json:"failed_logins"`
	DataAccessEvents  int64            `json:"data_access_events"`
}

// EventTypeCount represents event type with count
type EventTypeCount struct {
	EventType  string  `json:"event_type"`
	Count      int64   `json:"count"`
	Percentage float64 `json:"percentage"`
}

// UserActivity represents user activity metrics
type UserActivity struct {
	UserID       string    `json:"user_id"`
	EventCount   int64     `json:"event_count"`
	LastActivity Timestamp `json:"last_activity"`
	RiskScore    float64   `json:"risk_score"`
}

// IPActivity represents IP address activity
type IPActivity struct {
	IPAddress    string    `json:"ip_address"`
	EventCount   int64     `json:"event_count"`
	LastActivity Timestamp `json:"last_activity"`
	Country      string    `json:"country,omitempty"`
	City         string    `json:"city,omitempty"`
}

// ComplianceReportSummary represents a summary of compliance reports
type ComplianceReportSummary struct {
	ID          string    `json:"id"`
	Type        string    `json:"type"`
	Name        string    `json:"name"`
	Status      string    `json:"status"`
	Score       float64   `json:"score"`
	GeneratedAt Timestamp `json:"generated_at"`
	Size        int64     `json:"size"`
	DownloadURL string    `json:"download_url"`
	Violations  int64     `json:"violations"`
}

// GDPRMetrics provides GDPR-specific compliance metrics
type GDPRMetrics struct {
	AccessRequests        int64         `json:"access_requests"`
	ErasureRequests       int64         `json:"erasure_requests"`
	PortabilityRequests   int64         `json:"portability_requests"`
	RectificationRequests int64         `json:"rectification_requests"`
	AverageResponseTime   time.Duration `json:"average_response_time"`
	RequestsPending       int64         `json:"requests_pending"`
	RequestsThisWeek      int64         `json:"requests_this_week"`
	DataSubjects          int64         `json:"data_subjects"`
	ConsentRecords        int64         `json:"consent_records"`
	ActiveConsents        int64         `json:"active_consents"`
	ExpiredConsents       int64         `json:"expired_consents"`
	BreachIncidents       int64         `json:"breach_incidents"`
}

// DataGovernanceMetrics provides data governance metrics
type DataGovernanceMetrics struct {
	ClassifiedRecords   int64   `json:"classified_records"`
	UnclassifiedRecords int64   `json:"unclassified_records"`
	SensitiveData       int64   `json:"sensitive_data"`
	RestrictedData      int64   `json:"restricted_data"`
	PersonalData        int64   `json:"personal_data"`
	FinancialData       int64   `json:"financial_data"`
	HealthData          int64   `json:"health_data"`
	ConsentCoverage     float64 `json:"consent_coverage"`   // 0.0-1.0
	DataQualityScore    float64 `json:"data_quality_score"` // 0.0-1.0
}

// RetentionMetrics provides retention policy metrics
type RetentionMetrics struct {
	ActivePolicies      int64   `json:"active_policies"`
	PoliciesCompliance  float64 `json:"policies_compliance"` // 0.0-1.0
	DataRetentionRate   float64 `json:"data_retention_rate"` // 0.0-1.0
	LegalHolds          int64   `json:"legal_holds"`
	PendingDeletions    int64   `json:"pending_deletions"`
	CommittedDeletions  int64   `json:"committed_deletions"`
	RetentionViolations int64   `json:"retention_violations"`
}

// RiskMetrics provides risk assessment metrics
type RiskMetrics struct {
	OverallRiskScore   float64        `json:"overall_risk_score"` // 0.0-1.0
	SecurityEventsRate float64        `json:"security_events_rate"`
	ViolationRate      float64        `json:"violation_rate"`
	DataExposureScore  float64        `json:"data_exposure_score"`
	ComplianceScore    float64        `json:"compliance_score"`
	RiskLevel          string         `json:"risk_level"` // low, medium, high, critical
	TopRiskCategories  []RiskCategory `json:"top_risk_categories"`
}

// RiskCategory represents a risk category with score
type RiskCategory struct {
	Category   string  `json:"category"`
	RiskScore  float64 `json:"risk_score"`
	Violations int64   `json:"violations"`
	Trend      string  `json:"trend"` // increasing, decreasing, stable
}

// ComplianceAlert represents a compliance violation or alert
type ComplianceAlert struct {
	ID             string                 `json:"id"`
	Type           string                 `json:"type"`     // violation, warning, info
	Severity       string                 `json:"severity"` // critical, high, medium, low
	Category       string                 `json:"category"` // security, compliance, data_protection
	Title          string                 `json:"title"`
	Description    string                 `json:"description"`
	Resource       string                 `json:"resource,omitempty"`
	RuleID         string                 `json:"rule_id,omitempty"`
	Threshold      float64                `json:"threshold,omitempty"`
	Value          float64                `json:"value,omitempty"`
	TriggeredAt    Timestamp              `json:"triggered_at"`
	Status         string                 `json:"status"` // active, acknowledged, resolved
	AssignedTo     string                 `json:"assigned_to,omitempty"`
	AcknowledgedAt *Timestamp             `json:"acknowledged_at,omitempty"`
	ResolvedAt     *Timestamp             `json:"resolved_at,omitempty"`
	Metadata       map[string]interface{} `json:"metadata"`
}

// WidgetData represents data for dashboard widgets
type WidgetData struct {
	WidgetID    string                 `json:"widget_id"`
	Type        string                 `json:"type"`
	Title       string                 `json:"title"`
	Data        map[string]interface{} `json:"data"`
	LastUpdated Timestamp              `json:"last_updated"`
}

// GetDashboardData retrieves complete dashboard data
func (cd *ComplianceDashboard) GetDashboardData(ctx context.Context, config *ComplianceDashboardConfig) (*DashboardData, error) {
	data := &DashboardData{
		TenantID:  config.TenantID,
		Timestamp: NewTimestamp(time.Now().UTC()),
	}

	var err error
	data.Overview, err = cd.getComplianceOverview(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("failed to get compliance overview: %w", err)
	}

	data.AuditMetrics, err = cd.getAuditMetrics(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("failed to get audit metrics: %w", err)
	}

	data.Widgets, err = cd.getWidgetData(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("failed to get widget data: %w", err)
	}

	data.Alerts = cd.getAlerts(config)
	data.LastAssessment = NewTimestamp(time.Now().UTC())
	data.NextAssessment = NewTimestamp(time.Now().UTC().Add(24 * time.Hour)) // Next assessment in 24h

	return data, nil
}

// getComplianceOverview retrieves compliance overview metrics
func (cd *ComplianceDashboard) getComplianceOverview(ctx context.Context, config *ComplianceDashboardConfig) (*ComplianceOverview, error) {
	overview := &ComplianceOverview{
		ActivePolicies:   45, // Example values
		TotalPolicies:    50,
		LastAssessment:   func() *Timestamp { t := NewTimestamp(time.Now().UTC().AddDate(0, 0, -1)); return &t }(),
		AssessmentsToday: 3,
		NextAssessment:   func() *Timestamp { t := NewTimestamp(time.Now().UTC().Add(24 * time.Hour)); return &t }(),
	}

	// Calculate overall score and status
	overview.OverallScore = cd.calculateComplianceScore(overview)
	overview.Status = cd.determineComplianceStatus(overview.OverallScore)

	// Count violations by severity
	overview.CriticalViolations = 2
	overview.HighViolations = 5
	overview.MediumViolations = 8
	overview.LowViolations = 12

	return overview, nil
}

// getAuditMetrics retrieves audit log metrics
func (cd *ComplianceDashboard) getAuditMetrics(ctx context.Context, config *ComplianceDashboardConfig) (*AuditMetrics, error) {
	metrics := &AuditMetrics{
		TotalLogs:        15420,
		LogsToday:        342,
		LogsThisWeek:     2390,
		LogsThisMonth:    10500,
		SecurityEvents:   12,
		FailedLogins:     3,
		DataAccessEvents: 89,
	}

	// Calculate average logs per day
	metrics.AverageLogsPerDay = float64(metrics.LogsToday)

	// Get top event types
	metrics.TopEventTypes = []EventTypeCount{
		{EventType: "user_login", Count: 1200, Percentage: 7.8},
		{EventType: "data_access", Count: 890, Percentage: 5.8},
		{EventType: "api_call", Count: 2340, Percentage: 15.2},
		{EventType: "security_event", Count: 12, Percentage: 0.08},
	}

	// Get top users
	metrics.TopUsers = []UserActivity{
		{UserID: "user_123", EventCount: 234, LastActivity: NewTimestamp(time.Now().UTC()), RiskScore: 0.2},
		{UserID: "user_456", EventCount: 189, LastActivity: NewTimestamp(time.Now().UTC().AddDate(0, 0, -1)), RiskScore: 0.1},
		{UserID: "user_789", EventCount: 156, LastActivity: NewTimestamp(time.Now().UTC().AddDate(0, 0, -2)), RiskScore: 0.05},
	}

	// Get top IP addresses
	metrics.TopIPAddresses = []IPActivity{
		{IPAddress: "192.168.1.1", EventCount: 445, LastActivity: NewTimestamp(time.Now().UTC()), Country: "US", City: "New York"},
		{IPAddress: "10.0.0.5", EventCount: 234, LastActivity: NewTimestamp(time.Now().UTC().AddDate(0, 0, -1)), Country: "Unknown"},
		{IPAddress: "172.16.0.100", EventCount: 178, LastActivity: NewTimestamp(time.Now().UTC().AddDate(0, 0, -3)), Country: "US", City: "San Francisco"},
	}

	return metrics, nil
}

// getWidgetData retrieves data for all configured widgets
func (cd *ComplianceDashboard) getWidgetData(ctx context.Context, config *ComplianceDashboardConfig) ([]WidgetData, error) {
	var widgets []WidgetData

	for widgetID, widgetConfig := range config.WidgetConfiguration {
		if !widgetConfig.Enabled {
			continue
		}

		widget := WidgetData{
			WidgetID:    widgetID,
			Type:        widgetConfig.Type,
			Title:       widgetConfig.Title,
			Data:        make(map[string]interface{}),
			LastUpdated: NewTimestamp(time.Now().UTC()),
		}

		// Populate widget data based on type
		switch widgetConfig.Type {
		case "chart":
			widget.Data = cd.generateChartData(widgetID, widgetConfig)
		case "table":
			widget.Data = cd.generateTableData(widgetID, widgetConfig)
		case "metric":
			widget.Data = cd.generateMetricData(widgetID, widgetConfig)
		case "alert":
			widget.Data = cd.generateAlertData(widgetID, widgetConfig)
		}

		widgets = append(widgets, widget)
	}

	return widgets, nil
}

// generateChartData generates data for chart widgets
func (cd *ComplianceDashboard) generateChartData(widgetID string, config *WidgetConfig) map[string]interface{} {
	// Different charts based on configuration
	switch config.Configuration["chart_type"] {
	case "compliance_trend":
		return map[string]interface{}{
			"labels": []string{"Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"},
			"datasets": []map[string]interface{}{
				{
					"label":           "Compliance Score",
					"data":            []float64{0.95, 0.92, 0.89, 0.91, 0.94, 0.96, 0.93, 0.95, 0.97, 0.98, 0.99},
					"borderColor":     "#4f46e5",
					"backgroundColor": "rgba(79, 70, 229, 0.2)",
				},
			},
		}
	case "violation_summary":
		return map[string]interface{}{
			"labels":          []string{"Critical", "High", "Medium", "Low"},
			"data":            []int64{2, 5, 8, 12},
			"backgroundColor": []string{"#ef4444", "#e74c3c", "#f39c12", "#ffc107"},
		}
	case "event_types":
		return map[string]interface{}{
			"labels":          []string{"Login", "Data Access", "Security Event", "API Call"},
			"data":            []int64{1200, 890, 12, 2340},
			"backgroundColor": []string{"#4e73e1", "#36a2eb", "#e74c3c", "#f6ad55"},
		}
	}

	return map[string]interface{}{
		"labels": []string{"Unknown"},
		"data":   []float64{0},
	}
}

// generateTableData generates data for table widgets
func (cd *ComplianceDashboard) generateTableData(widgetID string, config *WidgetConfig) map[string]interface{} {
	// Sample table data structure
	return map[string]interface{}{
		"columns": []string{"Event Type", "Count", "Percentage", "Trend"},
		"rows": []map[string]interface{}{
			{"event_type": "User Login", "count": 1200, "percentage": 7.8, "trend": "up"},
			{"event_type": "Data Access", "count": 890, "percentage": 5.8, "trend": "down"},
			{"event_type": "Security Event", "count": 12, "percentage": 0.08, "trend": "stable"},
			{"event_type": "API Call", "count": 2340, "percentage": 15.2, "trend": "up"},
		},
	}
}

// generateMetricData generates data for metric widgets
func (cd *ComplianceDashboard) generateMetricData(widgetID string, config *WidgetConfig) map[string]interface{} {
	switch config.Configuration["metric_type"] {
	case "compliance_score":
		return map[string]interface{}{
			"value":  0.94,
			"trend":  "up",
			"change": 0.02,
		}
	case "violation_count":
		return map[string]interface{}{
			"value":  27,
			"trend":  "down",
			"change": -5,
		}
	case "active_users":
		return map[string]interface{}{
			"value":  1247,
			"trend":  "up",
			"change": 23,
		}
	}

	return map[string]interface{}{
		"value":  0,
		"trend":  "stable",
		"change": 0,
	}
}

// generateAlertData generates data for alert widgets
func (cd *ComplianceDashboard) generateAlertData(widgetID string, config *WidgetConfig) map[string]interface{} {
	alerts := cd.getAlerts(nil) // Would pass actual config
	return map[string]interface{}{
		"alerts":         alerts,
		"count":          len(alerts),
		"critical_count": len(filterAlertsBySeverity(alerts, "critical")),
		"high_count":     len(filterAlertsBySeverity(alerts, "high")),
	}
}

// getAlerts retrieves active compliance alerts
func (cd *ComplianceDashboard) getAlerts(config *ComplianceDashboardConfig) []ComplianceAlert {
	alerts := []ComplianceAlert{
		{
			ID:          "alert_1",
			Type:        "violation",
			Severity:    "critical",
			Category:    "security",
			Title:       "Failed Login Attempt Detected",
			Description: "Multiple failed login attempts detected from IP 192.168.1.1",
			TriggeredAt: NewTimestamp(time.Now().UTC().AddDate(0, 0, -2)), // 2 days ago
			Status:      "active",
			Resource:    "user_unknown",
			Threshold:   5.0,
			Value:       12.0,
		},
		{
			ID:          "alert_2",
			Type:        "warning",
			Severity:    "high",
			Category:    "compliance",
			Title:       "GDPR Access Request Expiring",
			Description: "GDPR access request will expire in 3 days",
			TriggeredAt: NewTimestamp(time.Now().UTC().AddDate(0, 0, -2)),
			Status:      "active",
			Resource:    "gdpr_request_123",
		},
		{
			ID:          "alert_3",
			Type:        "info",
			Severity:    "low",
			Category:    "data_protection",
			Title:       "Retention Policy Executed",
			Description: "Automatic data retention policy execution completed successfully",
			TriggeredAt: NewTimestamp(time.Now().UTC().AddDate(0, 0, -1)), // 1 day ago
			Status:      "resolved",
			Resource:    "retention_policy_personal",
		},
	}

	if config != nil && config.AlertingEnabled {
		return alerts
	}
	return []ComplianceAlert{}
}

// calculateComplianceScore calculates overall compliance score
func (cd *ComplianceDashboard) calculateComplianceScore(overview *ComplianceOverview) float64 {
	totalViolations := overview.CriticalViolations + overview.HighViolations +
		overview.MediumViolations + overview.LowViolations

	if totalViolations == 0 {
		return 1.0 // Perfect compliance
	}

	// Weight violations (critical = 0.5, high = 0.3, medium = 0.15, low = 0.05)
	weightedViolations := float64(overview.CriticalViolations)*0.5 +
		float64(overview.HighViolations)*0.3 +
		float64(overview.MediumViolations)*0.15 +
		float64(overview.LowViolations)*0.05

	// Score decreases with weighted violations
	score := 1.0 - (weightedViolations / 10.0)
	if score < 0 {
		return 0
	}

	return score
}

// determineComplianceStatus determines overall compliance status
func (cd *ComplianceDashboard) determineComplianceStatus(score float64) string {
	if score >= 0.95 {
		return "compliant"
	} else if score >= 0.85 {
		return "at_risk"
	} else {
		return "non_compliant"
	}
}

// filterAlertsBySeverity filters alerts by severity
func filterAlertsBySeverity(alerts []ComplianceAlert, severity string) []ComplianceAlert {
	var filtered []ComplianceAlert
	for _, alert := range alerts {
		if alert.Severity == severity {
			filtered = append(filtered, alert)
		}
	}
	return filtered
}
