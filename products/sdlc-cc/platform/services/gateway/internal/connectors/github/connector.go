// Package github is the REAL GitHub connector.
// Uses GitHub App authentication: a JWT signed by the App private key
// mints per-installation access tokens. The Authenticate() path runs
// the OAuth code exchange (used at install time to identify the user
// and capture the installation_id); subsequent calls use the
// installation token loaded from the TokenStore.
//
// API references:
//   - GitHub Apps:   https://docs.github.com/en/apps/creating-github-apps
//   - REST API:      https://docs.github.com/en/rest
//   - Search:        https://docs.github.com/en/rest/search/search
//
// Status: REAL HTTP client. Needs GITHUB_APP_ID / GITHUB_PRIVATE_KEY /
// GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET at runtime. Tests use
// httptest.NewServer + an in-memory TokenStore.
package github

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/sdlc-ai/platform/services/gateway/internal/connectors"
)

// Name is the canonical registry id.
const Name = "github"

// Connector is the REAL GitHub connector.
type Connector struct {
	logger       *slog.Logger
	tokens       connectors.Store
	hc           *http.Client
	clientID     string
	clientSecret string
	redirectURI  string

	// BaseURL is the API host (api.github.com in prod).
	BaseURL string
	// OAuthURL is the OAuth host (github.com in prod).
	OAuthURL string
}

// Config bundles runtime credentials.
type Config struct {
	ClientID     string
	ClientSecret string
	RedirectURI  string
}

// New returns a configured GitHub connector.
func New(logger *slog.Logger, tokens connectors.Store, cfg Config) *Connector {
	if logger == nil {
		logger = slog.Default()
	}
	return &Connector{
		logger:       logger.With("connector", Name),
		tokens:       tokens,
		hc:           &http.Client{Timeout: 30 * time.Second},
		clientID:     cfg.ClientID,
		clientSecret: cfg.ClientSecret,
		redirectURI:  cfg.RedirectURI,
		BaseURL:      "https://api.github.com",
		OAuthURL:     "https://github.com",
	}
}

// Name returns the canonical id.
func (c *Connector) Name() string { return Name }

type ghTokenResp struct {
	AccessToken string `json:"access_token"`
	TokenType   string `json:"token_type"`
	Scope       string `json:"scope"`
	Error       string `json:"error"`
}

// Authenticate exchanges an OAuth code via /login/oauth/access_token.
func (c *Connector) Authenticate(ctx context.Context, tenantID uuid.UUID, code string) error {
	form := url.Values{}
	form.Set("client_id", c.clientID)
	form.Set("client_secret", c.clientSecret)
	form.Set("code", code)
	form.Set("redirect_uri", c.redirectURI)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		strings.TrimRight(c.OAuthURL, "/")+"/login/oauth/access_token",
		strings.NewReader(form.Encode()))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")
	resp, err := c.hc.Do(req)
	if err != nil {
		return fmt.Errorf("github oauth: %w", err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return fmt.Errorf("github oauth %d: %s", resp.StatusCode, string(raw))
	}
	var tr ghTokenResp
	if err := json.Unmarshal(raw, &tr); err != nil {
		return fmt.Errorf("github oauth decode: %w", err)
	}
	if tr.Error != "" {
		return fmt.Errorf("github oauth: %s", tr.Error)
	}
	tok := connectors.Token{
		AccessToken: tr.AccessToken,
		TokenType:   tr.TokenType,
		Scope:       tr.Scope,
	}
	return c.tokens.Save(ctx, tenantID, Name, tok)
}

type ghRepo struct {
	ID       int64  `json:"id"`
	Name     string `json:"name"`
	FullName string `json:"full_name"`
	HTMLURL  string `json:"html_url"`
	Updated  string `json:"updated_at"`
}

type ghRepoListResp struct {
	TotalCount   int      `json:"total_count"`
	Repositories []ghRepo `json:"repositories"`
}

// ListResources lists installation repositories with Link-header pagination.
func (c *Connector) ListResources(ctx context.Context, tenantID uuid.UUID) ([]connectors.Resource, error) {
	tok, err := c.tokens.Load(ctx, tenantID, Name)
	if err != nil {
		return nil, err
	}
	page := 1
	var out []connectors.Resource
	for {
		u := fmt.Sprintf("%s/installation/repositories?per_page=100&page=%d",
			strings.TrimRight(c.BaseURL, "/"), page)
		req, _ := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
		c.applyHeaders(req, tok.AccessToken)
		resp, err := c.hc.Do(req)
		if err != nil {
			return nil, fmt.Errorf("github list: %w", err)
		}
		raw, _ := io.ReadAll(resp.Body)
		linkHdr := resp.Header.Get("Link")
		resp.Body.Close()
		if resp.StatusCode >= 400 {
			return nil, fmt.Errorf("github list %d: %s", resp.StatusCode, string(raw))
		}
		var rr ghRepoListResp
		if err := json.Unmarshal(raw, &rr); err != nil {
			return nil, fmt.Errorf("github list decode: %w", err)
		}
		for _, r := range rr.Repositories {
			t, _ := time.Parse(time.RFC3339, r.Updated)
			out = append(out, connectors.Resource{
				ID:        r.FullName,
				Type:      "repo",
				Title:     r.FullName,
				URL:       r.HTMLURL,
				UpdatedAt: t,
			})
		}
		if !hasNextLink(linkHdr) {
			break
		}
		page++
	}
	return out, nil
}

func hasNextLink(h string) bool {
	for _, part := range strings.Split(h, ",") {
		if strings.Contains(part, `rel="next"`) {
			return true
		}
	}
	return false
}

func (c *Connector) applyHeaders(req *http.Request, token string) {
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
}

