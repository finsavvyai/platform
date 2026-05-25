package servicenow

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/sdlc-ai/platform/services/gateway/internal/connectors"
)

func newTestConnector(t *testing.T, h http.HandlerFunc) (*Connector, *httptest.Server, uuid.UUID) {
	t.Helper()
	srv := httptest.NewServer(h)
	t.Cleanup(srv.Close)
	c := New(nil, connectors.NewMemoryStore(), "cid", "csec", "acme")
	c.BaseURL = srv.URL
	c.PollInterval = 5 * time.Millisecond
	return c, srv, uuid.New()
}

func TestAuthenticate_FormEncoded(t *testing.T) {
	c, _, tid := newTestConnector(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/oauth_token.do" {
			t.Fatalf("path: %s", r.URL.Path)
		}
		if ct := r.Header.Get("Content-Type"); ct != "application/x-www-form-urlencoded" {
			t.Fatalf("content-type: %s", ct)
		}
		_ = r.ParseForm()
		if r.PostForm.Get("code") != "abc" || r.PostForm.Get("client_id") != "cid" {
			t.Fatalf("form: %v", r.PostForm)
		}
		_, _ = w.Write([]byte(`{"access_token":"AT","refresh_token":"RT","token_type":"Bearer","expires_in":3600}`))
	})
	if err := c.Authenticate(context.Background(), tid, "abc"); err != nil {
		t.Fatalf("Authenticate: %v", err)
	}
	tok, _ := c.tokens.Load(context.Background(), tid, Name)
	if tok.AccessToken != "AT" || tok.RefreshToken != "RT" {
		t.Fatalf("token: %#v", tok)
	}
}

func TestAuthenticate_ServerError(t *testing.T) {
	c, _, tid := newTestConnector(t, func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "boom", http.StatusInternalServerError)
	})
	err := c.Authenticate(context.Background(), tid, "x")
	if err == nil || !strings.Contains(err.Error(), "500") {
		t.Fatalf("expected 500 error, got %v", err)
	}
}

func TestListResources_TableAPI(t *testing.T) {
	c, _, tid := newTestConnector(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/oauth_token.do" {
			_, _ = w.Write([]byte(`{"access_token":"AT"}`))
			return
		}
		if !strings.HasPrefix(r.URL.Path, "/api/now/table/incident") {
			t.Fatalf("path: %s", r.URL.Path)
		}
		if r.URL.Query().Get("sysparm_limit") == "" {
			t.Fatalf("missing sysparm_limit: %s", r.URL.RawQuery)
		}
		_, _ = w.Write([]byte(`{"result":[{"sys_id":"a1","number":"INC1","short_description":"down","sys_updated_on":"2024-01-02 03:04:05"}]}`))
	})
	_ = c.Authenticate(context.Background(), tid, "x")
	res, err := c.ListResources(context.Background(), tid)
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(res) != 1 || res[0].ID != "a1" || res[0].Title != "down" {
		t.Fatalf("res: %#v", res)
	}
}

func TestFetch_Record(t *testing.T) {
	c, _, tid := newTestConnector(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/oauth_token.do" {
			_, _ = w.Write([]byte(`{"access_token":"AT"}`))
			return
		}
		if r.URL.Path != "/api/now/table/incident/sys-99" {
			t.Fatalf("path: %s", r.URL.Path)
		}
		_, _ = w.Write([]byte(`{"result":{"sys_id":"sys-99","number":"INC99","description":"DETAIL"}}`))
	})
	_ = c.Authenticate(context.Background(), tid, "x")
	d, err := c.Fetch(context.Background(), tid, "sys-99")
	if err != nil {
		t.Fatalf("Fetch: %v", err)
	}
	if d.ID != "sys-99" || string(d.Body) != "DETAIL" {
		t.Fatalf("doc: %#v", d)
	}
}

func TestSearch_QueryEncoded(t *testing.T) {
	var raw string
	c, _, tid := newTestConnector(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/oauth_token.do" {
			_, _ = w.Write([]byte(`{"access_token":"AT"}`))
			return
		}
		raw = r.URL.RawQuery
		_, _ = w.Write([]byte(`{"result":[{"sys_id":"q1","short_description":"hit"}]}`))
	})
	_ = c.Authenticate(context.Background(), tid, "x")
	res, err := c.Search(context.Background(), tid, "active=true^priority=1")
	if err != nil {
		t.Fatalf("Search: %v", err)
	}
	if len(res) != 1 || res[0].ID != "q1" {
		t.Fatalf("res: %#v", res)
	}
	if !strings.Contains(raw, "sysparm_query=") {
		t.Fatalf("expected sysparm_query, got %s", raw)
	}
}

func TestWatch_PollsAndCancels(t *testing.T) {
	c, _, tid := newTestConnector(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/oauth_token.do" {
			_, _ = w.Write([]byte(`{"access_token":"AT"}`))
			return
		}
		future := time.Now().Add(time.Hour).UTC().Format("2006-01-02 15:04:05")
		_, _ = w.Write([]byte(`{"result":[{"sys_id":"poll1","short_description":"x","sys_updated_on":"` + future + `"}]}`))
	})
	_ = c.Authenticate(context.Background(), tid, "x")
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	ch, err := c.Watch(ctx, tid)
	if err != nil {
		t.Fatalf("Watch: %v", err)
	}
	select {
	case ev, ok := <-ch:
		if !ok {
			t.Fatalf("channel closed early")
		}
		if ev.Op != "update" || ev.ID != "poll1" {
			t.Fatalf("event: %#v", ev)
		}
	case <-time.After(2 * time.Second):
		t.Fatalf("timed out waiting for poll event")
	}
	cancel()
}

func TestRegister_AddsToRegistry(t *testing.T) {
	r := connectors.NewRegistry()
	if err := Register(r, nil, nil, "cid", "csec", "inst"); err != nil {
		t.Fatalf("Register: %v", err)
	}
	if _, ok := r.Get(Name); !ok {
		t.Fatalf("not registered")
	}
}
