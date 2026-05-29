package sdln

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestMonitoringService_CreateMetric(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	tests := []struct {
		name          string
		setupMock     func()
		metric        *Metric
		expectedError bool
		errorMsg      string
	}{
		{
			name: "successful metric creation",
			setupMock: func() {
				response := map[string]interface{}{
					"id":        "metric-123",
					"name":      "cpu_usage",
					"value":     75.5,
					"unit":      "percent",
					"timestamp": time.Now().Format(time.RFC3339),
					"labels": map[string]string{
						"host": "server-1",
					},
				}
				server.SetResponse("POST", "/api/v1/monitoring/metrics", response)
			},
			metric: &Metric{
				Name:   "cpu_usage",
				Value:  75.5,
				Unit:   "percent",
				Labels: map[string]string{"host": "server-1"},
			},
			expectedError: false,
		},
		{
			name:          "nil metric",
			metric:        nil,
			expectedError: true,
			errorMsg:      "metric cannot be nil",
		},
		{
			name: "empty metric name",
			metric: &Metric{
				Name:  "",
				Value: 75.5,
				Unit:  "percent",
			},
			expectedError: true,
			errorMsg:      "metric name cannot be empty",
		},
		{
			name: "invalid metric value",
			metric: &Metric{
				Name:  "test_metric",
				Value: 0,
				Unit:  "count",
			},
			expectedError: true,
			errorMsg:      "metric value cannot be zero",
		},
		{
			name: "duplicate metric",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "metric already exists",
						"code":    409,
					},
				}
				server.SetResponse("POST", "/api/v1/monitoring/metrics", errorResp)
			},
			metric: &Metric{
				Name:  "existing_metric",
				Value: 50.0,
				Unit:  "count",
			},
			expectedError: true,
			errorMsg:      "metric already exists",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupMock != nil {
				tt.setupMock()
			}

			result, err := client.Monitoring.CreateMetric(TestContext(), tt.metric)

			if tt.expectedError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(strings.ToLower(err.Error()), strings.ToLower(tt.errorMsg)) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}
				if result == nil {
					t.Fatal("Expected non-nil result")
				}
				if result.ID == "" {
					t.Fatal("Expected metric ID to be set")
				}
				if result.Name != tt.metric.Name {
					t.Fatalf("Expected metric name %q, got %q", tt.metric.Name, result.Name)
				}
			}
		})
	}
}

func TestMonitoringService_GetMetric(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	tests := []struct {
		name          string
		setupMock     func()
		metricID      string
		expectedError bool
		errorMsg      string
	}{
		{
			name: "successful get metric",
			setupMock: func() {
				response := map[string]interface{}{
					"id":        "metric-123",
					"name":      "cpu_usage",
					"value":     75.5,
					"unit":      "percent",
					"timestamp": time.Now().Format(time.RFC3339),
					"labels": map[string]string{
						"host": "server-1",
					},
				}
				server.SetResponse("GET", "/api/v1/monitoring/metrics/metric-123", response)
			},
			metricID:      "metric-123",
			expectedError: false,
		},
		{
			name:          "empty metric ID",
			metricID:      "",
			expectedError: true,
			errorMsg:      "metric ID cannot be empty",
		},
		{
			name: "metric not found",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "metric not found",
						"code":    404,
					},
				}
				server.SetResponse("GET", "/api/v1/monitoring/metrics/nonexistent", errorResp)
			},
			metricID:      "nonexistent",
			expectedError: true,
			errorMsg:      "metric not found",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupMock != nil {
				tt.setupMock()
			}

			result, err := client.Monitoring.GetMetric(TestContext(), tt.metricID)

			if tt.expectedError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(strings.ToLower(err.Error()), strings.ToLower(tt.errorMsg)) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}
				if result == nil {
					t.Fatal("Expected non-nil result")
				}
				if result.ID != tt.metricID {
					t.Fatalf("Expected metric ID %q, got %q", tt.metricID, result.ID)
				}
			}
		})
	}
}

func TestMonitoringService_UpdateMetric(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	tests := []struct {
		name          string
		setupMock     func()
		metricID      string
		metric        *Metric
		expectedError bool
		errorMsg      string
	}{
		{
			name: "successful metric update",
			setupMock: func() {
				response := map[string]interface{}{
					"id":        "metric-123",
					"name":      "cpu_usage",
					"value":     80.0,
					"unit":      "percent",
					"timestamp": time.Now().Format(time.RFC3339),
					"labels": map[string]string{
						"host": "server-1",
					},
				}
				server.SetResponse("PUT", "/api/v1/monitoring/metrics/metric-123", response)
			},
			metricID: "metric-123",
			metric: &Metric{
				Name:   "cpu_usage",
				Value:  80.0,
				Unit:   "percent",
				Labels: map[string]string{"host": "server-1"},
			},
			expectedError: false,
		},
		{
			name:          "empty metric ID",
			metricID:      "",
			metric:        GenerateTestMetric(),
			expectedError: true,
			errorMsg:      "metric ID cannot be empty",
		},
		{
			name:          "nil metric",
			metricID:      "metric-123",
			metric:        nil,
			expectedError: true,
			errorMsg:      "metric cannot be nil",
		},
		{
			name: "metric not found",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "metric not found",
						"code":    404,
					},
				}
				server.SetResponse("PUT", "/api/v1/monitoring/metrics/nonexistent", errorResp)
			},
			metricID:      "nonexistent",
			metric:        GenerateTestMetric(),
			expectedError: true,
			errorMsg:      "metric not found",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupMock != nil {
				tt.setupMock()
			}

			result, err := client.Monitoring.UpdateMetric(TestContext(), tt.metricID, tt.metric)

			if tt.expectedError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(strings.ToLower(err.Error()), strings.ToLower(tt.errorMsg)) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}
				if result == nil {
					t.Fatal("Expected non-nil result")
				}
				if result.ID != tt.metricID {
					t.Fatalf("Expected metric ID %q, got %q", tt.metricID, result.ID)
				}
			}
		})
	}
}

