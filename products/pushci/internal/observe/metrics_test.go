package observe

import (
	"testing"
	"time"
)

func TestCollectorRecordAndSummary(t *testing.T) {
	c := NewCollector()
	c.Record(RunRecord{ID: "1", Passed: true, Duration: 30 * time.Second, CostSaved: 0.01})
	c.Record(RunRecord{ID: "2", Passed: true, Duration: 45 * time.Second, CostSaved: 0.02})
	c.Record(RunRecord{ID: "3", Passed: false, Duration: 60 * time.Second, CostSaved: 0.01})

	m := c.BuildMetricsSummary()
	if m.TotalRuns != 3 {
		t.Errorf("total = %d, want 3", m.TotalRuns)
	}
	if m.PassRate < 66 || m.PassRate > 67 {
		t.Errorf("pass rate = %.1f, want ~66.7", m.PassRate)
	}
	if m.CostSaved != 0.04 {
		t.Errorf("cost saved = %.4f, want 0.04", m.CostSaved)
	}
}

func TestInsightsNeedMinRecords(t *testing.T) {
	c := NewCollector()
	c.Record(RunRecord{ID: "1", Passed: true})
	insights := c.GenerateInsights()
	if len(insights) != 0 {
		t.Error("expected no insights with < 5 records")
	}
}

func TestInsightsHighFailureRate(t *testing.T) {
	c := NewCollector()
	for i := 0; i < 10; i++ {
		c.Record(RunRecord{ID: "r", Passed: i%3 == 0, Duration: time.Second})
	}
	insights := c.GenerateInsights()
	found := false
	for _, ins := range insights {
		if ins.Type == "high_failure_rate" {
			found = true
		}
	}
	if !found {
		t.Error("expected high_failure_rate insight")
	}
}
