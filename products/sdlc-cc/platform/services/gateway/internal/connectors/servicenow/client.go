// Package servicenow — Table-API List/Fetch/Search + polling Watch.
// Split from connector.go to keep each file ≤200 LOC.
package servicenow

import (
	"context"
	"fmt"
	"net/url"
	"time"

	"github.com/google/uuid"

	"github.com/sdlc-ai/platform/services/gateway/internal/connectors"
)

type record struct {
	SysID        string `json:"sys_id"`
	Number       string `json:"number"`
	ShortDesc    string `json:"short_description"`
	Description  string `json:"description"`
	SysUpdatedOn string `json:"sys_updated_on"`
}

func (r record) toResource(tableName string) connectors.Resource {
	t, _ := time.Parse("2006-01-02 15:04:05", r.SysUpdatedOn)
	title := r.ShortDesc
	if title == "" {
		title = r.Number
	}
	return connectors.Resource{ID: r.SysID, Type: tableName, Title: title, UpdatedAt: t}
}

// ListResources GETs /api/now/table/{table} with sysparm_limit + offset.
func (c *Connector) ListResources(ctx context.Context, tenantID uuid.UUID) ([]connectors.Resource, error) {
	var out struct {
		Result []record `json:"result"`
	}
	path := fmt.Sprintf("/api/now/table/%s?sysparm_limit=100&sysparm_offset=0", url.PathEscape(c.table()))
	if err := c.authedGet(ctx, tenantID, path, &out); err != nil {
		return nil, err
	}
	res := make([]connectors.Resource, 0, len(out.Result))
	for _, r := range out.Result {
		res = append(res, r.toResource(c.table()))
	}
	return res, nil
}

// Fetch GETs /api/now/table/{table}/{sys_id}.
func (c *Connector) Fetch(ctx context.Context, tenantID uuid.UUID, id string) (*connectors.Document, error) {
	var out struct {
		Result record `json:"result"`
	}
	path := fmt.Sprintf("/api/now/table/%s/%s", url.PathEscape(c.table()), url.PathEscape(id))
	if err := c.authedGet(ctx, tenantID, path, &out); err != nil {
		return nil, err
	}
	r := out.Result
	return &connectors.Document{Resource: r.toResource(c.table()), Body: []byte(r.Description), MimeType: "text/plain"}, nil
}

// Search uses sysparm_query=encoded query against the same Table API.
func (c *Connector) Search(ctx context.Context, tenantID uuid.UUID, query string) ([]connectors.Resource, error) {
	var out struct {
		Result []record `json:"result"`
	}
	q := url.Values{"sysparm_query": {query}, "sysparm_limit": {"50"}}
	path := fmt.Sprintf("/api/now/table/%s?%s", url.PathEscape(c.table()), q.Encode())
	if err := c.authedGet(ctx, tenantID, path, &out); err != nil {
		return nil, err
	}
	res := make([]connectors.Resource, 0, len(out.Result))
	for _, r := range out.Result {
		res = append(res, r.toResource(c.table()))
	}
	return res, nil
}

// Watch polls the table for sys_updated_on > last tick and emits update
// events. Closes when ctx is cancelled. See package doc for the
// admin-Studio webhook rationale.
func (c *Connector) Watch(ctx context.Context, tenantID uuid.UUID) (<-chan connectors.ChangeEvent, error) {
	if _, err := c.tokens.Load(ctx, tenantID, Name); err != nil {
		return nil, fmt.Errorf("servicenow: load token: %w", err)
	}
	ch := make(chan connectors.ChangeEvent, 16)
	interval := c.PollInterval
	if interval <= 0 {
		interval = 30 * time.Second
	}
	go func() {
		defer close(ch)
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		var since time.Time
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				rs, err := c.ListResources(ctx, tenantID)
				if err != nil {
					c.logger.Warn("watch poll error", "err", err)
					continue
				}
				for _, r := range rs {
					if r.UpdatedAt.After(since) {
						ch <- connectors.ChangeEvent{Resource: r, Op: "update"}
					}
				}
				since = time.Now()
			}
		}
	}()
	return ch, nil
}
