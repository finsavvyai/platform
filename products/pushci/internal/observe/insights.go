package observe

import (
	"fmt"
	"sort"
	"time"
)

// Insight is an actionable observation about pipeline performance.
type Insight struct {
	Type     string `json:"type"`
	Message  string `json:"message"`
	Impact   string `json:"impact"` // high, medium, low
	Category string `json:"category"`
}

// GenerateInsights analyzes records and produces actionable insights.
func (c *Collector) GenerateInsights() []Insight {
	c.mu.Lock()
	defer c.mu.Unlock()
	var insights []Insight
	if len(c.records) < 5 {
		return insights
	}
	insights = append(insights, analyzeSlowBuilds(c.records)...)
	insights = append(insights, analyzeFlakyRuns(c.records)...)
	insights = append(insights, analyzeCostSavings(c.records)...)
	return insights
}

func analyzeSlowBuilds(records []RunRecord) []Insight {
	var durations []time.Duration
	for _, r := range records {
		durations = append(durations, r.Duration)
	}
	sort.Slice(durations, func(i, j int) bool { return durations[i] < durations[j] })
	p95 := durations[int(float64(len(durations))*0.95)]
	avg := averageDuration(durations)
	if p95 > 2*avg {
		return []Insight{{
			Type:     "slow_build",
			Message:  fmt.Sprintf("P95 build time (%.0fs) is 2x average (%.0fs)", p95.Seconds(), avg.Seconds()),
			Impact:   "high",
			Category: "performance",
		}}
	}
	return nil
}

func analyzeFlakyRuns(records []RunRecord) []Insight {
	total, failed := len(records), 0
	for _, r := range records {
		if !r.Passed {
			failed++
		}
	}
	rate := float64(failed) / float64(total) * 100
	if rate > 20 {
		return []Insight{{
			Type:     "high_failure_rate",
			Message:  fmt.Sprintf("%.0f%% failure rate — investigate flaky tests", rate),
			Impact:   "high",
			Category: "reliability",
		}}
	}
	return nil
}

func analyzeCostSavings(records []RunRecord) []Insight {
	var total float64
	for _, r := range records {
		total += r.CostSaved
	}
	if total > 0 {
		return []Insight{{
			Type:     "cost_savings",
			Message:  fmt.Sprintf("$%.2f saved vs GitHub Actions", total),
			Impact:   "medium",
			Category: "cost",
		}}
	}
	return nil
}

func averageDuration(d []time.Duration) time.Duration {
	if len(d) == 0 {
		return 0
	}
	var total time.Duration
	for _, dur := range d {
		total += dur
	}
	return total / time.Duration(len(d))
}
