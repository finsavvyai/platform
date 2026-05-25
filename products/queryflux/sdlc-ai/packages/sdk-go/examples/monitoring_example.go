package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/SDLC/sdln-sdk-go/pkg/sdln"
)

func main() {
	// Initialize the SDLC.ai client
	config := sdln.DefaultConfig()
	config.BaseURL = "https://api.sdlc.ai"

	client, err := sdln.NewClient(config,
		sdln.WithAPIKey("your-api-key-here"),
	)
	if err != nil {
		log.Fatalf("Failed to create client: %v", err)
	}
	defer client.Close()

	// Get the enhanced monitoring service
	monitoring := &EnhancedMonitoring{
		client: client,
	}

	// Example 1: Set up comprehensive monitoring
	fmt.Println("=== Setting up Monitoring Infrastructure ===")
	if err := monitoring.setupMonitoringInfrastructure(context.Background()); err != nil {
		log.Printf("Error setting up monitoring: %v", err)
	}

	// Example 2: Create anomaly detectors
	fmt.Println("\n=== Creating Anomaly Detectors ===")
	if err := monitoring.createAnomalyDetectors(context.Background()); err != nil {
		log.Printf("Error creating anomaly detectors: %v", err)
	}

	// Example 3: Create automated runbooks
	fmt.Println("\n=== Creating Automated Runbooks ===")
	if err := monitoring.createRunbooks(context.Background()); err != nil {
		log.Printf("Error creating runbooks: %v", err)
	}

	// Example 4: Monitor system health
	fmt.Println("\n=== Monitoring System Health ===")
	if err := monitoring.monitorSystemHealth(context.Background()); err != nil {
		log.Printf("Error monitoring health: %v", err)
	}

	// Example 5: Generate capacity plan
	fmt.Println("\n=== Generating Capacity Plan ===")
	if err := monitoring.generateCapacityPlan(context.Background()); err != nil {
		log.Printf("Error generating capacity plan: %v", err)
	}

	// Example 6: Get business metrics
	fmt.Println("\n=== Fetching Business Metrics ===")
	if err := monitoring.fetchBusinessMetrics(context.Background()); err != nil {
		log.Printf("Error fetching business metrics: %v", err)
	}

	// Example 7: Demonstrate incident response
	fmt.Println("\n=== Demonstrating Incident Response ===")
	if err := monitoring.demonstrateIncidentResponse(context.Background()); err != nil {
		log.Printf("Error in incident response: %v", err)
	}

	fmt.Println("\n=== Monitoring Setup Complete ===")
}

// EnhancedMonitoring wraps the monitoring service with additional functionality
type EnhancedMonitoring struct {
	client     *sdln.Client
	monitoring *sdln.MonitoringEnhanced
	tenantID   string
	utils      *sdln.MonitoringUtils
}

// NewEnhancedMonitoring creates a new enhanced monitoring instance
func NewEnhancedMonitoring(client *sdln.Client, tenantID string) *EnhancedMonitoring {
	return &EnhancedMonitoring{
		client:     client,
		monitoring: sdln.NewMonitoringEnhanced(client),
		tenantID:   tenantID,
		utils:      sdln.NewMonitoringUtils(),
	}
}

