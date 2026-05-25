package domain

import "testing"

func TestNewUsageRecord(t *testing.T) {
	tests := []struct {
		tenantID string
		product  Product
		period   string
		wantErr  bool
	}{
		{"t1", ProductAPI, "2026-03", false},
		{"", ProductAPI, "2026-03", true},
		{"t1", Product("invalid"), "2026-03", true},
		{"t1", ProductAPI, "", true},
	}
	for _, tt := range tests {
		_, err := NewUsageRecord(tt.tenantID, tt.product, tt.period)
		if (err != nil) != tt.wantErr {
			t.Errorf("NewUsageRecord() error = %v, wantErr %v", err, tt.wantErr)
		}
	}
}

func TestRecordUsage(t *testing.T) {
	rec, _ := NewUsageRecord("t1", ProductAPI, "2026-03")
	rec.RecordUsage(MetricAPIScreenings, 100)
	if got := rec.Metrics[MetricAPIScreenings]; got != 100 {
		t.Errorf("RecordUsage() = %d, want 100", got)
	}
	rec.RecordUsage(MetricAPIScreenings, 50)
	if got := rec.Metrics[MetricAPIScreenings]; got != 150 {
		t.Errorf("RecordUsage() = %d, want 150", got)
	}
}

func TestIsOverLimit(t *testing.T) {
	plan, _ := NewPlan("p1", ProductAPI, "starter", "API Starter", 49900)
	plan.SetLimit(MetricAPIScreenings, 10000)
	rec, _ := NewUsageRecord("t1", ProductAPI, "2026-03")

	if rec.IsOverLimit(plan, MetricAPIScreenings) {
		t.Error("0 usage should not be over limit")
	}
	rec.RecordUsage(MetricAPIScreenings, 10001)
	if !rec.IsOverLimit(plan, MetricAPIScreenings) {
		t.Error("10001 usage should be over 10000 limit")
	}
}

func TestUsagePercent(t *testing.T) {
	plan, _ := NewPlan("p1", ProductAPI, "starter", "API Starter", 49900)
	plan.SetLimit(MetricAPIScreenings, 10000)
	rec, _ := NewUsageRecord("t1", ProductAPI, "2026-03")

	tests := []struct {
		usage    int64
		expected float64
	}{
		{0, 0.0},
		{5000, 50.0},
		{10000, 100.0},
		{15000, 100.0},
	}
	for _, tt := range tests {
		rec.Metrics[MetricAPIScreenings] = tt.usage
		if got := rec.UsagePercent(plan, MetricAPIScreenings); got != tt.expected {
			t.Errorf("UsagePercent(%d) = %v, want %v", tt.usage, got, tt.expected)
		}
	}
}