func TestMonitoringService_DeleteMetric(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	tests := []struct {
		name          string
		setupMock     func()
		metricID      string
		expectedError bool
		errorMsg      string
	}{
		{
			name: "successful metric deletion",
			setupMock: func() {
				response := map[string]interface{}{
					"success": true,
					"message": "metric deleted",
				}
				server.SetResponse("DELETE", "/api/v1/monitoring/metrics/metric-123", response)
			},
			metricID:      "metric-123",
			expectedError: false,
		},
		{
			name:          "empty metric ID",
			metricID:      "",
			expectedError: true,
			errorMsg:      "metric ID cannot be empty",
		},
		{
			name: "metric not found",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "metric not found",
						"code":    404,
					},
				}
				server.SetResponse("DELETE", "/api/v1/monitoring/metrics/nonexistent", errorResp)
			},
			metricID:      "nonexistent",
			expectedError: true,
			errorMsg:      "metric not found",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupMock != nil {
				tt.setupMock()
			}

			err := client.Monitoring.DeleteMetric(TestContext(), tt.metricID)

			if tt.expectedError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(strings.ToLower(err.Error()), strings.ToLower(tt.errorMsg)) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}
			}
		})
	}
}

func TestMonitoringService_ListMetrics(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	tests := []struct {
		name          string
		setupMock     func()
		params        *MetricListParams
		expectedError bool
		errorMsg      string
	}{
		{
			name: "successful list metrics",
			setupMock: func() {
				response := MetricListResponse{
					Metrics: []*Metric{
						{
							ID:    "metric-1",
							Name:  "cpu_usage",
							Value: 75.5,
							Unit:  "percent",
						},
						{
							ID:    "metric-2",
							Name:  "memory_usage",
							Value: 60.2,
							Unit:  "percent",
						},
					},
					Total: 2,
				}
				server.SetResponse("GET", "/api/v1/monitoring/metrics", response)
			},
			params: &MetricListParams{
				Limit:  10,
				Offset: 0,
			},
			expectedError: false,
		},
		{
			name: "empty results",
			setupMock: func() {
				response := MetricListResponse{
					Metrics: []*Metric{},
					Total:   0,
				}
				server.SetResponse("GET", "/api/v1/monitoring/metrics", response)
			},
			params: &MetricListParams{
				Limit: 10,
			},
			expectedError: false,
		},
		{
			name: "invalid pagination",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "invalid pagination parameters",
						"code":    400,
					},
				}
				server.SetResponse("GET", "/api/v1/monitoring/metrics", errorResp)
			},
			params: &MetricListParams{
				Limit:  -1,
				Offset: -1,
			},
			expectedError: true,
			errorMsg:      "invalid pagination parameters",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupMock != nil {
				tt.setupMock()
			}

			result, err := client.Monitoring.ListMetrics(TestContext(), tt.params)

			if tt.expectedError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(strings.ToLower(err.Error()), strings.ToLower(tt.errorMsg)) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}
				if result == nil {
					t.Fatal("Expected non-nil result")
				}
				if result.Total < 0 {
					t.Fatal("Expected non-negative total count")
				}
			}
		})
	}
}

func TestMonitoringService_CreateAlert(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	tests := []struct {
		name          string
		setupMock     func()
		alert         *Alert
		expectedError bool
		errorMsg      string
	}{
		{
			name: "successful alert creation",
			setupMock: func() {
				response := map[string]interface{}{
					"id":           "alert-123",
					"name":         "High CPU Usage",
					"description":  "CPU usage is above 80%",
					"status":       "active",
					"severity":     "warning",
					"triggered_at": time.Now().Format(time.RFC3339),
				}
				server.SetResponse("POST", "/api/v1/monitoring/alerts", response)
			},
			alert: &Alert{
				Name:        "High CPU Usage",
				Description: "CPU usage is above 80%",
				Status:      "active",
				Severity:    "warning",
			},
			expectedError: false,
		},
		{
			name:          "nil alert",
			alert:         nil,
			expectedError: true,
			errorMsg:      "alert cannot be nil",
		},
		{
			name: "empty alert name",
			alert: &Alert{
				Name:        "",
				Description: "Test alert",
				Status:      "active",
				Severity:    "warning",
			},
			expectedError: true,
			errorMsg:      "alert name cannot be empty",
		},
		{
			name: "invalid alert status",
			alert: &Alert{
				Name:        "Test Alert",
				Description: "Test alert description",
				Status:      "invalid_status",
				Severity:    "warning",
			},
			expectedError: true,
			errorMsg:      "invalid alert status",
		},
		{
			name: "invalid alert severity",
			alert: &Alert{
				Name:        "Test Alert",
				Description: "Test alert description",
				Status:      "active",
				Severity:    "invalid_severity",
			},
			expectedError: true,
			errorMsg:      "invalid alert severity",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupMock != nil {
				tt.setupMock()
			}

			result, err := client.Monitoring.CreateAlert(TestContext(), tt.alert)

			if tt.expectedError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(strings.ToLower(err.Error()), strings.ToLower(tt.errorMsg)) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}
				if result == nil {
					t.Fatal("Expected non-nil result")
				}
				if result.ID == "" {
					t.Fatal("Expected alert ID to be set")
				}
				if result.Name != tt.alert.Name {
					t.Fatalf("Expected alert name %q, got %q", tt.alert.Name, result.Name)
				}
			}
		})
	}
}

