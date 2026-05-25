package domain

import "testing"

func TestUsageMetricIsValid(t *testing.T) {
	tests := []struct {
		metric UsageMetric
		want   bool
	}{
		{MetricAPIScreenings, true},
		{MetricDashboardSeats, true},
		{MetricSDKCalls, true},
		{MetricIFrameLookups, true},
		{MetricDatasetFetches, true},
		{MetricDatasetRows, true},
		{UsageMetric("invalid"), false},
	}
	for _, tt := range tests {
		if got := tt.metric.IsValid(); got != tt.want {
			t.Errorf("UsageMetric(%s).IsValid() = %v, want %v", tt.metric, got, tt.want)
		}
	}
}

func TestMetricsForProduct(t *testing.T) {
	tests := []struct {
		product Product
		want    int
	}{
		{ProductAPI, 1},
		{ProductDashboard, 1},
		{ProductSDK, 1},
		{ProductIFrame, 1},
		{ProductDataset, 2},
	}
	for _, tt := range tests {
		got := MetricsForProduct(tt.product)
		if len(got) != tt.want {
			t.Errorf("MetricsForProduct(%s) len = %d, want %d", tt.product, len(got), tt.want)
		}
	}
}

func TestUsageMetricUnit(t *testing.T) {
	tests := []struct {
		metric UsageMetric
		want   string
	}{
		{MetricAPIScreenings, "calls"},
		{MetricDashboardSeats, "active users"},
		{MetricSDKCalls, "calls"},
		{MetricIFrameLookups, "lookups"},
		{MetricDatasetFetches, "fetches"},
		{MetricDatasetRows, "rows"},
	}
	for _, tt := range tests {
		if got := tt.metric.Unit(); got != tt.want {
			t.Errorf("UsageMetric(%s).Unit() = %v, want %v", tt.metric, got, tt.want)
		}
	}
}

func TestParseMetric(t *testing.T) {
	_, err := ParseMetric(string(MetricAPIScreenings))
	if err != nil {
		t.Errorf("ParseMetric valid metric failed: %v", err)
	}
	_, err = ParseMetric("invalid")
	if err == nil {
		t.Error("ParseMetric invalid metric should fail")
	}
}
