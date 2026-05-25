package rules

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"quantumbeam/internal/fraud"
)

// RegisterRoutes mounts rule management endpoints onto the router group.
// The caller is responsible for applying JWT auth + enterprise role middleware
// on the parent group before calling this function.
//
// Endpoints registered:
//
//	POST   /             -> CreateRule
//	GET    /             -> ListRules
//	GET    /:id          -> GetRule
//	PUT    /:id          -> UpdateRule
//	DELETE /:id          -> DeleteRule
//	PATCH  /:id/toggle   -> ToggleRule
//	POST   /test         -> TestRule (dry-run)
func RegisterRoutes(group *gin.RouterGroup, handler *Handler) {
	// Shared middleware for all rule endpoints
	group.Use(fraud.RequestIDMiddleware())
	group.Use(fraud.RateLimitMiddleware(60))
	group.Use(auditMutatingRuleActions())

	// Mutating endpoints require JSON body
	mutating := group.Group("")
	mutating.Use(fraud.JSONContentTypeAndBodyLimitMiddleware(1 << 20)) // 1 MiB

	mutating.POST("", handler.CreateRule)
	mutating.PUT("/:id", handler.UpdateRule)
	mutating.PATCH("/:id/toggle", handler.ToggleRule)
	mutating.POST("/test", handler.TestRule)

	// Read-only endpoints
	group.GET("", handler.ListRules)
	group.GET("/:id", handler.GetRule)
	group.DELETE("/:id", handler.DeleteRule)
}

// parseListFilter extracts filter/pagination from query parameters.
func parseListFilter(c *gin.Context) ListFilter {
	f := ListFilter{}

	if v := c.Query("enabled"); v != "" {
		b := v == "true"
		if b {
			f.EnabledOnly = &b
		} else {
			nb := true
			f.DisabledOnly = &nb
		}
	}
	if v := c.Query("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			f.Limit = n
		}
	}
	if v := c.Query("offset"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 0 {
			f.Offset = n
		}
	}
	return f
}