func TestMonitoringService_GetAlert(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	tests := []struct {
		name          string
		setupMock     func()
		alertID       string
		expectedError bool
		errorMsg      string
	}{
		{
			name: "successful get alert",
			setupMock: func() {
				response := map[string]interface{}{
					"id":           "alert-123",
					"name":         "High CPU Usage",
					"description":  "CPU usage is above 80%",
					"status":       "active",
					"severity":     "warning",
					"triggered_at": time.Now().Format(time.RFC3339),
				}
				server.SetResponse("GET", "/api/v1/monitoring/alerts/alert-123", response)
			},
			alertID:       "alert-123",
			expectedError: false,
		},
		{
			name:          "empty alert ID",
			alertID:       "",
			expectedError: true,
			errorMsg:      "alert ID cannot be empty",
		},
		{
			name: "alert not found",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "alert not found",
						"code":    404,
					},
				}
				server.SetResponse("GET", "/api/v1/monitoring/alerts/nonexistent", errorResp)
			},
			alertID:       "nonexistent",
			expectedError: true,
			errorMsg:      "alert not found",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupMock != nil {
				tt.setupMock()
			}

			result, err := client.Monitoring.GetAlert(TestContext(), tt.alertID)

			if tt.expectedError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(strings.ToLower(err.Error()), strings.ToLower(tt.errorMsg)) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}
				if result == nil {
					t.Fatal("Expected non-nil result")
				}
				if result.ID != tt.alertID {
					t.Fatalf("Expected alert ID %q, got %q", tt.alertID, result.ID)
				}
			}
		})
	}
}

func TestMonitoringService_UpdateAlert(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	tests := []struct {
		name          string
		setupMock     func()
		alertID       string
		alert         *Alert
		expectedError bool
		errorMsg      string
	}{
		{
			name: "successful alert update",
			setupMock: func() {
				response := map[string]interface{}{
					"id":          "alert-123",
					"name":        "Updated Alert",
					"description": "Updated description",
					"status":      "resolved",
					"severity":    "info",
				}
				server.SetResponse("PUT", "/api/v1/monitoring/alerts/alert-123", response)
			},
			alertID: "alert-123",
			alert: &Alert{
				Name:        "Updated Alert",
				Description: "Updated description",
				Status:      "resolved",
				Severity:    "info",
			},
			expectedError: false,
		},
		{
			name:          "empty alert ID",
			alertID:       "",
			alert:         GenerateTestAlert(),
			expectedError: true,
			errorMsg:      "alert ID cannot be empty",
		},
		{
			name:          "nil alert",
			alertID:       "alert-123",
			alert:         nil,
			expectedError: true,
			errorMsg:      "alert cannot be nil",
		},
		{
			name: "alert not found",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "alert not found",
						"code":    404,
					},
				}
				server.SetResponse("PUT", "/api/v1/monitoring/alerts/nonexistent", errorResp)
			},
			alertID:       "nonexistent",
			alert:         GenerateTestAlert(),
			expectedError: true,
			errorMsg:      "alert not found",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupMock != nil {
				tt.setupMock()
			}

			result, err := client.Monitoring.UpdateAlert(TestContext(), tt.alertID, tt.alert)

			if tt.expectedError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(strings.ToLower(err.Error()), strings.ToLower(tt.errorMsg)) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}
				if result == nil {
					t.Fatal("Expected non-nil result")
				}
				if result.ID != tt.alertID {
					t.Fatalf("Expected alert ID %q, got %q", tt.alertID, result.ID)
				}
			}
		})
	}
}

func TestMonitoringService_DeleteAlert(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	tests := []struct {
		name          string
		setupMock     func()
		alertID       string
		expectedError bool
		errorMsg      string
	}{
		{
			name: "successful alert deletion",
			setupMock: func() {
				response := map[string]interface{}{
					"success": true,
					"message": "alert deleted",
				}
				server.SetResponse("DELETE", "/api/v1/monitoring/alerts/alert-123", response)
			},
			alertID:       "alert-123",
			expectedError: false,
		},
		{
			name:          "empty alert ID",
			alertID:       "",
			expectedError: true,
			errorMsg:      "alert ID cannot be empty",
		},
		{
			name: "alert not found",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "alert not found",
						"code":    404,
					},
				}
				server.SetResponse("DELETE", "/api/v1/monitoring/alerts/nonexistent", errorResp)
			},
			alertID:       "nonexistent",
			expectedError: true,
			errorMsg:      "alert not found",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupMock != nil {
				tt.setupMock()
			}

			err := client.Monitoring.DeleteAlert(TestContext(), tt.alertID)

			if tt.expectedError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(strings.ToLower(err.Error()), strings.ToLower(tt.errorMsg)) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}
			}
		})
	}
}

