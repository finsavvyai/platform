// Package slack is the REAL Slack connector.
// Indexes channel + group history. search.messages requires paid tier.
//
// API references:
//   - OAuth v2:        https://api.slack.com/authentication/oauth-v2
//   - conversations.*: https://api.slack.com/methods/conversations.list
//   - search.messages: https://api.slack.com/methods/search.messages
//
// Status: REAL HTTP client. Needs SLACK_CLIENT_ID / SLACK_CLIENT_SECRET
// at runtime. Tests use httptest.NewServer + an in-memory TokenStore.
package slack

import (
	"context"
	"encoding/json"
	"errors"
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
const Name = "slack"

// ErrTierLimited is returned when search.messages is called against a
// workspace that lacks the required paid plan.
var ErrTierLimited = errors.New("slack: search.messages requires paid workspace")

var oauthScopes = []string{
	"channels:history", "channels:read", "groups:read", "users:read",
}

// Connector is the REAL Slack connector.
type Connector struct {
	logger       *slog.Logger
	tokens       connectors.Store
	hc           *http.Client
	clientID     string
	clientSecret string
	redirectURI  string

	// BaseURL points at https://slack.com in prod.
	BaseURL string
}

// Config bundles runtime credentials.
type Config struct {
	ClientID     string
	ClientSecret string
	RedirectURI  string
}

// New returns a configured Slack connector.
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
		BaseURL:      "https://slack.com",
	}
}

// Name returns the canonical id.
func (c *Connector) Name() string { return Name }

type slackOAuthResp struct {
	OK          bool   `json:"ok"`
	Error       string `json:"error"`
	AccessToken string `json:"access_token"`
	TokenType   string `json:"token_type"`
	Scope       string `json:"scope"`
	BotUserID   string `json:"bot_user_id"`
	Team        struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	} `json:"team"`
}

// Authenticate exchanges an OAuth code via /api/oauth.v2.access.
func (c *Connector) Authenticate(ctx context.Context, tenantID uuid.UUID, code string) error {
	form := url.Values{}
	form.Set("code", code)
	form.Set("client_id", c.clientID)
	form.Set("client_secret", c.clientSecret)
	form.Set("redirect_uri", c.redirectURI)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		strings.TrimRight(c.BaseURL, "/")+"/api/oauth.v2.access", strings.NewReader(form.Encode()))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := c.hc.Do(req)
	if err != nil {
		return fmt.Errorf("slack oauth: %w", err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return fmt.Errorf("slack oauth %d: %s", resp.StatusCode, string(raw))
	}
	var or slackOAuthResp
	if err := json.Unmarshal(raw, &or); err != nil {
		return fmt.Errorf("slack oauth decode: %w", err)
	}
	if !or.OK {
		return fmt.Errorf("slack oauth: %s", or.Error)
	}
	tok := connectors.Token{
		AccessToken: or.AccessToken,
		TokenType:   or.TokenType,
		Scope:       or.Scope,
		Extra: map[string]string{
			"team_id":     or.Team.ID,
			"bot_user_id": or.BotUserID,
		},
	}
	return c.tokens.Save(ctx, tenantID, Name, tok)
}

type slackChannel struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	IsPrivate  bool   `json:"is_private"`
	NumMembers int    `json:"num_members"`
	Updated    int64  `json:"updated"`
}

type convListResp struct {
	OK               bool           `json:"ok"`
	Error            string         `json:"error"`
	Channels         []slackChannel `json:"channels"`
	ResponseMetadata struct {
		NextCursor string `json:"next_cursor"`
	} `json:"response_metadata"`
}

// ListResources lists conversations with cursor pagination.
func (c *Connector) ListResources(ctx context.Context, tenantID uuid.UUID) ([]connectors.Resource, error) {
	tok, err := c.tokens.Load(ctx, tenantID, Name)
	if err != nil {
		return nil, err
	}
	var out []connectors.Resource
	cursor := ""
	for {
		q := url.Values{}
		q.Set("limit", "200")
		q.Set("types", "public_channel,private_channel")
		if cursor != "" {
			q.Set("cursor", cursor)
		}
		page, err := c.convList(ctx, tok.AccessToken, q)
		if err != nil {
			return nil, err
		}
		for _, ch := range page.Channels {
			out = append(out, connectors.Resource{
				ID:        ch.ID,
				Type:      "channel",
				Title:     ch.Name,
				URL:       fmt.Sprintf("https://slack.com/archives/%s", ch.ID),
				UpdatedAt: time.Unix(ch.Updated/1000, 0),
			})
		}
		if page.ResponseMetadata.NextCursor == "" {
			break
		}
		cursor = page.ResponseMetadata.NextCursor
	}
	return out, nil
}

