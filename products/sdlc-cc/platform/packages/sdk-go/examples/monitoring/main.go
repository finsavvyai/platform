//go:build never
// +build never

package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/SDLC/sdln-sdk-go/pkg/sdln"
)

func main() {
	// Create a new client
	client, err := sdln.NewClient(&sdln.Config{
		BaseURL: "https://api.sdlc.cc",
		Timeout: 30 * time.Second,
	})
	if err != nil {
		log.Fatalf("Failed to create client: %v", err)
	}
	defer client.Close()

	// Get tenant ID (in practice, this would come from authentication)
	tenantID := "tenant-123"

	// Create context
	ctx := context.Background()

	// Run monitoring examples
	if err := runMonitoringExample(ctx, client, tenantID); err != nil {
		log.Fatalf("Monitoring example failed: %v", err)
	}

	if err := runAnomalyDetectionExample(ctx, client, tenantID); err != nil {
		log.Fatalf("Anomaly detection example failed: %v", err)
	}

	if err := runIncidentManagementExample(ctx, client, tenantID); err != nil {
		log.Fatalf("Incident management example failed: %v", err)
	}

	if err := runRunbookAutomationExample(ctx, client, tenantID); err != nil {
		log.Fatalf("Runbook automation example failed: %v", err)
	}

	if err := runCapacityPlanningExample(ctx, client, tenantID); err != nil {
		log.Fatalf("Capacity planning example failed: %v", err)
	}

	if err := runBusinessMetricsExample(ctx, client, tenantID); err != nil {
		log.Fatalf("Business metrics example failed: %v", err)
	}

	fmt.Println("All monitoring examples completed successfully!")
}