func TestMonitoringService_ListAlerts(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	tests := []struct {
		name          string
		setupMock     func()
		params        *AlertListParams
		expectedError bool
		errorMsg      string
	}{
		{
			name: "successful list alerts",
			setupMock: func() {
				response := AlertListResponse{
					Alerts: []*Alert{
						{
							ID:       "alert-1",
							Name:     "High CPU",
							Status:   "active",
							Severity: "warning",
						},
						{
							ID:       "alert-2",
							Name:     "Low Memory",
							Status:   "resolved",
							Severity: "info",
						},
					},
					Total: 2,
				}
				server.SetResponse("GET", "/api/v1/monitoring/alerts", response)
			},
			params: &AlertListParams{
				Status: "active",
				Limit:  10,
				Offset: 0,
			},
			expectedError: false,
		},
		{
			name: "empty results",
			setupMock: func() {
				response := AlertListResponse{
					Alerts: []*Alert{},
					Total:  0,
				}
				server.SetResponse("GET", "/api/v1/monitoring/alerts", response)
			},
			params: &AlertListParams{
				Limit: 10,
			},
			expectedError: false,
		},
		{
			name: "invalid status filter",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "invalid alert status filter",
						"code":    400,
					},
				}
				server.SetResponse("GET", "/api/v1/monitoring/alerts", errorResp)
			},
			params: &AlertListParams{
				Status: "invalid_status",
				Limit:  10,
			},
			expectedError: true,
			errorMsg:      "invalid alert status filter",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupMock != nil {
				tt.setupMock()
			}

			result, err := client.Monitoring.ListAlerts(TestContext(), tt.params)

			if tt.expectedError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(strings.ToLower(err.Error()), strings.ToLower(tt.errorMsg)) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}
				if result == nil {
					t.Fatal("Expected non-nil result")
				}
				if result.Total < 0 {
					t.Fatal("Expected non-negative total count")
				}
			}
		})
	}
}

func TestMonitoringService_CreateDashboard(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	tests := []struct {
		name          string
		setupMock     func()
		dashboard     *Dashboard
		expectedError bool
		errorMsg      string
	}{
		{
			name: "successful dashboard creation",
			setupMock: func() {
				response := map[string]interface{}{
					"id":          "dashboard-123",
					"name":        "System Overview",
					"description": "System monitoring dashboard",
					"widgets": []map[string]interface{}{
						{
							"type":   "metric",
							"title":  "CPU Usage",
							"metric": "cpu_usage",
						},
					},
					"created_at": time.Now().Format(time.RFC3339),
				}
				server.SetResponse("POST", "/api/v1/monitoring/dashboards", response)
			},
			dashboard: &Dashboard{
				Name:        "System Overview",
				Description: "System monitoring dashboard",
				Widgets: []DashboardWidget{
					{
						Type:   "metric",
						Title:  "CPU Usage",
						Metric: "cpu_usage",
					},
				},
			},
			expectedError: false,
		},
		{
			name:          "nil dashboard",
			dashboard:     nil,
			expectedError: true,
			errorMsg:      "dashboard cannot be nil",
		},
		{
			name: "empty dashboard name",
			dashboard: &Dashboard{
				Name:        "",
				Description: "Test dashboard",
				Widgets:     []DashboardWidget{},
			},
			expectedError: true,
			errorMsg:      "dashboard name cannot be empty",
		},
		{
			name: "duplicate dashboard",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "dashboard already exists",
						"code":    409,
					},
				}
				server.SetResponse("POST", "/api/v1/monitoring/dashboards", errorResp)
			},
			dashboard: &Dashboard{
				Name:        "Existing Dashboard",
				Description: "This dashboard already exists",
				Widgets:     []DashboardWidget{},
			},
			expectedError: true,
			errorMsg:      "dashboard already exists",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupMock != nil {
				tt.setupMock()
			}

			result, err := client.Monitoring.CreateDashboard(TestContext(), tt.dashboard)

			if tt.expectedError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(strings.ToLower(err.Error()), strings.ToLower(tt.errorMsg)) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}
				if result == nil {
					t.Fatal("Expected non-nil result")
				}
				if result.ID == "" {
					t.Fatal("Expected dashboard ID to be set")
				}
				if result.Name != tt.dashboard.Name {
					t.Fatalf("Expected dashboard name %q, got %q", tt.dashboard.Name, result.Name)
				}
			}
		})
	}
}

