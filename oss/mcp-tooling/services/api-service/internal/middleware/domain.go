package middleware

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/mcpoverflow/api-service/internal/config"
	"github.com/mcpoverflow/api-service/internal/services"
)

type DomainMiddleware struct {
	domainService *services.DomainService
}

func NewDomainMiddleware(cfg *config.Config) *DomainMiddleware {
	return &DomainMiddleware{
		domainService: services.NewDomainService(cfg),
	}
}

func (m *DomainMiddleware) Handle() gin.HandlerFunc {
	return func(c *gin.Context) {
		host := c.Request.Host
		// Remove port from host if present
		if colonIndex := strings.Index(host, ":"); colonIndex != -1 {
			host = host[:colonIndex]
		}

		// Detect domain based on host
		domain := m.domainService.DetectDomain(host)

		// Store domain in context
		c.Set("domain", domain)
		c.Set("domain_name", domain.Name)
		c.Set("domain_theme", domain.Theme)

		// Apply domain-specific headers
		m.domainService.ApplyDomainHeaders(c, domain)

		// Handle redirects and special routing
		m.domainService.HandleRedirect(c, domain)

		c.Next()
	}
}

func (m *DomainMiddleware) SEOHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		domain, exists := c.Get("domain")
		if !exists {
			c.Next()
			return
		}

		domainConfig := domain.(*config.Domain)
		seoHeaders := m.domainService.GetSEOHeaders()

		// Apply SEO-specific headers
		for key, value := range seoHeaders {
			c.Header(key, value)
		}

		// Apply Open Graph meta tags (stored in headers for frontend to use)
		ogTags := m.domainService.GenerateOpenGraph(domainConfig, c.Request.URL.Path)
		for key, value := range ogTags {
			c.Header(fmt.Sprintf("X-OG-%s", strings.ReplaceAll(key, "og:", "")), value)
		}

		c.Next()
	}
}

func (m *DomainMiddleware) SecurityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		domain, exists := c.Get("domain")
		if !exists {
			c.Next()
			return
		}

		domainConfig := domain.(*config.Domain)

		// Apply SSL/HTTPS headers
		if domainConfig.URL == "https://"+c.Request.Host || strings.HasPrefix(domainConfig.URL, "https://") {
			c.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload")
		}

		// Apply Content Security Policy
		c.Header("Content-Security-Policy", m.generateCSP(domainConfig))

		// Apply other security headers
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "SAMEORIGIN")
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
		c.Header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")

		c.Next()
	}
}

func (m *DomainMiddleware) generateCSP(domain *config.Domain) string {
	policies := []string{
		"default-src 'self'",
		"script-src 'self' 'unsafe-inline' https://analytics.google.com",
		"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
		"font-src 'self' https://fonts.gstatic.com",
		"img-src 'self' data: https:",
		"connect-src 'self' https://api.openai.com",
	}

	switch domain.Theme {
	case "marketing":
		policies = append(policies, "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com")
	case "developer":
		policies = append(policies, "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com")
	case "ai":
		policies = append(policies, "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net")
	case "docs":
		policies = append(policies, "script-src 'self' 'unsafe-inline' https://unpkg.com")
	}

	return strings.Join(policies, "; ")
}

func (m *DomainMiddleware) CORS() gin.HandlerFunc {
	return func(c *gin.Context) {
		domain, exists := c.Get("domain")
		if !exists {
			c.Next()
			return
		}

		domainConfig := domain.(*config.Domain)

		origin := c.Request.Header.Get("Origin")
		allowedOrigins := []string{
			domainConfig.URL,
			"http://localhost:" + c.Request.URL.Port(),
			"http://localhost:3000",
			"http://localhost:8080",
		}

		// Check if origin is allowed
		for _, allowedOrigin := range allowedOrigins {
			if origin == allowedOrigin {
				c.Header("Access-Control-Allow-Origin", origin)
				break
			}
		}

		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Authorization, X-Requested-With")
		c.Header("Access-Control-Allow-Credentials", "true")
		c.Header("Access-Control-Max-Age", "86400")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

// Helper functions to get domain information from context
func GetDomain(c *gin.Context) (*config.Domain, bool) {
	domain, exists := c.Get("domain")
	if !exists {
		return nil, false
	}
	return domain.(*config.Domain), true
}

func GetDomainTheme(c *gin.Context) string {
	theme, exists := c.Get("domain_theme")
	if !exists {
		return "default"
	}
	return theme.(string)
}

func GetDomainName(c *gin.Context) string {
	name, exists := c.Get("domain_name")
	if !exists {
		return "Unknown"
	}
	return name.(string)
}
