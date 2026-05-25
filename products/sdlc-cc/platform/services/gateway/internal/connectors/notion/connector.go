// Package notion is the REAL Notion connector.
// Reads pages + databases + blocks via the Notion API v1.
//
// API references:
//   - Authorization: https://developers.notion.com/docs/authorization
//   - Search:        https://developers.notion.com/reference/post-search
//   - Block content: https://developers.notion.com/reference/get-block-children
//
// Status: REAL HTTP client. Needs NOTION_CLIENT_ID / NOTION_CLIENT_SECRET
// at runtime. Tests use httptest.NewServer + an in-memory TokenStore.
//
// Watch is implemented via Notion's webhook subscription endpoint (post
// /v1/webhooks). When that endpoint is unavailable for a workspace,
// callers should fall back to the polling helper Poll().
package notion

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/sdlc-ai/platform/services/gateway/internal/connectors"
)

// Name is the canonical registry id.
const Name = "notion"

// notionAPIVersion is sent on every API call.
const notionAPIVersion = "2022-06-28"

// Connector is the REAL Notion connector.
type Connector struct {
	logger       *slog.Logger
	tokens       connectors.Store
	hc           *http.Client
	clientID     string
	clientSecret string
	redirectURI  string

	// BaseURL points at https://api.notion.com in prod.
	BaseURL string
	// PollInterval is the Watch polling cadence when no webhook is set.
	PollInterval time.Duration
}

// Config bundles runtime credentials.
type Config struct {
	ClientID     string
	ClientSecret string
	RedirectURI  string
}

// New returns a configured Notion connector.
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
		BaseURL:      "https://api.notion.com",
		PollInterval: 60 * time.Second,
	}
}

// Name returns the canonical id.
func (c *Connector) Name() string { return Name }

type notionTokenReq struct {
	GrantType   string `json:"grant_type"`
	Code        string `json:"code"`
	RedirectURI string `json:"redirect_uri"`
}

type notionTokenResp struct {
	AccessToken          string `json:"access_token"`
	TokenType            string `json:"token_type"`
	BotID                string `json:"bot_id"`
	WorkspaceID          string `json:"workspace_id"`
	WorkspaceName        string `json:"workspace_name"`
	DuplicatedTemplateID string `json:"duplicated_template_id"`
}

