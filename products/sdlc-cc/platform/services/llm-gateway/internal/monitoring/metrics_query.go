package monitoring

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/SDLC/llm-gateway/internal/config"
	"github.com/prometheus/client_golang/api"
	v1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/prometheus/common/model"
	"github.com/sirupsen/logrus"
)

// PrometheusQuery wraps Prometheus querying functionality
type PrometheusQuery struct {
	client v1.API
}

// NewPrometheusQuery creates a new Prometheus query client
func NewPrometheusQuery(address string) (*PrometheusQuery, error) {
	client, err := api.NewClient(api.Config{
		Address: address,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create Prometheus client: %w", err)
	}
	return &PrometheusQuery{
		client: v1.NewAPI(client),
	}, nil
}

// QueryCostByTenant queries cost metrics by tenant
func (p *PrometheusQuery) QueryCostByTenant(ctx context.Context, tenantID string, timeRange time.Duration) (float64, error) {
	query := fmt.Sprintf(
		`sum(increase(llm_gateway_tokens_cost_dollars{tenant_id="%s"}[%s]))`,
		tenantID,
		timeRange.String(),
	)
	result, _, err := p.client.Query(ctx, query, time.Now())
	if err != nil {
		return 0, fmt.Errorf("failed to query Prometheus: %w", err)
	}
	if result.Type() == model.ValVector {
		vector := result.(model.Vector)
		if len(vector) > 0 {
			return float64(vector[0].Value), nil
		}
	}
	return 0, nil
}

// QueryErrorRate queries error rate for a provider
func (p *PrometheusQuery) QueryErrorRate(ctx context.Context, provider string, timeRange time.Duration) (float64, error) {
	query := fmt.Sprintf(
		`rate(llm_gateway_provider_errors_total{provider="%s"}[%s]) / rate(llm_gateway_provider_requests_total{provider="%s"}[%s]) * 100`,
		provider, timeRange.String(), provider, timeRange.String(),
	)
	result, _, err := p.client.Query(ctx, query, time.Now())
	if err != nil {
		return 0, fmt.Errorf("failed to query Prometheus: %w", err)
	}
	if result.Type() == model.ValVector {
		vector := result.(model.Vector)
		if len(vector) > 0 {
			return float64(vector[0].Value), nil
		}
	}
	return 0, nil
}

// Init initializes monitoring with the given configuration
func Init(cfg *config.Config) error {
	_ = NewMetrics()
	if cfg.Monitoring.Enabled {
		logrus.WithFields(logrus.Fields{
			"port": cfg.Monitoring.Port,
			"path": cfg.Monitoring.Path,
		}).Info("Monitoring enabled")
	}
	return nil
}

// GetMetrics returns an HTTP handler for Prometheus metrics
func GetMetrics() http.Handler {
	return promhttp.Handler()
}