// setupMonitoringInfrastructure sets up the complete monitoring infrastructure
func (em *EnhancedMonitoring) setupMonitoringInfrastructure(ctx context.Context) error {
	// 1. Create alert rules for critical metrics
	alertRules := []*sdln.CreateAlertRuleRequest{
		{
			Name:        "High CPU Usage",
			Description: "Alert when CPU usage exceeds 80%",
			Query:       "avg(rate(cpu_usage_total[5m]))",
			Condition:   ">",
			Threshold:   80,
			Severity:    "warning",
			For:         sdln.DurationPtr(5 * time.Minute),
			Enabled:     sdln.BoolPtr(true),
			Labels: map[string]string{
				"team":     "platform",
				"resource": "cpu",
			},
			Annotations: map[string]string{
				"summary":     "High CPU usage detected",
				"description": "CPU usage has exceeded 80% for more than 5 minutes",
			},
		},
		{
			Name:        "Critical Memory Usage",
			Description: "Alert when memory usage exceeds 90%",
			Query:       "avg(rate(memory_usage_bytes[5m])) / total_memory_bytes * 100",
			Condition:   ">",
			Threshold:   90,
			Severity:    "critical",
			For:         sdln.DurationPtr(2 * time.Minute),
			Enabled:     sdln.BoolPtr(true),
			Labels: map[string]string{
				"team":     "platform",
				"resource": "memory",
			},
		},
		{
			Name:        "High Error Rate",
			Description: "Alert when error rate exceeds 5%",
			Query:       "rate(http_requests_total{status=~\"5..\"}[5m]) / rate(http_requests_total[5m]) * 100",
			Condition:   ">",
			Threshold:   5,
			Severity:    "critical",
			For:         sdln.DurationPtr(1 * time.Minute),
			Enabled:     sdln.BoolPtr(true),
			Labels: map[string]string{
				"team": "api",
			},
		},
		{
			Name:        "Database Connection Pool Exhaustion",
			Description: "Alert when database connection pool is nearly full",
			Query:       "db_connections_active / db_connections_max * 100",
			Condition:   ">",
			Threshold:   85,
			Severity:    "warning",
			For:         sdln.DurationPtr(3 * time.Minute),
			Enabled:     sdln.BoolPtr(true),
		},
		{
			Name:        "API Latency Spike",
			Description: "Alert when P95 latency exceeds 1 second",
			Query:       "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
			Condition:   ">",
			Threshold:   1.0,
			Severity:    "warning",
			For:         sdln.DurationPtr(2 * time.Minute),
			Enabled:     sdln.BoolPtr(true),
		},
	}

	for _, rule := range alertRules {
		_, err := em.monitoring.CreateAlertRule(ctx, em.tenantID, rule)
		if err != nil {
			return fmt.Errorf("failed to create alert rule %s: %w", rule.Name, err)
		}
		fmt.Printf("✓ Created alert rule: %s\n", rule.Name)
	}

	// 2. Create monitoring dashboards
	dashboards := []*sdln.Dashboard{
		{
			Name:        "System Overview",
			Description: "High-level system metrics and health",
			Tags:        []string{"system", "overview"},
			Panels: []sdln.DashboardPanel{
				{
					ID:       "cpu-panel",
					Title:    "CPU Usage",
					Type:     "graph",
					Query:    "avg(rate(cpu_usage_total[5m]))",
					Position: sdln.PanelPosition{X: 0, Y: 0, Width: 12, Height: 8},
				},
				{
					ID:       "memory-panel",
					Title:    "Memory Usage",
					Type:     "graph",
					Query:    "avg(rate(memory_usage_bytes[5m])) / total_memory_bytes * 100",
					Position: sdln.PanelPosition{X: 12, Y: 0, Width: 12, Height: 8},
				},
				{
					ID:       "request-rate",
					Title:    "Request Rate",
					Type:     "graph",
					Query:    "sum(rate(http_requests_total[5m]))",
					Position: sdln.PanelPosition{X: 0, Y: 8, Width: 12, Height: 8},
				},
				{
					ID:       "error-rate",
					Title:    "Error Rate",
					Type:     "singlestat",
					Query:    "rate(http_requests_total{status=~\"5..\"}[5m]) / rate(http_requests_total[5m]) * 100",
					Position: sdln.PanelPosition{X: 12, Y: 8, Width: 12, Height: 8},
				},
			},
			TimeRange: sdln.TimeRange{
				From: sdln.NewTimestamp(time.Now().Add(-24 * time.Hour)),
				To:   sdln.NewTimestamp(time.Now()),
			},
			Refresh: sdln.DurationPtr(30 * time.Second),
			Shared:  true,
			Public:  false,
		},
		{
			Name:        "API Performance",
			Description: "Detailed API performance metrics",
			Tags:        []string{"api", "performance"},
			Panels: []sdln.DashboardPanel{
				{
					ID:       "latency-p95",
					Title:    "P95 Latency",
					Type:     "graph",
					Query:    "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
					Position: sdln.PanelPosition{X: 0, Y: 0, Width: 12, Height: 8},
				},
				{
					ID:       "latency-p99",
					Title:    "P99 Latency",
					Type:     "graph",
					Query:    "histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))",
					Position: sdln.PanelPosition{X: 12, Y: 0, Width: 12, Height: 8},
				},
				{
					ID:       "throughput",
					Title:    "Throughput (RPS)",
					Type:     "graph",
					Query:    "sum(rate(http_requests_total[5m]))",
					Position: sdln.PanelPosition{X: 0, Y: 8, Width: 24, Height: 8},
				},
			},
			TimeRange: sdln.TimeRange{
				From: sdln.NewTimestamp(time.Now().Add(-6 * time.Hour)),
				To:   sdln.NewTimestamp(time.Now()),
			},
			Refresh: sdln.DurationPtr(15 * time.Second),
			Shared:  true,
		},
	}

	for _, dashboard := range dashboards {
		_, err := em.monitoring.CreateDashboard(ctx, em.tenantID, dashboard)
		if err != nil {
			return fmt.Errorf("failed to create dashboard %s: %w", dashboard.Name, err)
		}
		fmt.Printf("✓ Created dashboard: %s\n", dashboard.Name)
	}

	return nil
}

