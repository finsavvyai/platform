package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/mcpoverflow/api-service/internal/config"
	"github.com/mcpoverflow/api-service/internal/services"
)

type DomainHandler struct {
	domainService *services.DomainService
	config        *config.Config
}

func NewDomainHandler(cfg *config.Config) *DomainHandler {
	return &DomainHandler{
		domainService: services.NewDomainService(cfg),
		config:        cfg,
	}
}

// GetDomainConfig returns the current domain configuration
func (h *DomainHandler) GetDomainConfig(c *gin.Context) {
	domain, exists := c.Get("domain")
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Domain not found"})
		return
	}

	domainConfig := domain.(*config.Domain)

	c.JSON(http.StatusOK, gin.H{
		"domain": domainConfig,
		"seo": gin.H{
			"siteName":       h.config.SEO.SiteName,
			"description":    h.config.SEO.Description,
			"keywords":       h.config.SEO.Keywords,
			"analyticsID":    h.config.SEO.AnalyticsID,
			"structuredData": h.config.SEO.StructuredData,
		},
	})
}

// GetSitemap returns XML sitemap for the current domain
func (h *DomainHandler) GetSitemap(c *gin.Context) {
	domain, exists := c.Get("domain")
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Domain not found"})
		return
	}

	domainConfig := domain.(*config.Domain)
	sitemap := h.domainService.GenerateSitemap(domainConfig)

	c.Header("Content-Type", "application/xml")
	c.String(http.StatusOK, sitemap)
}

// GetRobotsTxt returns robots.txt for the current domain
func (h *DomainHandler) GetRobotsTxt(c *gin.Context) {
	domain, exists := c.Get("domain")
	if !exists {
		c.String(http.StatusNotFound, "User-agent: *\nDisallow: /")
		return
	}

	domainConfig := domain.(*config.Domain)
	robotsTxt := h.domainService.GenerateRobotsTxt(domainConfig)

	c.Header("Content-Type", "text/plain")
	c.String(http.StatusOK, robotsTxt)
}

// GetOpenGraph returns Open Graph meta tags for the current page
func (h *DomainHandler) GetOpenGraph(c *gin.Context) {
	domain, exists := c.Get("domain")
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Domain not found"})
		return
	}

	domainConfig := domain.(*config.Domain)
	path := c.Request.URL.Path
	ogTags := h.domainService.GenerateOpenGraph(domainConfig, path)

	c.JSON(http.StatusOK, gin.H{
		"meta": ogTags,
	})
}

// GetStructuredData returns JSON-LD structured data for SEO
func (h *DomainHandler) GetStructuredData(c *gin.Context) {
	domain, exists := c.Get("domain")
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Domain not found"})
		return
	}

	domainConfig := domain.(*config.Domain)
	path := c.Param("page")
	if path == "" {
		path = "/"
	}

	structuredData := h.domainService.GetStructuredData(domainConfig, path)

	c.JSON(http.StatusOK, structuredData)
}

// UpdateDomainConfig handles domain configuration updates (admin only)
func (h *DomainHandler) UpdateDomainConfig(c *gin.Context) {
	var req struct {
		DomainType string                 `json:"domainType" binding:"required"`
		Config     map[string]interface{} `json:"config"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// This would typically update configuration in the database
	// For now, we'll just return success
	c.JSON(http.StatusOK, gin.H{
		"message":    "Domain configuration updated successfully",
		"domainType": req.DomainType,
	})
}

// GetDomainAnalytics returns analytics data for the domain
func (h *DomainHandler) GetDomainAnalytics(c *gin.Context) {
	domain, exists := c.Get("domain")
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Domain not found"})
		return
	}

	domainConfig := domain.(*config.Domain)

	// Mock analytics data - in a real implementation, this would come from analytics services
	analytics := gin.H{
		"domain": domainConfig.Name,
		"pageViews": map[string]int{
			"/":         1250,
			"/features": 890,
			"/pricing":  670,
			"/about":    340,
		},
		"uniqueVisitors":     2450,
		"bounceRate":         "35.2%",
		"avgSessionDuration": "2:45",
		"topReferrers": []string{
			"google.com",
			"twitter.com",
			"github.com",
		},
	}

	c.JSON(http.StatusOK, analytics)
}

// GetDomainHealth returns health and performance metrics for the domain
func (h *DomainHandler) GetDomainHealth(c *gin.Context) {
	domain, exists := c.Get("domain")
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Domain not found"})
		return
	}

	domainConfig := domain.(*config.Domain)

	// Mock health data
	health := gin.H{
		"domain": domainConfig.Name,
		"status": "healthy",
		"ssl": gin.H{
			"enabled":    h.config.Domains.SSLEnabled,
			"validUntil": "2025-01-01",
			"issuer":     "Let's Encrypt",
		},
		"performance": gin.H{
			"loadTime":  "1.2s",
			"firstByte": "0.3s",
			"uptime":    "99.9%",
			"score":     92,
		},
		"cdn": gin.H{
			"enabled":  h.config.Domains.CDNEnabled,
			"provider": "Cloudflare",
		},
	}

	c.JSON(http.StatusOK, health)
}

// ListDomains returns all configured domains
func (h *DomainHandler) ListDomains(c *gin.Context) {
	domains := gin.H{
		"marketing":  h.config.Domains.Marketing,
		"developer":  h.config.Domains.Developer,
		"ai":         h.config.Domains.AI,
		"docs":       h.config.Domains.Docs,
		"default":    h.config.Domains.Default,
		"sslEnabled": h.config.Domains.SSLEnabled,
		"cdnEnabled": h.config.Domains.CDNEnabled,
	}

	c.JSON(http.StatusOK, domains)
}

// ValidateDomain checks if a domain is properly configured
func (h *DomainHandler) ValidateDomain(c *gin.Context) {
	domain := c.Query("domain")
	if domain == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Domain parameter is required"})
		return
	}

	// Mock validation
	validation := gin.H{
		"domain": domain,
		"valid":  true,
		"checks": gin.H{
			"dns": gin.H{
				"status": "valid",
				"records": []string{
					"A: 192.168.1.1",
					"CNAME: app.mcpoverflow.io",
				},
			},
			"ssl": gin.H{
				"status":  "valid",
				"issuer":  "Let's Encrypt",
				"expires": "2025-01-01",
			},
			"configuration": gin.H{
				"status":    "valid",
				"redirects": 3,
				"headers":   5,
			},
		},
	}

	c.JSON(http.StatusOK, validation)
}
