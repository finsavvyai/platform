package zendesk

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/google/uuid"

	"github.com/sdlc-ai/platform/services/gateway/internal/connectors"
)

func newTestConnector(t *testing.T, h http.HandlerFunc) (*Connector, *httptest.Server, uuid.UUID) {
	t.Helper()
	srv := httptest.NewServer(h)
	t.Cleanup(srv.Close)
	c := New(nil, connectors.NewMemoryStore(), "cid", "csec", "acme")
	c.BaseURL = srv.URL
	return c, srv, uuid.New()
}

func TestAuthenticate_Success(t *testing.T) {
	c, _, tid := newTestConnector(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/oauth/tokens" || r.Method != http.MethodPost {
			t.Fatalf("unexpected %s %s", r.Method, r.URL.Path)
		}
		var body map[string]string
		_ = json.NewDecoder(r.Body).Decode(&body)
		if body["code"] != "abc" {
			t.Fatalf("missing code: %v", body)
		}
		_ = json.NewEncoder(w).Encode(map[string]string{"access_token": "tok-1", "token_type": "bearer", "scope": "read"})
	})
	if err := c.Authenticate(context.Background(), tid, "abc"); err != nil {
		t.Fatalf("Authenticate: %v", err)
	}
	tok, err := c.tokens.Load(context.Background(), tid, Name)
	if err != nil || tok.AccessToken != "tok-1" {
		t.Fatalf("token not stored: %v %#v", err, tok)
	}
}

func TestAuthenticate_BadStatus(t *testing.T) {
	c, _, tid := newTestConnector(t, func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, `{"error":"invalid_grant"}`, http.StatusUnauthorized)
	})
	err := c.Authenticate(context.Background(), tid, "bad")
	if err == nil || !strings.Contains(err.Error(), "401") {
		t.Fatalf("expected 401 error, got %v", err)
	}
}

func TestListResources_ParsesTickets(t *testing.T) {
	c, _, tid := newTestConnector(t, func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/oauth/tokens":
			_ = json.NewEncoder(w).Encode(map[string]string{"access_token": "tok"})
		case "/api/v2/tickets.json":
			if r.Header.Get("Authorization") != "Bearer tok" {
				t.Fatalf("missing bearer: %v", r.Header)
			}
			_, _ = w.Write([]byte(`{"tickets":[{"id":1,"subject":"hi","url":"u","updated_at":"2024-01-02T03:04:05Z"},{"id":2,"subject":"bye"}]}`))
		default:
			t.Fatalf("unexpected path %s", r.URL.Path)
		}
	})
	if err := c.Authenticate(context.Background(), tid, "x"); err != nil {
		t.Fatalf("auth: %v", err)
	}
	res, err := c.ListResources(context.Background(), tid)
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(res) != 2 || res[0].ID != "1" || res[1].Title != "bye" {
		t.Fatalf("unexpected resources: %#v", res)
	}
}

func TestFetch_ReturnsDocument(t *testing.T) {
	c, _, tid := newTestConnector(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/oauth/tokens" {
			_ = json.NewEncoder(w).Encode(map[string]string{"access_token": "tok"})
			return
		}
		if r.URL.Path != "/api/v2/tickets/42.json" {
			t.Fatalf("path: %s", r.URL.Path)
		}
		_, _ = w.Write([]byte(`{"ticket":{"id":42,"subject":"S","description":"BODY"}}`))
	})
	_ = c.Authenticate(context.Background(), tid, "x")
	doc, err := c.Fetch(context.Background(), tid, "42")
	if err != nil {
		t.Fatalf("Fetch: %v", err)
	}
	if doc.Title != "S" || string(doc.Body) != "BODY" {
		t.Fatalf("doc: %#v", doc)
	}
}

func TestSearch_QueryEncoded(t *testing.T) {
	var got string
	c, _, tid := newTestConnector(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/oauth/tokens" {
			_ = json.NewEncoder(w).Encode(map[string]string{"access_token": "tok"})
			return
		}
		got = r.URL.RawQuery
		_, _ = w.Write([]byte(`{"results":[{"id":7,"subject":"found"}]}`))
	})
	_ = c.Authenticate(context.Background(), tid, "x")
	res, err := c.Search(context.Background(), tid, "type:ticket urgent")
	if err != nil {
		t.Fatalf("Search: %v", err)
	}
	if len(res) != 1 || res[0].Title != "found" {
		t.Fatalf("results: %#v", res)
	}
	if !strings.Contains(got, "query=") {
		t.Fatalf("expected query param, got %s", got)
	}
}

func TestWatch_RegistersWebhook(t *testing.T) {
	called := false
	c, _, tid := newTestConnector(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/oauth/tokens" {
			_ = json.NewEncoder(w).Encode(map[string]string{"access_token": "tok"})
			return
		}
		if r.URL.Path == "/api/v2/webhooks" && r.Method == http.MethodPost {
			called = true
			w.WriteHeader(http.StatusCreated)
			_, _ = w.Write([]byte(`{"webhook":{"id":"wh1"}}`))
			return
		}
		t.Fatalf("unexpected %s %s", r.Method, r.URL.Path)
	})
	_ = c.Authenticate(context.Background(), tid, "x")
	ch, err := c.Watch(context.Background(), tid)
	if err != nil {
		t.Fatalf("Watch: %v", err)
	}
	if !called {
		t.Fatalf("webhook endpoint not hit")
	}
	if _, ok := <-ch; ok {
		t.Fatalf("expected closed channel")
	}
}

func TestRegister_AddsToRegistry(t *testing.T) {
	r := connectors.NewRegistry()
	if err := Register(r, nil, nil, "cid", "csec", "acme"); err != nil {
		t.Fatalf("Register: %v", err)
	}
	if _, ok := r.Get(Name); !ok {
		t.Fatalf("not registered")
	}
}