// createAnomalyDetectors creates ML-based anomaly detectors
func (em *EnhancedMonitoring) createAnomalyDetectors(ctx context.Context) error {
	detectors := []*sdln.AnomalyDetectionRequest{
		{
			Name:        "CPU Usage Anomaly",
			Metric:      "cpu_usage_percent",
			Algorithm:   "statistical",
			Sensitivity: 0.8,
			Window:      5 * time.Minute,
			Threshold:   75,
			Enabled:     sdln.BoolPtr(true),
			Metadata: map[string]interface{}{
				"team": "platform",
			},
		},
		{
			Name:        "Request Rate Anomaly",
			Metric:      "requests_per_second",
			Algorithm:   "seasonal",
			Sensitivity: 0.7,
			Window:      10 * time.Minute,
			Threshold:   1000,
			Seasonality: sdln.DurationPtr(24 * time.Hour),
			Enabled:     sdln.BoolPtr(true),
		},
		{
			Name:        "Error Rate Anomaly",
			Metric:      "error_rate_percent",
			Algorithm:   "ml",
			Sensitivity: 0.9,
			Window:      5 * time.Minute,
			Threshold:   3,
			Enabled:     sdln.BoolPtr(true),
			Metadata: map[string]interface{}{
				"model_type": "isolation_forest",
			},
		},
		{
			Name:        "Latency Anomaly",
			Metric:      "response_time_p95",
			Algorithm:   "statistical",
			Sensitivity: 0.75,
			Window:      3 * time.Minute,
			Threshold:   500,
			Enabled:     sdln.BoolPtr(true),
		},
	}

	for _, detector := range detectors {
		created, err := em.monitoring.CreateAnomalyDetector(ctx, em.tenantID, detector)
		if err != nil {
			return fmt.Errorf("failed to create anomaly detector %s: %w", detector.Name, err)
		}
		fmt.Printf("✓ Created anomaly detector: %s (ID: %s)\n", detector.Name, created.ID)
	}

	return nil
}

