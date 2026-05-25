package compliance

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewInMemoryRegistry_InitializesControls(t *testing.T) {
	r := NewInMemoryControlRegistry()
	assert.NotNil(t, r)
	assert.Greater(t, len(r.controls), 0, "registry should have controls")
}

func TestListFrameworks_ReturnsSOC2AndPCIDSS(t *testing.T) {
	r := NewInMemoryControlRegistry()
	frameworks := r.ListFrameworks()
	assert.GreaterOrEqual(t, len(frameworks), 2)
	found := make(map[ComplianceFramework]bool)
	for _, fw := range frameworks {
		found[fw] = true
	}
	assert.True(t, found[SOC2], "should contain SOC2")
	assert.True(t, found[PCI_DSS], "should contain PCI_DSS")
}

func TestGetControls_SOC2_ReturnsExpectedCount(t *testing.T) {
	r := NewInMemoryControlRegistry()
	controls, err := r.GetControls(SOC2)
	require.NoError(t, err)
	assert.Len(t, controls, 9, "SOC2 should have 9 controls")
}

func TestGetControls_PCIDSS_ReturnsExpectedCount(t *testing.T) {
	r := NewInMemoryControlRegistry()
	controls, err := r.GetControls(PCI_DSS)
	require.NoError(t, err)
	assert.Len(t, controls, 8, "PCI DSS should have 8 controls")
}

func TestGetControls_UnknownFramework_ReturnsError(t *testing.T) {
	r := NewInMemoryControlRegistry()
	_, err := r.GetControls(ComplianceFramework("UNKNOWN"))
	assert.ErrorIs(t, err, ErrFrameworkNotFound)
}

func TestGetControl_ByID_ReturnsControl(t *testing.T) {
	r := NewInMemoryControlRegistry()

	tests := []struct {
		id        string
		framework ComplianceFramework
	}{
		{"CC1.1", SOC2},
		{"CC7.2", SOC2},
		{"PCI-1.1", PCI_DSS},
		{"PCI-10.1", PCI_DSS},
	}
	for _, tc := range tests {
		t.Run(tc.id, func(t *testing.T) {
			def, err := r.GetControl(tc.id)
			require.NoError(t, err)
			assert.Equal(t, tc.id, def.Control.ID)
			assert.Equal(t, tc.framework, def.Control.Framework)
		})
	}
}

func TestGetControl_UnknownID_ReturnsError(t *testing.T) {
	r := NewInMemoryControlRegistry()
	_, err := r.GetControl("NONEXISTENT-99")
	assert.ErrorIs(t, err, ErrControlNotFound)
}

func TestAllControls_HaveAtLeastOneEvidenceSource(t *testing.T) {
	r := NewInMemoryControlRegistry()
	for id, def := range r.controls {
		assert.NotEmpty(t, def.EvidenceSources,
			"control %s must have evidence sources", id)
	}
}

func TestAllControls_ConfidenceInRange(t *testing.T) {
	r := NewInMemoryControlRegistry()
	for id, def := range r.controls {
		assert.GreaterOrEqual(t, def.Confidence, 0.0,
			"control %s confidence must be >= 0", id)
		assert.LessOrEqual(t, def.Confidence, 1.0,
			"control %s confidence must be <= 1", id)
	}
}

func TestGetControl_ReturnsCopy(t *testing.T) {
	r := NewInMemoryControlRegistry()
	def1, err := r.GetControl("CC1.1")
	require.NoError(t, err)
	def1.Confidence = 0.0
	def2, err := r.GetControl("CC1.1")
	require.NoError(t, err)
	assert.NotEqual(t, 0.0, def2.Confidence,
		"GetControl should return a copy, not a reference")
}

func TestControlRegistry_InterfaceCompliance(t *testing.T) {
	var _ ControlRegistry = NewInMemoryControlRegistry()
}

func TestAllControls_HaveRequiredFields(t *testing.T) {
	r := NewInMemoryControlRegistry()
	for id, def := range r.controls {
		assert.NotEmpty(t, def.Control.ID, "control %s ID", id)
		assert.NotEmpty(t, def.Control.Framework, "control %s framework", id)
		assert.NotEmpty(t, def.Control.Title, "control %s title", id)
		assert.NotEmpty(t, def.Control.Description, "control %s description", id)
		assert.NotEmpty(t, def.Control.Category, "control %s category", id)
		assert.Equal(t, PendingReview, def.Control.Status,
			"control %s should default to PendingReview", id)
	}
}
