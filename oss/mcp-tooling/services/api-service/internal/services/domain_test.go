package services

import (
	"testing"

	"github.com/mcpoverflow/api-service/internal/config"
)

func TestDomainService_DetectDomain(t *testing.T) {
	cfg := &config.Config{
		Domains: config.DomainConfig{
			Marketing: config.Domain{
				URL:   "https://mcpoverflow.com",
				Name:  "MCPOverflow Marketing",
				Theme: "marketing",
			},
			Developer: config.Domain{
				URL:   "https://app.mcpoverflow.io",
				Name:  "MCPOverflow Developer Platform",
				Theme: "developer",
			},
			AI: config.Domain{
				URL:   "https://mcpoverflow.ai",
				Name:  "MCPOverflow AI Platform",
				Theme: "ai",
			},
			Docs: config.Domain{
				URL:   "https://mcpoverflow.dev",
				Name:  "MCPOverflow Documentation",
				Theme: "docs",
			},
			Default: "marketing",
		},
	}

	service := NewDomainService(cfg)

	tests := []struct {
		name     string
		host     string
		expected *config.Domain
	}{
		{
			name: "Marketing domain - mcpoverflow.com",
			host: "mcpoverflow.com",
			expected: &config.Domain{
				URL:   "https://mcpoverflow.com",
				Name:  "MCPOverflow Marketing",
				Theme: "marketing",
			},
		},
		{
			name: "Marketing domain - www.mcpoverflow.com",
			host: "www.mcpoverflow.com",
			expected: &config.Domain{
				URL:   "https://mcpoverflow.com",
				Name:  "MCPOverflow Marketing",
				Theme: "marketing",
			},
		},
		{
			name: "Developer domain",
			host: "app.mcpoverflow.io",
			expected: &config.Domain{
				URL:   "https://app.mcpoverflow.io",
				Name:  "MCPOverflow Developer Platform",
				Theme: "developer",
			},
		},
		{
			name: "AI domain",
			host: "mcpoverflow.ai",
			expected: &config.Domain{
				URL:   "https://mcpoverflow.ai",
				Name:  "MCPOverflow AI Platform",
				Theme: "ai",
			},
		},
		{
			name: "Docs domain",
			host: "mcpoverflow.dev",
			expected: &config.Domain{
				URL:   "https://mcpoverflow.dev",
				Name:  "MCPOverflow Documentation",
				Theme: "docs",
			},
		},
		{
			name: "Unknown domain - should return default",
			host: "unknown.com",
			expected: &config.Domain{
				URL:   "https://mcpoverflow.com",
				Name:  "MCPOverflow Marketing",
				Theme: "marketing",
			},
		},
		{
			name: "Subdomain - should return default",
			host: "api.mcpoverflow.com",
			expected: &config.Domain{
				URL:   "https://mcpoverflow.com",
				Name:  "MCPOverflow Marketing",
				Theme: "marketing",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := service.DetectDomain(tt.host)
			if result.URL != tt.expected.URL {
				t.Errorf("Expected URL %s, got %s", tt.expected.URL, result.URL)
			}
			if result.Name != tt.expected.Name {
				t.Errorf("Expected Name %s, got %s", tt.expected.Name, result.Name)
			}
			if result.Theme != tt.expected.Theme {
				t.Errorf("Expected Theme %s, got %s", tt.expected.Theme, result.Theme)
			}
		})
	}
}

func TestDomainService_GetDefaultDomain(t *testing.T) {
	tests := []struct {
		name          string
		defaultDomain string
		expectedTheme string
	}{
		{
			name:          "Default marketing",
			defaultDomain: "marketing",
			expectedTheme: "marketing",
		},
		{
			name:          "Default developer",
			defaultDomain: "developer",
			expectedTheme: "developer",
		},
		{
			name:          "Default AI",
			defaultDomain: "ai",
			expectedTheme: "ai",
		},
		{
			name:          "Default docs",
			defaultDomain: "docs",
			expectedTheme: "docs",
		},
		{
			name:          "Unknown default - should fallback to marketing",
			defaultDomain: "unknown",
			expectedTheme: "marketing",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := &config.Config{
				Domains: config.DomainConfig{
					Marketing: config.Domain{Theme: "marketing"},
					Developer: config.Domain{Theme: "developer"},
					AI:        config.Domain{Theme: "ai"},
					Docs:      config.Domain{Theme: "docs"},
					Default:   tt.defaultDomain,
				},
			}

			service := NewDomainService(cfg)
			result := service.GetDefaultDomain()

			if result.Theme != tt.expectedTheme {
				t.Errorf("Expected theme %s, got %s", tt.expectedTheme, result.Theme)
			}
		})
	}
}