// createRunbooks creates automated runbooks for incident response
func (em *EnhancedMonitoring) createRunbooks(ctx context.Context) error {
	runbooks := []*sdln.Runbook{
		{
			Name:        "Auto-Scale on High CPU",
			Description: "Automatically scale resources when CPU is high",
			Trigger: sdln.RunbookTrigger{
				Type: "alert",
				Conditions: map[string]interface{}{
					"alert_name": "High CPU Usage",
					"severity":   "warning",
				},
			},
			Steps: []sdln.RunbookStep{
				{
					ID:   1,
					Name: "Verify alert",
					Type: "action",
					Action: &sdln.RunbookAction{
						Type:   "query",
						Target: "SELECT avg(cpu_usage) FROM metrics WHERE time > now() - 5m",
					},
					Enabled: true,
				},
				{
					ID:   2,
					Name: "Scale up",
					Type: "action",
					Action: &sdln.RunbookAction{
						Type:   "api",
						Target: "https://api.cloudprovider.com/scale",
						Method: "POST",
						Body: map[string]interface{}{
							"service":  "api-service",
							"replicas": 10,
						},
					},
					Enabled: true,
				},
				{
					ID:   3,
					Name: "Notify team",
					Type: "notification",
					Notification: &sdln.RunbookNotification{
						Channels: []string{"slack", "email"},
						Template: "auto-scale-notification",
						Data: map[string]interface{}{
							"action":   "scaled up",
							"reason":   "high CPU usage",
							"replicas": 10,
						},
					},
					Enabled: true,
				},
			},
			Enabled: true,
			Version: 1,
			Author:  "sre-team",
		},
		{
			Name:        "Restart Failed Service",
			Description: "Automatically restart failed services",
			Trigger: sdln.RunbookTrigger{
				Type: "alert",
				Conditions: map[string]interface{}{
					"alert_name": "Service Down",
					"severity":   "critical",
				},
			},
			Steps: []sdln.RunbookStep{
				{
					ID:   1,
					Name: "Check service health",
					Type: "action",
					Action: &sdln.RunbookAction{
						Type:   "api",
						Target: "http://service:8080/health",
						Method: "GET",
					},
					Timeout: sdln.DurationPtr(10 * time.Second),
					Enabled: true,
				},
				{
					ID:   2,
					Name: "Restart service",
					Type: "action",
					Action: &sdln.RunbookAction{
						Type:   "api",
						Target: "http://service:8080/restart",
						Method: "POST",
					},
					Enabled: true,
				},
				{
					ID:      3,
					Name:    "Wait for restart",
					Type:    "delay",
					Delay:   sdln.DurationPtr(30 * time.Second),
					Enabled: true,
				},
				{
					ID:   4,
					Name: "Verify service is healthy",
					Type: "action",
					Action: &sdln.RunbookAction{
						Type:   "api",
						Target: "http://service:8080/health",
						Method: "GET",
					},
					Enabled: true,
				},
			},
			Enabled: true,
			Version: 1,
			Author:  "sre-team",
		},
		{
			Name:        "Clear Disk Space",
			Description: "Automatically clean up temporary files when disk is full",
			Trigger: sdln.RunbookTrigger{
				Type: "alert",
				Conditions: map[string]interface{}{
					"alert_name": "Disk Space Low",
					"severity":   "critical",
				},
			},
			Steps: []sdln.RunbookStep{
				{
					ID:   1,
					Name: "Clear temp files",
					Type: "action",
					Action: &sdln.RunbookAction{
						Type:   "script",
						Target: "cleanup-temp-files.sh",
					},
					Enabled: true,
				},
				{
					ID:   2,
					Name: "Rotate logs",
					Type: "action",
					Action: &sdln.RunbookAction{
						Type:   "script",
						Target: "rotate-logs.sh",
					},
					Enabled: true,
				},
				{
					ID:   3,
					Name: "Notify operations",
					Type: "notification",
					Notification: &sdln.RunbookNotification{
						Channels: []string{"pagerduty"},
						Template: "disk-space-critical",
						Data: map[string]interface{}{
							"action": "cleaned up disk space",
						},
					},
					Enabled: true,
				},
			},
			Enabled: true,
			Version: 1,
			Author:  "ops-team",
		},
	}

	for _, runbook := range runbooks {
		created, err := em.monitoring.CreateRunbook(ctx, em.tenantID, runbook)
		if err != nil {
			return fmt.Errorf("failed to create runbook %s: %w", runbook.Name, err)
		}
		fmt.Printf("✓ Created runbook: %s (ID: %s)\n", runbook.Name, created.ID)
	}

	return nil
}