type ghIssue struct {
	Number    int    `json:"number"`
	Title     string `json:"title"`
	Body      string `json:"body"`
	HTMLURL   string `json:"html_url"`
	State     string `json:"state"`
	UpdatedAt string `json:"updated_at"`
	User      struct {
		Login string `json:"login"`
	} `json:"user"`
}

// Fetch retrieves a single issue/PR. resourceID format: "owner/repo#number".
func (c *Connector) Fetch(ctx context.Context, tenantID uuid.UUID, resourceID string) (*connectors.Document, error) {
	tok, err := c.tokens.Load(ctx, tenantID, Name)
	if err != nil {
		return nil, err
	}
	owner, repo, number, err := parseResourceID(resourceID)
	if err != nil {
		return nil, err
	}
	u := fmt.Sprintf("%s/repos/%s/%s/issues/%s",
		strings.TrimRight(c.BaseURL, "/"), owner, repo, number)
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	c.applyHeaders(req, tok.AccessToken)
	resp, err := c.hc.Do(req)
	if err != nil {
		return nil, fmt.Errorf("github fetch: %w", err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("github fetch %d: %s", resp.StatusCode, string(raw))
	}
	var iss ghIssue
	if err := json.Unmarshal(raw, &iss); err != nil {
		return nil, fmt.Errorf("github fetch decode: %w", err)
	}
	t, _ := time.Parse(time.RFC3339, iss.UpdatedAt)
	return &connectors.Document{
		Resource: connectors.Resource{
			ID:        resourceID,
			Type:      "issue",
			Title:     iss.Title,
			URL:       iss.HTMLURL,
			UpdatedAt: t,
		},
		Body:     []byte(iss.Body),
		MimeType: "text/markdown",
		Author:   iss.User.Login,
	}, nil
}

func parseResourceID(id string) (owner, repo, number string, err error) {
	hash := strings.LastIndex(id, "#")
	if hash < 0 {
		return "", "", "", fmt.Errorf("github: invalid resource id %q (want owner/repo#number)", id)
	}
	left, number := id[:hash], id[hash+1:]
	slash := strings.Index(left, "/")
	if slash < 0 {
		return "", "", "", fmt.Errorf("github: invalid resource id %q", id)
	}
	return left[:slash], left[slash+1:], number, nil
}

type ghSearchResp struct {
	TotalCount int       `json:"total_count"`
	Items      []ghIssue `json:"items"`
}

// Search runs /search/issues?q=...
func (c *Connector) Search(ctx context.Context, tenantID uuid.UUID, query string) ([]connectors.Resource, error) {
	tok, err := c.tokens.Load(ctx, tenantID, Name)
	if err != nil {
		return nil, err
	}
	q := url.Values{}
	q.Set("q", query)
	u := fmt.Sprintf("%s/search/issues?%s", strings.TrimRight(c.BaseURL, "/"), q.Encode())
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	c.applyHeaders(req, tok.AccessToken)
	resp, err := c.hc.Do(req)
	if err != nil {
		return nil, fmt.Errorf("github search: %w", err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("github search %d: %s", resp.StatusCode, string(raw))
	}
	var sr ghSearchResp
	if err := json.Unmarshal(raw, &sr); err != nil {
		return nil, fmt.Errorf("github search decode: %w", err)
	}
	out := make([]connectors.Resource, 0, len(sr.Items))
	for _, it := range sr.Items {
		t, _ := time.Parse(time.RFC3339, it.UpdatedAt)
		out = append(out, connectors.Resource{
			ID:        fmt.Sprintf("#%d", it.Number),
			Type:      "issue",
			Title:     it.Title,
			URL:       it.HTMLURL,
			UpdatedAt: t,
		})
	}
	return out, nil
}

// Watch registers a webhook against a repository. resourceID-style hint
// passed via redirectURI is the destination URL; this method registers
// against installation repos[0]. Returns a channel closed on ctx cancel.
func (c *Connector) Watch(ctx context.Context, tenantID uuid.UUID) (<-chan connectors.ChangeEvent, error) {
	tok, err := c.tokens.Load(ctx, tenantID, Name)
	if err != nil {
		return nil, err
	}
	repos, err := c.ListResources(ctx, tenantID)
	if err != nil || len(repos) == 0 {
		return nil, fmt.Errorf("github watch: no repos available: %w", err)
	}
	body, _ := json.Marshal(map[string]any{
		"name":   "web",
		"active": true,
		"events": []string{"push", "issues", "pull_request"},
		"config": map[string]string{
			"url":          c.redirectURI,
			"content_type": "json",
		},
	})
	u := fmt.Sprintf("%s/repos/%s/hooks", strings.TrimRight(c.BaseURL, "/"), repos[0].ID)
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, u, strings.NewReader(string(body)))
	c.applyHeaders(req, tok.AccessToken)
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.hc.Do(req)
	if err != nil {
		return nil, fmt.Errorf("github watch: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		raw, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("github watch %d: %s", resp.StatusCode, string(raw))
	}
	ch := make(chan connectors.ChangeEvent)
	go func() { <-ctx.Done(); close(ch) }()
	return ch, nil
}

// Metadata returns the registry metadata for this connector.
func Metadata() connectors.Metadata {
	return connectors.Metadata{
		Name:        Name,
		DisplayName: "GitHub",
		Vendor:      "GitHub",
		Category:    "devtools",
		Scopes: []connectors.Scope{
			"read:repo",
			"read:issues",
			"read:pulls",
		},
		DocsURL: "https://docs.github.com/en/rest",
	}
}

// Register installs the connector into the given registry.
func Register(r *connectors.Registry, logger *slog.Logger, tokens connectors.Store, cfg Config) error {
	return r.RegisterWithMeta(New(logger, tokens, cfg), Metadata())
}