// runMonitoringExample demonstrates basic monitoring operations
func runMonitoringExample(ctx context.Context, client *sdln.Client, tenantID string) error {
	fmt.Println("\n=== Basic Monitoring Example ===")

	monitoring := client.Monitoring()

	// Push metrics
	metrics := []sdln.Metric{
		{
			Name:      "api_requests_total",
			Value:     1250,
			Timestamp: sdln.NewTimestamp(time.Now()),
			Labels: map[string]string{
				"method":   "GET",
				"status":   "200",
				"endpoint": "/api/v1/documents",
			},
			Unit: "count",
			Type: "counter",
		},
		{
			Name:      "response_time_seconds",
			Value:     0.089,
			Timestamp: sdln.NewTimestamp(time.Now()),
			Labels: map[string]string{
				"method":   "GET",
				"endpoint": "/api/v1/documents",
			},
			Unit: "seconds",
			Type: "histogram",
		},
		{
			Name:      "cpu_usage_percent",
			Value:     75.5,
			Timestamp: sdln.NewTimestamp(time.Now()),
			Labels: map[string]string{
				"instance": "api-server-1",
				"region":   "us-west-2",
			},
			Unit: "percent",
			Type: "gauge",
		},
	}

	fmt.Println("Pushing metrics...")
	if err := monitoring.PushMetrics(ctx, tenantID, metrics); err != nil {
		return fmt.Errorf("failed to push metrics: %w", err)
	}
	fmt.Printf("Successfully pushed %d metrics\n", len(metrics))

	// Query metrics
	queries := []sdln.MetricQuery{
		{
			Name:  "api_request_rate",
			Query: "sum(rate(api_requests_total[5m]))",
			Labels: map[string]string{
				"method": "GET",
			},
			Aggregation: "sum",
		},
		{
			Name:        "p95_response_time",
			Query:       "histogram_quantile(0.95, rate(response_time_seconds_bucket[5m]))",
			Aggregation: "avg",
		},
	}

	fmt.Println("\nQuerying metrics...")
	series, err := monitoring.QueryMetrics(ctx, queries)
	if err != nil {
		return fmt.Errorf("failed to query metrics: %w", err)
	}
	fmt.Printf("Retrieved %d metric series\n", len(series))

	// Create alert rule
	alertRule := &sdln.CreateAlertRuleRequest{
		Name:        "High CPU Usage",
		Description: "Alert when CPU usage exceeds 80%",
		Query:       "cpu_usage_percent > 80",
		Condition:   ">",
		Threshold:   80,
		Severity:    "warning",
		For:         sdln.DurationPtr(5 * time.Minute),
		Enabled:     sdln.BoolPtr(true),
		Labels: map[string]string{
			"team":    "platform",
			"service": "api",
		},
		Annotations: map[string]string{
			"summary":     "High CPU usage detected",
			"description": "CPU usage has exceeded 80% threshold",
		},
	}

	fmt.Println("\nCreating alert rule...")
	rule, err := monitoring.CreateAlertRule(ctx, tenantID, alertRule)
	if err != nil {
		return fmt.Errorf("failed to create alert rule: %w", err)
	}
	fmt.Printf("Created alert rule: %s (ID: %s)\n", rule.Name, rule.ID)

	// List active alerts
	fmt.Println("\nListing active alerts...")
	alerts, err := monitoring.ListAlerts(ctx, tenantID, &sdln.AlertListOptions{
		Status:   "active",
		Severity: "warning",
		SortBy:   "starts_at",
		SortDesc: true,
	})
	if err != nil {
		return fmt.Errorf("failed to list alerts: %w", err)
	}
	fmt.Printf("Found %d active alerts\n", len(alerts.Items))

	// Create dashboard
	dashboard := &sdln.Dashboard{
		Name:        "System Overview",
		Description: "Main system dashboard",
		Tags:        []string{"system", "overview"},
		Panels: []sdln.DashboardPanel{
			{
				ID:         "panel-1",
				Title:      "Request Rate",
				Type:       "graph",
				Query:      "rate(api_requests_total[5m])",
				Position:   sdln.PanelPosition{X: 0, Y: 0, Width: 12, Height: 8},
				DataSource: "prometheus",
			},
			{
				ID:         "panel-2",
				Title:      "CPU Usage",
				Type:       "stat",
				Query:      "avg(cpu_usage_percent)",
				Position:   sdln.PanelPosition{X: 12, Y: 0, Width: 12, Height: 8},
				DataSource: "prometheus",
			},
		},
		TimeRange: sdln.TimeRange{
			From: sdln.NewTimestamp(time.Now().Add(-1 * time.Hour)),
			To:   sdln.NewTimestamp(time.Now()),
		},
		Refresh: sdln.DurationPtr(1 * time.Minute),
		Shared:  true,
		Public:  false,
	}

	fmt.Println("\nCreating dashboard...")
	createdDashboard, err := monitoring.CreateDashboard(ctx, tenantID, dashboard)
	if err != nil {
		return fmt.Errorf("failed to create dashboard: %w", err)
	}
	fmt.Printf("Created dashboard: %s (ID: %s)\n", createdDashboard.Name, createdDashboard.ID)

	// Get system health
	fmt.Println("\nChecking system health...")
	health, err := monitoring.GetHealth(ctx, tenantID, []string{"database", "cache", "api", "vector_store"})
	if err != nil {
		return fmt.Errorf("failed to get health status: %w", err)
	}
	fmt.Printf("System health status: %s\n", health.Status)
	for _, check := range health.Checks {
		fmt.Printf("  - %s: %s (%.2fs)\n", check.Name, check.Status, check.Duration.Seconds())
	}

	return nil
}

