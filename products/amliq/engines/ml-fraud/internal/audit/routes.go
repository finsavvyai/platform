package audit

import (
	"github.com/gin-gonic/gin"
	"quantumbeam/internal/fraud"
)

// RegisterRoutes mounts audit log query endpoints onto the router group.
// The caller is responsible for applying JWT auth middleware on the
// parent group before calling this function.
//
// Endpoints registered:
//
//	GET /           -> ListEntries  (paginated, filtered)
//	GET /stats      -> GetStats     (summary statistics)
//	GET /:id        -> GetEntry     (single entry detail)
//
// Rate limits: 30 rpm for list/stats, 60 rpm for single entry.
func RegisterRoutes(group *gin.RouterGroup, handler *Handler) {
	group.Use(fraud.RequestIDMiddleware())

	// List and stats share a tighter rate limit (30 rpm)
	listing := group.Group("")
	listing.Use(fraud.RateLimitMiddleware(30))
	listing.GET("", handler.ListEntries)
	listing.GET("/stats", handler.GetStats)

	// Single entry has a higher limit (60 rpm)
	detail := group.Group("")
	detail.Use(fraud.RateLimitMiddleware(60))
	detail.GET("/:id", handler.GetEntry)
}