func TestMonitoringService_GetDashboard(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	tests := []struct {
		name          string
		setupMock     func()
		dashboardID   string
		expectedError bool
		errorMsg      string
	}{
		{
			name: "successful get dashboard",
			setupMock: func() {
				response := map[string]interface{}{
					"id":          "dashboard-123",
					"name":        "System Overview",
					"description": "System monitoring dashboard",
					"widgets": []map[string]interface{}{
						{
							"type":   "metric",
							"title":  "CPU Usage",
							"metric": "cpu_usage",
						},
					},
					"created_at": time.Now().Format(time.RFC3339),
				}
				server.SetResponse("GET", "/api/v1/monitoring/dashboards/dashboard-123", response)
			},
			dashboardID:   "dashboard-123",
			expectedError: false,
		},
		{
			name:          "empty dashboard ID",
			dashboardID:   "",
			expectedError: true,
			errorMsg:      "dashboard ID cannot be empty",
		},
		{
			name: "dashboard not found",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "dashboard not found",
						"code":    404,
					},
				}
				server.SetResponse("GET", "/api/v1/monitoring/dashboards/nonexistent", errorResp)
			},
			dashboardID:   "nonexistent",
			expectedError: true,
			errorMsg:      "dashboard not found",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupMock != nil {
				tt.setupMock()
			}

			result, err := client.Monitoring.GetDashboard(TestContext(), tt.dashboardID)

			if tt.expectedError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(strings.ToLower(err.Error()), strings.ToLower(tt.errorMsg)) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}
				if result == nil {
					t.Fatal("Expected non-nil result")
				}
				if result.ID != tt.dashboardID {
					t.Fatalf("Expected dashboard ID %q, got %q", tt.dashboardID, result.ID)
				}
			}
		})
	}
}

func TestMonitoringService_ListDashboards(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	tests := []struct {
		name          string
		setupMock     func()
		expectedError bool
		errorMsg      string
	}{
		{
			name: "successful list dashboards",
			setupMock: func() {
				response := []Dashboard{
					{
						ID:          "dashboard-1",
						Name:        "System Overview",
						Description: "System monitoring dashboard",
					},
					{
						ID:          "dashboard-2",
						Name:        "Application Metrics",
						Description: "Application performance dashboard",
					},
				}
				server.SetResponse("GET", "/api/v1/monitoring/dashboards", response)
			},
			expectedError: false,
		},
		{
			name: "empty list",
			setupMock: func() {
				response := []Dashboard{}
				server.SetResponse("GET", "/api/v1/monitoring/dashboards", response)
			},
			expectedError: false,
		},
		{
			name: "server error",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "failed to list dashboards",
						"code":    500,
					},
				}
				server.SetResponse("GET", "/api/v1/monitoring/dashboards", errorResp)
			},
			expectedError: true,
			errorMsg:      "failed to list dashboards",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupMock != nil {
				tt.setupMock()
			}

			result, err := client.Monitoring.ListDashboards(TestContext())

			if tt.expectedError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(strings.ToLower(err.Error()), strings.ToLower(tt.errorMsg)) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}
				if result == nil {
					t.Fatal("Expected non-nil result")
				}
			}
		})
	}
}

func TestMonitoringService_CreateHealthCheck(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	tests := []struct {
		name          string
		setupMock     func()
		healthCheck   *HealthCheck
		expectedError bool
		errorMsg      string
	}{
		{
			name: "successful health check creation",
			setupMock: func() {
				response := map[string]interface{}{
					"id":         "health-123",
					"name":       "Database Check",
					"endpoint":   "tcp://localhost:5432",
					"interval":   30,
					"timeout":    5,
					"status":     "healthy",
					"created_at": time.Now().Format(time.RFC3339),
				}
				server.SetResponse("POST", "/api/v1/monitoring/health-checks", response)
			},
			healthCheck: &HealthCheck{
				Name:     "Database Check",
				Endpoint: "tcp://localhost:5432",
				Interval: 30,
				Timeout:  5,
			},
			expectedError: false,
		},
		{
			name:          "nil health check",
			healthCheck:   nil,
			expectedError: true,
			errorMsg:      "health check cannot be nil",
		},
		{
			name: "empty health check name",
			healthCheck: &HealthCheck{
				Name:     "",
				Endpoint: "tcp://localhost:5432",
				Interval: 30,
				Timeout:  5,
			},
			expectedError: true,
			errorMsg:      "health check name cannot be empty",
		},
		{
			name: "empty endpoint",
			healthCheck: &HealthCheck{
				Name:     "Test Check",
				Endpoint: "",
				Interval: 30,
				Timeout:  5,
			},
			expectedError: true,
			errorMsg:      "endpoint cannot be empty",
		},
		{
			name: "invalid interval",
			healthCheck: &HealthCheck{
				Name:     "Test Check",
				Endpoint: "tcp://localhost:5432",
				Interval: 0,
				Timeout:  5,
			},
			expectedError: true,
			errorMsg:      "interval must be positive",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupMock != nil {
				tt.setupMock()
			}

			result, err := client.Monitoring.CreateHealthCheck(TestContext(), tt.healthCheck)

			if tt.expectedError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(strings.ToLower(err.Error()), strings.ToLower(tt.errorMsg)) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}
				if result == nil {
					t.Fatal("Expected non-nil result")
				}
				if result.ID == "" {
					t.Fatal("Expected health check ID to be set")
				}
				if result.Name != tt.healthCheck.Name {
					t.Fatalf("Expected health check name %q, got %q", tt.healthCheck.Name, result.Name)
				}
			}
		})
	}
}