// runAnomalyDetectionExample demonstrates ML-based anomaly detection
func runAnomalyDetectionExample(ctx context.Context, client *sdln.Client, tenantID string) error {
	fmt.Println("\n=== Anomaly Detection Example ===")

	enhanced := sdln.NewMonitoringEnhanced(client)

	// Create anomaly detectors
	detectors := []sdln.AnomalyDetectionRequest{
		{
			Name:        "CPU Usage Anomaly Detector",
			Metric:      "cpu_usage_percent",
			Algorithm:   "statistical",
			Sensitivity: 0.8,
			Window:      5 * time.Minute,
			Threshold:   80,
			Enabled:     sdln.BoolPtr(true),
		},
		{
			Name:        "Memory Usage Anomaly Detector",
			Metric:      "memory_usage_percent",
			Algorithm:   "ml",
			Sensitivity: 0.9,
			Window:      10 * time.Minute,
			Threshold:   85,
			Seasonality: sdln.DurationPtr(24 * time.Hour),
			Enabled:     sdln.BoolPtr(true),
		},
		{
			Name:        "Request Rate Anomaly Detector",
			Metric:      "api_requests_per_second",
			Algorithm:   "seasonal",
			Sensitivity: 0.7,
			Window:      15 * time.Minute,
			Threshold:   1000,
			Seasonality: sdln.DurationPtr(1 * time.Hour),
			Enabled:     sdln.BoolPtr(true),
		},
	}

	for _, req := range detectors {
		fmt.Printf("Creating anomaly detector: %s\n", req.Name)
		detector, err := enhanced.CreateAnomalyDetector(ctx, tenantID, &req)
		if err != nil {
			return fmt.Errorf("failed to create anomaly detector: %w", err)
		}
		fmt.Printf("  - Created detector ID: %s\n", detector.ID)
		fmt.Printf("  - Algorithm: %s\n", detector.Algorithm)
		fmt.Printf("  - Sensitivity: %.2f\n", detector.Sensitivity)
	}

	// List all anomaly detectors
	fmt.Println("\nListing anomaly detectors...")
	detectorsList, err := enhanced.ListAnomalyDetectors(ctx, tenantID, &sdln.ListOptions{
		PageSize: 10,
	})
	if err != nil {
		return fmt.Errorf("failed to list anomaly detectors: %w", err)
	}
	fmt.Printf("Found %d anomaly detectors\n", len(detectorsList.Items))

	// List recent anomalies
	fmt.Println("\nListing recent anomalies...")
	anomalies, err := enhanced.ListAnomalies(ctx, tenantID, &sdln.AnomalyListOptions{
		PageSize: 20,
		Severity: "high",
		Resolved: sdln.BoolPtr(false),
		SortDesc: true,
	})
	if err != nil {
		return fmt.Errorf("failed to list anomalies: %w", err)
	}

	fmt.Printf("Found %d unresolved high-severity anomalies\n", len(anomalies.Items))
	for i, anomaly := range anomalies.Items {
		if i >= 5 { // Show only first 5
			break
		}
		fmt.Printf("  - %s: %.2f (expected: %.2f, deviation: %.2f%%)\n",
			anomaly.Metric, anomaly.Value, anomaly.Expected, anomaly.Deviation)
		fmt.Printf("    Confidence: %.2f, Severity: %s\n",
			anomaly.Confidence, anomaly.Severity)
	}

	return nil
}

