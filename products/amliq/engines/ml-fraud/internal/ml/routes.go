package ml

import "github.com/gin-gonic/gin"

// RegisterRoutes mounts all ML retraining endpoints onto the given
// router group. The group is typically prefixed with /api/v1/ml.
func RegisterRoutes(router *gin.RouterGroup, handler *RetrainingHandler) {
	router.GET("/drift/report", handler.GetDriftReport)
	router.POST("/retrain/trigger", handler.TriggerRetrain)
	router.GET("/retrain/jobs", handler.ListJobs)
	router.GET("/retrain/jobs/:job_id", handler.GetJobStatus)
	router.GET("/retrain/schedule", handler.GetSchedule)
	router.PUT("/retrain/schedule", handler.UpdateSchedule)
}
