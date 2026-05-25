package monitoring

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// RecordRequest records a request metric
func (m *Metrics) RecordRequest(method, endpoint, status, tenantID, userID string, duration time.Duration) {
	m.requestsTotal.WithLabelValues(method, endpoint, status, tenantID, userID).Inc()
	m.requestDuration.WithLabelValues(method, endpoint, "", "").Observe(duration.Seconds())
}

// RecordProviderRequest records a provider request
func (m *Metrics) RecordProviderRequest(provider, model, status string, duration time.Duration) {
	m.providerRequests.WithLabelValues(provider, model, status).Inc()
	m.providerLatency.WithLabelValues(provider, model).Observe(duration.Seconds())
}

// IncCounter increments a counter metric
func (m *Metrics) IncCounter(name string) {
	switch name {
	case "llm.errors.validation":
		m.providerErrors.WithLabelValues("gateway", "validation").Inc()
	case "llm.errors.all_providers_failed":
		m.providerErrors.WithLabelValues("gateway", "all_providers_failed").Inc()
	default:
		m.providerErrors.WithLabelValues(name, "unknown").Inc()
	}
}

// RecordTokens records token usage
func (m *Metrics) RecordTokens(provider, model string, promptTokens, completionTokens int) {
	m.tokensTotal.WithLabelValues(provider, model, "prompt").Add(float64(promptTokens))
	m.tokensTotal.WithLabelValues(provider, model, "completion").Add(float64(completionTokens))
	m.tokensTotal.WithLabelValues(provider, model, "total").Add(float64(promptTokens + completionTokens))
}

// RecordCost records cost in USD
func (m *Metrics) RecordCost(provider, model, tenantID string, cost float64) {
	m.tokensCost.WithLabelValues(provider, model, tenantID).Add(cost)
}

// UpdateActiveConnections updates the active connections gauge
func (m *Metrics) UpdateActiveConnections(count float64) {
	m.activeConnections.Set(count)
}

// UpdateQueueSize updates the queue size gauge
func (m *Metrics) UpdateQueueSize(size float64) {
	m.queueSize.Set(size)
}

// UpdateBudgetUsage updates the budget usage gauge
func (m *Metrics) UpdateBudgetUsage(tenantID, period string, usage float64) {
	m.budgetUsage.WithLabelValues(tenantID, period).Set(usage)
}

// RecordBudgetAlert records a budget alert
func (m *Metrics) RecordBudgetAlert(tenantID, alertType string, threshold float64) {
	m.budgetAlerts.WithLabelValues(tenantID, alertType, fmt.Sprintf("%.0f", threshold)).Inc()
}

// RecordLatency records latency for a specific operation
func (m *Metrics) RecordLatency(operation string, duration time.Duration) {
	if strings.HasPrefix(operation, "llm.") {
		m.requestDuration.WithLabelValues("", "", "", "").Observe(duration.Seconds())
	}
}

// GetHandler returns the Prometheus metrics handler
func (m *Metrics) GetHandler() http.Handler {
	return promhttp.HandlerFor(m.registry, promhttp.HandlerOpts{})
}

// GetRegistry returns the Prometheus registry
func (m *Metrics) GetRegistry() *prometheus.Registry {
	return m.registry
}
