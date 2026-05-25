package audit

import (
	"github.com/gin-gonic/gin"
	"quantumbeam/internal/fraud"
)

// RegisterThemeRoutes mounts theme management endpoints onto the router group.
// RBAC: admin for write ops, any authenticated user for read/preview.
//
// Endpoints registered:
//
//	POST /         -> CreateTheme     (admin)
//	GET  /         -> ListThemes      (any role)
//	GET  /:id      -> GetTheme        (any role)
//	PUT  /:id      -> UpdateTheme     (admin)
//	DELETE /:id    -> DeleteTheme     (admin)
//	POST /:id/activate -> ActivateTheme (admin)
//	POST /preview  -> PreviewTheme    (any role)
//
// Rate limits: 60 rpm for write, 120 rpm for read.
func RegisterThemeRoutes(group *gin.RouterGroup, handler *ThemeHandler) {
	group.Use(fraud.RequestIDMiddleware())

	// Read endpoints (higher rate limit)
	read := group.Group("")
	read.Use(fraud.RateLimitMiddleware(120))
	read.GET("", handler.ListThemes)
	read.GET("/:id", handler.GetTheme)
	read.POST("/preview", handler.PreviewTheme)

	// Write endpoints (tighter rate limit)
	write := group.Group("")
	write.Use(fraud.RateLimitMiddleware(60))
	write.POST("", handler.CreateTheme)
	write.PUT("/:id", handler.UpdateTheme)
	write.DELETE("/:id", handler.DeleteTheme)
	write.POST("/:id/activate", handler.ActivateTheme)
}