func TestMonitoringService_GetHealthCheck(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	tests := []struct {
		name          string
		setupMock     func()
		healthCheckID string
		expectedError bool
		errorMsg      string
	}{
		{
			name: "successful get health check",
			setupMock: func() {
				response := map[string]interface{}{
					"id":         "health-123",
					"name":       "Database Check",
					"endpoint":   "tcp://localhost:5432",
					"interval":   30,
					"timeout":    5,
					"status":     "healthy",
					"created_at": time.Now().Format(time.RFC3339),
				}
				server.SetResponse("GET", "/api/v1/monitoring/health-checks/health-123", response)
			},
			healthCheckID: "health-123",
			expectedError: false,
		},
		{
			name:          "empty health check ID",
			healthCheckID: "",
			expectedError: true,
			errorMsg:      "health check ID cannot be empty",
		},
		{
			name: "health check not found",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "health check not found",
						"code":    404,
					},
				}
				server.SetResponse("GET", "/api/v1/monitoring/health-checks/nonexistent", errorResp)
			},
			healthCheckID: "nonexistent",
			expectedError: true,
			errorMsg:      "health check not found",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupMock != nil {
				tt.setupMock()
			}

			result, err := client.Monitoring.GetHealthCheck(TestContext(), tt.healthCheckID)

			if tt.expectedError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(strings.ToLower(err.Error()), strings.ToLower(tt.errorMsg)) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}
				if result == nil {
					t.Fatal("Expected non-nil result")
				}
				if result.ID != tt.healthCheckID {
					t.Fatalf("Expected health check ID %q, got %q", tt.healthCheckID, result.ID)
				}
			}
		})
	}
}

func TestMonitoringService_QueryLogs(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	tests := []struct {
		name          string
		setupMock     func()
		query         *LogQuery
		expectedError bool
		errorMsg      string
	}{
		{
			name: "successful log query",
			setupMock: func() {
				response := LogQueryResponse{
					Logs: []LogEntry{
						{
							ID:        "log-1",
							Level:     "info",
							Message:   "Application started",
							Timestamp: time.Now(),
							Source:    "application",
						},
						{
							ID:        "log-2",
							Level:     "error",
							Message:   "Database connection failed",
							Timestamp: time.Now(),
							Source:    "database",
						},
					},
					Total:   2,
					HasMore: false,
				}
				server.SetResponse("POST", "/api/v1/monitoring/logs/query", response)
			},
			query: &LogQuery{
				Query:  "level:error",
				From:   time.Now().Add(-1 * time.Hour),
				To:     time.Now(),
				Limit:  100,
				Offset: 0,
			},
			expectedError: false,
		},
		{
			name:          "nil query",
			query:         nil,
			expectedError: true,
			errorMsg:      "log query cannot be nil",
		},
		{
			name: "empty query",
			query: &LogQuery{
				Query: "",
				From:  time.Now().Add(-1 * time.Hour),
				To:    time.Now(),
			},
			expectedError: true,
			errorMsg:      "query cannot be empty",
		},
		{
			name: "invalid time range",
			query: &LogQuery{
				Query: "test",
				From:  time.Now(),
				To:    time.Now().Add(-1 * time.Hour), // From > To
			},
			expectedError: true,
			errorMsg:      "invalid time range",
		},
		{
			name: "query syntax error",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "invalid query syntax",
						"code":    400,
					},
				}
				server.SetResponse("POST", "/api/v1/monitoring/logs/query", errorResp)
			},
			query: &LogQuery{
				Query: "invalid syntax ((",
				From:  time.Now().Add(-1 * time.Hour),
				To:    time.Now(),
			},
			expectedError: true,
			errorMsg:      "invalid query syntax",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupMock != nil {
				tt.setupMock()
			}

			result, err := client.Monitoring.QueryLogs(TestContext(), tt.query)

			if tt.expectedError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(strings.ToLower(err.Error()), strings.ToLower(tt.errorMsg)) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}
				if result == nil {
					t.Fatal("Expected non-nil result")
				}
				if result.Total < 0 {
					t.Fatal("Expected non-negative total count")
				}
			}
		})
	}
}

func TestMonitoringService_ContextCancellation(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	ctx, cancel := context.WithCancel(context.Background())

	// Cancel the context immediately
	cancel()

	metric := &Metric{
		Name:  "test_metric",
		Value: 42.0,
		Unit:  "count",
	}

	_, err := client.Monitoring.CreateMetric(ctx, metric)
	if err == nil {
		t.Fatal("Expected context cancellation error")
	}
	if !strings.Contains(strings.ToLower(err.Error()), "context canceled") {
		t.Fatalf("Expected context cancellation error, got %v", err)
	}
}

