package sdln

import (
	"context"
	"testing"
	"time"
)

func TestMonitoringService_PushMetrics(t *testing.T) {
	client := NewTestClient()
	monitoring := NewMonitoringService(client)
	ctx := context.Background()

	tenantID := "test-tenant"
	metrics := []Metric{
		{
			Name:      "api_requests_total",
			Value:     100,
			Timestamp: NewTimestamp(time.Now()),
			Labels: map[string]string{
				"method": "GET",
				"status": "200",
			},
			Unit: "count",
			Type: "counter",
		},
		{
			Name:      "response_time_seconds",
			Value:     0.123,
			Timestamp: NewTimestamp(time.Now()),
			Labels: map[string]string{
				"endpoint": "/api/v1/documents",
			},
			Unit: "seconds",
			Type: "histogram",
		},
	}

	err := monitoring.PushMetrics(ctx, tenantID, metrics)
	if err != nil {
		t.Fatalf("Failed to push metrics: %v", err)
	}
}

func TestMonitoringService_QueryMetrics(t *testing.T) {
	client := NewTestClient()
	monitoring := NewMonitoringService(client)
	ctx := context.Background()

	queries := []MetricQuery{
		{
			Name:  "api_requests_total",
			Query: "sum(rate(api_requests_total[5m]))",
			Labels: map[string]string{
				"method": "GET",
			},
			Aggregation: "sum",
		},
		{
			Name:        "response_time_seconds",
			Query:       "histogram_quantile(0.95, rate(response_time_seconds_bucket[5m]))",
			Aggregation: "avg",
		},
	}

	series, err := monitoring.QueryMetrics(ctx, queries)
	if err != nil {
		t.Fatalf("Failed to query metrics: %v", err)
	}

	if len(series) != len(queries) {
		t.Errorf("Expected %d series, got %d", len(queries), len(series))
	}
}

func TestMonitoringService_AlertRules(t *testing.T) {
	client := NewTestClient()
	monitoring := NewMonitoringService(client)
	ctx := context.Background()

	tenantID := "test-tenant"

	// Create alert rule
	createReq := &CreateAlertRuleRequest{
		Name:        "High Error Rate",
		Description: "Alert when error rate exceeds 5%",
		Query:       "rate(api_requests_total{status=~\"5..\"}[5m]) / rate(api_requests_total[5m])",
		Condition:   ">",
		Threshold:   0.05,
		Severity:    "warning",
		For:         DurationPtr(5 * time.Minute),
		Enabled:     BoolPtr(true),
		Labels: map[string]string{
			"team": "platform",
		},
		Annotations: map[string]string{
			"summary":     "High error rate detected",
			"description": "Error rate has exceeded 5% for the last 5 minutes",
		},
	}

	rule, err := monitoring.CreateAlertRule(ctx, tenantID, createReq)
	if err != nil {
		t.Fatalf("Failed to create alert rule: %v", err)
	}

	if rule.Name != createReq.Name {
		t.Errorf("Expected rule name %s, got %s", createReq.Name, rule.Name)
	}

	// Get alert rule
	getRule, err := monitoring.GetAlertRule(ctx, tenantID, rule.ID)
	if err != nil {
		t.Fatalf("Failed to get alert rule: %v", err)
	}

	if getRule.ID != rule.ID {
		t.Errorf("Expected rule ID %s, got %s", rule.ID, getRule.ID)
	}

	// List alert rules
	listResp, err := monitoring.ListAlertRules(ctx, tenantID, &ListOptions{
		Page:     1,
		PageSize: 10,
	})
	if err != nil {
		t.Fatalf("Failed to list alert rules: %v", err)
	}

	if len(listResp.Items) == 0 {
		t.Error("Expected at least one alert rule in list")
	}

	// Update alert rule
	updateReq := &UpdateAlertRuleRequest{
		Name:      StringPtr("High Error Rate - Updated"),
		Threshold: Float64Ptr(0.1),
	}

	updatedRule, err := monitoring.UpdateAlertRule(ctx, tenantID, rule.ID, updateReq)
	if err != nil {
		t.Fatalf("Failed to update alert rule: %v", err)
	}

	if updatedRule.Threshold != *updateReq.Threshold {
		t.Errorf("Expected threshold %f, got %f", *updateReq.Threshold, updatedRule.Threshold)
	}

	// Delete alert rule
	err = monitoring.DeleteAlertRule(ctx, tenantID, rule.ID)
	if err != nil {
		t.Fatalf("Failed to delete alert rule: %v", err)
	}
}

