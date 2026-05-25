package server

import (
	"net/http"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

// SQLInjectionDetectionMiddleware detects potential SQL injection attempts
func (s *Server) SQLInjectionDetectionMiddleware() gin.HandlerFunc {
	sqlInjectionPatterns := []string{
		`(?i)(union|select|insert|update|delete|drop|create|alter|exec|execute)\s+`,
		`(?i)(or|and)\s+\d+\s*=\s*\d+`,
		`(?i)(or|and)\s+['"].*['"]\s*=\s*['"].*['"]`,
		`(?i)(\|\||&&)`,
		`(?i)(waitfor\s+delay|sleep\s*\()`,
		`(?i)(benchmark\s*\(|pg_sleep\s*\()`,
		`(?i)(xp_cmdshell|sp_executesql)`,
		`(?i)(concat|char|ascii|substring|mid|len)`,
		`(?i)(information_schema|sysobjects|sysdatabases|mysql)`,
		`(--|\/\*|\*\/)`,
		`(?i)(script|javascript|vbscript)`,
		`[<>].*?(script|iframe|object|embed)`,
	}

	return func(c *gin.Context) {
		if strings.HasPrefix(c.Request.URL.Path, "/health") ||
			strings.HasPrefix(c.Request.URL.Path, "/static") {
			c.Next()
			return
		}

		urlPath := c.Request.URL.Path
		for _, pattern := range sqlInjectionPatterns {
			if matched, _ := regexp.MatchString(pattern, urlPath); matched {
				logrus.WithFields(logrus.Fields{
					"path": urlPath, "pattern": pattern,
					"client_ip": c.ClientIP(),
				}).Warn("SQL injection pattern detected in URL")
				s.respondWithError(c, http.StatusForbidden, "SECURITY_VIOLATION",
					"Request contains potentially malicious content", nil)
				c.Abort()
				return
			}
		}

		for key, values := range c.Request.URL.Query() {
			for _, pattern := range sqlInjectionPatterns {
				if matched, _ := regexp.MatchString(pattern, key); matched {
					s.respondWithError(c, http.StatusForbidden, "SECURITY_VIOLATION",
						"Request contains potentially malicious content", nil)
					c.Abort()
					return
				}
			}
			for _, value := range values {
				for _, pattern := range sqlInjectionPatterns {
					if matched, _ := regexp.MatchString(pattern, value); matched {
						s.respondWithError(c, http.StatusForbidden, "SECURITY_VIOLATION",
							"Request contains potentially malicious content", nil)
						c.Abort()
						return
					}
				}
			}
		}
		c.Next()
	}
}

// XSSProtectionMiddleware detects and prevents XSS attacks
func (s *Server) XSSProtectionMiddleware() gin.HandlerFunc {
	xssPatterns := []string{
		`(?i)<script[^>]*>.*?</script>`,
		`(?i)javascript:`,
		`(?i)vbscript:`,
		`(?i)on(load|click|mouseover|error|focus|blur|submit|change)=`,
		`(?i)<iframe[^>]*>`,
		`(?i)<object[^>]*>`,
		`(?i)<embed[^>]*>`,
		`(?i)<link[^>]*>`,
		`(?i)<meta[^>]*>`,
		`(?i)<style[^>]*>.*?</style>`,
		`(?i)expression\s*\(`,
		`(?i)@import`,
		`(?i)eval\s*\(`,
	}

	return func(c *gin.Context) {
		if strings.HasPrefix(c.GetHeader("Content-Type"), "multipart/form-data") {
			c.Next()
			return
		}

		for key, values := range c.Request.URL.Query() {
			for _, value := range values {
				for _, pattern := range xssPatterns {
					if matched, _ := regexp.MatchString(pattern, value); matched {
						logrus.WithFields(logrus.Fields{
							"param": key, "client_ip": c.ClientIP(),
						}).Warn("XSS pattern detected in parameter")
						s.respondWithError(c, http.StatusForbidden, "SECURITY_VIOLATION",
							"Request contains potentially malicious content", nil)
						c.Abort()
						return
					}
				}
			}
		}
		c.Next()
	}
}
