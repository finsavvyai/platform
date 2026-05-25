package onboarding

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func validSession() OnboardingSession {
	return OnboardingSession{
		ID:          uuid.New().String(),
		OrgName:     "Acme Corp",
		AdminEmail:  "admin@acme.com",
		CurrentStep: StepOrgSetup,
		Status:      StatusInProgress,
		TenantID:    uuid.New().String(),
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
		ExpiresAt:   time.Now().Add(24 * time.Hour),
	}
}

func TestOnboardingStepEnumValues(t *testing.T) {
	assert.Equal(t, OnboardingStep("ORG_SETUP"), StepOrgSetup)
	assert.Equal(t, OnboardingStep("TENANT_CONFIG"), StepTenantConfig)
	assert.Equal(t, OnboardingStep("API_KEYS"), StepAPIKeys)
	assert.Equal(t, OnboardingStep("SANDBOX"), StepSandbox)
	assert.Equal(t, OnboardingStep("INTEGRATION_CHECK"), StepIntegrationCheck)
}

func TestOnboardingStatusEnumValues(t *testing.T) {
	assert.Equal(t, OnboardingStatus("IN_PROGRESS"), StatusInProgress)
	assert.Equal(t, OnboardingStatus("COMPLETED"), StatusCompleted)
	assert.Equal(t, OnboardingStatus("EXPIRED"), StatusExpired)
	assert.Equal(t, OnboardingStatus("ABANDONED"), StatusAbandoned)
}

func TestValidateOnboardingSession_Valid(t *testing.T) {
	err := ValidateOnboardingSession(validSession())
	require.NoError(t, err)
}

func TestValidateOnboardingSession_MissingOrgName(t *testing.T) {
	s := validSession()
	s.OrgName = ""
	err := ValidateOnboardingSession(s)
	assert.ErrorIs(t, err, ErrMissingOrgName)
}

func TestValidateOnboardingSession_MissingEmail(t *testing.T) {
	s := validSession()
	s.AdminEmail = ""
	err := ValidateOnboardingSession(s)
	assert.ErrorIs(t, err, ErrMissingAdminEmail)
}

func TestValidateOnboardingSession_MissingID(t *testing.T) {
	s := validSession()
	s.ID = ""
	err := ValidateOnboardingSession(s)
	assert.ErrorIs(t, err, ErrMissingID)
}

func TestValidateOnboardingSession_InvalidEmail(t *testing.T) {
	s := validSession()
	s.AdminEmail = "not-an-email"
	err := ValidateOnboardingSession(s)
	assert.ErrorIs(t, err, ErrInvalidEmail)
}

func TestStepOrder_ReturnsCorrectSequence(t *testing.T) {
	expected := []OnboardingStep{
		StepOrgSetup,
		StepTenantConfig,
		StepAPIKeys,
		StepSandbox,
		StepIntegrationCheck,
	}
	assert.Equal(t, expected, StepOrder())
}

func TestStepOrder_HasFiveSteps(t *testing.T) {
	assert.Len(t, StepOrder(), 5)
}

func TestCanAdvanceTo_ValidNextStep(t *testing.T) {
	s := validSession()
	s.CurrentStep = StepOrgSetup
	assert.True(t, s.CanAdvanceTo(StepTenantConfig))

	s.CurrentStep = StepSandbox
	assert.True(t, s.CanAdvanceTo(StepIntegrationCheck))
}

func TestCanAdvanceTo_SkipStep(t *testing.T) {
	s := validSession()
	s.CurrentStep = StepOrgSetup
	assert.False(t, s.CanAdvanceTo(StepAPIKeys))
}

func TestCanAdvanceTo_Backwards(t *testing.T) {
	s := validSession()
	s.CurrentStep = StepSandbox
	assert.False(t, s.CanAdvanceTo(StepOrgSetup))
}

func TestCanAdvanceTo_SameStep(t *testing.T) {
	s := validSession()
	s.CurrentStep = StepAPIKeys
	assert.False(t, s.CanAdvanceTo(StepAPIKeys))
}

func TestCanAdvanceTo_LastStepCannotAdvance(t *testing.T) {
	s := validSession()
	s.CurrentStep = StepIntegrationCheck
	assert.False(t, s.CanAdvanceTo(StepOrgSetup))
}

func TestDefaultIntegrationChecklist_HasFiveItems(t *testing.T) {
	cl := DefaultIntegrationChecklist("sess-1")
	assert.Len(t, cl.Items, 5)
	assert.Equal(t, "sess-1", cl.SessionID)
	assert.Equal(t, float64(0), cl.CompletionPercent)
}

func TestDefaultIntegrationChecklist_RequiredFlags(t *testing.T) {
	cl := DefaultIntegrationChecklist("sess-1")
	requiredCount := 0
	for _, item := range cl.Items {
		if item.Required {
			requiredCount++
		}
	}
	assert.Equal(t, 3, requiredCount, "3 of 5 items should be required")
}

func TestUpdateCompletion_AllComplete(t *testing.T) {
	cl := DefaultIntegrationChecklist("sess-1")
	for i := range cl.Items {
		cl.Items[i].Completed = true
	}
	cl.UpdateCompletion()
	assert.Equal(t, float64(100), cl.CompletionPercent)
}

func TestUpdateCompletion_Partial(t *testing.T) {
	cl := DefaultIntegrationChecklist("sess-1")
	cl.Items[0].Completed = true
	cl.Items[1].Completed = true
	cl.UpdateCompletion()
	assert.InDelta(t, 40.0, cl.CompletionPercent, 0.01)
}

func TestUpdateCompletion_NoneComplete(t *testing.T) {
	cl := DefaultIntegrationChecklist("sess-1")
	cl.UpdateCompletion()
	assert.Equal(t, float64(0), cl.CompletionPercent)
}

func TestUpdateCompletion_EmptyItems(t *testing.T) {
	cl := IntegrationChecklist{SessionID: "sess-1", Items: nil}
	cl.UpdateCompletion()
	assert.Equal(t, float64(0), cl.CompletionPercent)
}

func TestAllRequiredComplete_AllDone(t *testing.T) {
	cl := DefaultIntegrationChecklist("sess-1")
	for i := range cl.Items {
		if cl.Items[i].Required {
			cl.Items[i].Completed = true
		}
	}
	assert.True(t, cl.AllRequiredComplete())
}

func TestAllRequiredComplete_SomeMissing(t *testing.T) {
	cl := DefaultIntegrationChecklist("sess-1")
	cl.Items[0].Completed = true
	// leave other required items incomplete
	assert.False(t, cl.AllRequiredComplete())
}

func TestAllRequiredComplete_OnlyOptionalIncomplete(t *testing.T) {
	cl := DefaultIntegrationChecklist("sess-1")
	for i := range cl.Items {
		if cl.Items[i].Required {
			cl.Items[i].Completed = true
		}
	}
	// optional item stays incomplete -- should still return true
	assert.True(t, cl.AllRequiredComplete())
}

func TestAllRequiredComplete_EmptyChecklist(t *testing.T) {
	cl := IntegrationChecklist{SessionID: "sess-1", Items: nil}
	assert.True(t, cl.AllRequiredComplete())
}