// monitorSystemHealth checks the overall system health
func (em *EnhancedMonitoring) monitorSystemHealth(ctx context.Context) error {
	// Get system health status
	health, err := em.monitoring.GetHealth(ctx, em.tenantID, []string{
		"database",
		"cache",
		"api",
		"vector_store",
		"llm_service",
		"document_store",
	})
	if err != nil {
		return fmt.Errorf("failed to get health status: %w", err)
	}

	fmt.Printf("System Health Status: %s\n", health.Status)

	for _, check := range health.Checks {
		status := "✓"
		if check.Status != "pass" {
			status = "✗"
		}
		fmt.Printf("  %s %s: %s (%.2fs)\n", status, check.Name, check.Status, check.Duration.Seconds())
		if check.Message != "" {
			fmt.Printf("    Message: %s\n", check.Message)
		}
	}

	// Check recent alerts
	alerts, err := em.monitoring.ListAlerts(ctx, em.tenantID, &sdln.AlertListOptions{
		Page:     1,
		PageSize: 20,
		Status:   "active",
		SortBy:   "starts_at",
		SortDesc: true,
		TimeRange: &sdln.TimestampRange{
			From: sdln.NewTimestamp(time.Now().Add(-1 * time.Hour)),
			To:   sdln.NewTimestamp(time.Now()),
		},
	})
	if err != nil {
		return fmt.Errorf("failed to list alerts: %w", err)
	}

	fmt.Printf("\nActive Alerts (%d):\n", len(alerts.Items))
	for _, alert := range alerts.Items {
		fmt.Printf("  - %s [%s]: %s\n", alert.Name, alert.Severity, alert.Description)
	}

	// Check recent anomalies
	anomalies, err := em.monitoring.ListAnomalies(ctx, em.tenantID, &sdln.AnomalyListOptions{
		Page:     1,
		PageSize: 10,
		Resolved: sdln.BoolPtr(false),
		SortBy:   "timestamp",
		SortDesc: true,
	})
	if err == nil {
		fmt.Printf("\nRecent Anomalies (%d):\n", len(anomalies.Items))
		for _, anomaly := range anomalies.Items {
			fmt.Printf("  - %s: %.2f (expected: %.2f, deviation: %.2f%%)\n",
				anomaly.Metric, anomaly.Value, anomaly.Expected, anomaly.Deviation)
		}
	}

	return nil
}

// generateCapacityPlan creates a capacity planning report
func (em *EnhancedMonitoring) generateCapacityPlan(ctx context.Context) error {
	timeRange := sdln.TimestampRange{
		From: sdln.NewTimestamp(time.Now().Add(-30 * 24 * time.Hour)),
		To:   sdln.NewTimestamp(time.Now()),
	}

	options := &sdln.CapacityPlanningOptions{
		PredictionHorizon: sdln.DurationPtr(90 * 24 * time.Hour),
		GrowthRate:        sdln.Float64Ptr(0.20), // 20% growth
		Seasonality:       sdln.BoolPtr(true),
		IncludeCosts:      sdln.BoolPtr(true),
		ConfidenceLevel:   sdln.Float64Ptr(0.95),
	}

	plan, err := em.monitoring.GenerateCapacityPlan(ctx, em.tenantID, timeRange, options)
	if err != nil {
		return fmt.Errorf("failed to generate capacity plan: %w", err)
	}

	fmt.Printf("Capacity Plan: %s\n", plan.Name)
	fmt.Printf("Overall Status: %s\n", plan.Summary.OverallStatus)
	fmt.Printf("Valid Until: %s\n", plan.ValidUntil.Format("2006-01-02 15:04:05"))

	fmt.Printf("\nCritical Resources:\n")
	for _, resource := range plan.Summary.CriticalResources {
		fmt.Printf("  - %s\n", resource)
	}

	fmt.Printf("\nScaling Needs:\n")
	for _, need := range plan.Summary.ScalingNeeds {
		fmt.Printf("  - %s\n", need)
	}

	fmt.Printf("\nTop Recommendations:\n")
	for i, rec := range plan.Recommendations {
		if i >= 5 { // Show top 5
			break
		}
		fmt.Printf("  %d. %s\n", i+1, rec.Description)
		fmt.Printf("     Action: %s, Priority: %s\n", rec.Action, rec.Priority)
		fmt.Printf("     Cost Impact: $%.2f\n", rec.CostImpact)
	}

	return nil
}

