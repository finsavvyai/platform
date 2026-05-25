package onboarding

import "github.com/gin-gonic/gin"

// RegisterRoutes mounts all onboarding endpoints onto the given router group.
// The group is expected to be mounted at /onboarding (or similar prefix).
//
// Routes registered:
//   - POST   /start              -> StartOnboarding (public, no auth)
//   - GET    /:id                -> GetSession
//   - POST   /:id/step/:step     -> CompleteStep
//   - POST   /:id/sandbox        -> ProvisionSandbox
//   - GET    /:id/checklist      -> GetChecklist
//   - POST   /:id/checklist/:item -> CompleteChecklistItem
//   - GET    /analytics           -> GetAnalytics
func RegisterRoutes(router *gin.RouterGroup, handler *OnboardingHandler) {
	router.POST("/start", handler.StartOnboarding)
	router.GET("/analytics", handler.GetAnalytics)
	router.GET("/:id", handler.GetSession)
	router.POST("/:id/step/:step", handler.CompleteStep)
	router.POST("/:id/sandbox", handler.ProvisionSandbox)
	router.GET("/:id/checklist", handler.GetChecklist)
	router.POST("/:id/checklist/:item", handler.CompleteChecklistItem)
}
