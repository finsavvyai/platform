package hubspot

import (
	"context"
	"encoding/json"
	"io"
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
	c := New(nil, connectors.NewMemoryStore(), "cid", "csec", "appid")
	c.BaseURL = srv.URL
	return c, srv, uuid.New()
}

func TestAuthenticate_FormBody(t *testing.T) {
	c, _, tid := newTestConnector(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/oauth/v1/token" {
			t.Fatalf("path: %s", r.URL.Path)
		}
		if r.Header.Get("Content-Type") != "application/x-www-form-urlencoded" {
			t.Fatalf("ct: %s", r.Header.Get("Content-Type"))
		}
		_ = r.ParseForm()
		if r.PostForm.Get("code") != "abc" {
			t.Fatalf("form: %v", r.PostForm)
		}
		_, _ = w.Write([]byte(`{"access_token":"AT","refresh_token":"RT","expires_in":1800}`))
	})
	if err := c.Authenticate(context.Background(), tid, "abc"); err != nil {
		t.Fatalf("Authenticate: %v", err)
	}
	tok, _ := c.tokens.Load(context.Background(), tid, Name)
	if tok.AccessToken != "AT" || tok.RefreshToken != "RT" || tok.Expiry.IsZero() {
		t.Fatalf("token: %#v", tok)
	}
}

func TestAuthenticate_Forbidden(t *testing.T) {
	c, _, tid := newTestConnector(t, func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, `{"status":"error"}`, http.StatusForbidden)
	})
	err := c.Authenticate(context.Background(), tid, "x")
	if err == nil || !strings.Contains(err.Error(), "403") {
		t.Fatalf("expected 403, got %v", err)
	}
}

func TestListResources_ContactsCRMv3(t *testing.T) {
	c, _, tid := newTestConnector(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/oauth/v1/token" {
			_, _ = w.Write([]byte(`{"access_token":"AT"}`))
			return
		}
		if !strings.HasPrefix(r.URL.Path, "/crm/v3/objects/contacts") {
			t.Fatalf("path: %s", r.URL.Path)
		}
		if r.Header.Get("Authorization") != "Bearer AT" {
			t.Fatalf("auth: %s", r.Header.Get("Authorization"))
		}
		_, _ = w.Write([]byte(`{"results":[{"id":"1","properties":{"firstname":"Ada","lastname":"Lovelace","email":"a@b"}}]}`))
	})
	_ = c.Authenticate(context.Background(), tid, "x")
	res, err := c.ListResources(context.Background(), tid)
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(res) != 1 || res[0].ID != "1" || res[0].Title != "Ada Lovelace" {
		t.Fatalf("res: %#v", res)
	}
}

func TestFetch_Contact(t *testing.T) {
	c, _, tid := newTestConnector(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/oauth/v1/token" {
			_, _ = w.Write([]byte(`{"access_token":"AT"}`))
			return
		}
		if !strings.HasPrefix(r.URL.Path, "/crm/v3/objects/contacts/55") {
			t.Fatalf("path: %s", r.URL.Path)
		}
		_, _ = w.Write([]byte(`{"id":"55","properties":{"email":"x@y","firstname":"Z","lastname":""}}`))
	})
	_ = c.Authenticate(context.Background(), tid, "x")
	d, err := c.Fetch(context.Background(), tid, "55")
	if err != nil {
		t.Fatalf("Fetch: %v", err)
	}
	if d.ID != "55" || d.MimeType != "application/json" {
		t.Fatalf("doc: %#v", d)
	}
}

func TestSearch_PostsFilterGroups(t *testing.T) {
	c, _, tid := newTestConnector(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/oauth/v1/token" {
			_, _ = w.Write([]byte(`{"access_token":"AT"}`))
			return
		}
		if r.Method != http.MethodPost || r.URL.Path != "/crm/v3/objects/contacts/search" {
			t.Fatalf("unexpected: %s %s", r.Method, r.URL.Path)
		}
		b, _ := io.ReadAll(r.Body)
		var got map[string]any
		_ = json.Unmarshal(b, &got)
		if _, ok := got["filterGroups"]; !ok {
			t.Fatalf("missing filterGroups: %s", string(b))
		}
		_, _ = w.Write([]byte(`{"results":[{"id":"7","properties":{"email":"hit@x"}}]}`))
	})
	_ = c.Authenticate(context.Background(), tid, "x")
	res, err := c.Search(context.Background(), tid, "hit")
	if err != nil {
		t.Fatalf("Search: %v", err)
	}
	if len(res) != 1 || res[0].ID != "7" {
		t.Fatalf("res: %#v", res)
	}
}

func TestWatch_PostsSubscription(t *testing.T) {
	hit := false
	c, _, tid := newTestConnector(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/oauth/v1/token" {
			_, _ = w.Write([]byte(`{"access_token":"AT"}`))
			return
		}
		if r.URL.Path == "/webhooks/v3/appid/subscriptions" && r.Method == http.MethodPost {
			hit = true
			w.WriteHeader(http.StatusCreated)
			_, _ = w.Write([]byte(`{"id":"sub1"}`))
			return
		}
		t.Fatalf("unexpected %s %s", r.Method, r.URL.Path)
	})
	_ = c.Authenticate(context.Background(), tid, "x")
	ch, err := c.Watch(context.Background(), tid)
	if err != nil {
		t.Fatalf("Watch: %v", err)
	}
	if !hit {
		t.Fatalf("subscription endpoint not called")
	}
	if _, ok := <-ch; ok {
		t.Fatalf("expected closed channel")
	}
}

func TestRegister_AddsToRegistry(t *testing.T) {
	r := connectors.NewRegistry()
	if err := Register(r, nil, nil, "cid", "csec", "appid"); err != nil {
		t.Fatalf("Register: %v", err)
	}
	if _, ok := r.Get(Name); !ok {
		t.Fatalf("not registered")
	}
}
