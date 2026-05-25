package domain

import (
	"fmt"
	"time"
)

// ComplianceReportType categorizes the export.
type ComplianceReportType string

const (
	ReportSAR    ComplianceReportType = "sar"
	ReportSTR    ComplianceReportType = "str"
	ReportCTR    ComplianceReportType = "ctr"
	ReportAudit  ComplianceReportType = "audit"
	ReportCustom ComplianceReportType = "custom"
)

// ComplianceReport is a generated regulatory filing or summary.
type ComplianceReport struct {
	ID         string
	TenantID   TenantID
	Type       ComplianceReportType
	PeriodFrom time.Time
	PeriodTo   time.Time
	Summary    ReportSummary
	CreatedAt  time.Time
}

// ReportSummary holds aggregate counts for the report period.
type ReportSummary struct {
	TotalScreenings   int `json:"total_screenings"`
	TotalAlerts       int `json:"total_alerts"`
	CasesOpened       int `json:"cases_opened"`
	CasesResolved     int `json:"cases_resolved"`
	HighRiskEntities  int `json:"high_risk_entities"`
	SARFiled          int `json:"sar_filed"`
	MonitoringActions int `json:"monitoring_actions"`
}

func NewComplianceReport(
	tenantID TenantID, rptType ComplianceReportType,
	from, to time.Time, summary ReportSummary,
) (ComplianceReport, error) {
	if tenantID.IsZero() {
		return ComplianceReport{}, fmt.Errorf("tenant required")
	}
	if to.Before(from) {
		return ComplianceReport{}, fmt.Errorf("period_to before period_from")
	}
	return ComplianceReport{
		ID:       fmt.Sprintf("rpt_%d", time.Now().UnixNano()),
		TenantID: tenantID, Type: rptType,
		PeriodFrom: from, PeriodTo: to,
		Summary: summary, CreatedAt: time.Now().UTC(),
	}, nil
}
