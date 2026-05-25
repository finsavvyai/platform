package onboarding

import (
	"errors"
	"regexp"
	"time"
)

// OnboardingStep represents a step in the onboarding workflow.
type OnboardingStep string

const (
	StepOrgSetup         OnboardingStep = "ORG_SETUP"
	StepTenantConfig     OnboardingStep = "TENANT_CONFIG"
	StepAPIKeys          OnboardingStep = "API_KEYS"
	StepSandbox          OnboardingStep = "SANDBOX"
	StepIntegrationCheck OnboardingStep = "INTEGRATION_CHECK"
)

// OnboardingStatus represents the current status of an onboarding session.
type OnboardingStatus string

const (
	StatusInProgress OnboardingStatus = "IN_PROGRESS"
	StatusCompleted  OnboardingStatus = "COMPLETED"
	StatusExpired    OnboardingStatus = "EXPIRED"
	StatusAbandoned  OnboardingStatus = "ABANDONED"
)

// OnboardingSession tracks a single onboarding workflow instance.
type OnboardingSession struct {
	ID          string           `json:"id"`
	OrgName     string           `json:"org_name"`
	AdminEmail  string           `json:"admin_email"`
	CurrentStep OnboardingStep   `json:"current_step"`
	Status      OnboardingStatus `json:"status"`
	TenantID    string           `json:"tenant_id"`
	CreatedAt   time.Time        `json:"created_at"`
	UpdatedAt   time.Time        `json:"updated_at"`
	CompletedAt *time.Time       `json:"completed_at,omitempty"`
	ExpiresAt   time.Time        `json:"expires_at"`
}

// SandboxConfig holds configuration for a tenant sandbox environment.
type SandboxConfig struct {
	TenantID            string    `json:"tenant_id"`
	APIEndpoint         string    `json:"api_endpoint"`
	APIKey              string    `json:"api_key"`
	ExpiresAt           time.Time `json:"expires_at"`
	SyntheticDataLoaded bool      `json:"synthetic_data_loaded"`
	TransactionCount    int       `json:"transaction_count"`
}

// ChecklistItem represents a single verification item in the checklist.
type ChecklistItem struct {
	Name        string     `json:"name"`
	Description string     `json:"description"`
	Required    bool       `json:"required"`
	Completed   bool       `json:"completed"`
	VerifiedAt  *time.Time `json:"verified_at,omitempty"`
}

// IntegrationChecklist tracks integration verification progress.
type IntegrationChecklist struct {
	SessionID        string          `json:"session_id"`
	Items            []ChecklistItem `json:"items"`
	CompletionPercent float64        `json:"completion_percent"`
}

// OnboardingAnalytics aggregates onboarding metrics.
type OnboardingAnalytics struct {
	TotalSessions        int                       `json:"total_sessions"`
	CompletedSessions    int                       `json:"completed_sessions"`
	AbandonedSessions    int                       `json:"abandoned_sessions"`
	AvgCompletionMinutes float64                   `json:"avg_completion_minutes"`
	DropOffByStep        map[OnboardingStep]int    `json:"drop_off_by_step"`
}

// Validation errors returned by ValidateOnboardingSession.
var (
	ErrMissingOrgName    = errors.New("org_name is required")
	ErrMissingAdminEmail = errors.New("admin_email is required")
	ErrInvalidEmail      = errors.New("admin_email is not a valid email address")
	ErrMissingID         = errors.New("id is required")
)

// emailRegex is a basic email format check.
var emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)

// ValidateOnboardingSession checks that required fields are populated.
func ValidateOnboardingSession(s OnboardingSession) error {
	if s.ID == "" {
		return ErrMissingID
	}
	if s.OrgName == "" {
		return ErrMissingOrgName
	}
	if s.AdminEmail == "" {
		return ErrMissingAdminEmail
	}
	if !emailRegex.MatchString(s.AdminEmail) {
		return ErrInvalidEmail
	}
	return nil
}

// StepOrder returns the onboarding steps in their correct sequence.
func StepOrder() []OnboardingStep {
	return []OnboardingStep{
		StepOrgSetup,
		StepTenantConfig,
		StepAPIKeys,
		StepSandbox,
		StepIntegrationCheck,
	}
}

// stepIndex returns the position of a step in the sequence, or -1.
func stepIndex(step OnboardingStep) int {
	for i, s := range StepOrder() {
		if s == step {
			return i
		}
	}
	return -1
}

// CanAdvanceTo returns true if the session can move to the given step.
// Advancement is allowed only to the immediate next step.
func (s *OnboardingSession) CanAdvanceTo(step OnboardingStep) bool {
	currentIdx := stepIndex(s.CurrentStep)
	targetIdx := stepIndex(step)
	if currentIdx < 0 || targetIdx < 0 {
		return false
	}
	return targetIdx == currentIdx+1
}

// DefaultIntegrationChecklist creates a checklist with 5 standard items.
func DefaultIntegrationChecklist(sessionID string) IntegrationChecklist {
	return IntegrationChecklist{
		SessionID: sessionID,
		Items: []ChecklistItem{
			{Name: "API Authentication", Description: "Verify API key authentication works end-to-end", Required: true},
			{Name: "Webhook Endpoint", Description: "Configure and verify webhook delivery", Required: true},
			{Name: "Transaction Submission", Description: "Submit a test transaction via the API", Required: true},
			{Name: "Fraud Score Retrieval", Description: "Retrieve a fraud score for a test transaction", Required: false},
			{Name: "Alert Configuration", Description: "Set up alert rules and notification channels", Required: false},
		},
		CompletionPercent: 0,
	}
}

// UpdateCompletion recalculates CompletionPercent based on completed items.
func (c *IntegrationChecklist) UpdateCompletion() {
	if len(c.Items) == 0 {
		c.CompletionPercent = 0
		return
	}
	completed := 0
	for _, item := range c.Items {
		if item.Completed {
			completed++
		}
	}
	c.CompletionPercent = float64(completed) / float64(len(c.Items)) * 100
}

// AllRequiredComplete returns true when every required item is completed.
func (c *IntegrationChecklist) AllRequiredComplete() bool {
	for _, item := range c.Items {
		if item.Required && !item.Completed {
			return false
		}
	}
	return true
}