func TestMonitoringService_JsonSerialization(t *testing.T) {
	t.Run("Metric serialization", func(t *testing.T) {
		metric := &Metric{
			ID:        "metric-123",
			Name:      "cpu_usage",
			Value:     75.5,
			Unit:      "percent",
			Timestamp: time.Now(),
			Labels: map[string]string{
				"host":        "server-1",
				"environment": "production",
			},
		}

		data, err := json.Marshal(metric)
		if err != nil {
			t.Fatalf("Failed to marshal metric: %v", err)
		}

		var decoded Metric
		err = json.Unmarshal(data, &decoded)
		if err != nil {
			t.Fatalf("Failed to unmarshal metric: %v", err)
		}

		if decoded.ID != metric.ID {
			t.Fatalf("Expected ID %q, got %q", metric.ID, decoded.ID)
		}
		if decoded.Name != metric.Name {
			t.Fatalf("Expected name %q, got %q", metric.Name, decoded.Name)
		}
		if decoded.Value != metric.Value {
			t.Fatalf("Expected value %f, got %f", metric.Value, decoded.Value)
		}
	})

	t.Run("Alert serialization", func(t *testing.T) {
		alert := &Alert{
			ID:          "alert-123",
			Name:        "High CPU Usage",
			Description: "CPU usage is above 80%",
			Status:      "active",
			Severity:    "warning",
			TriggeredAt: time.Now(),
			Labels: map[string]string{
				"service": "web-server",
				"team":    "operations",
			},
		}

		data, err := json.Marshal(alert)
		if err != nil {
			t.Fatalf("Failed to marshal alert: %v", err)
		}

		var decoded Alert
		err = json.Unmarshal(data, &decoded)
		if err != nil {
			t.Fatalf("Failed to unmarshal alert: %v", err)
		}

		if decoded.ID != alert.ID {
			t.Fatalf("Expected ID %q, got %q", alert.ID, decoded.ID)
		}
		if decoded.Name != alert.Name {
			t.Fatalf("Expected name %q, got %q", alert.Name, decoded.Name)
		}
		if decoded.Status != alert.Status {
			t.Fatalf("Expected status %q, got %q", alert.Status, decoded.Status)
		}
	})
}

func TestMonitoringService_ConcurrentOperations(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	// Setup mock responses for concurrent operations
	for i := 0; i < 10; i++ {
		response := map[string]interface{}{
			"id":    fmt.Sprintf("metric-%d", i),
			"name":  fmt.Sprintf("metric_%d", i),
			"value": float64(i * 10),
			"unit":  "count",
		}
		server.SetResponse("POST", "/api/v1/monitoring/metrics", response)
	}

	// Test concurrent metric creation
	const numGoroutines = 10
	var wg sync.WaitGroup
	errors := make(chan error, numGoroutines)
	results := make(chan *Metric, numGoroutines)

	wg.Add(numGoroutines)
	for i := 0; i < numGoroutines; i++ {
		go func(id int) {
			defer wg.Done()

			metric := &Metric{
				Name:  fmt.Sprintf("metric_%d", id),
				Value: float64(id * 10),
				Unit:  "count",
			}

			result, err := client.Monitoring.CreateMetric(TestContext(), metric)
			if err != nil {
				errors <- err
				return
			}
			results <- result
		}(i)
	}

	wg.Wait()
	close(errors)
	close(results)

	// Check for errors
	for err := range errors {
		t.Errorf("Concurrent operation failed: %v", err)
	}

	// Check results
	resultCount := 0
	for range results {
		resultCount++
	}

	if resultCount != numGoroutines {
		t.Errorf("Expected %d results, got %d", numGoroutines, resultCount)
	}
}

func TestMonitoringService_MetricValidation(t *testing.T) {
	client, _ := CreateTestClient(t)

	tests := []struct {
		name      string
		metric    *Metric
		expectErr bool
		errMsg    string
	}{
		{
			name: "valid metric",
			metric: &Metric{
				Name:  "cpu_usage",
				Value: 75.5,
				Unit:  "percent",
				Labels: map[string]string{
					"host": "server-1",
				},
			},
			expectErr: false,
		},
		{
			name: "invalid metric name - empty",
			metric: &Metric{
				Name:  "",
				Value: 75.5,
				Unit:  "percent",
			},
			expectErr: true,
			errMsg:    "metric name cannot be empty",
		},
		{
			name: "invalid metric value - NaN",
			metric: &Metric{
				Name:  "test_metric",
				Value: math.NaN(),
				Unit:  "count",
			},
			expectErr: true,
			errMsg:    "metric value cannot be NaN",
		},
		{
			name: "invalid metric value - Inf",
			metric: &Metric{
				Name:  "test_metric",
				Value: math.Inf(1),
				Unit:  "count",
			},
			expectErr: true,
			errMsg:    "metric value cannot be Inf",
		},
		{
			name: "invalid unit - empty",
			metric: &Metric{
				Name:  "test_metric",
				Value: 42.0,
				Unit:  "",
			},
			expectErr: true,
			errMsg:    "unit cannot be empty",
		},
		{
			name: "invalid labels - nil key",
			metric: &Metric{
				Name:  "test_metric",
				Value: 42.0,
				Unit:  "count",
				Labels: map[string]string{
					"": "value",
				},
			},
			expectErr: true,
			errMsg:    "label keys cannot be empty",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := client.Monitoring.CreateMetric(TestContext(), tt.metric)

			if tt.expectErr {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errMsg != "" && !strings.Contains(strings.ToLower(err.Error()), strings.ToLower(tt.errMsg)) {
					t.Fatalf("Expected error containing %q, got %q", tt.errMsg, err.Error())
				}
			}
		})
	}
}

