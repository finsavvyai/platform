package server

import (
	"time"

	"github.com/queryflux/backend/internal/domain"
)

func defaultDatabaseMetrics() []string {
	return []string{
		"connection_pool_active",
		"connection_pool_idle",
		"query_duration_ms",
		"query_success_rate",
		"database_connections_active",
		"database_size_mb",
		"database_transactions_per_second",
	}
}

func (s *Server) calculateStartTime(timeRange string) time.Time {
	now := time.Now()
	switch timeRange {
	case "1h":
		return now.Add(-1 * time.Hour)
	case "6h":
		return now.Add(-6 * time.Hour)
	case "24h":
		return now.Add(-24 * time.Hour)
	case "7d":
		return now.Add(-7 * 24 * time.Hour)
	case "30d":
		return now.Add(-30 * 24 * time.Hour)
	default:
		return now.Add(-1 * time.Hour)
	}
}

func (s *Server) calculateAggregationInterval(timeRange string) time.Duration {
	switch timeRange {
	case "1h":
		return 1 * time.Minute
	case "6h":
		return 5 * time.Minute
	case "24h":
		return 15 * time.Minute
	case "7d":
		return 1 * time.Hour
	case "30d":
		return 6 * time.Hour
	default:
		return 1 * time.Minute
	}
}

func (s *Server) getMetricNamesByType(metricType string) []string {
	switch metricType {
	case "connection":
		return []string{
			"connection_pool_active", "connection_pool_idle",
			"connection_pool_total", "connection_errors_total",
		}
	case "query":
		return []string{
			"query_duration_ms", "query_success_rate",
			"query_errors_total", "queries_per_second",
		}
	case "system":
		return []string{
			"database_connections_active", "database_size_mb",
			"database_transactions_per_second", "database_lock_wait_time_ms",
		}
	default:
		return []string{}
	}
}

func (s *Server) processMetricSeries(series []*domain.MetricSeries, interval string) []*domain.MetricSeries {
	return series
}

func countTotalDataPoints(series []*domain.MetricSeries) int {
	total := 0
	for _, s := range series {
		total += len(s.Points)
	}
	return total
}
