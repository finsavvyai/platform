package compliance

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// verifiedProvider returns evidence items marked as verified.
type verifiedProvider struct{ verified bool }

func (vp *verifiedProvider) Collect(
	_ context.Context, _ string, _ EvidenceType,
) ([]EvidenceItem, error) {
	return []EvidenceItem{
		{Data: "evidence-data", Source: "test", Verified: vp.verified},
	}, nil
}

// emptyProvider returns no evidence.
type emptyProvider struct{}

func (ep *emptyProvider) Collect(
	_ context.Context, _ string, _ EvidenceType,
) ([]EvidenceItem, error) {
	return nil, nil
}

func newTestGenerator(prov EvidenceProvider) *ReportGenerator {
	registry := NewInMemoryControlRegistry()
	collector := NewEvidenceCollector()
	collector.RegisterProvider(AuditLog, prov)
	collector.RegisterProvider(RBACConfig, prov)
	collector.RegisterProvider(EncryptionConf, prov)
	collector.RegisterProvider(CICDLog, prov)
	collector.RegisterProvider(MonitoringAlert, prov)
	collector.RegisterProvider(ManualUpload, prov)
	return NewReportGenerator(registry, collector)
}

func TestGenerateReport_SOC2Framework(t *testing.T) {
	gen := newTestGenerator(&verifiedProvider{verified: true})
	report, err := gen.GenerateReport(context.Background(), "tenant-1", SOC2)
	require.NoError(t, err)
	assert.Equal(t, SOC2, report.Framework)
	assert.Equal(t, "tenant-1", report.TenantID)
	assert.NotEmpty(t, report.ID)
	assert.False(t, report.GeneratedAt.IsZero())
	assert.Greater(t, len(report.Controls), 0)
}

func TestGenerateReport_AllVerified_HighScore(t *testing.T) {
	gen := newTestGenerator(&verifiedProvider{verified: true})
	report, err := gen.GenerateReport(context.Background(), "t1", SOC2)
	require.NoError(t, err)
	assert.Equal(t, float64(100), report.Score)
	assert.Equal(t, report.TotalControls, report.CompliantControls)
	assert.Empty(t, report.Gaps)
}

func TestGenerateReport_NoEvidence_AllPending(t *testing.T) {
	gen := newTestGenerator(&emptyProvider{})
	report, err := gen.GenerateReport(context.Background(), "t1", SOC2)
	require.NoError(t, err)
	assert.Equal(t, float64(0), report.Score)
	assert.Equal(t, 0, report.CompliantControls)
	for _, ctrl := range report.Controls {
		assert.Equal(t, PendingReview, ctrl.Status)
	}
}

func TestGenerateReport_MixedEvidence_PartialControls(t *testing.T) {
	gen := newTestGenerator(&verifiedProvider{verified: false})
	report, err := gen.GenerateReport(context.Background(), "t1", PCI_DSS)
	require.NoError(t, err)
	assert.Equal(t, float64(0), report.Score)
	for _, ctrl := range report.Controls {
		assert.Equal(t, Partial, ctrl.Status)
	}
	assert.Equal(t, report.TotalControls, len(report.Gaps))
}

func TestGenerateReport_UnknownFramework_Error(t *testing.T) {
	gen := newTestGenerator(&verifiedProvider{verified: true})
	_, err := gen.GenerateReport(
		context.Background(), "t1", ComplianceFramework("UNKNOWN"),
	)
	require.Error(t, err)
	assert.ErrorIs(t, err, ErrFrameworkNotFound)
}

func TestGenerateDashboardStats_AggregatesFrameworks(t *testing.T) {
	gen := newTestGenerator(&verifiedProvider{verified: true})
	stats, err := gen.GenerateDashboardStats(context.Background(), "t1")
	require.NoError(t, err)
	assert.GreaterOrEqual(t, len(stats.Frameworks), 2)
	// Registry has 9 SOC2 + 8 PCI DSS = 17 controls total.
	assert.Equal(t, 17, stats.TotalControls)
	assert.Equal(t, 17, stats.CompliantControls)
	assert.Equal(t, 0, stats.NonCompliantControls)
	assert.Equal(t, float64(100), stats.OverallScore)
}

func TestGenerateDashboardStats_NoEvidence(t *testing.T) {
	gen := newTestGenerator(&emptyProvider{})
	stats, err := gen.GenerateDashboardStats(context.Background(), "t1")
	require.NoError(t, err)
	assert.Equal(t, float64(0), stats.OverallScore)
	assert.Equal(t, 0, stats.CompliantControls)
	assert.Equal(t, stats.TotalControls, stats.NonCompliantControls)
}

func TestAssessControlStatus_AllVerified(t *testing.T) {
	def := ControlDefinition{}
	evidence := []EvidenceItem{
		{Verified: true}, {Verified: true},
	}
	assert.Equal(t, Compliant, assessControlStatus(def, evidence))
}

func TestAssessControlStatus_SomeUnverified(t *testing.T) {
	def := ControlDefinition{}
	evidence := []EvidenceItem{
		{Verified: true}, {Verified: false},
	}
	assert.Equal(t, Partial, assessControlStatus(def, evidence))
}

func TestAssessControlStatus_NoEvidence(t *testing.T) {
	def := ControlDefinition{}
	assert.Equal(t, PendingReview, assessControlStatus(def, nil))
}

func TestAssessControlStatus_SingleVerified(t *testing.T) {
	def := ControlDefinition{}
	evidence := []EvidenceItem{{Verified: true}}
	assert.Equal(t, Compliant, assessControlStatus(def, evidence))
}

func TestBuildFrameworkScore_Calculation(t *testing.T) {
	report := &ComplianceReport{
		Framework:         SOC2,
		Score:             75.0,
		TotalControls:     4,
		CompliantControls: 3,
	}
	score := buildFrameworkScore(report)
	assert.Equal(t, SOC2, score.Framework)
	assert.Equal(t, 75.0, score.Score)
	assert.Equal(t, 4, score.TotalControls)
	assert.Equal(t, 3, score.CompliantControls)
	assert.Equal(t, float64(0), score.Trend)
}

func TestBuildFrameworkScore_ZeroReport(t *testing.T) {
	report := &ComplianceReport{Framework: PCI_DSS}
	score := buildFrameworkScore(report)
	assert.Equal(t, PCI_DSS, score.Framework)
	assert.Equal(t, float64(0), score.Score)
	assert.Equal(t, 0, score.TotalControls)
}

func TestGenerateReport_SetsLastAssessedAt(t *testing.T) {
	gen := newTestGenerator(&verifiedProvider{verified: true})
	report, err := gen.GenerateReport(context.Background(), "t1", SOC2)
	require.NoError(t, err)
	for _, ctrl := range report.Controls {
		require.NotNil(t, ctrl.LastAssessedAt)
		assert.False(t, ctrl.LastAssessedAt.IsZero())
	}
}

func TestGenerateReport_ControlsHaveEvidence(t *testing.T) {
	gen := newTestGenerator(&verifiedProvider{verified: true})
	report, err := gen.GenerateReport(context.Background(), "t1", PCI_DSS)
	require.NoError(t, err)
	for _, ctrl := range report.Controls {
		assert.Greater(t, len(ctrl.Evidence), 0)
	}
}
