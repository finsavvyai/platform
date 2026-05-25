package compliance

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"quantumbeam/internal/logger"
)

func AuditSensitiveComplianceActions() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()
		if c.Writer.Status() >= http.StatusBadRequest {
			return
		}
		if c.Request.Method == http.MethodPost || c.Request.Method == http.MethodPut || c.Request.Method == http.MethodPatch || c.Request.Method == http.MethodDelete {
			userID, _ := c.Get("user_id")
			userIDValue, _ := userID.(string)
			logger.NewAuditLogger(nil, nil).LogAuthSuccess(
				userIDValue,
				c.ClientIP(),
				c.FullPath(),
				c.GetHeader("X-Request-ID"),
			)
		}
	}
}