func TestMonitoringService_Alerts(t *testing.T) {
	client := NewTestClient()
	monitoring := NewMonitoringService(client)
	ctx := context.Background()

	tenantID := "test-tenant"

	// List alerts
	alerts, err := monitoring.ListAlerts(ctx, tenantID, &AlertListOptions{
		Page:     1,
		PageSize: 20,
		Status:   "active",
		Severity: "critical",
		SortBy:   "starts_at",
		SortDesc: true,
	})
	if err != nil {
		t.Fatalf("Failed to list alerts: %v", err)
	}

	if len(alerts.Items) == 0 {
		t.Error("Expected at least one alert")
	}

	// Acknowledge alert
	if len(alerts.Items) > 0 {
		alert := alerts.Items[0]
		err := monitoring.AcknowledgeAlert(ctx, tenantID, alert.ID, "Acknowledging alert for investigation")
		if err != nil {
			t.Errorf("Failed to acknowledge alert: %v", err)
		}

		// Resolve alert
		err = monitoring.ResolveAlert(ctx, tenantID, alert.ID, "Issue has been resolved")
		if err != nil {
			t.Errorf("Failed to resolve alert: %v", err)
		}
	}
}

func TestMonitoringService_Dashboards(t *testing.T) {
	client := NewTestClient()
	monitoring := NewMonitoringService(client)
	ctx := context.Background()

	tenantID := "test-tenant"

	// Create dashboard
	dashboard := &Dashboard{
		Name:        "API Dashboard",
		Description: "API performance and health metrics",
		Tags:        []string{"api", "performance"},
		Panels: []DashboardPanel{
			{
				ID:         "panel-1",
				Title:      "Request Rate",
				Type:       "graph",
				Query:      "rate(api_requests_total[5m])",
				Position:   PanelPosition{X: 0, Y: 0, Width: 12, Height: 8},
				DataSource: "prometheus",
			},
			{
				ID:         "panel-2",
				Title:      "Error Rate",
				Type:       "stat",
				Query:      "rate(api_requests_total{status=~\"5..\"}[5m]) / rate(api_requests_total[5m])",
				Position:   PanelPosition{X: 12, Y: 0, Width: 12, Height: 8},
				DataSource: "prometheus",
			},
		},
		TimeRange: TimeRange{
			From: NewTimestamp(time.Now().Add(-24 * time.Hour)),
			To:   NewTimestamp(time.Now()),
		},
		Refresh: DurationPtr(5 * time.Minute),
		Shared:  false,
		Public:  false,
	}

	createdDashboard, err := monitoring.CreateDashboard(ctx, tenantID, dashboard)
	if err != nil {
		t.Fatalf("Failed to create dashboard: %v", err)
	}

	if createdDashboard.Name != dashboard.Name {
		t.Errorf("Expected dashboard name %s, got %s", dashboard.Name, createdDashboard.Name)
	}

	// Get dashboard
	getDashboard, err := monitoring.GetDashboard(ctx, tenantID, createdDashboard.ID)
	if err != nil {
		t.Fatalf("Failed to get dashboard: %v", err)
	}

	if getDashboard.ID != createdDashboard.ID {
		t.Errorf("Expected dashboard ID %s, got %s", createdDashboard.ID, getDashboard.ID)
	}

	// List dashboards
	dashboards, err := monitoring.ListDashboards(ctx, tenantID, &DashboardListOptions{
		Page:     1,
		PageSize: 10,
		Tags:     []string{"api"},
	})
	if err != nil {
		t.Fatalf("Failed to list dashboards: %v", err)
	}

	if len(dashboards.Items) == 0 {
		t.Error("Expected at least one dashboard")
	}

	// Update dashboard
	updatedDashboard := *getDashboard
	updatedDashboard.Description = "Updated API dashboard"

	updated, err := monitoring.UpdateDashboard(ctx, tenantID, createdDashboard.ID, &updatedDashboard)
	if err != nil {
		t.Fatalf("Failed to update dashboard: %v", err)
	}

	if updated.Description != updatedDashboard.Description {
		t.Errorf("Expected description %s, got %s", updatedDashboard.Description, updated.Description)
	}

	// Delete dashboard
	err = monitoring.DeleteDashboard(ctx, tenantID, createdDashboard.ID)
	if err != nil {
		t.Fatalf("Failed to delete dashboard: %v", err)
	}
}

