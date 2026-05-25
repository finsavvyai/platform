package domain

import "fmt"

type UsageMetric string

const (
	MetricAPIScreenings  UsageMetric = "api_screenings"
	MetricDashboardSeats UsageMetric = "dashboard_seats"
	MetricSDKCalls       UsageMetric = "sdk_calls"
	MetricIFrameLookups  UsageMetric = "iframe_lookups"
	MetricDatasetFetches UsageMetric = "dataset_fetches"
	MetricDatasetRows    UsageMetric = "dataset_rows"
)

func (m UsageMetric) String() string {
	return string(m)
}

func (m UsageMetric) IsValid() bool {
	switch m {
	case MetricAPIScreenings, MetricDashboardSeats, MetricSDKCalls, MetricIFrameLookups, MetricDatasetFetches, MetricDatasetRows:
		return true
	}
	return false
}

func (m UsageMetric) Unit() string {
	switch m {
	case MetricAPIScreenings:
		return "calls"
	case MetricDashboardSeats:
		return "active users"
	case MetricSDKCalls:
		return "calls"
	case MetricIFrameLookups:
		return "lookups"
	case MetricDatasetFetches:
		return "fetches"
	case MetricDatasetRows:
		return "rows"
	}
	return ""
}

func MetricsForProduct(p Product) []UsageMetric {
	switch p {
	case ProductAPI:
		return []UsageMetric{MetricAPIScreenings}
	case ProductDashboard:
		return []UsageMetric{MetricDashboardSeats}
	case ProductSDK:
		return []UsageMetric{MetricSDKCalls}
	case ProductIFrame:
		return []UsageMetric{MetricIFrameLookups}
	case ProductDataset:
		return []UsageMetric{MetricDatasetFetches, MetricDatasetRows}
	}
	return []UsageMetric{}
}

func ParseMetric(s string) (UsageMetric, error) {
	m := UsageMetric(s)
	if !m.IsValid() {
		return "", fmt.Errorf("invalid metric: %s", s)
	}
	return m, nil
}