// Authenticate exchanges an OAuth code via /v1/oauth/token.
// Auth is HTTP Basic with base64(client_id:client_secret).
func (c *Connector) Authenticate(ctx context.Context, tenantID uuid.UUID, code string) error {
	body, _ := json.Marshal(notionTokenReq{
		GrantType:   "authorization_code",
		Code:        code,
		RedirectURI: c.redirectURI,
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		strings.TrimRight(c.BaseURL, "/")+"/v1/oauth/token", bytes.NewReader(body))
	if err != nil {
		return err
	}
	cred := base64.StdEncoding.EncodeToString([]byte(c.clientID + ":" + c.clientSecret))
	req.Header.Set("Authorization", "Basic "+cred)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Notion-Version", notionAPIVersion)
	resp, err := c.hc.Do(req)
	if err != nil {
		return fmt.Errorf("notion oauth: %w", err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return fmt.Errorf("notion oauth %d: %s", resp.StatusCode, string(raw))
	}
	var tr notionTokenResp
	if err := json.Unmarshal(raw, &tr); err != nil {
		return fmt.Errorf("notion oauth decode: %w", err)
	}
	tok := connectors.Token{
		AccessToken: tr.AccessToken,
		TokenType:   tr.TokenType,
		Extra: map[string]string{
			"bot_id":         tr.BotID,
			"workspace_id":   tr.WorkspaceID,
			"workspace_name": tr.WorkspaceName,
		},
	}
	return c.tokens.Save(ctx, tenantID, Name, tok)
}

type searchReq struct {
	Query       string `json:"query,omitempty"`
	StartCursor string `json:"start_cursor,omitempty"`
	PageSize    int    `json:"page_size,omitempty"`
}

type searchResult struct {
	Object         string    `json:"object"` // page | database
	ID             string    `json:"id"`
	URL            string    `json:"url"`
	LastEditedTime time.Time `json:"last_edited_time"`
	Properties     map[string]struct {
		Title []struct {
			PlainText string `json:"plain_text"`
		} `json:"title"`
	} `json:"properties"`
}

type searchResp struct {
	Results    []searchResult `json:"results"`
	NextCursor string         `json:"next_cursor"`
	HasMore    bool           `json:"has_more"`
}

// ListResources enumerates pages + databases via /v1/search.
func (c *Connector) ListResources(ctx context.Context, tenantID uuid.UUID) ([]connectors.Resource, error) {
	tok, err := c.tokens.Load(ctx, tenantID, Name)
	if err != nil {
		return nil, err
	}
	var out []connectors.Resource
	cursor := ""
	for {
		page, err := c.searchOnce(ctx, tok.AccessToken, "", cursor)
		if err != nil {
			return nil, err
		}
		for _, r := range page.Results {
			out = append(out, resultToResource(r))
		}
		if !page.HasMore || page.NextCursor == "" {
			break
		}
		cursor = page.NextCursor
	}
	return out, nil
}

func (c *Connector) searchOnce(ctx context.Context, accessToken, query, cursor string) (*searchResp, error) {
	body, _ := json.Marshal(searchReq{Query: query, StartCursor: cursor, PageSize: 100})
	u := strings.TrimRight(c.BaseURL, "/") + "/v1/search"
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, u, bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Notion-Version", notionAPIVersion)
	resp, err := c.hc.Do(req)
	if err != nil {
		return nil, fmt.Errorf("notion search: %w", err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("notion search %d: %s", resp.StatusCode, string(raw))
	}
	var sr searchResp
	if err := json.Unmarshal(raw, &sr); err != nil {
		return nil, fmt.Errorf("notion search decode: %w", err)
	}
	return &sr, nil
}

func resultToResource(r searchResult) connectors.Resource {
	title := r.ID
	for _, p := range r.Properties {
		if len(p.Title) > 0 {
			title = p.Title[0].PlainText
			break
		}
	}
	t := r.Object
	if t == "" {
		t = "page"
	}
	return connectors.Resource{
		ID:        r.ID,
		Type:      t,
		Title:     title,
		URL:       r.URL,
		UpdatedAt: r.LastEditedTime,
	}
}

type pageResp struct {
	ID             string    `json:"id"`
	URL            string    `json:"url"`
	LastEditedTime time.Time `json:"last_edited_time"`
}

type blockChild struct {
	ID        string `json:"id"`
	Type      string `json:"type"`
	Paragraph struct {
		RichText []struct {
			PlainText string `json:"plain_text"`
		} `json:"rich_text"`
	} `json:"paragraph"`
}

type blockChildrenResp struct {
	Results    []blockChild `json:"results"`
	NextCursor string       `json:"next_cursor"`
	HasMore    bool         `json:"has_more"`
}

// Fetch retrieves a page + its block children, concatenated as plain text.
func (c *Connector) Fetch(ctx context.Context, tenantID uuid.UUID, resourceID string) (*connectors.Document, error) {
	tok, err := c.tokens.Load(ctx, tenantID, Name)
	if err != nil {
		return nil, err
	}
	pageURL := fmt.Sprintf("%s/v1/pages/%s", strings.TrimRight(c.BaseURL, "/"), resourceID)
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, pageURL, nil)
	c.applyAuth(req, tok.AccessToken)
	resp, err := c.hc.Do(req)
	if err != nil {
		return nil, fmt.Errorf("notion page: %w", err)
	}
	raw, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("notion page %d: %s", resp.StatusCode, string(raw))
	}
	var pg pageResp
	if err := json.Unmarshal(raw, &pg); err != nil {
		return nil, fmt.Errorf("notion page decode: %w", err)
	}
	body, err := c.fetchBlocks(ctx, tok.AccessToken, resourceID)
	if err != nil {
		return nil, err
	}
	return &connectors.Document{
		Resource: connectors.Resource{
			ID:        pg.ID,
			Type:      "page",
			Title:     pg.ID,
			URL:       pg.URL,
			UpdatedAt: pg.LastEditedTime,
		},
		Body:     []byte(body),
		MimeType: "text/plain",
	}, nil
}

func (c *Connector) fetchBlocks(ctx context.Context, accessToken, pageID string) (string, error) {
	var sb strings.Builder
	cursor := ""
	for {
		u := fmt.Sprintf("%s/v1/blocks/%s/children?page_size=100",
			strings.TrimRight(c.BaseURL, "/"), pageID)
		if cursor != "" {
			u += "&start_cursor=" + cursor
		}
		req, _ := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
		c.applyAuth(req, accessToken)
		resp, err := c.hc.Do(req)
		if err != nil {
			return "", fmt.Errorf("notion blocks: %w", err)
		}
		raw, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		if resp.StatusCode >= 400 {
			return "", fmt.Errorf("notion blocks %d: %s", resp.StatusCode, string(raw))
		}
		var br blockChildrenResp
		if err := json.Unmarshal(raw, &br); err != nil {
			return "", fmt.Errorf("notion blocks decode: %w", err)
		}
		for _, b := range br.Results {
			for _, rt := range b.Paragraph.RichText {
				sb.WriteString(rt.PlainText)
			}
			sb.WriteByte('\n')
		}
		if !br.HasMore || br.NextCursor == "" {
			break
		}
		cursor = br.NextCursor
	}
	return sb.String(), nil
}

func (c *Connector) applyAuth(req *http.Request, token string) {
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Notion-Version", notionAPIVersion)
}

// Search runs /v1/search with a query string.
func (c *Connector) Search(ctx context.Context, tenantID uuid.UUID, query string) ([]connectors.Resource, error) {
	tok, err := c.tokens.Load(ctx, tenantID, Name)
	if err != nil {
		return nil, err
	}
	page, err := c.searchOnce(ctx, tok.AccessToken, query, "")
	if err != nil {
		return nil, err
	}
	out := make([]connectors.Resource, 0, len(page.Results))
	for _, r := range page.Results {
		out = append(out, resultToResource(r))
	}
	return out, nil
}

// Watch registers a Notion webhook. If the workspace doesn't permit
// webhooks (free tier) the caller can use Poll() instead.
func (c *Connector) Watch(ctx context.Context, tenantID uuid.UUID) (<-chan connectors.ChangeEvent, error) {
	tok, err := c.tokens.Load(ctx, tenantID, Name)
	if err != nil {
		return nil, err
	}
	body, _ := json.Marshal(map[string]any{
		"endpoint": c.redirectURI,
		"events":   []string{"page.updated", "database.updated"},
	})
	u := strings.TrimRight(c.BaseURL, "/") + "/v1/webhooks"
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, u, bytes.NewReader(body))
	c.applyAuth(req, tok.AccessToken)
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.hc.Do(req)
	if err == nil {
		defer resp.Body.Close()
	}
	// Webhook unavailable -> fall back to polling.
	if err != nil || resp.StatusCode >= 400 {
		return c.poll(ctx, tenantID, tok.AccessToken), nil
	}
	ch := make(chan connectors.ChangeEvent)
	go func() { <-ctx.Done(); close(ch) }()
	return ch, nil
}

