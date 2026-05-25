//go:build ignore

package policy

import (
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/sirupsen/logrus"
)

// PolicyMetricsCollector collects and exposes Prometheus metrics for policy enforcement
type PolicyMetricsCollector struct {
	logger *logrus.Logger

	// Decision metrics
	decisionsTotal   *prometheus.CounterVec
	decisionsAllowed *prometheus.CounterVec
	decisionsDenied  *prometheus.CounterVec
	decisionsErrors  *prometheus.CounterVec

	// Latency metrics
	evaluationDuration        *prometheus.HistogramVec
	evaluationDurationSummary *prometheus.SummaryVec

	// Cache metrics
	cacheHits   *prometheus.CounterVec
	cacheMisses *prometheus.CounterVec
	cacheSize   prometheus.Gauge

	// Tenant metrics
	tenantDecisions *prometheus.CounterVec

	// Resource metrics
	resourceDecisions *prometheus.CounterVec
	resourceDenials   *prometheus.CounterVec

	// Policy metrics
	policyEvaluations *prometheus.CounterVec
	policyLoadTime    *prometheus.GaugeVec

	// OPA connection metrics
	opaConnectionErrors prometheus.Counter
	opaRequestDuration  *prometheus.HistogramVec

	// Batch metrics
	batchEvaluations    *prometheus.CounterVec
	batchEvaluationSize *prometheus.HistogramVec

	mu        sync.RWMutex
	lastReset time.Time
}

// NewPolicyMetricsCollector creates a new policy metrics collector
func NewPolicyMetricsCollector(logger *logrus.Logger) *PolicyMetricsCollector {
	if logger == nil {
		logger = logrus.New()
	}

	return &PolicyMetricsCollector{
		logger:    logger,
		lastReset: time.Now(),
	}
}

// Describe implements prometheus.Collector
func (pmc *PolicyMetricsCollector) Describe(ch chan<- *prometheus.Desc) {
	prometheus.DescribeByCollect(pmc, ch)
}

// Collect implements prometheus.Collector
func (pmc *PolicyMetricsCollector) Collect(ch chan<- prometheus.Metric) {
	pmc.mu.RLock()
	defer pmc.mu.RUnlock()

	if pmc.decisionsTotal != nil {
		pmc.decisionsTotal.Collect(ch)
	}
	if pmc.decisionsAllowed != nil {
		pmc.decisionsAllowed.Collect(ch)
	}
	if pmc.decisionsDenied != nil {
		pmc.decisionsDenied.Collect(ch)
	}
	if pmc.decisionsErrors != nil {
		pmc.decisionsErrors.Collect(ch)
	}
	if pmc.evaluationDuration != nil {
		pmc.evaluationDuration.Collect(ch)
	}
	if pmc.evaluationDurationSummary != nil {
		pmc.evaluationDurationSummary.Collect(ch)
	}
	if pmc.cacheHits != nil {
		pmc.cacheHits.Collect(ch)
	}
	if pmc.cacheMisses != nil {
		pmc.cacheMisses.Collect(ch)
	}
	if pmc.tenantDecisions != nil {
		pmc.tenantDecisions.Collect(ch)
	}
	if pmc.resourceDecisions != nil {
		pmc.resourceDecisions.Collect(ch)
	}
	if pmc.resourceDenials != nil {
		pmc.resourceDenials.Collect(ch)
	}
	if pmc.policyEvaluations != nil {
		pmc.policyEvaluations.Collect(ch)
	}
	if pmc.opaConnectionErrors != nil {
		pmc.opaConnectionErrors.Collect(ch)
	}
	if pmc.opaRequestDuration != nil {
		pmc.opaRequestDuration.Collect(ch)
	}
	if pmc.batchEvaluations != nil {
		pmc.batchEvaluations.Collect(ch)
	}
	if pmc.batchEvaluationSize != nil {
		pmc.batchEvaluationSize.Collect(ch)
	}
}

