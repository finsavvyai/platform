package config

import "os"

type OAuthProvider struct {
	ClientID     string
	ClientSecret string
	AuthURL      string
	TokenURL     string
	UserInfoURL  string
	Scopes       []string
}

type OAuthConfig struct {
	FrontendURL string
	APIURL      string
	Providers   map[string]OAuthProvider
}

func LoadOAuth() OAuthConfig {
	cfg := OAuthConfig{
		FrontendURL: envOr("FRONTEND_URL", "http://localhost:5173"),
		APIURL:      envOr("API_URL", "http://localhost:8080"),
		Providers:   make(map[string]OAuthProvider),
	}
	if id := os.Getenv("GOOGLE_CLIENT_ID"); id != "" {
		cfg.Providers["google"] = OAuthProvider{
			ClientID: id, ClientSecret: os.Getenv("GOOGLE_CLIENT_SECRET"),
			AuthURL:     "https://accounts.google.com/o/oauth2/v2/auth",
			TokenURL:    "https://oauth2.googleapis.com/token",
			UserInfoURL: "https://www.googleapis.com/oauth2/v2/userinfo",
			Scopes:      []string{"openid", "email", "profile"},
		}
	}
	if id := os.Getenv("GITHUB_CLIENT_ID"); id != "" {
		cfg.Providers["github"] = OAuthProvider{
			ClientID: id, ClientSecret: os.Getenv("GITHUB_CLIENT_SECRET"),
			AuthURL:     "https://github.com/login/oauth/authorize",
			TokenURL:    "https://github.com/login/oauth/access_token",
			UserInfoURL: "https://api.github.com/user",
			Scopes:      []string{"user:email"},
		}
	}
	if id := os.Getenv("MICROSOFT_CLIENT_ID"); id != "" {
		cfg.Providers["microsoft"] = OAuthProvider{
			ClientID: id, ClientSecret: os.Getenv("MICROSOFT_CLIENT_SECRET"),
			AuthURL:     "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
			TokenURL:    "https://login.microsoftonline.com/common/oauth2/v2.0/token",
			UserInfoURL: "https://graph.microsoft.com/v1.0/me",
			Scopes:      []string{"openid", "email", "profile", "User.Read"},
		}
	}
	if id := os.Getenv("LINKEDIN_CLIENT_ID"); id != "" {
		cfg.Providers["linkedin"] = OAuthProvider{
			ClientID: id, ClientSecret: os.Getenv("LINKEDIN_CLIENT_SECRET"),
			AuthURL:     "https://www.linkedin.com/oauth/v2/authorization",
			TokenURL:    "https://www.linkedin.com/oauth/v2/accessToken",
			UserInfoURL: "https://api.linkedin.com/v2/userinfo",
			Scopes:      []string{"openid", "email", "profile"},
		}
	}
	return cfg
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
