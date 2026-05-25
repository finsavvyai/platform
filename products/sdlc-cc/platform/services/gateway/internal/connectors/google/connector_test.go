package google

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/google/uuid"

	"github.com/sdlc-ai/platform/services/gateway/internal/connectors"
)

func newTestConnector(oauth, base string) (*Connector, *connectors.MemoryStore) {
	store := connectors.NewMemoryStore()
	c := New(nil, store, Config{
		ClientID:     "cid",
		ClientSecret: "secret",
		RedirectURI:  "http://localhost/cb",
	})
	c.OAuthURL = oauth
	c.BaseURL = base
	return c, store
}

func TestAuthenticate_ExchangesCodeForToken(t *testing.T) {
	tenant := uuid.New()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/token" {
			t.Errorf("path = %s, want /token", r.URL.Path)
		}
		if got := r.Header.Get("Content-Type"); got != "application/x-www-form-urlencoded" {
			t.Errorf("Content-Type = %s", got)
		}
		body, _ := io.ReadAll(r.Body)
		v, _ := url.ParseQuery(string(body))
		if v.Get("code") != "abc" || v.Get("client_id") != "cid" || v.Get("grant_type") != "authorization_code" {
			t.Errorf("unexpected form: %s", body)
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"access_token": "tok-1", "refresh_token": "ref-1",
			"token_type": "Bearer", "scope": "drive.readonly", "expires_in": 3600,
		})
	}))
	defer srv.Close()

	c, store := newTestConnector(srv.URL, srv.URL)
	if err := c.Authenticate(context.Background(), tenant, "abc"); err != nil {
		t.Fatalf("Authenticate: %v", err)
	}
	tok, err := store.Load(context.Background(), tenant, Name)
	if err != nil || tok.AccessToken != "tok-1" || tok.RefreshToken != "ref-1" {
		t.Fatalf("token mismatch: %+v err=%v", tok, err)
	}
}

func TestAuthenticate_ServerError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "bad", http.StatusBadRequest)
	}))
	defer srv.Close()
	c, _ := newTestConnector(srv.URL, srv.URL)
	if err := c.Authenticate(context.Background(), uuid.New(), "x"); err == nil {
		t.Fatal("expected error")
	}
}

func TestListResources_PaginatesViaPageToken(t *testing.T) {
	tenant := uuid.New()
	calls := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("Authorization"); got != "Bearer tok" {
			t.Errorf("auth = %q", got)
		}
		calls++
		switch r.URL.Query().Get("pageToken") {
		case "":
			_ = json.NewEncoder(w).Encode(driveListResp{
				Files: []driveFile{{
					ID: "1", Name: "doc1", MimeType: "application/vnd.google-apps.document",
					ModifiedTime: "2026-01-01T00:00:00Z",
				}},
				NextPageToken: "p2",
			})
		case "p2":
			_ = json.NewEncoder(w).Encode(driveListResp{
				Files: []driveFile{{ID: "2", Name: "sheet", MimeType: "application/vnd.google-apps.spreadsheet"}},
			})
		default:
			t.Errorf("unexpected pageToken %q", r.URL.Query().Get("pageToken"))
		}
	}))
	defer srv.Close()
	c, store := newTestConnector(srv.URL, srv.URL)
	_ = store.Save(context.Background(), tenant, Name, connectors.Token{AccessToken: "tok"})
	got, err := c.ListResources(context.Background(), tenant)
	if err != nil {
		t.Fatalf("ListResources: %v", err)
	}
	if calls != 2 {
		t.Errorf("calls = %d, want 2", calls)
	}
	if len(got) != 2 || got[0].ID != "1" || got[1].Type != "sheet" {
		t.Errorf("got = %+v", got)
	}
}

func TestListResources_RequiresToken(t *testing.T) {
	c, _ := newTestConnector("http://unused", "http://unused")
	if _, err := c.ListResources(context.Background(), uuid.New()); err == nil {
		t.Fatal("expected ErrTokenNotFound")
	}
}

func TestFetch_GetsMetaThenBody(t *testing.T) {
	tenant := uuid.New()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.HasSuffix(r.URL.Path, "/files/abc") && r.URL.Query().Get("alt") == "":
			_ = json.NewEncoder(w).Encode(driveFile{ID: "abc", Name: "file.txt", MimeType: "text/plain"})
		case strings.HasSuffix(r.URL.Path, "/files/abc") && r.URL.Query().Get("alt") == "media":
			_, _ = w.Write([]byte("hello-body"))
		default:
			t.Errorf("unexpected: %s ?%s", r.URL.Path, r.URL.RawQuery)
		}
	}))
	defer srv.Close()
	c, store := newTestConnector(srv.URL, srv.URL)
	_ = store.Save(context.Background(), tenant, Name, connectors.Token{AccessToken: "tok"})
	doc, err := c.Fetch(context.Background(), tenant, "abc")
	if err != nil {
		t.Fatalf("Fetch: %v", err)
	}
	if string(doc.Body) != "hello-body" || doc.MimeType != "text/plain" || doc.ID != "abc" {
		t.Errorf("doc = %+v", doc)
	}
}

func TestSearch_UsesFullTextQ(t *testing.T) {
	tenant := uuid.New()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query().Get("q")
		if !strings.Contains(q, "fullText contains") || !strings.Contains(q, "kittens") {
			t.Errorf("q = %q", q)
		}
		_ = json.NewEncoder(w).Encode(driveListResp{Files: []driveFile{{ID: "x", Name: "kittens.txt"}}})
	}))
	defer srv.Close()
	c, store := newTestConnector(srv.URL, srv.URL)
	_ = store.Save(context.Background(), tenant, Name, connectors.Token{AccessToken: "tok"})
	got, err := c.Search(context.Background(), tenant, "kittens")
	if err != nil || len(got) != 1 || got[0].ID != "x" {
		t.Fatalf("Search: got=%+v err=%v", got, err)
	}
}

func TestRegister_AddsMetadata(t *testing.T) {
	r := connectors.NewRegistry()
	if err := Register(r, nil, connectors.NewMemoryStore(), Config{}); err != nil {
		t.Fatalf("Register: %v", err)
	}
	if _, ok := r.Get(Name); !ok {
		t.Fatal("connector not registered")
	}
	m, err := r.Meta(Name)
	if err != nil || m.DisplayName != "Google Workspace" {
		t.Fatalf("meta: %+v err=%v", m, err)
	}
}