// Initialize initializes the Prometheus metrics
func (pmc *PolicyMetricsCollector) Initialize(namespace string) {
	pmc.mu.Lock()
	defer pmc.mu.Unlock()

	if namespace == "" {
		namespace = "sdlc_platform"
	}

	subsystem := "policy_enforcement"

	// Decision metrics
	pmc.decisionsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "decisions_total",
			Help:      "Total number of policy decisions made",
		},
		[]string{"tenant_id", "decision"},
	)

	pmc.decisionsAllowed = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "decisions_allowed_total",
			Help:      "Total number of allowed policy decisions",
		},
		[]string{"tenant_id", "action", "resource_type"},
	)

	pmc.decisionsDenied = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "decisions_denied_total",
			Help:      "Total number of denied policy decisions",
		},
		[]string{"tenant_id", "action", "resource_type", "reason"},
	)

	pmc.decisionsErrors = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "decisions_errors_total",
			Help:      "Total number of policy decision errors",
		},
		[]string{"tenant_id", "error_type"},
	)

	// Latency metrics
	pmc.evaluationDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "evaluation_duration_seconds",
			Help:      "Policy evaluation duration in seconds",
			Buckets:   []float64{0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5},
		},
		[]string{"tenant_id", "cached"},
	)

	pmc.evaluationDurationSummary = promauto.NewSummaryVec(
		prometheus.SummaryOpts{
			Namespace:  namespace,
			Subsystem:  subsystem,
			Name:       "evaluation_duration_summary_seconds",
			Help:       "Policy evaluation duration summary in seconds",
			Objectives: map[float64]float64{0.5: 0.05, 0.9: 0.01, 0.95: 0.005, 0.99: 0.001},
		},
		[]string{"tenant_id"},
	)

	// Cache metrics
	pmc.cacheHits = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "cache_hits_total",
			Help:      "Total number of cache hits",
		},
		[]string{"tenant_id", "cache_type"},
	)

	pmc.cacheMisses = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "cache_misses_total",
			Help:      "Total number of cache misses",
		},
		[]string{"tenant_id", "cache_type"},
	)

	pmc.cacheSize = promauto.NewGauge(
		prometheus.GaugeOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "cache_size",
			Help:      "Current size of the policy decision cache",
		},
	)

	// Tenant metrics
	pmc.tenantDecisions = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "tenant_decisions_total",
			Help:      "Total number of policy decisions per tenant",
		},
		[]string{"tenant_id", "user_role"},
	)

	// Resource metrics
	pmc.resourceDecisions = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "resource_decisions_total",
			Help:      "Total number of policy decisions per resource",
		},
		[]string{"tenant_id", "resource_path", "method"},
	)

	pmc.resourceDenials = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "resource_denials_total",
			Help:      "Total number of denials per resource",
		},
		[]string{"tenant_id", "resource_path", "method"},
	)

	// Policy metrics
	pmc.policyEvaluations = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "policy_evaluations_total",
			Help:      "Total number of times each policy was evaluated",
		},
		[]string{"tenant_id", "policy_id", "policy_type"},
	)

	pmc.policyLoadTime = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "policy_load_time_seconds",
			Help:      "Time taken to load policies",
		},
		[]string{"tenant_id", "policy_id"},
	)

	// OPA connection metrics
	pmc.opaConnectionErrors = promauto.NewCounter(
		prometheus.CounterOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "opa_connection_errors_total",
			Help:      "Total number of OPA connection errors",
		},
	)

	pmc.opaRequestDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "opa_request_duration_seconds",
			Help:      "OPA request duration in seconds",
			Buckets:   []float64{0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5},
		},
		[]string{"endpoint"},
	)

	// Batch metrics
	pmc.batchEvaluations = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "batch_evaluations_total",
			Help:      "Total number of batch policy evaluations",
		},
		[]string{"tenant_id", "result"},
	)

	pmc.batchEvaluationSize = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "batch_evaluation_size",
			Help:      "Size of batch policy evaluations",
			Buckets:   []float64{1, 5, 10, 25, 50, 100},
		},
		[]string{"tenant_id"},
	)

	pmc.logger.Info("Policy metrics initialized")
}