func TestDomainService_GenerateSitemap(t *testing.T) {
	cfg := &config.Config{
		SEO: config.SEOConfig{
			SitemapEnabled: true,
		},
	}

	domain := &config.Domain{
		URL:   "https://mcpoverflow.com",
		Name:  "MCPOverflow Marketing",
		Theme: "marketing",
	}

	service := NewDomainService(cfg)
	sitemap := service.GenerateSitemap(domain)

	// Check if sitemap contains required elements
	expectedElements := []string{
		`<?xml version="1.0" encoding="UTF-8"?>`,
		`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
		`<loc>https://mcpoverflow.com</loc>`,
		`<changefreq>daily</changefreq>`,
		`<priority>1.0</priority>`,
		`<loc>https://mcpoverflow.com/features</loc>`,
		`<loc>https://mcpoverflow.com/pricing</loc>`,
		`</urlset>`,
	}

	for _, element := range expectedElements {
		if len(sitemap) == 0 {
			t.Error("Generated sitemap is empty")
		}
		// Simple contains check - in a real implementation, you'd want proper XML parsing
		if !contains(sitemap, element) {
			t.Errorf("Sitemap should contain '%s', but it doesn't", element)
		}
	}
}

func TestDomainService_GenerateRobotsTxt(t *testing.T) {
	cfg := &config.Config{
		SEO: config.SEOConfig{
			IndexingEnabled: true,
			SitemapEnabled:  true,
		},
	}

	domain := &config.Domain{
		URL:   "https://mcpoverflow.com",
		Theme: "marketing",
	}

	service := NewDomainService(cfg)
	robotsTxt := service.GenerateRobotsTxt(domain)

	// Check if robots.txt contains required elements
	expectedElements := []string{
		"User-agent: *",
		"Allow: /",
		"Disallow: /admin/",
		"Disallow: /api/",
		"Disallow: /private/",
		"Sitemap: https://mcpoverflow.com/sitemap.xml",
	}

	for _, element := range expectedElements {
		if !contains(robotsTxt, element) {
			t.Errorf("Robots.txt should contain '%s', but it doesn't", element)
		}
	}
}

func TestDomainService_GenerateRobotsTxt_NoIndexing(t *testing.T) {
	cfg := &config.Config{
		SEO: config.SEOConfig{
			IndexingEnabled: false,
		},
	}

	domain := &config.Domain{
		URL:   "https://mcpoverflow.com",
		Theme: "marketing",
	}

	service := NewDomainService(cfg)
	robotsTxt := service.GenerateRobotsTxt(domain)

	expected := "User-agent: *\nDisallow: /"
	if robotsTxt != expected {
		t.Errorf("Expected robots.txt '%s', got '%s'", expected, robotsTxt)
	}
}

func TestDomainService_GetStructuredData(t *testing.T) {
	cfg := &config.Config{}

	domain := &config.Domain{
		URL:         "https://mcpoverflow.com",
		Name:        "MCPOverflow Marketing",
		Description: "AI-Powered MCP Connector Platform",
		Theme:       "marketing",
	}

	service := NewDomainService(cfg)
	structuredData := service.GetStructuredData(domain, "/")

	// Check if structured data contains required fields
	requiredFields := []string{
		"@context",
		"@type",
		"name",
		"url",
		"description",
	}

	for _, field := range requiredFields {
		if _, exists := structuredData[field]; !exists {
			t.Errorf("Structured data should contain field '%s', but it doesn't", field)
		}
	}

	// Check marketing-specific fields
	if structuredData["@type"] != "Organization" {
		t.Errorf("Marketing domain should have @type 'Organization', got '%s'", structuredData["@type"])
	}
}

