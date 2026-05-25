package server

import (
	"fmt"
	"net/http"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

// SecurityHeadersMiddleware adds security headers
func (s *Server) SecurityHeadersMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		c.Header("X-XSS-Protection", "1; mode=block")
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
		if s.config.Environment == "production" {
			c.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		}
		c.Next()
	}
}

// InputValidationMiddleware provides input validation and sanitization
func (s *Server) InputValidationMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.Method == "POST" || c.Request.Method == "PUT" || c.Request.Method == "PATCH" {
			contentType := c.GetHeader("Content-Type")
			if !strings.Contains(contentType, "application/json") &&
				!strings.Contains(contentType, "multipart/form-data") &&
				!strings.Contains(contentType, "application/x-www-form-urlencoded") {
				s.respondWithError(c, http.StatusUnsupportedMediaType, "INVALID_CONTENT_TYPE",
					"Content-Type must be application/json, multipart/form-data, or application/x-www-form-urlencoded", nil)
				c.Abort()
				return
			}
		}

		if s.containsSuspiciousPatterns(c.Request.URL.Path) {
			logrus.WithFields(logrus.Fields{
				"path": c.Request.URL.Path, "client_ip": c.ClientIP(),
				"user_agent": c.GetHeader("User-Agent"),
			}).Warn("Suspicious URL pattern detected")
			s.respondWithError(c, http.StatusBadRequest, "SUSPICIOUS_REQUEST",
				"Request contains suspicious patterns", nil)
			c.Abort()
			return
		}

		for key, values := range c.Request.URL.Query() {
			if s.containsSuspiciousPatterns(key) {
				s.respondWithError(c, http.StatusBadRequest, "SUSPICIOUS_PARAMETER",
					"Request contains suspicious parameters", nil)
				c.Abort()
				return
			}
			for _, value := range values {
				if s.containsSuspiciousPatterns(value) {
					s.respondWithError(c, http.StatusBadRequest, "SUSPICIOUS_PARAMETER",
						"Request contains suspicious parameter values", nil)
					c.Abort()
					return
				}
			}
		}
		c.Next()
	}
}

// RequestSizeLimitMiddleware limits the size of requests
func (s *Server) RequestSizeLimitMiddleware() gin.HandlerFunc {
	maxRequestSize := int64(10 << 20) // 10MB
	return func(c *gin.Context) {
		if contentLength := c.Request.ContentLength; contentLength > maxRequestSize {
			s.respondWithError(c, http.StatusRequestEntityTooLarge, "REQUEST_TOO_LARGE",
				fmt.Sprintf("Request size %d exceeds maximum allowed size %d", contentLength, maxRequestSize), nil)
			c.Abort()
			return
		}
		c.Next()
	}
}

// IPWhitelistMiddleware provides IP whitelisting for sensitive endpoints
func (s *Server) IPWhitelistMiddleware(allowedIPs []string) gin.HandlerFunc {
	return func(c *gin.Context) {
		clientIP := c.ClientIP()
		allowed := false
		for _, ip := range allowedIPs {
			if ip == clientIP {
				allowed = true
				break
			}
		}
		if !allowed {
			s.respondWithError(c, http.StatusForbidden, "ACCESS_DENIED",
				"Access denied from your IP address", nil)
			c.Abort()
			return
		}
		c.Next()
	}
}

// containsSuspiciousPatterns checks for common attack patterns
func (s *Server) containsSuspiciousPatterns(input string) bool {
	suspiciousPatterns := []string{
		`(?i)(union|select|insert|update|delete|drop|create|alter|exec|execute)\s+`,
		`(?i)(or|and)\s+\d+\s*=\s*\d+`,
		`(?i)(or|and)\s+['"].*['"]\s*=\s*['"].*['"]`,
		`(?i)(waitfor\s+delay|sleep\s*\()`,
		`(?i)(benchmark\s*\(|pg_sleep\s*\()`,
		`(?i)(xp_cmdshell|sp_executesql)`,
		`(?i)(script|javascript|vbscript)`,
		`(?i)<script[^>]*>.*?</script>`,
		`(?i)javascript:`,
		`(?i)vbscript:`,
		`(?i)on(load|click|mouseover|error)=`,
		`(?i)<iframe[^>]*>`,
		`(?i)<object[^>]*>`,
		`(?i)<embed[^>]*>`,
		`[<>].*?(script|iframe|object|embed)`,
		`(?i)eval\s*\(`,
		`(?i)expression\s*\(`,
		`(--|\/\*|\*\/)`,
		`(?i)(\|\||&&)`,
		`(?i)(concat|char|ascii|substring|mid|len)`,
		`(?i)(information_schema|sysobjects|sysdatabases|mysql)`,
		`[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]`,
	}
	for _, pattern := range suspiciousPatterns {
		if matched, _ := regexp.MatchString(pattern, input); matched {
			return true
		}
	}
	return false
}
