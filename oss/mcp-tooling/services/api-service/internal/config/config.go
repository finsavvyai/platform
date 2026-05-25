package config

import (
	"fmt"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	Environment string
	Database    DatabaseConfig
	Supabase    SupabaseConfig
	Redis       RedisConfig
	AgentKit    AgentKitConfig
	OAuth       OAuthConfig
	JWT         JWTConfig
	Server      ServerConfig
	Domains     DomainConfig
	SEO         SEOConfig
}

type DatabaseConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	Name     string
	SSLMode  string
}

type SupabaseConfig struct {
	URL     string
	AnonKey string
}

type RedisConfig struct {
	URL string
}

type AgentKitConfig struct {
	APIKey     string
	BaseURL    string
	MaxRetries int
	Timeout    int
}

type OAuthConfig struct {
	Google    OAuthProviderConfig
	GitHub    OAuthProviderConfig
	Microsoft OAuthProviderConfig
	Apple     OAuthProviderConfig
}

type OAuthProviderConfig struct {
	ClientID     string
	ClientSecret string
	RedirectURI  string
	TeamID       string // For Apple
	KeyID        string // For Apple
}

type JWTConfig struct {
	Secret             string
	AccessTokenExpiry  int
	RefreshTokenExpiry int
}

type ServerConfig struct {
	Port string
	Host string
}

type DomainConfig struct {
	Marketing  Domain
	Developer  Domain
	AI         Domain
	Docs       Domain
	Default    string
	SSLEnabled bool
	CDNEnabled bool
}

type Domain struct {
	URL         string
	Name        string
	Title       string
	Description string
	Logo        string
	Favicon     string
	Theme       string
	Redirects   map[string]string
	Headers     map[string]string
}

type SEOConfig struct {
	SiteName        string
	Description     string
	Keywords        []string
	OgImage         string
	TwitterCard     string
	TwitterSite     string
	AnalyticsID     string
	GoogleConsole   string
	SitemapEnabled  bool
	RobotsEnabled   bool
	IndexingEnabled bool
	StructuredData  bool
}

