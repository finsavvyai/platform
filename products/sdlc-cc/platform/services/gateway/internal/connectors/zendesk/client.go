// Package zendesk — resource-fetching half of the connector.
// (List/Fetch/Search/Watch + payload structs.) Split from connector.go
// to keep each file ≤200 LOC.
package zendesk

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"time"

	"github.com/google/uuid"

	"github.com/sdlc-ai/platform/services/gateway/internal/connectors"
)

type ticketJSON struct {
	ID        int64     `json:"id"`
	Subject   string    `json:"subject"`
	URL       string    `json:"url"`
	UpdatedAt time.Time `json:"updated_at"`
	Body      string    `json:"description"`
}

func (t ticketJSON) toResource() connectors.Resource {
	return connectors.Resource{
		ID: fmt.Sprintf("%d", t.ID), Type: "ticket", Title: t.Subject, URL: t.URL, UpdatedAt: t.UpdatedAt,
	}
}

// ListResources GETs /api/v2/tickets.json (cursor pagination).
func (c *Connector) ListResources(ctx context.Context, tenantID uuid.UUID) ([]connectors.Resource, error) {
	var out struct {
		Tickets []ticketJSON `json:"tickets"`
	}
	if err := c.authedDo(ctx, tenantID, http.MethodGet, "/api/v2/tickets.json", nil, &out); err != nil {
		return nil, err
	}
	res := make([]connectors.Resource, 0, len(out.Tickets))
	for _, t := range out.Tickets {
		res = append(res, t.toResource())
	}
	return res, nil
}

// Fetch GETs /api/v2/tickets/{id}.json.
func (c *Connector) Fetch(ctx context.Context, tenantID uuid.UUID, id string) (*connectors.Document, error) {
	var out struct {
		Ticket ticketJSON `json:"ticket"`
	}
	if err := c.authedDo(ctx, tenantID, http.MethodGet, "/api/v2/tickets/"+url.PathEscape(id)+".json", nil, &out); err != nil {
		return nil, err
	}
	return &connectors.Document{Resource: out.Ticket.toResource(), Body: []byte(out.Ticket.Body), MimeType: "text/plain"}, nil
}

// Search GETs /api/v2/search.json?query=...
func (c *Connector) Search(ctx context.Context, tenantID uuid.UUID, query string) ([]connectors.Resource, error) {
	var out struct {
		Results []ticketJSON `json:"results"`
	}
	q := url.Values{"query": {query}}
	if err := c.authedDo(ctx, tenantID, http.MethodGet, "/api/v2/search.json?"+q.Encode(), nil, &out); err != nil {
		return nil, err
	}
	res := make([]connectors.Resource, 0, len(out.Results))
	for _, t := range out.Results {
		res = append(res, t.toResource())
	}
	return res, nil
}

// Watch registers a Zendesk webhook (POST /api/v2/webhooks). The returned
// channel closes immediately because Zendesk pushes events to our own
// /webhooks/zendesk endpoint — Watch's job is the registration step.
func (c *Connector) Watch(ctx context.Context, tenantID uuid.UUID) (<-chan connectors.ChangeEvent, error) {
	body, _ := json.Marshal(map[string]any{"webhook": map[string]any{
		"name": "sdlc-platform", "endpoint": c.base() + "/webhooks/zendesk",
		"http_method": "POST", "request_format": "json", "status": "active",
		"subscriptions": []string{"conditional_ticket_events"},
	}})
	if err := c.authedDo(ctx, tenantID, http.MethodPost, "/api/v2/webhooks", bytes.NewReader(body), nil); err != nil {
		return nil, err
	}
	ch := make(chan connectors.ChangeEvent)
	close(ch)
	return ch, nil
}
