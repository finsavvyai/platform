package adapter

import (
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// RequestIDMiddleware ensures X-Request-ID on responses and Gin context for logging.
func RequestIDMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		rid := c.GetHeader("X-Request-ID")
		if rid == "" {
			rid = uuid.New().String()
		}
		c.Writer.Header().Set("X-Request-ID", rid)
		c.Set("request_id", rid)
		c.Next()
	}
}