// runIncidentManagementExample demonstrates incident management
func runIncidentManagementExample(ctx context.Context, client *sdln.Client, tenantID string) error {
	fmt.Println("\n=== Incident Management Example ===")

	enhanced := sdln.NewMonitoringEnhanced(client)

	// Create incidents
	incidents := []sdln.CreateIncidentRequest{
		{
			Title:       "Database Connection Pool Exhaustion",
			Description: "Database connection pool has reached maximum capacity, causing connection timeouts",
			Severity:    "P1",
			Impact:      "high",
			Urgency:     "high",
			Source:      "alert",
			AlertIDs:    []string{"alert-123", "alert-124"},
			Tags:        []string{"database", "outage"},
			AssignedTo:  sdln.StringPtr("db-team"),
		},
		{
			Title:       "High Latency on API Endpoints",
			Description: "API endpoints are experiencing elevated latency (>2s) for the last 15 minutes",
			Severity:    "P2",
			Impact:      "medium",
			Urgency:     "medium",
			Source:      "monitoring",
			AlertIDs:    []string{"alert-125"},
			Tags:        []string{"performance", "api"},
			AssignedTo:  sdln.StringPtr("platform-team"),
		},
		{
			Title:       "Elasticsearch Cluster Yellow Status",
			Description: "Elasticsearch cluster health is yellow due to unassigned shards",
			Severity:    "P3",
			Impact:      "low",
			Urgency:     "low",
			Source:      "health-check",
			AlertIDs:    []string{"alert-126"},
			Tags:        []string{"search", "infrastructure"},
		},
	}

	for _, req := range incidents {
		fmt.Printf("Creating incident: %s\n", req.Title)
		incident, err := enhanced.CreateIncident(ctx, tenantID, &req)
		if err != nil {
			return fmt.Errorf("failed to create incident: %w", err)
		}
		fmt.Printf("  - Incident ID: %s\n", incident.ID)
		fmt.Printf("  - Severity: %s, Impact: %s\n", incident.Severity, incident.Impact)
		fmt.Printf("  - Assigned to: %s\n", *incident.AssignedTo)
		fmt.Printf("  - Created at: %s\n", incident.CreatedAt.Format(time.RFC3339))

		// Simulate incident resolution for P3
		if req.Severity == "P3" {
			fmt.Printf("  - Resolving incident...\n")
			err = enhanced.ResolveIncident(ctx, tenantID, incident.ID,
				"Reassigned shards and cluster health is now green")
			if err != nil {
				return fmt.Errorf("failed to resolve incident: %w", err)
			}
			fmt.Printf("  - Incident resolved\n")
		}
	}

	// List open incidents
	fmt.Println("\nListing open incidents...")
	openIncidents, err := enhanced.ListIncidents(ctx, tenantID, &sdln.IncidentListOptions{
		Status:   "open",
		PageSize: 10,
		SortBy:   "start_time",
		SortDesc: true,
	})
	if err != nil {
		return fmt.Errorf("failed to list incidents: %w", err)
	}

	fmt.Printf("Found %d open incidents\n", len(openIncidents.Items))
	for _, incident := range openIncidents.Items {
		fmt.Printf("  - [%s] %s (Severity: %s, Assigned: %s)\n",
			incident.ID, incident.Title, incident.Severity,
			func() string {
				if incident.AssignedTo != nil {
					return *incident.AssignedTo
				}
				return "Unassigned"
			}())
	}

	return nil
}