func TestMonitoringService_Health(t *testing.T) {
	client := NewTestClient()
	monitoring := NewMonitoringService(client)
	ctx := context.Background()

	tenantID := "test-tenant"

	// Get health status
	health, err := monitoring.GetHealth(ctx, tenantID, []string{"database", "cache", "api"})
	if err != nil {
		t.Fatalf("Failed to get health status: %v", err)
	}

	if health.Status == "" {
		t.Error("Expected health status")
	}

	if len(health.Checks) == 0 {
		t.Error("Expected at least one health check")
	}
}

func TestMonitoringService_Logs(t *testing.T) {
	client := NewTestClient()
	monitoring := NewMonitoringService(client)
	ctx := context.Background()

	tenantID := "test-tenant"

	// Query logs
	query := &LogQuery{
		Query:     "error",
		StartTime: TimestampPtr(NewTimestamp(time.Now().Add(-1 * time.Hour))),
		EndTime:   TimestampPtr(NewTimestamp(time.Now())),
		Level:     "error",
		Limit:     IntPtr(100),
		OrderBy:   "timestamp",
		OrderDesc: true,
	}

	response, err := monitoring.QueryLogs(ctx, tenantID, query)
	if err != nil {
		t.Fatalf("Failed to query logs: %v", err)
	}

	if response.Total < 0 {
		t.Error("Expected non-negative total count")
	}
}

func TestMonitoringService_Traces(t *testing.T) {
	client := NewTestClient()
	monitoring := NewMonitoringService(client)
	ctx := context.Background()

	tenantID := "test-tenant"

	// Get trace
	trace, err := monitoring.GetTrace(ctx, tenantID, "trace-123")
	if err != nil {
		t.Fatalf("Failed to get trace: %v", err)
	}

	if trace.ID == "" {
		t.Error("Expected trace ID")
	}

	// Search traces
	traces, err := monitoring.SearchTraces(ctx, tenantID, &TraceSearchOptions{
		Page:     1,
		PageSize: 20,
		Service:  "api-service",
		Status:   "error",
		TimeRange: &TimestampRange{
			From: NewTimestamp(time.Now().Add(-1 * time.Hour)),
			To:   NewTimestamp(time.Now()),
		},
	})
	if err != nil {
		t.Fatalf("Failed to search traces: %v", err)
	}

	if len(traces.Items) == 0 {
		t.Error("Expected at least one trace")
	}
}

func TestMonitoringEnhanced_AnomalyDetection(t *testing.T) {
	client := NewTestClient()
	monitoring := NewMonitoringEnhanced(client)
	ctx := context.Background()

	tenantID := "test-tenant"

	// Create anomaly detector
	req := &AnomalyDetectionRequest{
		Name:        "CPU Usage Anomaly Detector",
		Metric:      "cpu_usage_percent",
		Algorithm:   "statistical",
		Sensitivity: 0.8,
		Window:      5 * time.Minute,
		Threshold:   80.0,
		Enabled:     BoolPtr(true),
		Metadata: map[string]interface{}{
			"department": "platform",
			"owner":      "sre-team",
		},
	}

	detector, err := monitoring.CreateAnomalyDetector(ctx, tenantID, req)
	if err != nil {
		t.Fatalf("Failed to create anomaly detector: %v", err)
	}

	if detector.Name != req.Name {
		t.Errorf("Expected detector name %s, got %s", req.Name, detector.Name)
	}

	// List anomalies
	anomalies, err := monitoring.ListAnomalies(ctx, tenantID, &AnomalyListOptions{
		Page:       1,
		PageSize:   50,
		DetectorID: detector.ID,
		Severity:   "high",
		Resolved:   BoolPtr(false),
	})
	if err != nil {
		t.Fatalf("Failed to list anomalies: %v", err)
	}

	if len(anomalies.Items) == 0 {
		t.Error("Expected at least one anomaly")
	}
}

