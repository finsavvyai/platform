package audit

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

// allowedRoles lists roles permitted to access audit logs.
var allowedRoles = map[string]bool{
	"admin":      true,
	"compliance": true,
	"auditor":    true,
}

// Handler provides Gin HTTP handlers for the audit log query API.
type Handler struct {
	repo AuditRepository
}

// NewHandler creates an audit log handler backed by the given repository.
func NewHandler(repo AuditRepository) *Handler {
	return &Handler{repo: repo}
}

// ListEntries handles GET /api/v1/audit -- paginated, filtered listing.
func (h *Handler) ListEntries(c *gin.Context) {
	tenantID, role := extractClaims(c)
	if !allowedRoles[role] {
		sendError(c, http.StatusForbidden, "FORBIDDEN", "insufficient role for audit access")
		return
	}

	query, err := parseQuery(c, tenantID)
	if err != nil {
		sendError(c, http.StatusBadRequest, "INVALID_QUERY", err.Error())
		return
	}

	entries, nextCursor, err := h.repo.List(c.Request.Context(), *query)
	if err != nil {
		sendError(c, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"entries":     entries,
		"next_cursor": nextCursor,
		"count":       len(entries),
		"request_id":  c.GetString("request_id"),
		"timestamp":   time.Now().UTC().Format(time.RFC3339),
	})
}

// GetEntry handles GET /api/v1/audit/:id -- single entry detail.
func (h *Handler) GetEntry(c *gin.Context) {
	tenantID, role := extractClaims(c)
	if !allowedRoles[role] {
		sendError(c, http.StatusForbidden, "FORBIDDEN", "insufficient role for audit access")
		return
	}

	entry, err := h.repo.GetByID(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		sendError(c, http.StatusNotFound, "NOT_FOUND", err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"entry":      entry,
		"request_id": c.GetString("request_id"),
		"timestamp":  time.Now().UTC().Format(time.RFC3339),
	})
}

// GetStats handles GET /api/v1/audit/stats -- summary statistics.
func (h *Handler) GetStats(c *gin.Context) {
	tenantID, role := extractClaims(c)
	if !allowedRoles[role] {
		sendError(c, http.StatusForbidden, "FORBIDDEN", "insufficient role for audit access")
		return
	}

	filter := parseFilterParams(c)
	stats, err := h.repo.GetStats(c.Request.Context(), tenantID, filter)
	if err != nil {
		sendError(c, http.StatusInternalServerError, "STATS_FAILED", err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"stats":      stats,
		"request_id": c.GetString("request_id"),
		"timestamp":  time.Now().UTC().Format(time.RFC3339),
	})
}

// --- helpers ---

func extractClaims(c *gin.Context) (tenantID, role string) {
	if v, ok := c.Get("user_id"); ok {
		tenantID, _ = v.(string)
	}
	if v, ok := c.Get("user_role"); ok {
		role, _ = v.(string)
	}
	return
}

func parseQuery(c *gin.Context, tenantID string) (*AuditQuery, error) {
	q := AuditQuery{
		TenantID: tenantID,
		Cursor:   c.Query("cursor"),
		Filters:  parseFilterParams(c),
	}
	if v := c.Query("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			q.Limit = n
		}
	}
	if v := c.Query("sort_order"); v != "" {
		q.SortOrder = SortOrder(v)
	}
	if err := q.Validate(); err != nil {
		return nil, err
	}
	return &q, nil
}

func parseFilterParams(c *gin.Context) AuditFilter {
	f := AuditFilter{
		Actor:    c.Query("actor"),
		Action:   ActionType(c.Query("action")),
		Resource: c.Query("resource"),
		Keyword:  c.Query("q"),
	}
	if v := c.Query("from"); v != "" {
		if t, err := time.Parse(time.RFC3339, v); err == nil {
			f.From = &t
		}
	}
	if v := c.Query("to"); v != "" {
		if t, err := time.Parse(time.RFC3339, v); err == nil {
			f.To = &t
		}
	}
	return f
}

func sendError(c *gin.Context, status int, code, message string) {
	c.JSON(status, gin.H{
		"error_code": code,
		"message":    message,
		"request_id": c.GetString("request_id"),
		"timestamp":  time.Now().UTC().Format(time.RFC3339),
	})
}
