package slack

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/google/uuid"

	"github.com/sdlc-ai/platform/services/gateway/internal/connectors"
)

func newTestConnector(base string) (*Connector, *connectors.MemoryStore) {
	store := connectors.NewMemoryStore()
	c := New(nil, store, Config{
		ClientID:     "cid",
		ClientSecret: "secret",
		RedirectURI:  "http://localhost/cb",
	})
	c.BaseURL = base
	return c, store
}

func TestAuthenticate_OAuthV2Access(t *testing.T) {
	tenant := uuid.New()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/oauth.v2.access" {
			t.Errorf("path = %s", r.URL.Path)
		}
		body, _ := io.ReadAll(r.Body)
		v, _ := url.ParseQuery(string(body))
		if v.Get("code") != "abc" || v.Get("client_id") != "cid" {
			t.Errorf("form = %s", body)
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok":           true,
			"access_token": "xoxb-1",
			"token_type":   "bot",
			"scope":        "channels:read",
			"bot_user_id":  "U123",
			"team":         map[string]string{"id": "T1", "name": "test"},
		})
	}))
	defer srv.Close()
	c, store := newTestConnector(srv.URL)
	if err := c.Authenticate(context.Background(), tenant, "abc"); err != nil {
		t.Fatalf("Authenticate: %v", err)
	}
	tok, err := store.Load(context.Background(), tenant, Name)
	if err != nil || tok.AccessToken != "xoxb-1" || tok.Extra["team_id"] != "T1" {
		t.Fatalf("token mismatch: %+v err=%v", tok, err)
	}
}

func TestAuthenticate_OKFalse(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": false, "error": "invalid_code"})
	}))
	defer srv.Close()
	c, _ := newTestConnector(srv.URL)
	err := c.Authenticate(context.Background(), uuid.New(), "x")
	if err == nil || !strings.Contains(err.Error(), "invalid_code") {
		t.Fatalf("err = %v", err)
	}
}

func TestListResources_PaginatesViaCursor(t *testing.T) {
	tenant := uuid.New()
	calls := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer tok" {
			t.Errorf("auth = %q", r.Header.Get("Authorization"))
		}
		calls++
		switch r.URL.Query().Get("cursor") {
		case "":
			resp := convListResp{OK: true, Channels: []slackChannel{{ID: "C1", Name: "general"}}}
			resp.ResponseMetadata.NextCursor = "c2"
			_ = json.NewEncoder(w).Encode(resp)
		case "c2":
			_ = json.NewEncoder(w).Encode(convListResp{OK: true, Channels: []slackChannel{{ID: "C2", Name: "random"}}})
		default:
			t.Errorf("cursor = %q", r.URL.Query().Get("cursor"))
		}
	}))
	defer srv.Close()
	c, store := newTestConnector(srv.URL)
	_ = store.Save(context.Background(), tenant, Name, connectors.Token{AccessToken: "tok"})
	got, err := c.ListResources(context.Background(), tenant)
	if err != nil {
		t.Fatalf("ListResources: %v", err)
	}
	if calls != 2 || len(got) != 2 {
		t.Errorf("calls=%d got=%+v", calls, got)
	}
}

func TestFetch_HistoryConcatenated(t *testing.T) {
	tenant := uuid.New()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("channel") != "C1" {
			t.Errorf("channel = %q", r.URL.Query().Get("channel"))
		}
		_ = json.NewEncoder(w).Encode(historyResp{
			OK: true,
			Messages: []slackMessage{
				{User: "U1", Text: "hello"},
				{User: "U2", Text: "world"},
			},
		})
	}))
	defer srv.Close()
	c, store := newTestConnector(srv.URL)
	_ = store.Save(context.Background(), tenant, Name, connectors.Token{AccessToken: "tok"})
	doc, err := c.Fetch(context.Background(), tenant, "C1")
	if err != nil {
		t.Fatalf("Fetch: %v", err)
	}
	if !strings.Contains(string(doc.Body), "U1: hello") || !strings.Contains(string(doc.Body), "U2: world") {
		t.Errorf("body = %q", doc.Body)
	}
}

func TestSearch_TierLimited(t *testing.T) {
	tenant := uuid.New()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": false, "error": "paid_only"})
	}))
	defer srv.Close()
	c, store := newTestConnector(srv.URL)
	_ = store.Save(context.Background(), tenant, Name, connectors.Token{AccessToken: "tok"})
	_, err := c.Search(context.Background(), tenant, "anything")
	if !errors.Is(err, ErrTierLimited) {
		t.Fatalf("err = %v, want ErrTierLimited", err)
	}
}

func TestSearch_Success(t *testing.T) {
	tenant := uuid.New()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"ok":true,"messages":{"matches":[{"channel":{"id":"C1","name":"general"},"user":"U1","text":"hi","permalink":"http://x","ts":"1.0"}]}}`))
	}))
	defer srv.Close()
	c, store := newTestConnector(srv.URL)
	_ = store.Save(context.Background(), tenant, Name, connectors.Token{AccessToken: "tok"})
	got, err := c.Search(context.Background(), tenant, "hi")
	if err != nil || len(got) != 1 || got[0].URL != "http://x" {
		t.Fatalf("Search: got=%+v err=%v", got, err)
	}
}

func TestRegister_AddsMetadata(t *testing.T) {
	r := connectors.NewRegistry()
	if err := Register(r, nil, connectors.NewMemoryStore(), Config{}); err != nil {
		t.Fatalf("Register: %v", err)
	}
	if _, ok := r.Get(Name); !ok {
		t.Fatal("not registered")
	}
}
