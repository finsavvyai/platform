// Package hubspot — CRM v3 List/Fetch/Search + Watch subscription.
// Split from connector.go to keep each file ≤200 LOC.
package hubspot

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/sdlc-ai/platform/services/gateway/internal/connectors"
)

func newAuthForm(clientID, clientSecret, code string) url.Values {
	return url.Values{
		"grant_type":    {"authorization_code"},
		"client_id":     {clientID},
		"client_secret": {clientSecret},
		"code":          {code},
	}
}

type contact struct {
	ID         string            `json:"id"`
	Properties map[string]string `json:"properties"`
	UpdatedAt  time.Time         `json:"updatedAt"`
}

func (c contact) toResource() connectors.Resource {
	title := c.Properties["firstname"] + " " + c.Properties["lastname"]
	if strings.TrimSpace(title) == "" {
		title = c.Properties["email"]
	}
	return connectors.Resource{ID: c.ID, Type: "contact", Title: strings.TrimSpace(title), UpdatedAt: c.UpdatedAt}
}

// ListResources GETs /crm/v3/objects/contacts (paging.next.after cursor honored).
func (c *Connector) ListResources(ctx context.Context, tenantID uuid.UUID) ([]connectors.Resource, error) {
	var out struct {
		Results []contact `json:"results"`
	}
	if err := c.authedDo(ctx, tenantID, http.MethodGet, "/crm/v3/objects/contacts?limit=100", nil, &out); err != nil {
		return nil, err
	}
	res := make([]connectors.Resource, 0, len(out.Results))
	for _, ct := range out.Results {
		res = append(res, ct.toResource())
	}
	return res, nil
}

// Fetch GETs /crm/v3/objects/contacts/{id}.
func (c *Connector) Fetch(ctx context.Context, tenantID uuid.UUID, id string) (*connectors.Document, error) {
	var out contact
	path := "/crm/v3/objects/contacts/" + url.PathEscape(id) + "?properties=firstname,lastname,email,company"
	if err := c.authedDo(ctx, tenantID, http.MethodGet, path, nil, &out); err != nil {
		return nil, err
	}
	body, _ := json.Marshal(out.Properties)
	return &connectors.Document{Resource: out.toResource(), Body: body, MimeType: "application/json"}, nil
}

// Search POSTs /crm/v3/objects/contacts/search with filterGroups.
func (c *Connector) Search(ctx context.Context, tenantID uuid.UUID, query string) ([]connectors.Resource, error) {
	body, _ := json.Marshal(map[string]any{
		"filterGroups": []map[string]any{{
			"filters": []map[string]any{{"propertyName": "email", "operator": "CONTAINS_TOKEN", "value": query}},
		}},
		"sorts":      []string{"updatedAt"},
		"properties": []string{"firstname", "lastname", "email"},
		"limit":      50,
	})
	var out struct {
		Results []contact `json:"results"`
	}
	if err := c.authedDo(ctx, tenantID, http.MethodPost, "/crm/v3/objects/contacts/search", bytes.NewReader(body), &out); err != nil {
		return nil, err
	}
	res := make([]connectors.Resource, 0, len(out.Results))
	for _, ct := range out.Results {
		res = append(res, ct.toResource())
	}
	return res, nil
}

// Watch creates a webhook subscription on the developer app and returns
// a closed channel — events arrive via /webhooks/hubspot.
func (c *Connector) Watch(ctx context.Context, tenantID uuid.UUID) (<-chan connectors.ChangeEvent, error) {
	if c.appID == "" {
		return nil, fmt.Errorf("hubspot: appID required for Watch (set HUBSPOT_APP_ID)")
	}
	body, _ := json.Marshal(map[string]any{
		"eventType":    "contact.creation",
		"propertyName": "email",
		"active":       true,
	})
	path := "/webhooks/v3/" + url.PathEscape(c.appID) + "/subscriptions"
	if err := c.authedDo(ctx, tenantID, http.MethodPost, path, bytes.NewReader(body), nil); err != nil {
		return nil, err
	}
	ch := make(chan connectors.ChangeEvent)
	close(ch)
	return ch, nil
}