// runRunbookAutomationExample demonstrates runbook automation
func runRunbookAutomationExample(ctx context.Context, client *sdln.Client, tenantID string) error {
	fmt.Println("\n=== Runbook Automation Example ===")

	enhanced := sdln.NewMonitoringEnhanced(client)

	// Create automated runbooks
	runbooks := []sdln.Runbook{
		{
			Name:        "Auto-Restart Failing Service",
			Description: "Automatically restarts a service when it fails health checks",
			Trigger: sdln.RunbookTrigger{
				Type: "alert",
				Conditions: map[string]interface{}{
					"alert_name": "Service Unhealthy",
					"severity":   "critical",
				},
			},
			Steps: []sdln.RunbookStep{
				{
					ID:   1,
					Name: "Verify service status",
					Type: "action",
					Action: &sdln.RunbookAction{
						Type:   "api",
						Target: "http://service:8080/health",
						Method: "GET",
					},
					Enabled: true,
				},
				{
					ID:   2,
					Name: "Scale up service",
					Type: "action",
					Action: &sdln.RunbookAction{
						Type:   "api",
						Target: "http://k8s-api/scale",
						Method: "POST",
						Body: map[string]interface{}{
							"deployment": "api-service",
							"replicas":   3,
						},
					},
					Enabled: true,
				},
				{
					ID:      3,
					Name:    "Wait for service to stabilize",
					Type:    "delay",
					Delay:   sdln.DurationPtr(30 * time.Second),
					Enabled: true,
				},
				{
					ID:   4,
					Name: "Verify service health",
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
			Description: "Automatically clears temporary files when disk usage exceeds threshold",
			Trigger: sdln.RunbookTrigger{
				Type: "alert",
				Conditions: map[string]interface{}{
					"metric_name": "disk_usage_percent",
					"threshold":   90,
					"operator":    ">",
				},
			},
			Steps: []sdln.RunbookStep{
				{
					ID:   1,
					Name: "Identify large temporary files",
					Type: "action",
					Action: &sdln.RunbookAction{
						Type:   "script",
						Target: "find-temp-files.sh",
						Parameters: map[string]interface{}{
							"older_than": "7d",
							"min_size":   "1GB",
						},
					},
					Enabled: true,
				},
				{
					ID:   2,
					Name: "Archive and remove old files",
					Type: "action",
					Action: &sdln.RunbookAction{
						Type:   "script",
						Target: "cleanup-temp-files.sh",
						Parameters: map[string]interface{}{
							"archive": true,
							"backup":  "s3://backups/temp/",
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
						Template: "disk-cleanup-notification",
						Data: map[string]interface{}{
							"space_freed": "{{files_size}}",
							"files_count": "{{file_count}}",
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
		fmt.Printf("Creating runbook: %s\n", runbook.Name)
		created, err := enhanced.CreateRunbook(ctx, tenantID, &runbook)
		if err != nil {
			return fmt.Errorf("failed to create runbook: %w", err)
		}
		fmt.Printf("  - Runbook ID: %s\n", created.ID)
		fmt.Printf("  - Steps: %d\n", len(created.Steps))
		fmt.Printf("  - Trigger type: %s\n", created.Trigger.Type)

		// Execute runbook (manual trigger for demo)
		if runbook.Name == "Clear Disk Space" {
			fmt.Printf("  - Executing runbook...\n")
			execution, err := enhanced.ExecuteRunbook(ctx, tenantID, created.ID,
				sdln.RunbookTrigger{
					Type: "manual",
					Conditions: map[string]interface{}{
						"triggered_by": "demo",
					},
				}, "demo-user")
			if err != nil {
				return fmt.Errorf("failed to execute runbook: %w", err)
			}
			fmt.Printf("  - Execution ID: %s\n", execution.ID)
			fmt.Printf("  - Status: %s\n", execution.Status)
		}
	}

	// List runbook executions
	fmt.Println("\nListing recent runbook executions...")
	executions, err := enhanced.ListRunbookExecutions(ctx, tenantID, &sdln.ExecutionListOptions{
		PageSize: 10,
		SortDesc: true,
	})
	if err != nil {
		return fmt.Errorf("failed to list runbook executions: %w", err)
	}

	fmt.Printf("Found %d recent executions\n", len(executions.Items))
	for _, exec := range executions.Items {
		fmt.Printf("  - %s: %s (Runbook: %s, Duration: %v)\n",
			exec.ID, exec.Status, exec.RunbookID, exec.Duration)
	}

	return nil
}

// runCapacityPlanningExample demonstrates capacity planning
func runCapacityPlanningExample(ctx context.Context, client *sdln.Client, tenantID string) error {
	fmt.Println("\n=== Capacity Planning Example ===")

	enhanced := sdln.NewMonitoringEnhanced(client)

	// Define time range for analysis
	timeRange := sdln.TimestampRange{
		From: sdln.NewTimestamp(time.Now().Add(-30 * 24 * time.Hour)), // Last 30 days
		To:   sdln.NewTimestamp(time.Now()),
	}

	// Capacity planning options
	options := &sdln.CapacityPlanningOptions{
		PredictionHorizon: sdln.DurationPtr(90 * 24 * time.Hour), // Predict 90 days ahead
		GrowthRate:        sdln.Float64Ptr(0.15),                 // 15% expected growth
		Seasonality:       sdln.BoolPtr(true),                    // Consider seasonal patterns
		IncludeCosts:      sdln.BoolPtr(true),                    // Include cost analysis
		ConfidenceLevel:   sdln.Float64Ptr(0.95),                 // 95% confidence level
		Resources:         []string{"cpu", "memory", "storage", "network"},
	}

	fmt.Println("Generating capacity plan...")
	plan, err := enhanced.GenerateCapacityPlan(ctx, tenantID, timeRange, options)
	if err != nil {
		return fmt.Errorf("failed to generate capacity plan: %w", err)
	}

	fmt.Printf("Capacity Plan: %s\n", plan.Name)
	fmt.Printf("Generated at: %s\n", plan.GeneratedAt.Format(time.RFC3339))
	fmt.Printf("Valid until: %s\n", plan.ValidUntil.Format(time.RFC3339))
	fmt.Printf("Overall status: %s\n", plan.Summary.OverallStatus)

	// Display current capacity
	fmt.Println("\nCurrent Capacity:")
	for _, capacity := range plan.CurrentCapacity {
		fmt.Printf("  - %s (%s): %.2f / %.2f %.2f (%.1f%% utilized)\n",
			capacity.Resource, capacity.Type, capacity.Current, capacity.Maximum,
			capacity.Unit, capacity.Utilization)
	}

	// Display predictions
	fmt.Println("\nPredicted Demand (7-day forecast):")
	predictions := make(map[string][]sdln.ResourceDemand)
	for _, demand := range plan.PredictedDemand {
		if _, ok := predictions[demand.Resource]; !ok {
			predictions[demand.Resource] = []sdln.ResourceDemand{}
		}
		if len(predictions[demand.Resource]) < 7 {
			predictions[demand.Resource] = append(predictions[demand.Resource], demand)
		}
	}

	for resource, demands := range predictions {
		fmt.Printf("  - %s:\n", resource)
		for _, demand := range demands {
			fmt.Printf("    Day %d: %.2f (confidence: %.2f%%)\n",
				demand.Timestamp.Day(), demand.Predicted, demand.Confidence*100)
		}
	}

	// Display recommendations
	fmt.Println("\nCapacity Recommendations:")
	for _, rec := range plan.Recommendations {
		fmt.Printf("  - [%s] %s\n", rec.Priority, rec.Description)
		fmt.Printf("    Action: %s, Impact: %s, Cost: $%.2f\n",
			rec.Action, rec.PerformanceImpact, rec.CostImpact)
		fmt.Printf("    Justification: %s\n", rec.Justification)
	}

	// Display summary
	fmt.Println("\nCapacity Summary:")
	fmt.Printf("  Critical resources: %v\n", plan.Summary.CriticalResources)
	fmt.Printf("  Scaling needs: %v\n", plan.Summary.ScalingNeeds)
	fmt.Printf("  Cost optimization opportunities: %v\n", plan.Summary.CostOptimization)
	fmt.Printf("  Risk factors: %v\n", plan.Summary.RiskFactors)
	fmt.Printf("  Next review: %s\n", plan.Summary.NextReview.Format(time.RFC3339))

	return nil
}

// runBusinessMetricsExample demonstrates business metrics collection
func runBusinessMetricsExample(ctx context.Context, client *sdln.Client, tenantID string) error {
	fmt.Println("\n=== Business Metrics Example ===")

	enhanced := sdln.NewMonitoringEnhanced(client)

	// Define time range for metrics
	timeRange := sdln.TimestampRange{
		From: sdln.NewTimestamp(time.Now().Add(-7 * 24 * time.Hour)), // Last 7 days
		To:   sdln.NewTimestamp(time.Now()),
	}

	// Get business metrics
	fmt.Println("Fetching business metrics...")
	metrics, err := enhanced.GetBusinessMetrics(ctx, tenantID, timeRange, []string{
		"user_metrics",
		"revenue_metrics",
		"usage_metrics",
		"quality_metrics",
		"sla_metrics",
	})
	if err != nil {
		return fmt.Errorf("failed to get business metrics: %w", err)
	}

	// User metrics
	fmt.Println("\nUser Metrics:")
	fmt.Printf("  Total users: %d\n", metrics.UserMetrics.TotalUsers)
	fmt.Printf("  Active users: %d\n", metrics.UserMetrics.ActiveUsers)
	fmt.Printf("  New users: %d\n", metrics.UserMetrics.NewUsers)
	fmt.Printf("  Churned users: %d\n", metrics.UserMetrics.ChurnedUsers)
	fmt.Printf("  Retention rate: %.2f%%\n", metrics.UserMetrics.RetentionRate*100)
	fmt.Printf("  Engagement score: %.2f\n", metrics.UserMetrics.EngagementScore)
	fmt.Printf("  Avg session duration: %v\n", metrics.UserMetrics.SessionDuration)
	fmt.Printf("  Conversion rate: %.2f%%\n", metrics.UserMetrics.ConversionRate*100)

	// Revenue metrics
	fmt.Println("\nRevenue Metrics:")
	fmt.Printf("  Total revenue: $%.2f\n", metrics.RevenueMetrics.TotalRevenue)
	fmt.Printf("  MRR: $%.2f\n", metrics.RevenueMetrics.MRR)
	fmt.Printf("  ARR: $%.2f\n", metrics.RevenueMetrics.ARR)
	fmt.Printf("  ARPU: $%.2f\n", metrics.RevenueMetrics.ARPU)
	fmt.Printf("  Growth rate: %.2f%%\n", metrics.RevenueMetrics.GrowthRate*100)
	fmt.Printf("  Churn rate: %.2f%%\n", metrics.RevenueMetrics.ChurnRate*100)

	// Usage metrics
	fmt.Println("\nUsage Metrics:")
	fmt.Printf("  API requests: %d\n", metrics.UsageMetrics.APIRequests)
	fmt.Printf("  Document uploads: %d\n", metrics.UsageMetrics.DocumentUploads)
	fmt.Printf("  LLM calls: %d\n", metrics.UsageMetrics.LLMCalls)
	fmt.Printf("  Token usage: %d\n", metrics.UsageMetrics.TokenUsage)
	fmt.Printf("  Storage used: %d MB\n", metrics.UsageMetrics.StorageUsed/(1024*1024))
	fmt.Printf("  Success rate: %.2f%%\n", metrics.UsageMetrics.SuccessRate*100)
	fmt.Printf("  Error rate: %.2f%%\n", metrics.UsageMetrics.ErrorRate*100)

	// Quality metrics
	fmt.Println("\nQuality Metrics:")
	fmt.Printf("  Uptime: %.2f%%\n", metrics.QualityMetrics.Uptime*100)
	fmt.Printf("  Availability: %.2f%%\n", metrics.QualityMetrics.Availability*100)
	fmt.Printf("  P50 latency: %v\n", metrics.QualityMetrics.Latency.P50)
	fmt.Printf("  P95 latency: %v\n", metrics.QualityMetrics.Latency.P95)
	fmt.Printf("  P99 latency: %v\n", metrics.QualityMetrics.Latency.P99)
	fmt.Printf("  Satisfaction score: %.2f\n", metrics.QualityMetrics.SatisfactionScore)
	fmt.Printf("  MTTR: %v\n", metrics.QualityMetrics.MeanTimeToRecover)

	// SLA metrics
	fmt.Println("\nSLA Metrics:")
	fmt.Printf("  Overall compliance: %.2f%%\n", metrics.SLAMetrics.OverallCompliance*100)
	fmt.Printf("  Penalties: $%.2f\n", metrics.SLAMetrics.Penalties)
	fmt.Printf("  Credits issued: $%.2f\n", metrics.SLAMetrics.CreditsIssued)

	fmt.Println("\nSLA Details:")
	for _, sla := range metrics.SLAMetrics.SLAs {
		fmt.Printf("  - %s: %.2f%% (target: %.2f%%)\n",
			sla.Name, sla.Compliance*100, sla.Target*100)
	}

	// Display summary
	fmt.Println("\nBusiness Metrics Summary:")
	fmt.Printf("  Overall score: %.2f\n", metrics.Summary.OverallScore)
	fmt.Printf("  Health status: %s\n", metrics.Summary.Health)

	fmt.Println("\nKey Insights:")
	for _, insight := range metrics.Summary.KeyInsights {
		fmt.Printf("  • %s\n", insight)
	}

	fmt.Println("\nRisk Factors:")
	for _, risk := range metrics.Summary.RiskFactors {
		fmt.Printf("  • %s\n", risk)
	}

	fmt.Println("\nOpportunities:")
	for _, opportunity := range metrics.Summary.Opportunities {
		fmt.Printf("  • %s\n", opportunity)
	}

	fmt.Println("\nRecommendations:")
	for _, rec := range metrics.Summary.Recommendations {
		fmt.Printf("  • %s\n", rec)
	}

	return nil
}
