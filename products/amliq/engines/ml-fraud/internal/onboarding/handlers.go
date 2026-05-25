package onboarding

import (
	"errors"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// StartOnboardingRequest is the JSON body for starting a new onboarding session.
type StartOnboardingRequest struct {
	OrgName    string `json:"org_name" binding:"required"`
	AdminEmail string `json:"admin_email" binding:"required,email"`
}

// OnboardingHandler exposes HTTP endpoints for the onboarding workflow.
type OnboardingHandler struct {
	repo    OnboardingRepository
	sandbox SandboxService
}

// NewOnboardingHandler creates a handler backed by the given dependencies.
func NewOnboardingHandler(
	repo OnboardingRepository, sandbox SandboxService,
) *OnboardingHandler {
	return &OnboardingHandler{repo: repo, sandbox: sandbox}
}

// StartOnboarding creates a new onboarding session (POST /onboarding).
func (h *OnboardingHandler) StartOnboarding(c *gin.Context) {
	var req StartOnboardingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	session := &OnboardingSession{
		ID:          uuid.New().String(),
		OrgName:     req.OrgName,
		AdminEmail:  req.AdminEmail,
		CurrentStep: StepOrgSetup,
		Status:      StatusInProgress,
		TenantID:    "tenant_" + uuid.New().String()[:8],
		ExpiresAt:   time.Now().AddDate(0, 0, 30),
	}

	if err := h.repo.Create(c.Request.Context(), session); err != nil {
		if errors.Is(err, ErrSessionAlreadyExists) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, session)
}

// GetSession returns an onboarding session by ID (GET /onboarding/:id).
func (h *OnboardingHandler) GetSession(c *gin.Context) {
	id := c.Param("id")
	session, err := h.repo.Get(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, ErrSessionNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, session)
}

// CompleteStep advances the session to the given step (POST /onboarding/:id/step/:step).
func (h *OnboardingHandler) CompleteStep(c *gin.Context) {
	id := c.Param("id")
	stepName := OnboardingStep(c.Param("step"))

	session, err := h.repo.Get(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, ErrSessionNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if !session.CanAdvanceTo(stepName) {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "cannot advance to step " + string(stepName),
		})
		return
	}

	session.CurrentStep = stepName
	if stepName == StepIntegrationCheck {
		now := time.Now().UTC()
		session.CompletedAt = &now
		session.Status = StatusCompleted
	}

	if err := h.repo.Update(c.Request.Context(), session); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, session)
}

// ProvisionSandbox provisions a sandbox for the session (POST /onboarding/:id/sandbox).
func (h *OnboardingHandler) ProvisionSandbox(c *gin.Context) {
	id := c.Param("id")
	session, err := h.repo.Get(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, ErrSessionNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	cfg, err := h.sandbox.Provision(c.Request.Context(), session.TenantID)
	if err != nil {
		if errors.Is(err, ErrSandboxAlreadyExists) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, cfg)
}

// GetAnalytics returns aggregated onboarding metrics (GET /onboarding/analytics).
func (h *OnboardingHandler) GetAnalytics(c *gin.Context) {
	analytics, err := h.repo.GetAnalytics(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, analytics)
}