// fetchBusinessMetrics retrieves and displays business metrics
func (em *EnhancedMonitoring) fetchBusinessMetrics(ctx context.Context) error {
	timeRange := sdln.TimestampRange{
		From: sdln.NewTimestamp(time.Now().Add(-7 * 24 * time.Hour)),
		To:   sdln.NewTimestamp(time.Now()),
	}

	metrics, err := em.monitoring.GetBusinessMetrics(ctx, em.tenantID, timeRange, []string{
		"user_metrics",
		"revenue_metrics",
		"usage_metrics",
		"quality_metrics",
		"sla_metrics",
	})
	if err != nil {
		return fmt.Errorf("failed to get business metrics: %w", err)
	}

	fmt.Printf("Business Metrics Summary\n")
	fmt.Printf("========================\n")
	fmt.Printf("Overall Score: %.1f/100\n", metrics.Summary.OverallScore)
	fmt.Printf("Health Status: %s\n", metrics.Summary.Health)

	// User Metrics
	fmt.Printf("\nUser Metrics:\n")
	fmt.Printf("  Total Users: %d\n", metrics.UserMetrics.TotalUsers)
	fmt.Printf("  Active Users: %d\n", metrics.UserMetrics.ActiveUsers)
	fmt.Printf("  New Users: %d\n", metrics.UserMetrics.NewUsers)
	fmt.Printf("  Retention Rate: %.1f%%\n", metrics.UserMetrics.RetentionRate*100)
	fmt.Printf("  Engagement Score: %.1f\n", metrics.UserMetrics.EngagementScore)

	// Revenue Metrics
	fmt.Printf("\nRevenue Metrics:\n")
	fmt.Printf("  MRR: $%.2f\n", metrics.RevenueMetrics.MRR)
	fmt.Printf("  ARR: $%.2f\n", metrics.RevenueMetrics.ARR)
	fmt.Printf("  ARPU: $%.2f\n", metrics.RevenueMetrics.ARPU)
	fmt.Printf("  Growth Rate: %.1f%%\n", metrics.RevenueMetrics.GrowthRate*100)
	fmt.Printf("  Churn Rate: %.1f%%\n", metrics.RevenueMetrics.ChurnRate*100)

	// Usage Metrics
	fmt.Printf("\nUsage Metrics:\n")
	fmt.Printf("  API Requests: %d\n", metrics.UsageMetrics.APIRequests)
	fmt.Printf("  Document Uploads: %d\n", metrics.UsageMetrics.DocumentUploads)
	fmt.Printf("  LLM Calls: %d\n", metrics.UsageMetrics.LLMCalls)
	fmt.Printf("  Token Usage: %d\n", metrics.UsageMetrics.TokenUsage)
	fmt.Printf("  Success Rate: %.1f%%\n", metrics.UsageMetrics.SuccessRate*100)

	// Quality Metrics
	fmt.Printf("\nQuality Metrics:\n")
	fmt.Printf("  Uptime: %.2f%%\n", metrics.QualityMetrics.Uptime*100)
	fmt.Printf("  P95 Latency: %v\n", metrics.QualityMetrics.Latency.P95)
	fmt.Printf("  P99 Latency: %v\n", metrics.QualityMetrics.Latency.P99)
	fmt.Printf("  Error Rate: %.2f%%\n", metrics.QualityMetrics.ErrorRate*100)
	fmt.Printf("  Satisfaction Score: %.1f\n", metrics.QualityMetrics.SatisfactionScore)

	// Key Insights
	fmt.Printf("\nKey Insights:\n")
	for _, insight := range metrics.Summary.KeyInsights {
		fmt.Printf("  • %s\n", insight)
	}

	// Recommendations
	fmt.Printf("\nRecommendations:\n")
	for _, rec := range metrics.Summary.Recommendations {
		fmt.Printf("  • %s\n", rec)
	}

	return nil
}

