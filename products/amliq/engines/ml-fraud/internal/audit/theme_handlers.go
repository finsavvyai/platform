package audit

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// ThemeHandler provides Gin handlers for theme CRUD operations.
type ThemeHandler struct {
	repo ThemeRepository
}

// NewThemeHandler creates a theme handler backed by the given repository.
func NewThemeHandler(repo ThemeRepository) *ThemeHandler {
	return &ThemeHandler{repo: repo}
}

// CreateTheme handles POST /api/v1/themes
func (h *ThemeHandler) CreateTheme(c *gin.Context) {
	tenantID, role := extractClaims(c)
	if role != "admin" {
		sendError(c, http.StatusForbidden, "FORBIDDEN", "admin role required")
		return
	}

	var theme ThemeConfig
	if err := c.ShouldBindJSON(&theme); err != nil {
		sendError(c, http.StatusBadRequest, "INVALID_BODY", err.Error())
		return
	}
	theme.ID = uuid.New().String()
	theme.TenantID = tenantID

	// Validate contrast
	contrastResults := theme.Colors.ValidateContrast()
	for _, cr := range contrastResults {
		if !cr.Passes {
			sendError(c, http.StatusBadRequest, "CONTRAST_FAIL", cr.Pair+" fails WCAG AA (ratio: "+formatFloat(cr.Ratio)+")")
			return
		}
	}

	if err := h.repo.Create(c.Request.Context(), &theme); err != nil {
		sendError(c, http.StatusBadRequest, "CREATE_FAILED", err.Error())
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"theme":      theme,
		"request_id": c.GetString("request_id"),
		"timestamp":  time.Now().UTC().Format(time.RFC3339),
	})
}

// ListThemes handles GET /api/v1/themes
func (h *ThemeHandler) ListThemes(c *gin.Context) {
	tenantID, _ := extractClaims(c)
	themes, err := h.repo.GetByTenant(c.Request.Context(), tenantID)
	if err != nil {
		sendError(c, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"themes":     themes,
		"count":      len(themes),
		"request_id": c.GetString("request_id"),
		"timestamp":  time.Now().UTC().Format(time.RFC3339),
	})
}

// GetTheme handles GET /api/v1/themes/:id
func (h *ThemeHandler) GetTheme(c *gin.Context) {
	tenantID, _ := extractClaims(c)
	theme, err := h.repo.GetByID(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		sendError(c, http.StatusNotFound, "NOT_FOUND", err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"theme":      theme,
		"request_id": c.GetString("request_id"),
		"timestamp":  time.Now().UTC().Format(time.RFC3339),
	})
}

// UpdateTheme handles PUT /api/v1/themes/:id
func (h *ThemeHandler) UpdateTheme(c *gin.Context) {
	tenantID, role := extractClaims(c)
	if role != "admin" {
		sendError(c, http.StatusForbidden, "FORBIDDEN", "admin role required")
		return
	}

	var theme ThemeConfig
	if err := c.ShouldBindJSON(&theme); err != nil {
		sendError(c, http.StatusBadRequest, "INVALID_BODY", err.Error())
		return
	}
	theme.ID = c.Param("id")
	theme.TenantID = tenantID

	if err := h.repo.Update(c.Request.Context(), &theme); err != nil {
		sendError(c, http.StatusBadRequest, "UPDATE_FAILED", err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"theme":      theme,
		"request_id": c.GetString("request_id"),
		"timestamp":  time.Now().UTC().Format(time.RFC3339),
	})
}

// DeleteTheme handles DELETE /api/v1/themes/:id
func (h *ThemeHandler) DeleteTheme(c *gin.Context) {
	tenantID, role := extractClaims(c)
	if role != "admin" {
		sendError(c, http.StatusForbidden, "FORBIDDEN", "admin role required")
		return
	}
	if err := h.repo.Delete(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		status := http.StatusNotFound
		code := "NOT_FOUND"
		if err == ErrThemeDeleteActive {
			status = http.StatusConflict
			code = "DELETE_ACTIVE"
		}
		sendError(c, status, code, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"message":    "theme deleted",
		"request_id": c.GetString("request_id"),
		"timestamp":  time.Now().UTC().Format(time.RFC3339),
	})
}

// ActivateTheme handles POST /api/v1/themes/:id/activate
func (h *ThemeHandler) ActivateTheme(c *gin.Context) {
	tenantID, role := extractClaims(c)
	if role != "admin" {
		sendError(c, http.StatusForbidden, "FORBIDDEN", "admin role required")
		return
	}
	if err := h.repo.SetActive(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		sendError(c, http.StatusNotFound, "NOT_FOUND", err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"message":    "theme activated",
		"request_id": c.GetString("request_id"),
		"timestamp":  time.Now().UTC().Format(time.RFC3339),
	})
}

// PreviewTheme handles POST /api/v1/themes/preview
func (h *ThemeHandler) PreviewTheme(c *gin.Context) {
	var theme ThemeConfig
	if err := c.ShouldBindJSON(&theme); err != nil {
		sendError(c, http.StatusBadRequest, "INVALID_BODY", err.Error())
		return
	}
	contrastResults := theme.Colors.ValidateContrast()
	c.JSON(http.StatusOK, gin.H{
		"preview":          theme,
		"contrast_results": contrastResults,
		"request_id":       c.GetString("request_id"),
		"timestamp":        time.Now().UTC().Format(time.RFC3339),
	})
}

func formatFloat(f float64) string {
	return time.Duration(int64(f * 100)).String()[:4]
}
