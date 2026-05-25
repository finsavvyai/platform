package compliance

import "github.com/gin-gonic/gin"

// RegisterComplianceRoutes is a package-level convenience function that
// creates a ComplianceHandler from the given dependencies and wires all
// compliance endpoints onto the provided router group.
//
// Routes registered:
//   GET  /frameworks            -> ListFrameworks
//   GET  /controls              -> ListControls
//   GET  /controls/:id/evidence -> GetControlEvidence
//   POST /evidence/collect      -> CollectEvidence
//   GET  /report                -> GenerateReport
//   GET  /dashboard             -> GetDashboard
//   POST /controls/:id/override -> OverrideControlStatus
func RegisterComplianceRoutes(
	rg *gin.RouterGroup,
	registry ControlRegistry,
	generator *ReportGenerator,
) *ComplianceHandler {
	handler := NewComplianceHandler(registry, generator)
	rg.Use(AuditSensitiveComplianceActions())
	handler.RegisterRoutes(rg)
	return handler
}
