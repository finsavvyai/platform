package observe

import (
	"sync"
	"time"
)

// DORAMetrics represents the four key DORA metrics.
type DORAMetrics struct {
	DeployFrequency      float64 `json:"deploy_frequency"`        // deploys per day
	LeadTimeMinutes      float64 `json:"lead_time_minutes"`       // commit to production
	ChangeFailureRate    float64 `json:"change_failure_rate"`     // % of deploys causing failures
	TimeToRestoreMinutes float64 `json:"time_to_restore_minutes"` // mean time to restore
}

// BuildMetrics tracks pipeline performance over time.
type BuildMetrics struct {
	TotalRuns   int           `json:"total_runs"`
	PassRate    float64       `json:"pass_rate"`
	AvgDuration time.Duration `json:"avg_duration"`
	P95Duration time.Duration `json:"p95_duration"`
	CostSaved   float64       `json:"cost_saved"`
}

// RunRecord stores one pipeline run for analytics.
type RunRecord struct {
	ID        string
	Passed    bool
	Duration  time.Duration
	Timestamp time.Time
	CostSaved float64
}

// Collector aggregates metrics from pipeline runs.
type Collector struct {
	mu        sync.Mutex
	records   []RunRecord
	storePath string
}

// NewCollector creates an in-memory metrics collector (no disk I/O).
func NewCollector() *Collector {
	return &Collector{records: make([]RunRecord, 0)}
}

// LoadCollector creates a collector pre-loaded from disk and saves on every Record.
func LoadCollector() *Collector {
	path := defaultStorePath()
	return &Collector{
		records:   loadRecords(path),
		storePath: path,
	}
}

// Record adds a run to the collector. If a store path is set, persists to disk.
func (c *Collector) Record(r RunRecord) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.records = append(c.records, r)
	if len(c.records) > 10000 {
		c.records = c.records[len(c.records)-10000:]
	}
	saveRecords(c.storePath, c.records)
}

// BuildMetricsSummary computes aggregate build metrics.
func (c *Collector) BuildMetricsSummary() BuildMetrics {
	c.mu.Lock()
	defer c.mu.Unlock()
	if len(c.records) == 0 {
		return BuildMetrics{}
	}
	m := BuildMetrics{TotalRuns: len(c.records)}
	var totalDur time.Duration
	passed := 0
	for _, r := range c.records {
		totalDur += r.Duration
		m.CostSaved += r.CostSaved
		if r.Passed {
			passed++
		}
	}
	m.PassRate = float64(passed) / float64(len(c.records)) * 100
	m.AvgDuration = totalDur / time.Duration(len(c.records))
	return m
}