func Load() *Config {
	// Load .env file if it exists
	if err := godotenv.Load(); err != nil {
		// .env file not found, continue with environment variables
	}

	return &Config{
		Environment: getEnv("ENVIRONMENT", "development"),
		Database: DatabaseConfig{
			Host:     getEnv("DB_HOST", "localhost"),
			Port:     getEnv("DB_PORT", "5432"),
			User:     getEnv("DB_USER", "postgres"),
			Password: getSecret("DB_PASSWORD", ""),
			Name:     getEnv("DB_NAME", "mcpoverflow"),
			SSLMode:  getEnv("DB_SSL_MODE", "disable"),
		},
		Supabase: SupabaseConfig{
			URL:     getEnv("SUPABASE_URL", ""),
			AnonKey: getSecret("SUPABASE_ANON_KEY", ""),
		},
		Redis: RedisConfig{
			URL: getEnv("REDIS_URL", "redis://localhost:6379"),
		},
		AgentKit: AgentKitConfig{
			APIKey:     getSecret("AGENTKIT_API_KEY", ""),
			BaseURL:    getEnv("AGENTKIT_BASE_URL", "https://api.openai.com/v1/agentkit"),
			MaxRetries: getEnvAsInt("AGENTKIT_MAX_RETRIES", 3),
			Timeout:    getEnvAsInt("AGENTKIT_TIMEOUT", 30),
		},
		OAuth: OAuthConfig{
			Google: OAuthProviderConfig{
				ClientID:     getEnv("GOOGLE_CLIENT_ID", ""),
				ClientSecret: getSecret("GOOGLE_CLIENT_SECRET", ""),
				RedirectURI:  getEnv("GOOGLE_REDIRECT_URI", ""),
			},
			GitHub: OAuthProviderConfig{
				ClientID:     getEnv("GITHUB_CLIENT_ID", ""),
				ClientSecret: getSecret("GITHUB_CLIENT_SECRET", ""),
				RedirectURI:  getEnv("GITHUB_REDIRECT_URI", ""),
			},
			Microsoft: OAuthProviderConfig{
				ClientID:     getEnv("MICROSOFT_CLIENT_ID", ""),
				ClientSecret: getSecret("MICROSOFT_CLIENT_SECRET", ""),
				RedirectURI:  getEnv("MICROSOFT_REDIRECT_URI", ""),
			},
			Apple: OAuthProviderConfig{
				ClientID:     getEnv("APPLE_CLIENT_ID", ""),
				ClientSecret: getSecret("APPLE_CLIENT_SECRET", ""),
				RedirectURI:  getEnv("APPLE_REDIRECT_URI", ""),
				TeamID:       getEnv("APPLE_TEAM_ID", ""),
				KeyID:        getEnv("APPLE_KEY_ID", ""),
			},
		},
		JWT: JWTConfig{
			Secret:             getSecret("JWT_SECRET", "your-secret-key"),
			AccessTokenExpiry:  getEnvAsInt("JWT_ACCESS_TOKEN_EXPIRY", 900),     // 15 minutes default
			RefreshTokenExpiry: getEnvAsInt("JWT_REFRESH_TOKEN_EXPIRY", 604800), // 7 days default
		},
		Server: ServerConfig{
			Port: getEnv("PORT", "8080"),
			Host: getEnv("HOST", "0.0.0.0"),
		},
		Domains: DomainConfig{
			Marketing: Domain{
				URL:         getEnv("DOMAIN_MARKETING_URL", "https://mcpoverflow.com"),
				Name:        "MCPOverflow Marketing",
				Title:       "MCPOverflow - AI-Powered MCP Connector Platform",
				Description: "Generate MCP connectors instantly from OpenAPI, GraphQL, and Postman collections. Build powerful AI agent workflows with automatic tool generation.",
				Logo:        "/logo.png",
				Favicon:     "/favicon.ico",
				Theme:       "marketing",
				Redirects: map[string]string{
					"/docs": "https://mcpoverflow.dev",
					"/app":  "https://app.mcpoverflow.io",
					"/ai":   "https://mcpoverflow.ai",
				},
				Headers: map[string]string{
					"X-Frame-Options":        "SAMEORIGIN",
					"X-Content-Type-Options": "nosniff",
				},
			},
			Developer: Domain{
				URL:         getEnv("DOMAIN_DEVELOPER_URL", "https://app.mcpoverflow.io"),
				Name:        "MCPOverflow Developer Platform",
				Title:       "MCPOverflow Developer Platform - Build MCP Connectors",
				Description: "Access powerful tools to create, test, and deploy MCP connectors. Integrate AI agents with any API instantly.",
				Logo:        "/logo.png",
				Favicon:     "/favicon.ico",
				Theme:       "developer",
				Redirects: map[string]string{
					"/":     "/dashboard",
					"/docs": "https://mcpoverflow.dev",
				},
				Headers: map[string]string{
					"X-Frame-Options":           "DENY",
					"X-Content-Type-Options":    "nosniff",
					"Strict-Transport-Security": "max-age=31536000; includeSubDomains",
				},
			},
			AI: Domain{
				URL:         getEnv("DOMAIN_AI_URL", "https://mcpoverflow.ai"),
				Name:        "MCPOverflow AI Platform",
				Title:       "MCPOverflow AI - Intelligent Agent Management",
				Description: "Deploy and manage AI agents with automatic MCP connector generation. Build intelligent workflows that understand your APIs.",
				Logo:        "/logo.png",
				Favicon:     "/favicon.ico",
				Theme:       "ai",
				Redirects: map[string]string{
					"/chat": "/",
				},
				Headers: map[string]string{
					"X-Frame-Options":        "DENY",
					"X-Content-Type-Options": "nosniff",
				},
			},
			Docs: Domain{
				URL:         getEnv("DOMAIN_DOCS_URL", "https://mcpoverflow.dev"),
				Name:        "MCPOverflow Documentation",
				Title:       "MCPOverflow Documentation - Developer Guide",
				Description: "Complete guide to building MCP connectors, integrating AI agents, and deploying with the MCPOverflow platform.",
				Logo:        "/logo.png",
				Favicon:     "/favicon.ico",
				Theme:       "docs",
				Redirects: map[string]string{
					"/": "/getting-started",
				},
				Headers: map[string]string{
					"X-Frame-Options":        "SAMEORIGIN",
					"X-Content-Type-Options": "nosniff",
				},
			},
			Default:    getEnv("DOMAIN_DEFAULT", "marketing"),
			SSLEnabled: getEnvAsBool("DOMAIN_SSL_ENABLED", true),
			CDNEnabled: getEnvAsBool("DOMAIN_CDN_ENABLED", false),
		},
		SEO: SEOConfig{
			SiteName:        "MCPOverflow",
			Description:     "Generate MCP connectors instantly from OpenAPI, GraphQL, and Postman collections. Build powerful AI agent workflows.",
			Keywords:        []string{"MCP", "AI", "OpenAPI", "GraphQL", "Postman", "connector", "agent", "automation", "API"},
			OgImage:         getEnv("SEO_OG_IMAGE", "https://mcpoverflow.com/og-image.png"),
			TwitterCard:     getEnv("SEO_TWITTER_CARD", "summary_large_image"),
			TwitterSite:     getEnv("SEO_TWITTER_SITE", "@mcpoverflow"),
			AnalyticsID:     getEnv("SEO_ANALYTICS_ID", ""),
			GoogleConsole:   getEnv("SEO_GOOGLE_CONSOLE", ""),
			SitemapEnabled:  getEnvAsBool("SEO_SITEMAP_ENABLED", true),
			RobotsEnabled:   getEnvAsBool("SEO_ROBOTS_ENABLED", true),
			IndexingEnabled: getEnvAsBool("SEO_INDEXING_ENABLED", true),
			StructuredData:  getEnvAsBool("SEO_STRUCTURED_DATA", true),
		},
	}
}

func (c *Config) DatabaseURL() string {
	return fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=%s",
		c.Database.User,
		c.Database.Password,
		c.Database.Host,
		c.Database.Port,
		c.Database.Name,
		c.Database.SSLMode,
	)
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// getSecret retrieves a secret value from:
// 1. A file specified by <KEY>_FILE environment variable (Docker Secrets)
// 2. The <KEY> environment variable directly
// 3. The default value
func getSecret(key, defaultValue string) string {
	// 1. Check for <KEY>_FILE
	if fileVar := os.Getenv(key + "_FILE"); fileVar != "" {
		if content, err := os.ReadFile(fileVar); err == nil {
			// Trim whitespace/newlines from the file content
			return string(trimBytes(content))
		}
	}

	// 2. Check for <KEY>
	if value := os.Getenv(key); value != "" {
		return value
	}

	// 3. Return default
	return defaultValue
}

func trimBytes(b []byte) []byte {
	n := len(b)
	for n > 0 && (b[n-1] == '\n' || b[n-1] == '\r' || b[n-1] == ' ') {
		n--
	}
	return b[:n]
}

func getEnvAsInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := fmt.Sscanf(value, "%d", new(int)); err == nil && intValue == 1 {
			var result int
			fmt.Sscanf(value, "%d", &result)
			return result
		}
	}
	return defaultValue
}

func getEnvAsBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if value == "true" || value == "1" || value == "yes" {
			return true
		}
		if value == "false" || value == "0" || value == "no" {
			return false
		}
	}
	return defaultValue
}
