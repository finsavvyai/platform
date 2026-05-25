package compliance

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// ReportGenerator builds compliance reports by combining registry
// definitions with collected evidence.
type ReportGenerator struct {
	registry  ControlRegistry
	collector *EvidenceCollector
}

// NewReportGenerator returns a generator wired to the given registry
// and evidence collector.
func NewReportGenerator(
	registry ControlRegistry,
	collector *EvidenceCollector,
) *ReportGenerator {
	return &ReportGenerator{
		registry:  registry,
		collector: collector,
	}
}

// GenerateReport creates a ComplianceReport for a single framework.
// It fetches controls from the registry, collects evidence for each,
// and determines the status of every control.
func (rg *ReportGenerator) GenerateReport(
	ctx context.Context,
	tenantID string,
	framework ComplianceFramework,
) (*ComplianceReport, error) {
	defs, err := rg.registry.GetControls(framework)
	if err != nil {
		return nil, fmt.Errorf("get controls: %w", err)
	}

	controls := make([]Control, 0, len(defs))
	now := time.Now()

	for _, def := range defs {
		evidence, err := rg.collectForControl(ctx, tenantID, def)
		if err != nil {
			return nil, fmt.Errorf("collect evidence for %s: %w", def.Control.ID, err)
		}

		status := assessControlStatus(def, evidence)
		ctrl := def.Control
		ctrl.Status = status
		ctrl.Evidence = evidence
		ctrl.LastAssessedAt = &now
		controls = append(controls, ctrl)
	}

	report := &ComplianceReport{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		Framework:   framework,
		GeneratedAt: now,
		Controls:    controls,
	}
	report.CalculateScore()
	report.FindGaps()
	return report, nil
}

// collectForControl gathers evidence for a single control definition
// by extracting its required evidence types.
func (rg *ReportGenerator) collectForControl(
	ctx context.Context,
	tenantID string,
	def ControlDefinition,
) ([]EvidenceItem, error) {
	types := make([]EvidenceType, 0, len(def.EvidenceSources))
	for _, src := range def.EvidenceSources {
		types = append(types, src.Type)
	}
	return rg.collector.CollectEvidence(ctx, tenantID, def.Control.ID, types)
}

// GenerateDashboardStats builds aggregate statistics across every
// framework known to the registry.
func (rg *ReportGenerator) GenerateDashboardStats(
	ctx context.Context,
	tenantID string,
) (*ComplianceDashboardStats, error) {
	frameworks := rg.registry.ListFrameworks()
	stats := &ComplianceDashboardStats{}

	for _, fw := range frameworks {
		report, err := rg.GenerateReport(ctx, tenantID, fw)
		if err != nil {
			return nil, fmt.Errorf("generate report for %s: %w", fw, err)
		}
		score := buildFrameworkScore(report)
		stats.Frameworks = append(stats.Frameworks, score)
		stats.TotalControls += report.TotalControls
		stats.CompliantControls += report.CompliantControls
	}

	stats.NonCompliantControls = stats.TotalControls - stats.CompliantControls
	if stats.TotalControls > 0 {
		stats.OverallScore = float64(stats.CompliantControls) /
			float64(stats.TotalControls) * 100
	}
	return stats, nil
}

// assessControlStatus determines the compliance status of a control
// based on the evidence collected for it.
func assessControlStatus(
	def ControlDefinition,
	evidence []EvidenceItem,
) ControlStatus {
	if len(evidence) == 0 {
		return PendingReview
	}
	allVerified := true
	for _, item := range evidence {
		if !item.Verified {
			allVerified = false
			break
		}
	}
	if allVerified {
		return Compliant
	}
	return Partial
}

// buildFrameworkScore converts a ComplianceReport into a FrameworkScore.
func buildFrameworkScore(report *ComplianceReport) FrameworkScore {
	return FrameworkScore{
		Framework:         report.Framework,
		Score:             report.Score,
		TotalControls:     report.TotalControls,
		CompliantControls: report.CompliantControls,
		Trend:             0,
	}
}
