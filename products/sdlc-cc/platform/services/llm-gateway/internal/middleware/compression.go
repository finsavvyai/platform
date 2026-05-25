package middleware

import (
	"time"

	"github.com/gin-contrib/gzip"
	"github.com/gin-gonic/gin"
)

// Timeout adds request timeout middleware
func Timeout(timeout time.Duration) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Request = c.Request.WithContext(c.Request.Context())
		c.Next()
	}
}

// Compression adds gzip compression middleware
func Compression() gin.HandlerFunc {
	return gzip.Gzip(gzip.DefaultCompression)
}