func TestMonitoringService_AlertValidation(t *testing.T) {
	client, _ := CreateTestClient(t)

	validStatuses := []string{"active", "resolved", "suppressed"}
	validSeverities := []string{"info", "warning", "error", "critical"}

	tests := []struct {
		name      string
		alert     *Alert
		expectErr bool
		errMsg    string
	}{
		{
			name: "valid alert",
			alert: &Alert{
				Name:        "High CPU Usage",
				Description: "CPU usage is above 80%",
				Status:      "active",
				Severity:    "warning",
			},
			expectErr: false,
		},
		{
			name: "invalid alert name - empty",
			alert: &Alert{
				Name:        "",
				Description: "Test alert",
				Status:      "active",
				Severity:    "warning",
			},
			expectErr: true,
			errMsg:    "alert name cannot be empty",
		},
		{
			name: "invalid alert status",
			alert: &Alert{
				Name:        "Test Alert",
				Description: "Test alert description",
				Status:      "invalid_status",
				Severity:    "warning",
			},
			expectErr: true,
			errMsg:    "invalid alert status",
		},
		{
			name: "invalid alert severity",
			alert: &Alert{
				Name:        "Test Alert",
				Description: "Test alert description",
				Status:      "active",
				Severity:    "invalid_severity",
			},
			expectErr: true,
			errMsg:    "invalid alert severity",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := client.Monitoring.CreateAlert(TestContext(), tt.alert)

			if tt.expectErr {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errMsg != "" && !strings.Contains(strings.ToLower(err.Error()), strings.ToLower(tt.errMsg)) {
					t.Fatalf("Expected error containing %q, got %q", tt.errMsg, err.Error())
				}
			}
		})
	}

	// Test valid values
	for _, status := range validStatuses {
		t.Run(fmt.Sprintf("valid status %s", status), func(t *testing.T) {
			alert := &Alert{
				Name:     "Test Alert",
				Status:   status,
				Severity: "warning",
			}
			_, err := client.Monitoring.CreateAlert(TestContext(), alert)
			// Should not get validation error for status
			if err != nil && strings.Contains(err.Error(), "invalid alert status") {
				t.Errorf("Valid status %s was rejected", status)
			}
		})
	}

	for _, severity := range validSeverities {
		t.Run(fmt.Sprintf("valid severity %s", severity), func(t *testing.T) {
			alert := &Alert{
				Name:     "Test Alert",
				Status:   "active",
				Severity: severity,
			}
			_, err := client.Monitoring.CreateAlert(TestContext(), alert)
			// Should not get validation error for severity
			if err != nil && strings.Contains(err.Error(), "invalid alert severity") {
				t.Errorf("Valid severity %s was rejected", severity)
			}
		})
	}
}

func TestMonitoringService_DashboardValidation(t *testing.T) {
	client, _ := CreateTestClient(t)

	validWidgetTypes := []string{"metric", "chart", "table", "text"}

	tests := []struct {
		name      string
		dashboard *Dashboard
		expectErr bool
		errMsg    string
	}{
		{
			name: "valid dashboard",
			dashboard: &Dashboard{
				Name:        "Test Dashboard",
				Description: "A test dashboard",
				Widgets: []DashboardWidget{
					{
						Type:   "metric",
						Title:  "CPU Usage",
						Metric: "cpu_usage",
					},
				},
			},
			expectErr: false,
		},
		{
			name: "invalid dashboard name - empty",
			dashboard: &Dashboard{
				Name:        "",
				Description: "Test dashboard",
				Widgets:     []DashboardWidget{},
			},
			expectErr: true,
			errMsg:    "dashboard name cannot be empty",
		},
		{
			name: "invalid widget type",
			dashboard: &Dashboard{
				Name:        "Test Dashboard",
				Description: "Test dashboard",
				Widgets: []DashboardWidget{
					{
						Type:   "invalid_type",
						Title:  "Test Widget",
						Metric: "test_metric",
					},
				},
			},
			expectErr: true,
			errMsg:    "invalid widget type",
		},
		{
			name: "widget with empty title",
			dashboard: &Dashboard{
				Name:        "Test Dashboard",
				Description: "Test dashboard",
				Widgets: []DashboardWidget{
					{
						Type:   "metric",
						Title:  "",
						Metric: "test_metric",
					},
				},
			},
			expectErr: true,
			errMsg:    "widget title cannot be empty",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := client.Monitoring.CreateDashboard(TestContext(), tt.dashboard)

			if tt.expectErr {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errMsg != "" && !strings.Contains(strings.ToLower(err.Error()), strings.ToLower(tt.errMsg)) {
					t.Fatalf("Expected error containing %q, got %q", tt.errMsg, err.Error())
				}
			}
		})
	}

	// Test valid widget types
	for _, widgetType := range validWidgetTypes {
		t.Run(fmt.Sprintf("valid widget type %s", widgetType), func(t *testing.T) {
			dashboard := &Dashboard{
				Name:        "Test Dashboard",
				Description: "Test dashboard",
				Widgets: []DashboardWidget{
					{
						Type:   widgetType,
						Title:  "Test Widget",
						Metric: "test_metric",
					},
				},
			}
			_, err := client.Monitoring.CreateDashboard(TestContext(), dashboard)
			// Should not get validation error for widget type
			if err != nil && strings.Contains(err.Error(), "invalid widget type") {
				t.Errorf("Valid widget type %s was rejected", widgetType)
			}
		})
	}
}
