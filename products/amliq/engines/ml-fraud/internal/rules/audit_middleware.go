package rules

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"quantumbeam/internal/logger"
)

func auditMutatingRuleActions() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()
		if c.Writer.Status() >= http.StatusBadRequest {
			return
		}
		switch c.Request.Method {
		case http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete:
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

