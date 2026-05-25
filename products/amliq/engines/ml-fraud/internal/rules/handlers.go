package rules

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"quantumbeam/internal/models"
)

// Handler provides HTTP endpoints for rule management.
type Handler struct {
	repo   RuleRepository
	engine *Engine
}

// NewHandler creates a rule management handler.
func NewHandler(repo RuleRepository, engine *Engine) *Handler {
	return &Handler{repo: repo, engine: engine}
}

// CreateRule handles POST /api/v1/rules.
func (h *Handler) CreateRule(c *gin.Context) {
	tenantID := extractTenantID(c)
	if tenantID == "" {
		sendRuleError(c, http.StatusForbidden, "MISSING_TENANT", "tenant ID required")
		return
	}

	var rule Rule
	if err := c.ShouldBindJSON(&rule); err != nil {
		sendRuleError(c, http.StatusBadRequest, "INVALID_JSON", err.Error())
		return
	}
	rule.TenantID = tenantID // enforce tenant from JWT

	if err := rule.Validate(); err != nil {
		sendRuleError(c, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
		return
	}

	if err := h.repo.Create(c.Request.Context(), &rule); err != nil {
		sendRuleError(c, http.StatusConflict, "CREATE_FAILED", err.Error())
		return
	}
	c.JSON(http.StatusCreated, gin.H{"rule": rule})
}

// ListRules handles GET /api/v1/rules.
func (h *Handler) ListRules(c *gin.Context) {
	tenantID := extractTenantID(c)
	if tenantID == "" {
		sendRuleError(c, http.StatusForbidden, "MISSING_TENANT", "tenant ID required")
		return
	}

	filter := parseListFilter(c)
	rules, err := h.repo.List(c.Request.Context(), tenantID, filter)
	if err != nil {
		sendRuleError(c, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"rules": rules, "count": len(rules)})
}

// GetRule handles GET /api/v1/rules/:id.
func (h *Handler) GetRule(c *gin.Context) {
	tenantID := extractTenantID(c)
	if tenantID == "" {
		sendRuleError(c, http.StatusForbidden, "MISSING_TENANT", "tenant ID required")
		return
	}

	rule, err := h.repo.Get(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		sendRuleError(c, http.StatusNotFound, "NOT_FOUND", err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"rule": rule})
}

// UpdateRule handles PUT /api/v1/rules/:id.
func (h *Handler) UpdateRule(c *gin.Context) {
	tenantID := extractTenantID(c)
	if tenantID == "" {
		sendRuleError(c, http.StatusForbidden, "MISSING_TENANT", "tenant ID required")
		return
	}

	var rule Rule
	if err := c.ShouldBindJSON(&rule); err != nil {
		sendRuleError(c, http.StatusBadRequest, "INVALID_JSON", err.Error())
		return
	}
	rule.ID = c.Param("id")
	rule.TenantID = tenantID

	if err := rule.Validate(); err != nil {
		sendRuleError(c, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
		return
	}

	if err := h.repo.Update(c.Request.Context(), &rule); err != nil {
		sendRuleError(c, http.StatusNotFound, "UPDATE_FAILED", err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"rule": rule})
}

// DeleteRule handles DELETE /api/v1/rules/:id.
func (h *Handler) DeleteRule(c *gin.Context) {
	tenantID := extractTenantID(c)
	if tenantID == "" {
		sendRuleError(c, http.StatusForbidden, "MISSING_TENANT", "tenant ID required")
		return
	}

	if err := h.repo.Delete(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		sendRuleError(c, http.StatusNotFound, "DELETE_FAILED", err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "rule deleted"})
}

// ToggleRule handles PATCH /api/v1/rules/:id/toggle.
func (h *Handler) ToggleRule(c *gin.Context) {
	tenantID := extractTenantID(c)
	if tenantID == "" {
		sendRuleError(c, http.StatusForbidden, "MISSING_TENANT", "tenant ID required")
		return
	}

	var body struct {
		Enabled bool `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		sendRuleError(c, http.StatusBadRequest, "INVALID_JSON", err.Error())
		return
	}

	err := h.repo.SetEnabled(c.Request.Context(), tenantID, c.Param("id"), body.Enabled)
	if err != nil {
		sendRuleError(c, http.StatusNotFound, "TOGGLE_FAILED", err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("rule enabled=%v", body.Enabled)})
}

// TestRule handles POST /api/v1/rules/test (dry-run).
func (h *Handler) TestRule(c *gin.Context) {
	tenantID := extractTenantID(c)
	if tenantID == "" {
		sendRuleError(c, http.StatusForbidden, "MISSING_TENANT", "tenant ID required")
		return
	}

	var req TestRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		sendRuleError(c, http.StatusBadRequest, "INVALID_JSON", err.Error())
		return
	}

	req.Rule.TenantID = tenantID
	if err := req.Rule.Validate(); err != nil {
		sendRuleError(c, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
		return
	}

	req.Rule.Enabled = true
	result := h.engine.EvaluateRules([]*Rule{&req.Rule}, &req.Transaction)
	c.JSON(http.StatusOK, gin.H{"result": result})
}

// TestRuleRequest is the body for the dry-run test endpoint.
type TestRuleRequest struct {
	Rule        Rule                   `json:"rule"`
	Transaction models.TransactionData `json:"transaction"`
}

// --- helpers ---

// extractTenantID reads the tenant (user_id) from the Gin context.
// The auth middleware sets "user_id" from JWT claims.
func extractTenantID(c *gin.Context) string {
	v, exists := c.Get("user_id")
	if !exists {
		return ""
	}
	s, _ := v.(string)
	return s
}

func sendRuleError(c *gin.Context, status int, code, message string) {
	c.JSON(status, gin.H{
		"error_code": code,
		"message":    message,
		"timestamp":  time.Now(),
	})
}
