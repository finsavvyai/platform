package auth

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// GitHubApp handles GitHub App OAuth flow for PipeWarden.
// It manages JWT generation, installation tokens, and webhook verification.
type GitHubApp struct {
	AppID         int64
	PrivateKey    string
	WebhookSecret string
	ClientID      string
	ClientSecret  string
	Slug          string
	APIBaseURL    string
}

// InstallationToken represents a GitHub App installation access token.
type InstallationToken struct {
	Token               string    `json:"token"`
	ExpiresAt           time.Time `json:"expires_at"`
	RepositorySelection string    `json:"repository_selection"`
}

// Installation represents a GitHub App installation.
type Installation struct {
	ID      int64 `json:"id"`
	AppID   int64 `json:"app_id"`
	Account struct {
		Login string `json:"login"`
		ID    int64  `json:"id"`
	} `json:"account"`
	AccessTokensURL string    `json:"access_tokens_url"`
	HTMLURL         string    `json:"html_url"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

// jwtClaims for GitHub App authentication (RS256, 10-minute validity).
type jwtClaims struct {
	jwt.RegisteredClaims
}

// NewGitHubApp creates a GitHub App instance.
func NewGitHubApp(appID int64, privateKey, webhookSecret, clientID, clientSecret string) *GitHubApp {
	return &GitHubApp{
		AppID:         appID,
		PrivateKey:    privateKey,
		WebhookSecret: webhookSecret,
		ClientID:      clientID,
		ClientSecret:  clientSecret,
		APIBaseURL:    "https://api.github.com",
	}
}

// GenerateJWT creates a signed JWT for GitHub App authentication (RS256, 10 min).
func (g *GitHubApp) GenerateJWT() (string, error) {
	now := time.Now()
	claims := jwtClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(10 * time.Minute)),
			Issuer:    fmt.Sprintf("%d", g.AppID),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	privateKey, err := jwt.ParseRSAPrivateKeyFromPEM([]byte(g.PrivateKey))
	if err != nil {
		return "", fmt.Errorf("failed to parse private key: %w", err)
	}

	signed, err := token.SignedString(privateKey)
	if err != nil {
		return "", fmt.Errorf("failed to sign JWT: %w", err)
	}

	return signed, nil
}

// GenerateInstallationToken exchanges an installation ID for an access token.
// Uses GitHub App JWT to request a temporary token valid for 1 hour.
func (g *GitHubApp) GenerateInstallationToken(installationID int64, httpClient *http.Client) (*InstallationToken, error) {
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 30 * time.Second}
	}

	jwtToken, err := g.GenerateJWT()
	if err != nil {
		return nil, fmt.Errorf("failed to generate JWT: %w", err)
	}

	url := fmt.Sprintf("%s/app/installations/%d/access_tokens", g.apiBaseURL(), installationID)
	req, err := http.NewRequest(http.MethodPost, url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+jwtToken)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to request installation token: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("github API error (HTTP %d): %s", resp.StatusCode, string(body))
	}

	var token InstallationToken
	if err := json.NewDecoder(resp.Body).Decode(&token); err != nil {
		return nil, fmt.Errorf("failed to decode token response: %w", err)
	}

	return &token, nil
}

func (g *GitHubApp) apiBaseURL() string {
	if g.APIBaseURL == "" {
		return "https://api.github.com"
	}
	return strings.TrimRight(g.APIBaseURL, "/")
}