// RecordDecision records a policy decision
func (pmc *PolicyMetricsCollector) RecordDecision(tenantID, action, resourceType, decision, reason string, duration time.Duration, cached bool) {
	pmc.mu.RLock()
	defer pmc.mu.RUnlock()

	labels := prometheus.Labels{
		"tenant_id": tenantID,
		"decision":  decision,
	}

	if pmc.decisionsTotal != nil {
		pmc.decisionsTotal.With(labels).Inc()
	}

	if decision == "allow" {
		if pmc.decisionsAllowed != nil {
			pmc.decisionsAllowed.With(prometheus.Labels{
				"tenant_id":     tenantID,
				"action":        action,
				"resource_type": resourceType,
			}).Inc()
		}
	} else {
		if pmc.decisionsDenied != nil {
			pmc.decisionsDenied.With(prometheus.Labels{
				"tenant_id":     tenantID,
				"action":        action,
				"resource_type": resourceType,
				"reason":        reason,
			}).Inc()
		}
	}

	cachedStr := "false"
	if cached {
		cachedStr = "true"
		if pmc.cacheHits != nil {
			pmc.cacheHits.With(prometheus.Labels{
				"tenant_id":  tenantID,
				"cache_type": "decision",
			}).Inc()
		}
	} else {
		if pmc.cacheMisses != nil {
			pmc.cacheMisses.With(prometheus.Labels{
				"tenant_id":  tenantID,
				"cache_type": "decision",
			}).Inc()
		}
	}

	if pmc.evaluationDuration != nil {
		pmc.evaluationDuration.With(prometheus.Labels{
			"tenant_id": tenantID,
			"cached":    cachedStr,
		}).Observe(duration.Seconds())
	}

	if pmc.evaluationDurationSummary != nil {
		pmc.evaluationDurationSummary.With(prometheus.Labels{
			"tenant_id": tenantID,
		}).Observe(duration.Seconds())
	}
}

// RecordError records a policy evaluation error
func (pmc *PolicyMetricsCollector) RecordError(tenantID, errorType string) {
	pmc.mu.RLock()
	defer pmc.mu.RUnlock()

	if pmc.decisionsErrors != nil {
		pmc.decisionsErrors.With(prometheus.Labels{
			"tenant_id":  tenantID,
			"error_type": errorType,
		}).Inc()
	}
}

// RecordOPARequest records an OPA request
func (pmc *PolicyMetricsCollector) RecordOPARequest(endpoint string, duration time.Duration, err error) {
	pmc.mu.RLock()
	defer pmc.mu.RUnlock()

	if err != nil && pmc.opaConnectionErrors != nil {
		pmc.opaConnectionErrors.Inc()
	}

	if pmc.opaRequestDuration != nil {
		pmc.opaRequestDuration.With(prometheus.Labels{
			"endpoint": endpoint,
		}).Observe(duration.Seconds())
	}
}

// RecordBatchEvaluation records a batch policy evaluation
func (pmc *PolicyMetricsCollector) RecordBatchEvaluation(tenantID string, size int, success bool) {
	pmc.mu.RLock()
	defer pmc.mu.RUnlock()

	result := "success"
	if !success {
		result = "error"
	}

	if pmc.batchEvaluations != nil {
		pmc.batchEvaluations.With(prometheus.Labels{
			"tenant_id": tenantID,
			"result":    result,
		}).Inc()
	}

	if pmc.batchEvaluationSize != nil {
		pmc.batchEvaluationSize.With(prometheus.Labels{
			"tenant_id": tenantID,
		}).Observe(float64(size))
	}
}

