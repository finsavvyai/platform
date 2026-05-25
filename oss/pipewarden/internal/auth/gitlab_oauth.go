package auth

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// GitLabOAuth holds config for a GitLab OAuth2 application.
// Mirrors the GitHub App ergonomics so onboarding UX is symmetric.
type GitLabOAuth struct {
	ClientID     string
	ClientSecret string
	RedirectURI  string
	BaseURL      string // e.g. https://gitlab.com (self-hosted: https://gitlab.example.com)
	Scopes       []string
}

// GitLabToken is the OAuth2 exchange result.
type GitLabToken struct {
	AccessToken  string `json:"access_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int    `json:"expires_in"`
	RefreshToken string `json:"refresh_token"`
	CreatedAt    int64  `json:"created_at"`
	Scope        string `json:"scope"`
}

// AuthorizeURL returns the GitLab authorization URL a user should be redirected to.
// State must be a CSRF-protecting random string (use GenerateState()).
func (g *GitLabOAuth) AuthorizeURL(state string) string {
	base := g.base() + "/oauth/authorize"
	params := url.Values{}
	params.Set("client_id", g.ClientID)
	params.Set("redirect_uri", g.RedirectURI)
	params.Set("response_type", "code")
	params.Set("state", state)
	if len(g.Scopes) > 0 {
		params.Set("scope", strings.Join(g.Scopes, " "))
	} else {
		params.Set("scope", "read_api read_repository")
	}
	return base + "?" + params.Encode()
}

// ExchangeCode swaps an authorization code for an access token.
func (g *GitLabOAuth) ExchangeCode(httpClient *http.Client, code string) (*GitLabToken, error) {
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 15 * time.Second}
	}
	form := url.Values{}
	form.Set("client_id", g.ClientID)
	form.Set("client_secret", g.ClientSecret)
	form.Set("code", code)
	form.Set("grant_type", "authorization_code")
	form.Set("redirect_uri", g.RedirectURI)

	req, err := http.NewRequest(http.MethodPost, g.base()+"/oauth/token", strings.NewReader(form.Encode()))
	if err != nil {
		return nil, fmt.Errorf("failed to build token request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("token request failed: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("gitlab token exchange HTTP %d: %s", resp.StatusCode, string(body))
	}

	var tok GitLabToken
	if err := json.NewDecoder(resp.Body).Decode(&tok); err != nil {
		return nil, fmt.Errorf("failed to decode token: %w", err)
	}
	if tok.AccessToken == "" {
		return nil, fmt.Errorf("gitlab returned empty access token")
	}
	return &tok, nil
}

// RefreshToken rotates a refresh_token for a new access_token.
func (g *GitLabOAuth) RefreshToken(httpClient *http.Client, refreshToken string) (*GitLabToken, error) {
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 15 * time.Second}
	}
	form := url.Values{}
	form.Set("client_id", g.ClientID)
	form.Set("client_secret", g.ClientSecret)
	form.Set("refresh_token", refreshToken)
	form.Set("grant_type", "refresh_token")

	req, err := http.NewRequest(http.MethodPost, g.base()+"/oauth/token", strings.NewReader(form.Encode()))
	if err != nil {
		return nil, fmt.Errorf("failed to build refresh request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("refresh request failed: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("gitlab refresh HTTP %d: %s", resp.StatusCode, string(body))
	}

	var tok GitLabToken
	if err := json.NewDecoder(resp.Body).Decode(&tok); err != nil {
		return nil, fmt.Errorf("failed to decode refresh token: %w", err)
	}
	return &tok, nil
}

func (g *GitLabOAuth) base() string {
	if g.BaseURL == "" {
		return "https://gitlab.com"
	}
	return strings.TrimRight(g.BaseURL, "/")
}