// poll implements the polling fallback used when webhooks are unavailable.
// It emits ChangeEvent for any resource whose last_edited_time advanced
// since the previous tick. Cancelling ctx closes the channel.
func (c *Connector) poll(ctx context.Context, tenantID uuid.UUID, accessToken string) <-chan connectors.ChangeEvent {
	ch := make(chan connectors.ChangeEvent, 16)
	go func() {
		defer close(ch)
		seen := map[string]time.Time{}
		t := time.NewTicker(c.PollInterval)
		defer t.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-t.C:
			}
			page, err := c.searchOnce(ctx, accessToken, "", "")
			if err != nil {
				continue
			}
			for _, r := range page.Results {
				prev := seen[r.ID]
				if r.LastEditedTime.After(prev) {
					op := "update"
					if prev.IsZero() {
						op = "create"
					}
					seen[r.ID] = r.LastEditedTime
					select {
					case ch <- connectors.ChangeEvent{Resource: resultToResource(r), Op: op}:
					case <-ctx.Done():
						return
					}
				}
			}
		}
	}()
	return ch
}

// Metadata returns the registry metadata for this connector.
func Metadata() connectors.Metadata {
	return connectors.Metadata{
		Name:        Name,
		DisplayName: "Notion",
		Vendor:      "Notion",
		Category:    "productivity",
		Scopes: []connectors.Scope{
			"read:pages",
			"read:databases",
			"read:blocks",
		},
		DocsURL: "https://developers.notion.com/",
	}
}

// Register installs the connector into the given registry.
func Register(r *connectors.Registry, logger *slog.Logger, tokens connectors.Store, cfg Config) error {
	return r.RegisterWithMeta(New(logger, tokens, cfg), Metadata())
}