// RecordPolicyLoad records a policy load operation
func (pmc *PolicyMetricsCollector) RecordPolicyLoad(tenantID, policyID string, duration time.Duration) {
	pmc.mu.RLock()
	defer pmc.mu.RUnlock()

	if pmc.policyLoadTime != nil {
		pmc.policyLoadTime.With(prometheus.Labels{
			"tenant_id": tenantID,
			"policy_id": policyID,
		}).Set(duration.Seconds())
	}
}

// UpdateCacheSize updates the current cache size
func (pmc *PolicyMetricsCollector) UpdateCacheSize(size int) {
	pmc.mu.RLock()
	defer pmc.mu.RUnlock()

	if pmc.cacheSize != nil {
		pmc.cacheSize.Set(float64(size))
	}
}

// RecordResourceDecision records a decision for a specific resource
func (pmc *PolicyMetricsCollector) RecordResourceDecision(tenantID, resourcePath, method string, allowed bool) {
	pmc.mu.RLock()
	defer pmc.mu.RUnlock()

	if pmc.resourceDecisions != nil {
		pmc.resourceDecisions.With(prometheus.Labels{
			"tenant_id":     tenantID,
			"resource_path": resourcePath,
			"method":        method,
		}).Inc()
	}

	if !allowed && pmc.resourceDenials != nil {
		pmc.resourceDenials.With(prometheus.Labels{
			"tenant_id":     tenantID,
			"resource_path": resourcePath,
			"method":        method,
		}).Inc()
	}
}

// RecordPolicyEvaluation records that a specific policy was evaluated
func (pmc *PolicyMetricsCollector) RecordPolicyEvaluation(tenantID, policyID, policyType string) {
	pmc.mu.RLock()
	defer pmc.mu.RUnlock()

	if pmc.policyEvaluations != nil {
		pmc.policyEvaluations.With(prometheus.Labels{
			"tenant_id":   tenantID,
			"policy_id":   policyID,
			"policy_type": policyType,
		}).Inc()
	}
}

// Reset resets all metrics (useful for testing)
func (pmc *PolicyMetricsCollector) Reset() {
	pmc.mu.Lock()
	defer pmc.mu.Unlock()

	pmc.lastReset = time.Now()

	if pmc.decisionsTotal != nil {
		pmc.decisionsTotal.Reset()
	}
	if pmc.decisionsAllowed != nil {
		pmc.decisionsAllowed.Reset()
	}
	if pmc.decisionsDenied != nil {
		pmc.decisionsDenied.Reset()
	}
	if pmc.decisionsErrors != nil {
		pmc.decisionsErrors.Reset()
	}
	if pmc.cacheHits != nil {
		pmc.cacheHits.Reset()
	}
	if pmc.cacheMisses != nil {
		pmc.cacheMisses.Reset()
	}
	if pmc.tenantDecisions != nil {
		pmc.tenantDecisions.Reset()
	}
	if pmc.resourceDecisions != nil {
		pmc.resourceDecisions.Reset()
	}
	if pmc.resourceDenials != nil {
		pmc.resourceDenials.Reset()
	}
	if pmc.policyEvaluations != nil {
		pmc.policyEvaluations.Reset()
	}
	if pmc.opaConnectionErrors != nil {
		pmc.opaConnectionErrors = 0
	}
	if pmc.batchEvaluations != nil {
		pmc.batchEvaluations.Reset()
	}
}

// GetLastReset returns the last reset time
func (pmc *PolicyMetricsCollector) GetLastReset() time.Time {
	pmc.mu.RLock()
	defer pmc.mu.RUnlock()
	return pmc.lastReset
}

// GetMetricsSummary returns a summary of current metrics
func (pmc *PolicyMetricsCollector) GetMetricsSummary() map[string]interface{} {
	pmc.mu.RLock()
	defer pmc.mu.RUnlock()

	return map[string]interface{}{
		"last_reset":    pmc.lastReset,
		"initialized":   pmc.decisionsTotal != nil,
		"metrics_count": 16, // Number of metric types
	}
}