func TestDomainService_GetStructuredData_Developer(t *testing.T) {
	cfg := &config.Config{}

	domain := &config.Domain{
		URL:         "https://app.mcpoverflow.io",
		Name:        "MCPOverflow Developer Platform",
		Description: "Build MCP Connectors",
		Theme:       "developer",
	}

	service := NewDomainService(cfg)
	structuredData := service.GetStructuredData(domain, "/dashboard")

	// Check developer-specific fields
	if structuredData["@type"] != "SoftwareApplication" {
		t.Errorf("Developer domain should have @type 'SoftwareApplication', got '%s'", structuredData["@type"])
	}

	if structuredData["applicationCategory"] != "DeveloperApplication" {
		t.Errorf("Developer domain should have applicationCategory 'DeveloperApplication'")
	}
}

func TestDomainService_GetStructuredData_Docs(t *testing.T) {
	cfg := &config.Config{}

	domain := &config.Domain{
		URL:         "https://mcpoverflow.dev",
		Name:        "MCPOverflow Documentation",
		Description: "Developer Guide",
		Theme:       "docs",
	}

	service := NewDomainService(cfg)
	structuredData := service.GetStructuredData(domain, "/getting-started")

	// Check docs-specific fields
	if structuredData["@type"] != "TechArticle" {
		t.Errorf("Docs domain should have @type 'TechArticle', got '%s'", structuredData["@type"])
	}

	author, exists := structuredData["author"]
	if !exists {
		t.Error("Docs domain should have author field")
	}

	if authorMap, ok := author.(map[string]interface{}); ok {
		if authorMap["@type"] != "Organization" || authorMap["name"] != "MCPOverflow Team" {
			t.Error("Docs domain author should be 'MCPOverflow Team' organization")
		}
	}
}

func TestDomainService_GenerateOpenGraph(t *testing.T) {
	cfg := &config.Config{
		SEO: config.SEOConfig{
			SiteName:    "MCPOverflow",
			OgImage:     "https://mcpoverflow.com/og-image.png",
			TwitterCard: "summary_large_image",
			TwitterSite: "@mcpoverflow",
		},
	}

	domain := &config.Domain{
		URL:         "https://mcpoverflow.com",
		Title:       "MCPOverflow - AI-Powered MCP Connector Platform",
		Description: "Generate MCP connectors instantly",
	}

	service := NewDomainService(cfg)
	ogTags := service.GenerateOpenGraph(domain, "/features")

	// Check if Open Graph tags contain required elements
	requiredTags := map[string]string{
		"og:title":       "MCPOverflow - AI-Powered MCP Connector Platform",
		"og:description": "Generate MCP connectors instantly",
		"og:url":         "https://mcpoverflow.com/features",
		"og:type":        "website",
		"og:site_name":   "MCPOverflow",
		"og:image":       "https://mcpoverflow.com/og-image.png",
		"twitter:card":   "summary_large_image",
		"twitter:site":   "@mcpoverflow",
	}

	for key, expectedValue := range requiredTags {
		if actualValue, exists := ogTags[key]; !exists {
			t.Errorf("Open Graph tags should contain '%s', but it doesn't", key)
		} else if actualValue != expectedValue {
			t.Errorf("Expected '%s' = '%s', got '%s'", key, expectedValue, actualValue)
		}
	}
}

func TestDomainService_GetSEOHeaders(t *testing.T) {
	cfg := &config.Config{
		SEO: config.SEOConfig{
			AnalyticsID:   "GA_MEASUREMENT_ID",
			GoogleConsole: "google-console-verification",
		},
	}

	service := NewDomainService(cfg)
	headers := service.GetSEOHeaders()

	expectedHeaders := map[string]string{
		"X-Analytics-ID":   "GA_MEASUREMENT_ID",
		"X-Google-Console": "google-console-verification",
	}

	for key, expectedValue := range expectedHeaders {
		if actualValue, exists := headers[key]; !exists {
			t.Errorf("SEO headers should contain '%s', but it doesn't", key)
		} else if actualValue != expectedValue {
			t.Errorf("Expected '%s' = '%s', got '%s'", key, expectedValue, actualValue)
		}
	}
}

// Helper function to check if a string contains a substring
func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(substr) == 0 ||
		(len(s) > len(substr) && findSubstring(s, substr)))
}

func findSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
