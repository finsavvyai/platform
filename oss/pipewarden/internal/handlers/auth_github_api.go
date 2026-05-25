package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
)

// githubOAuthBaseURL / githubAPIBaseURL are package-level vars so tests can
// point the OAuth + REST helpers at an httptest.Server. Default to live
// GitHub. Overriding both fields together keeps the test scaffold simple.
var (
	githubOAuthBaseURL = "https://github.com"
	githubAPIBaseURL   = "https://api.github.com"
)

// exchangeGitHubCode swaps the OAuth code for an access token via
// GitHub's token endpoint. Accept-JSON header avoids the URL-encoded
// fallback response shape.
func (h *Handlers) exchangeGitHubCode(ctx context.Context, code, redirectURI string) (string, error) {
	body := url.Values{
		"client_id":     {h.githubClientID()},
		"client_secret": {h.githubClientSecret()},
		"code":          {code},
		"redirect_uri":  {redirectURI},
	}
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, githubOAuthBaseURL+"/login/oauth/access_token", strings.NewReader(body.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		raw, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("github HTTP %d: %s", resp.StatusCode, string(raw))
	}
	var out struct {
		AccessToken string `json:"access_token"`
		Error       string `json:"error"`
		ErrorDesc   string `json:"error_description"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return "", err
	}
	if out.Error != "" {
		return "", fmt.Errorf("github oauth error: %s — %s", out.Error, out.ErrorDesc)
	}
	if out.AccessToken == "" {
		return "", errors.New("github returned empty access_token")
	}
	return out.AccessToken, nil
}

// fetchGitHubUser pulls the authenticated user's id + display name + email.
// Email may be private — the user:email scope lets us fetch the verified
// primary email separately.
func (h *Handlers) fetchGitHubUser(ctx context.Context, token string) (id int64, email, name string, err error) {
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, githubAPIBaseURL+"/user", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return 0, "", "", err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return 0, "", "", fmt.Errorf("github /user HTTP %d", resp.StatusCode)
	}
	var u struct {
		ID    int64  `json:"id"`
		Email string `json:"email"`
		Name  string `json:"name"`
		Login string `json:"login"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&u); err != nil {
		return 0, "", "", err
	}
	if u.Email == "" {
		u.Email, _ = h.fetchGitHubPrimaryEmail(ctx, token)
	}
	if u.Name == "" {
		u.Name = u.Login
	}
	return u.ID, u.Email, u.Name, nil
}

func (h *Handlers) fetchGitHubPrimaryEmail(ctx context.Context, token string) (string, error) {
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, githubAPIBaseURL+"/user/emails", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("HTTP %d", resp.StatusCode)
	}
	var emails []struct {
		Email    string `json:"email"`
		Primary  bool   `json:"primary"`
		Verified bool   `json:"verified"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&emails); err != nil {
		return "", err
	}
	for _, e := range emails {
		if e.Primary && e.Verified {
			return e.Email, nil
		}
	}
	return "", errors.New("no verified primary email")
}
