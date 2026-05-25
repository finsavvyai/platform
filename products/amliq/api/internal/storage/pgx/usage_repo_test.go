package pgx

import (
	"encoding/json"
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestScanUsageMetricsJSON(t *testing.T) {
	tests := []struct {
		name     string
		jsonStr  string
		expected int64
		metric   domain.UsageMetric
	}{
		{
			"api screenings",
			`{"api_screenings": 150}`,
			150,
			domain.MetricAPIScreenings,
		},
		{
			"sdk calls",
			`{"sdk_calls": 500}`,
			500,
			domain.MetricSDKCalls,
		},
		{
			"empty metrics",
			`{}`,
			0,
			domain.MetricAPIScreenings,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			metrics := make(map[domain.UsageMetric]int64)
			if err := json.Unmarshal([]byte(tt.jsonStr), &metrics); err != nil {
				t.Fatalf("unmarshal: %v", err)
			}
			got := metrics[tt.metric]
			if got != tt.expected {
				t.Errorf("got %d, want %d", got, tt.expected)
			}
		})
	}
}

func TestUsageRecordOverLimit(t *testing.T) {
	tests := []struct {
		name    string
		usage   int64
		limit   int64
		overLim bool
	}{
		{"under limit", 500, 1000, false},
		{"at limit", 1000, 1000, false},
		{"over limit", 1001, 1000, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec, _ := domain.NewUsageRecord("tnt_abc123abc123", domain.ProductAPI, "2026-03")
			rec.RecordUsage(domain.MetricAPIScreenings, tt.usage)

			plan := domain.Plan{Limits: map[domain.UsageMetric]int64{
				domain.MetricAPIScreenings: tt.limit,
			}}
			got := rec.IsOverLimit(plan, domain.MetricAPIScreenings)
			if got != tt.overLim {
				t.Errorf("got %v, want %v", got, tt.overLim)
			}
		})
	}
}