func (c *Connector) convList(ctx context.Context, accessToken string, q url.Values) (*convListResp, error) {
	u := strings.TrimRight(c.BaseURL, "/") + "/api/conversations.list?" + q.Encode()
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	req.Header.Set("Authorization", "Bearer "+accessToken)
	resp, err := c.hc.Do(req)
	if err != nil {
		return nil, fmt.Errorf("slack conv list: %w", err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("slack conv list %d: %s", resp.StatusCode, string(raw))
	}
	var cl convListResp
	if err := json.Unmarshal(raw, &cl); err != nil {
		return nil, fmt.Errorf("slack conv list decode: %w", err)
	}
	if !cl.OK {
		return nil, fmt.Errorf("slack conv list: %s", cl.Error)
	}
	return &cl, nil
}

type slackMessage struct {
	Type string `json:"type"`
	User string `json:"user"`
	Text string `json:"text"`
	TS   string `json:"ts"`
}

type historyResp struct {
	OK       bool           `json:"ok"`
	Error    string         `json:"error"`
	Messages []slackMessage `json:"messages"`
}

// Fetch returns the recent history for a single channel.
func (c *Connector) Fetch(ctx context.Context, tenantID uuid.UUID, resourceID string) (*connectors.Document, error) {
	tok, err := c.tokens.Load(ctx, tenantID, Name)
	if err != nil {
		return nil, err
	}
	q := url.Values{}
	q.Set("channel", resourceID)
	q.Set("limit", "200")
	u := strings.TrimRight(c.BaseURL, "/") + "/api/conversations.history?" + q.Encode()
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	req.Header.Set("Authorization", "Bearer "+tok.AccessToken)
	resp, err := c.hc.Do(req)
	if err != nil {
		return nil, fmt.Errorf("slack history: %w", err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("slack history %d: %s", resp.StatusCode, string(raw))
	}
	var hr historyResp
	if err := json.Unmarshal(raw, &hr); err != nil {
		return nil, fmt.Errorf("slack history decode: %w", err)
	}
	if !hr.OK {
		return nil, fmt.Errorf("slack history: %s", hr.Error)
	}
	var sb strings.Builder
	for _, m := range hr.Messages {
		sb.WriteString(m.User)
		sb.WriteString(": ")
		sb.WriteString(m.Text)
		sb.WriteString("\n")
	}
	return &connectors.Document{
		Resource: connectors.Resource{
			ID:    resourceID,
			Type:  "channel_history",
			Title: resourceID,
			URL:   fmt.Sprintf("https://slack.com/archives/%s", resourceID),
		},
		Body:     []byte(sb.String()),
		MimeType: "text/plain",
	}, nil
}

type searchResp struct {
	OK       bool   `json:"ok"`
	Error    string `json:"error"`
	Messages struct {
		Matches []struct {
			Channel struct {
				ID   string `json:"id"`
				Name string `json:"name"`
			} `json:"channel"`
			User      string `json:"user"`
			Text      string `json:"text"`
			Permalink string `json:"permalink"`
			TS        string `json:"ts"`
		} `json:"matches"`
	} `json:"messages"`
}

// Search runs search.messages. Returns ErrTierLimited on free workspaces.
func (c *Connector) Search(ctx context.Context, tenantID uuid.UUID, query string) ([]connectors.Resource, error) {
	tok, err := c.tokens.Load(ctx, tenantID, Name)
	if err != nil {
		return nil, err
	}
	q := url.Values{}
	q.Set("query", query)
	q.Set("count", "100")
	u := strings.TrimRight(c.BaseURL, "/") + "/api/search.messages?" + q.Encode()
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	req.Header.Set("Authorization", "Bearer "+tok.AccessToken)
	resp, err := c.hc.Do(req)
	if err != nil {
		return nil, fmt.Errorf("slack search: %w", err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("slack search %d: %s", resp.StatusCode, string(raw))
	}
	var sr searchResp
	if err := json.Unmarshal(raw, &sr); err != nil {
		return nil, fmt.Errorf("slack search decode: %w", err)
	}
	if !sr.OK {
		if sr.Error == "not_allowed_token_type" || sr.Error == "team_not_authorized" || sr.Error == "paid_only" {
			return nil, ErrTierLimited
		}
		return nil, fmt.Errorf("slack search: %s", sr.Error)
	}
	out := make([]connectors.Resource, 0, len(sr.Messages.Matches))
	for _, m := range sr.Messages.Matches {
		out = append(out, connectors.Resource{
			ID:    m.Channel.ID + ":" + m.TS,
			Type:  "message",
			Title: m.Text,
			URL:   m.Permalink,
		})
	}
	return out, nil
}

// Watch subscribes to the Events API by configuring an event subscription.
func (c *Connector) Watch(ctx context.Context, tenantID uuid.UUID) (<-chan connectors.ChangeEvent, error) {
	tok, err := c.tokens.Load(ctx, tenantID, Name)
	if err != nil {
		return nil, err
	}
	body, _ := json.Marshal(map[string]any{
		"events_url": c.redirectURI,
		"events":     []string{"message.channels", "message.groups"},
	})
	u := strings.TrimRight(c.BaseURL, "/") + "/api/apps.event.subscriptions.update"
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, u, strings.NewReader(string(body)))
	req.Header.Set("Authorization", "Bearer "+tok.AccessToken)
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.hc.Do(req)
	if err != nil {
		return nil, fmt.Errorf("slack watch: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		raw, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("slack watch %d: %s", resp.StatusCode, string(raw))
	}
	ch := make(chan connectors.ChangeEvent)
	go func() { <-ctx.Done(); close(ch) }()
	return ch, nil
}

// Metadata returns the registry metadata for this connector.
func Metadata() connectors.Metadata {
	return connectors.Metadata{
		Name:        Name,
		DisplayName: "Slack",
		Vendor:      "Slack",
		Category:    "communication",
		Scopes: []connectors.Scope{
			"read:channels",
			"read:messages",
			"read:private_channels",
		},
		DocsURL: "https://api.slack.com/",
	}
}

// Register installs the connector into the given registry.
func Register(r *connectors.Registry, logger *slog.Logger, tokens connectors.Store, cfg Config) error {
	return r.RegisterWithMeta(New(logger, tokens, cfg), Metadata())
}

// OAuthScopes exposes the Slack OAuth scopes for the redirect URL.
func OAuthScopes() []string { return append([]string(nil), oauthScopes...) }
