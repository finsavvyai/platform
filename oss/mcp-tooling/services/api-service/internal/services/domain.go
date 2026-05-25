package services

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/mcpoverflow/api-service/internal/config"
)

type DomainService struct {
	config *config.Config
}

func NewDomainService(cfg *config.Config) *DomainService {
	return &DomainService{
		config: cfg,
	}
}

func (s *DomainService) DetectDomain(host string) *config.Domain {
	switch host {
	case "mcpoverflow.com", "www.mcpoverflow.com":
		return &s.config.Domains.Marketing
	case "app.mcpoverflow.io":
		return &s.config.Domains.Developer
	case "mcpoverflow.ai":
		return &s.config.Domains.AI
	case "mcpoverflow.dev":
		return &s.config.Domains.Docs
	default:
		return s.GetDefaultDomain()
	}
}

func (s *DomainService) GetDefaultDomain() *config.Domain {
	switch s.config.Domains.Default {
	case "marketing":
		return &s.config.Domains.Marketing
	case "developer":
		return &s.config.Domains.Developer
	case "ai":
		return &s.config.Domains.AI
	case "docs":
		return &s.config.Domains.Docs
	default:
		return &s.config.Domains.Marketing
	}
}

func (s *DomainService) ApplyDomainHeaders(c *gin.Context, domain *config.Domain) {
	// Apply security headers
	for key, value := range domain.Headers {
		c.Header(key, value)
	}

	// Apply CORS headers
	c.Header("Access-Control-Allow-Origin", domain.URL)
	c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
	c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Authorization")

	// Apply SEO headers
	c.Header("X-Domain-Name", domain.Name)
	c.Header("X-Theme", domain.Theme)
}

func (s *DomainService) HandleRedirect(c *gin.Context, domain *config.Domain) {
	path := c.Request.URL.Path

	// Check if path should be redirected
	if target, exists := domain.Redirects[path]; exists {
		c.Redirect(http.StatusMovedPermanently, target)
		return
	}

	// Handle domain-level redirects
	if domain.Name == s.config.Domains.Marketing.Name {
		// Marketing site specific redirects
		switch path {
		case "":
			fallthrough
		case "/":
			c.HTML(http.StatusOK, "marketing-index.html", gin.H{
				"domain": domain,
				"seo":    s.config.SEO,
			})
			return
		}
	}

	c.Next()
}

func (s *DomainService) GenerateSitemap(domain *config.Domain) string {
	var sitemap strings.Builder

	sitemap.WriteString(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`)

	// Add homepage
	sitemap.WriteString(fmt.Sprintf(`
	<url>
		<loc>%s</loc>
		<lastmod>%s</lastmod>
		<changefreq>daily</changefreq>
		<priority>1.0</priority>
	</url>`,
		domain.URL,
		"2024-01-01",
	))

	// Add additional pages based on domain type
	switch domain.Theme {
	case "marketing":
		pages := []string{"/features", "/pricing", "/about", "/contact"}
		for _, page := range pages {
			sitemap.WriteString(fmt.Sprintf(`
	<url>
		<loc>%s%s</loc>
		<lastmod>%s</lastmod>
		<changefreq>weekly</changefreq>
		<priority>0.8</priority>
	</url>`,
				domain.URL,
				page,
				"2024-01-01",
			))
		}
	case "developer":
		pages := []string{"/dashboard", "/connectors", "/generators", "/settings"}
		for _, page := range pages {
			sitemap.WriteString(fmt.Sprintf(`
	<url>
		<loc>%s%s</loc>
		<lastmod>%s</lastmod>
		<changefreq>daily</changefreq>
		<priority>0.9</priority>
	</url>`,
				domain.URL,
				page,
				"2024-01-01",
			))
		}
	case "docs":
		pages := []string{"/getting-started", "/guides", "/api-reference", "/examples"}
		for _, page := range pages {
			sitemap.WriteString(fmt.Sprintf(`
	<url>
		<loc>%s%s</loc>
		<lastmod>%s</lastmod>
		<changefreq>weekly</changefreq>
		<priority>0.8</priority>
	</url>`,
				domain.URL,
				page,
				"2024-01-01",
			))
		}
	}

	sitemap.WriteString(`
</urlset>`)

	return sitemap.String()
}

func (s *DomainService) GenerateRobotsTxt(domain *config.Domain) string {
	if !s.config.SEO.IndexingEnabled {
		return "User-agent: *\nDisallow: /"
	}

	var robots strings.Builder
	robots.WriteString("User-agent: *\n")

	// Allow all crawlers
	robots.WriteString("Allow: /\n\n")

	// Block admin areas
	robots.WriteString("Disallow: /admin/\n")
	robots.WriteString("Disallow: /api/\n")
	robots.WriteString("Disallow: /private/\n\n")

	// Domain-specific rules
	switch domain.Theme {
	case "developer":
		robots.WriteString("Disallow: /dashboard/\n")
		robots.WriteString("Disallow: /settings/\n")
	case "docs":
		robots.WriteString("Allow: /docs/\n")
		robots.WriteString("Allow: /api-reference/\n")
	}

	// Add sitemap URL
	if s.config.SEO.SitemapEnabled {
		robots.WriteString(fmt.Sprintf("\nSitemap: %s/sitemap.xml\n", domain.URL))
	}

	return robots.String()
}

func (s *DomainService) GetStructuredData(domain *config.Domain, page string) map[string]interface{} {
	baseData := map[string]interface{}{
		"@context":    "https://schema.org",
		"@type":       "WebSite",
		"name":        domain.Name,
		"url":         domain.URL,
		"description": domain.Description,
	}

	switch domain.Theme {
	case "marketing":
		baseData["@type"] = "Organization"
		baseData["sameAs"] = []string{
			"https://twitter.com/mcpoverflow",
			"https://github.com/mcpoverflow",
		}
		baseData["potentialAction"] = map[string]interface{}{
			"@type":       "SearchAction",
			"target":      fmt.Sprintf("%s/search?q={search_term_string}", domain.URL),
			"query-input": "required name=search_term_string",
		}
	case "developer":
		baseData["@type"] = "SoftwareApplication"
		baseData["applicationCategory"] = "DeveloperApplication"
		baseData["operatingSystem"] = "Web Browser"
	case "docs":
		baseData["@type"] = "TechArticle"
		baseData["author"] = map[string]interface{}{
			"@type": "Organization",
			"name":  "MCPOverflow Team",
		}
	}

	return baseData
}

func (s *DomainService) GetSEOHeaders() map[string]string {
	headers := make(map[string]string)

	if s.config.SEO.AnalyticsID != "" {
		headers["X-Analytics-ID"] = s.config.SEO.AnalyticsID
	}

	if s.config.SEO.GoogleConsole != "" {
		headers["X-Google-Console"] = s.config.SEO.GoogleConsole
	}

	return headers
}

func (s *DomainService) GenerateOpenGraph(domain *config.Domain, page string) map[string]string {
	og := map[string]string{
		"og:title":        domain.Title,
		"og:description":  domain.Description,
		"og:url":          fmt.Sprintf("%s%s", domain.URL, page),
		"og:type":         "website",
		"og:site_name":    s.config.SEO.SiteName,
		"og:image":        s.config.SEO.OgImage,
		"og:image:width":  "1200",
		"og:image:height": "630",
	}

	if s.config.SEO.TwitterCard != "" {
		og["twitter:card"] = s.config.SEO.TwitterCard
	}

	if s.config.SEO.TwitterSite != "" {
		og["twitter:site"] = s.config.SEO.TwitterSite
	}

	return og
}
