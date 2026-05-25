package reporting

import (
	"context"
	"time"
)

// MonthlyMetrics holds aggregate compliance statistics.
type MonthlyMetrics struct {
	ScreeningsPerformed int     `json:"screenings_performed"`
	AlertsGenerated     int     `json:"alerts_generated"`
	CasesOpened         int     `json:"cases_opened"`
	CasesClosed         int     `json:"cases_closed"`
	SARsFiled           int     `json:"sars_filed"`
	FalsePositiveRate   float64 `json:"false_positive_rate"`
	AvgResolutionHours  float64 `json:"avg_resolution_hours"`
}

// Report wraps monthly compliance data.
type Report struct {
	TenantID  string         `json:"tenant_id"`
	Month     string         `json:"month"`
	Metrics   MonthlyMetrics `json:"metrics"`
	CreatedAt time.Time      `json:"created_at"`
}

// StatsSource provides the data needed for report generation.
type StatsSource interface {
	ScreeningCount(ctx context.Context, tenantID string, from, to time.Time) (int, error)
	AlertCount(ctx context.Context, tenantID string, from, to time.Time) (int, error)
	CaseStats(ctx context.Context, tenantID string, from, to time.Time) (opened, closed int, err error)
	SARCount(ctx context.Context, tenantID string, from, to time.Time) (int, error)
	FalsePositiveRate(ctx context.Context, tenantID string, from, to time.Time) (float64, error)
	AvgResolution(ctx context.Context, tenantID string, from, to time.Time) (float64, error)
}

// ComplianceReporter generates monthly compliance reports.
type ComplianceReporter struct {
	source StatsSource
}

// NewComplianceReporter creates a reporter.
func NewComplianceReporter(source StatsSource) *ComplianceReporter {
	return &ComplianceReporter{source: source}
}

// GenerateMonthlyReport builds a report for the specified month.
func (r *ComplianceReporter) GenerateMonthlyReport(
	ctx context.Context, tenantID string, year int, month time.Month,
) (*Report, error) {
	from := time.Date(year, month, 1, 0, 0, 0, 0, time.UTC)
	to := from.AddDate(0, 1, 0).Add(-time.Second)

	screenings, _ := r.source.ScreeningCount(ctx, tenantID, from, to)
	alerts, _ := r.source.AlertCount(ctx, tenantID, from, to)
	opened, closed, _ := r.source.CaseStats(ctx, tenantID, from, to)
	sars, _ := r.source.SARCount(ctx, tenantID, from, to)
	fpRate, _ := r.source.FalsePositiveRate(ctx, tenantID, from, to)
	avgRes, _ := r.source.AvgResolution(ctx, tenantID, from, to)

	return &Report{
		TenantID: tenantID,
		Month:    from.Format("2006-01"),
		Metrics: MonthlyMetrics{
			ScreeningsPerformed: screenings,
			AlertsGenerated:     alerts,
			CasesOpened:         opened,
			CasesClosed:         closed,
			SARsFiled:           sars,
			FalsePositiveRate:   fpRate,
			AvgResolutionHours:  avgRes,
		},
		CreatedAt: time.Now().UTC(),
	}, nil
}