// demonstrateIncidentResponse demonstrates the incident response workflow
func (em *EnhancedMonitoring) demonstrateIncidentResponse(ctx context.Context) error {
	// Create a test incident
	incidentReq := &sdln.CreateIncidentRequest{
		Title:       "Database Connection Pool Exhaustion",
		Description: "Application is experiencing database connection pool exhaustion causing 5xx errors",
		Severity:    "P1",
		Impact:      "high",
		Urgency:     "high",
		Source:      "alert",
		AlertIDs:    []string{"alert-123", "alert-124"},
		Tags:        []string{"database", "production", "p1"},
		AssignedTo:  sdln.StringPtr("on-call-db-team"),
	}

	incident, err := em.monitoring.CreateIncident(ctx, em.tenantID, incidentReq)
	if err != nil {
		return fmt.Errorf("failed to create incident: %w", err)
	}

	fmt.Printf("Created Incident: %s (ID: %s)\n", incident.Title, incident.ID)
	fmt.Printf("Severity: %s, Status: %s\n", incident.Severity, incident.Status)

	// Simulate incident response steps
	steps := []struct {
		action   string
		duration time.Duration
	}{
		{"Acknowledge incident", 5 * time.Minute},
		{"Investigate root cause", 15 * time.Minute},
		{"Implement fix", 30 * time.Minute},
		{"Verify resolution", 10 * time.Minute},
	}

	for _, step := range steps {
		fmt.Printf("  %s... (took %v)\n", step.action, step.duration)
		time.Sleep(100 * time.Millisecond) // Simulate work
	}

	// Resolve the incident
	err = em.monitoring.ResolveIncident(ctx, em.tenantID, incident.ID,
		"Increased database connection pool size from 50 to 100 connections")
	if err != nil {
		return fmt.Errorf("failed to resolve incident: %w", err)
	}

	fmt.Printf("✓ Incident resolved in %v\n", 1*time.Hour)

	// Get updated incident details
	resolved, err := em.monitoring.GetIncident(ctx, em.tenantID, incident.ID)
	if err != nil {
		return fmt.Errorf("failed to get incident: %w", err)
	}

	if resolved.MTTR != nil {
		fmt.Printf("MTTR: %v\n", *resolved.MTTR)
	}

	// Execute related runbook
	runbooks, err := em.monitoring.ListRunbooks(ctx, em.tenantID, &sdln.ListOptions{
		PageSize: 10,
	})
	if err == nil {
		for _, rb := range runbooks.Items {
			if rb.Name == "Database Pool Recovery" {
				trigger := sdln.RunbookTrigger{
					Type: "alert",
					Conditions: map[string]interface{}{
						"incident_id": incident.ID,
					},
				}

				execution, err := em.monitoring.ExecuteRunbook(ctx, em.tenantID, rb.ID, trigger, "incident-response")
				if err == nil {
					fmt.Printf("✓ Executed runbook: %s (Execution ID: %s)\n", rb.Name, execution.ID)
					fmt.Printf("  Status: %s\n", execution.Status)
				}
				break
			}
		}
	}

	return nil
}

// Helper function to create client with API key
func WithAPIKey(key string) sdln.ClientOption {
	return func(c *sdln.Client) error {
		// This would set up authentication with the API key
		// Implementation depends on the auth mechanism
		return nil
	}
}
