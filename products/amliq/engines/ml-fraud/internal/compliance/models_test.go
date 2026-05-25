package compliance

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestComplianceFrameworkConstants(t *testing.T) {
	assert.Equal(t, ComplianceFramework("SOC2"), SOC2)
	assert.Equal(t, ComplianceFramework("PCI_DSS"), PCI_DSS)
	assert.Equal(t, ComplianceFramework("GDPR"), GDPR)
	assert.Equal(t, ComplianceFramework("HIPAA"), HIPAA)
}

func TestControlStatusConstants(t *testing.T) {
	assert.Equal(t, ControlStatus("COMPLIANT"), Compliant)
	assert.Equal(t, ControlStatus("NON_COMPLIANT"), NonCompliant)
	assert.Equal(t, ControlStatus("PARTIAL"), Partial)
	assert.Equal(t, ControlStatus("NOT_APPLICABLE"), NotApplicable)
	assert.Equal(t, ControlStatus("PENDING_REVIEW"), PendingReview)
}

func TestEvidenceTypeConstants(t *testing.T) {
	assert.Equal(t, EvidenceType("AUDIT_LOG"), AuditLog)
	assert.Equal(t, EvidenceType("RBAC_CONFIG"), RBACConfig)
	assert.Equal(t, EvidenceType("ENCRYPTION_CONFIG"), EncryptionConf)
	assert.Equal(t, EvidenceType("CI_CD_LOG"), CICDLog)
	assert.Equal(t, EvidenceType("MONITORING_ALERT"), MonitoringAlert)
	assert.Equal(t, EvidenceType("MANUAL_UPLOAD"), ManualUpload)
}

func TestValidateControl_Valid(t *testing.T) {
	now := time.Now()
	c := Control{
		ID:             "CTL-001",
		Framework:      SOC2,
		Category:       "Access Control",
		Title:          "MFA Enforcement",
		Description:    "Multi-factor authentication required",
		Status:         Compliant,
		LastAssessedAt: &now,
	}
	require.NoError(t, ValidateControl(c))
}

func TestValidateControl_MissingID(t *testing.T) {
	c := Control{Framework: SOC2, Title: "Test"}
	assert.ErrorIs(t, ValidateControl(c), ErrMissingControlID)
}

func TestValidateControl_MissingFramework(t *testing.T) {
	c := Control{ID: "CTL-001", Title: "Test"}
	assert.ErrorIs(t, ValidateControl(c), ErrMissingFramework)
}

func TestValidateControl_MissingTitle(t *testing.T) {
	c := Control{ID: "CTL-001", Framework: SOC2}
	assert.ErrorIs(t, ValidateControl(c), ErrMissingTitle)
}

func TestValidateControl_InvalidFramework(t *testing.T) {
	c := Control{ID: "CTL-001", Framework: "INVALID", Title: "Test"}
	assert.ErrorIs(t, ValidateControl(c), ErrInvalidFramework)
}

func TestValidateControl_InvalidStatus(t *testing.T) {
	c := Control{
		ID: "CTL-001", Framework: GDPR,
		Title: "Test", Status: "BAD_STATUS",
	}
	assert.ErrorIs(t, ValidateControl(c), ErrInvalidControlStatus)
}

func TestValidateControl_EmptyStatusAllowed(t *testing.T) {
	c := Control{ID: "CTL-001", Framework: PCI_DSS, Title: "Test"}
	require.NoError(t, ValidateControl(c))
}

func TestCalculateScore_Full(t *testing.T) {
	r := &ComplianceReport{
		Controls: []Control{
			{ID: "1", Status: Compliant},
			{ID: "2", Status: Compliant},
		},
	}
	r.CalculateScore()
	assert.Equal(t, 100.0, r.Score)
	assert.Equal(t, 2, r.TotalControls)
	assert.Equal(t, 2, r.CompliantControls)
}

func TestCalculateScore_Half(t *testing.T) {
	r := &ComplianceReport{
		Controls: []Control{
			{ID: "1", Status: Compliant},
			{ID: "2", Status: NonCompliant},
		},
	}
	r.CalculateScore()
	assert.Equal(t, 50.0, r.Score)
	assert.Equal(t, 1, r.CompliantControls)
}

func TestCalculateScore_Zero(t *testing.T) {
	r := &ComplianceReport{
		Controls: []Control{
			{ID: "1", Status: NonCompliant},
			{ID: "2", Status: Partial},
		},
	}
	r.CalculateScore()
	assert.Equal(t, 0.0, r.Score)
	assert.Equal(t, 0, r.CompliantControls)
}

func TestCalculateScore_Empty(t *testing.T) {
	r := &ComplianceReport{}
	r.CalculateScore()
	assert.Equal(t, 0.0, r.Score)
	assert.Equal(t, 0, r.TotalControls)
}

func TestFindGaps_NonCompliantAndPartial(t *testing.T) {
	r := &ComplianceReport{
		Controls: []Control{
			{ID: "1", Status: Compliant},
			{ID: "2", Status: NonCompliant},
			{ID: "3", Status: Partial},
			{ID: "4", Status: NotApplicable},
			{ID: "5", Status: PendingReview},
		},
	}
	r.FindGaps()
	require.Len(t, r.Gaps, 2)
	assert.Equal(t, "2", r.Gaps[0].ID)
	assert.Equal(t, "3", r.Gaps[1].ID)
}

func TestFindGaps_NoGaps(t *testing.T) {
	r := &ComplianceReport{
		Controls: []Control{
			{ID: "1", Status: Compliant},
			{ID: "2", Status: Compliant},
		},
	}
	r.FindGaps()
	assert.Empty(t, r.Gaps)
}

func TestFindGaps_Empty(t *testing.T) {
	r := &ComplianceReport{}
	r.FindGaps()
	assert.Nil(t, r.Gaps)
}

func TestFrameworkDisplayName(t *testing.T) {
	tests := []struct {
		framework ComplianceFramework
		expected  string
	}{
		{SOC2, "SOC 2"},
		{PCI_DSS, "PCI DSS"},
		{GDPR, "GDPR"},
		{HIPAA, "HIPAA"},
		{ComplianceFramework("UNKNOWN"), "UNKNOWN"},
	}
	for _, tt := range tests {
		t.Run(string(tt.framework), func(t *testing.T) {
			assert.Equal(t, tt.expected, FrameworkDisplayName(tt.framework))
		})
	}
}