func TestMonitoringEnhanced_Incidents(t *testing.T) {
	client := NewTestClient()
	monitoring := NewMonitoringEnhanced(client)
	ctx := context.Background()

	tenantID := "test-tenant"

	// Create incident
	req := &CreateIncidentRequest{
		Title:       "API Service Outage",
		Description: "API service is experiencing high latency and errors",
		Severity:    "P1",
		Impact:      "high",
		Urgency:     "high",
		Source:      "alert",
		AlertIDs:    []string{"alert-1", "alert-2"},
		Tags:        []string{"outage", "api"},
		AssignedTo:  StringPtr("sre-team"),
	}

	incident, err := monitoring.CreateIncident(ctx, tenantID, req)
	if err != nil {
		t.Fatalf("Failed to create incident: %v", err)
	}

	if incident.Title != req.Title {
		t.Errorf("Expected incident title %s, got %s", req.Title, incident.Title)
	}

	// Update incident
	update := &Incident{
		Status:     "investigating",
		AssignedTo: StringPtr("john.doe"),
	}

	updated, err := monitoring.UpdateIncident(ctx, tenantID, incident.ID, update)
	if err != nil {
		t.Fatalf("Failed to update incident: %v", err)
	}

	if updated.Status != update.Status {
		t.Errorf("Expected status %s, got %s", update.Status, updated.Status)
	}

	// Resolve incident
	err = monitoring.ResolveIncident(ctx, tenantID, incident.ID, "Fixed underlying database issue")
	if err != nil {
		t.Fatalf("Failed to resolve incident: %v", err)
	}
}

func TestMonitoringEnhanced_Runbooks(t *testing.T) {
	client := NewTestClient()
	monitoring := NewMonitoringEnhanced(client)
	ctx := context.Background()

	tenantID := "test-tenant"

	// Create runbook
	runbook := &Runbook{
		Name:        "Restart Service",
		Description: "Automated runbook to restart service when it fails",
		Trigger: RunbookTrigger{
			Type: "alert",
			Conditions: map[string]interface{}{
				"alert_name": "Service Down",
				"severity":   "critical",
			},
		},
		Steps: []RunbookStep{
			{
				ID:   1,
				Name: "Check service status",
				Type: "action",
				Action: &RunbookAction{
					Type:   "api",
					Target: "http://localhost:8080/health",
					Method: "GET",
				},
				Enabled: true,
			},
			{
				ID:   2,
				Name: "Restart service",
				Type: "action",
				Action: &RunbookAction{
					Type:   "api",
					Target: "http://localhost:8080/restart",
					Method: "POST",
				},
				Enabled: true,
			},
			{
				ID:      3,
				Name:    "Wait for service to start",
				Type:    "delay",
				Delay:   DurationPtr(30 * time.Second),
				Enabled: true,
			},
		},
		Enabled: true,
		Version: 1,
		Author:  "sre-team",
	}

	created, err := monitoring.CreateRunbook(ctx, tenantID, runbook)
	if err != nil {
		t.Fatalf("Failed to create runbook: %v", err)
	}

	if created.Name != runbook.Name {
		t.Errorf("Expected runbook name %s, got %s", runbook.Name, created.Name)
	}

	// Execute runbook
	trigger := RunbookTrigger{
		Type: "manual",
		Conditions: map[string]interface{}{
			"triggered_by": "test-user",
		},
	}

	execution, err := monitoring.ExecuteRunbook(ctx, tenantID, created.ID, trigger, "test-user")
	if err != nil {
		t.Fatalf("Failed to execute runbook: %v", err)
	}

	if execution.Status == "" {
		t.Error("Expected execution status")
	}

	// Get execution status
	status, err := monitoring.GetRunbookExecution(ctx, tenantID, execution.ID)
	if err != nil {
		t.Fatalf("Failed to get runbook execution: %v", err)
	}

	if status.ID != execution.ID {
		t.Errorf("Expected execution ID %s, got %s", execution.ID, status.ID)
	}
}

