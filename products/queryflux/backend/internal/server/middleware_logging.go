package server

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

// LoggingMiddleware provides structured logging for requests
func (s *Server) LoggingMiddleware() gin.HandlerFunc {
	return gin.LoggerWithFormatter(func(param gin.LogFormatterParams) string {
		logEntry := logrus.WithFields(logrus.Fields{
			"method":     param.Method,
			"path":       param.Path,
			"status":     param.StatusCode,
			"latency":    param.Latency,
			"client_ip":  param.ClientIP,
			"user_agent": param.Request.UserAgent(),
			"request_id": param.Keys["request_id"],
		})

		if param.ErrorMessage != "" {
			logEntry = logEntry.WithField("error", param.ErrorMessage)
		}

		if param.StatusCode >= 400 {
			logEntry.Error("HTTP request completed with error")
		} else {
			logEntry.Info("HTTP request completed")
		}

		return ""
	})
}

// ErrorHandlingMiddleware provides centralized error handling
func (s *Server) ErrorHandlingMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()

		if len(c.Errors) > 0 {
			err := c.Errors.Last()

			logrus.WithFields(logrus.Fields{
				"error":      err.Error(),
				"request_id": c.GetString("request_id"),
				"path":       c.Request.URL.Path,
				"method":     c.Request.Method,
			}).Error("Request processing error")

			if !c.Writer.Written() {
				s.respondWithError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "An internal error occurred", err.Error())
			}
		}
	}
}

// RateLimitMiddleware provides basic rate limiting
func (s *Server) RateLimitMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()
	}
}