func TestMonitoringEnhanced_CapacityPlanning(t *testing.T) {
	client := NewTestClient()
	monitoring := NewMonitoringEnhanced(client)
	ctx := context.Background()

	tenantID := "test-tenant"

	// Generate capacity plan
	timeRange := TimestampRange{
		From: NewTimestamp(time.Now().Add(-30 * 24 * time.Hour)),
		To:   NewTimestamp(time.Now()),
	}

	options := &CapacityPlanningOptions{
		PredictionHorizon: DurationPtr(90 * 24 * time.Hour),
		GrowthRate:        Float64Ptr(0.15), // 15% growth
		Seasonality:       BoolPtr(true),
		IncludeCosts:      BoolPtr(true),
		ConfidenceLevel:   Float64Ptr(0.95),
		Resources:         []string{"cpu", "memory", "storage", "network"},
	}

	plan, err := monitoring.GenerateCapacityPlan(ctx, tenantID, timeRange, options)
	if err != nil {
		t.Fatalf("Failed to generate capacity plan: %v", err)
	}

	if plan.Name == "" {
		t.Error("Expected capacity plan name")
	}

	if len(plan.CurrentCapacity) == 0 {
		t.Error("Expected current capacity data")
	}

	if len(plan.PredictedDemand) == 0 {
		t.Error("Expected predicted demand data")
	}

	if len(plan.Recommendations) == 0 {
		t.Error("Expected capacity recommendations")
	}

	if plan.Summary.OverallStatus == "" {
		t.Error("Expected overall status in summary")
	}
}

func TestMonitoringEnhanced_BusinessMetrics(t *testing.T) {
	client := NewTestClient()
	monitoring := NewMonitoringEnhanced(client)
	ctx := context.Background()

	tenantID := "test-tenant"

	// Get business metrics
	timeRange := TimestampRange{
		From: NewTimestamp(time.Now().Add(-30 * 24 * time.Hour)),
		To:   NewTimestamp(time.Now()),
	}

	metrics := []string{
		"user_metrics",
		"revenue_metrics",
		"usage_metrics",
		"quality_metrics",
		"sla_metrics",
	}

	businessMetrics, err := monitoring.GetBusinessMetrics(ctx, tenantID, timeRange, metrics)
	if err != nil {
		t.Fatalf("Failed to get business metrics: %v", err)
	}

	if businessMetrics.UserMetrics.TotalUsers == 0 {
		t.Error("Expected non-zero total users")
	}

	if businessMetrics.RevenueMetrics.MRR == 0 {
		t.Error("Expected non-zero MRR")
	}

	if businessMetrics.UsageMetrics.APIRequests == 0 {
		t.Error("Expected non-zero API requests")
	}

	if businessMetrics.Summary.OverallScore == 0 {
		t.Error("Expected non-zero overall score")
	}
}

func TestCalculateSeasonality(t *testing.T) {
	// Test with seasonal data
	data := []float64{100, 120, 140, 160, 180, 200, 220, 240, 260, 280, 300, 320,
		100, 120, 140, 160, 180, 200, 220, 240, 260, 280, 300, 320, 100, 120, 140, 160, 180, 200}

	hasSeasonality, period, confidence := CalculateSeasonality(data, time.Hour)

	if !hasSeasonality {
		t.Error("Expected to detect seasonality")
	}

	if period != 12*time.Hour {
		t.Errorf("Expected period of 12 hours, got %v", period)
	}

	if confidence < 0.7 {
		t.Errorf("Expected confidence > 0.7, got %f", confidence)
	}
}

func TestDetectAnomalies(t *testing.T) {
	// Test with data containing anomalies
	data := []float64{10, 12, 11, 13, 12, 14, 13, 15, 14, 16, // normal
		50,                                     // anomaly
		15, 17, 16, 18, 17, 19, 18, 20, 19, 21, // normal
		5,                                      // anomaly
		22, 24, 23, 25, 24, 26, 25, 27, 26, 28, // normal
	}

	anomalies := DetectAnomalies(data, 0.5)

	if len(anomalies) == 0 {
		t.Error("Expected to detect anomalies")
	}

	// Check if anomalies are at expected positions
	expectedAnomalies := []int{10, 20}

	for i, expected := range expectedAnomalies {
		if i >= len(anomalies) {
			break
		}
		if anomalies[i] != expected {
			t.Errorf("Expected anomaly at position %d, got %d", expected, anomalies[i])
		}
	}
}

// Helper functions
func DurationPtr(d time.Duration) *time.Duration {
	return &d
}

func BoolPtr(b bool) *bool {
	return &b
}

func Float64Ptr(f float64) *float64 {
	return &f
}

func IntPtr(i int) *int {
	return &i
}

func StringPtr(s string) *string {
	return &s
}

func TimestampPtr(t Timestamp) *Timestamp {
	return &t
}
