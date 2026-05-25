package notion

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

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
	c.PollInterval = 5 * time.Millisecond
	return c, store
}

func TestAuthenticate_BasicAuthExchange(t *testing.T) {
	tenant := uuid.New()
	wantBasic := "Basic " + base64.StdEncoding.EncodeToString([]byte("cid:secret"))
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/oauth/token" {
			t.Errorf("path = %s", r.URL.Path)
		}
		if r.Header.Get("Authorization") != wantBasic {
			t.Errorf("auth = %q", r.Header.Get("Authorization"))
		}
		if r.Header.Get("Notion-Version") != notionAPIVersion {
			t.Errorf("Notion-Version missing")
		}
		body, _ := io.ReadAll(r.Body)
		var req notionTokenReq
		_ = json.Unmarshal(body, &req)
		if req.GrantType != "authorization_code" || req.Code != "abc" {
			t.Errorf("body = %s", body)
		}
		_ = json.NewEncoder(w).Encode(notionTokenResp{
			AccessToken: "secret_x", TokenType: "bearer",
			BotID: "bot1", WorkspaceID: "ws1", WorkspaceName: "Acme",
		})
	}))
	defer srv.Close()
	c, store := newTestConnector(srv.URL)
	if err := c.Authenticate(context.Background(), tenant, "abc"); err != nil {
		t.Fatalf("Authenticate: %v", err)
	}
	tok, err := store.Load(context.Background(), tenant, Name)
	if err != nil || tok.AccessToken != "secret_x" || tok.Extra["workspace_id"] != "ws1" {
		t.Fatalf("token = %+v err=%v", tok, err)
	}
}

func TestAuthenticate_HTTPError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, `{"error":"invalid_grant"}`, http.StatusBadRequest)
	}))
	defer srv.Close()
	c, _ := newTestConnector(srv.URL)
	err := c.Authenticate(context.Background(), uuid.New(), "x")
	if err == nil || !strings.Contains(err.Error(), "invalid_grant") {
		t.Fatalf("err = %v", err)
	}
}

func TestListResources_PaginatesViaCursor(t *testing.T) {
	tenant := uuid.New()
	calls := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/search" || r.Method != http.MethodPost {
			t.Errorf("path/method = %s %s", r.URL.Path, r.Method)
		}
		var req searchReq
		body, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(body, &req)
		calls++
		switch req.StartCursor {
		case "":
			_ = json.NewEncoder(w).Encode(searchResp{
				Results:    []searchResult{{Object: "page", ID: "p1", URL: "http://p1"}},
				NextCursor: "c2", HasMore: true,
			})
		case "c2":
			_ = json.NewEncoder(w).Encode(searchResp{
				Results: []searchResult{{Object: "database", ID: "db1", URL: "http://db1"}},
				HasMore: false,
			})
		default:
			t.Errorf("cursor = %q", req.StartCursor)
		}
	}))
	defer srv.Close()
	c, store := newTestConnector(srv.URL)
	_ = store.Save(context.Background(), tenant, Name, connectors.Token{AccessToken: "tok"})
	got, err := c.ListResources(context.Background(), tenant)
	if err != nil {
		t.Fatalf("ListResources: %v", err)
	}
	if calls != 2 || len(got) != 2 || got[1].Type != "database" {
		t.Errorf("got=%+v calls=%d", got, calls)
	}
}

func TestFetch_PageThenBlocks(t *testing.T) {
	tenant := uuid.New()
	pageID := "abc"
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Notion-Version") != notionAPIVersion {
			t.Errorf("missing Notion-Version")
		}
		switch {
		case r.URL.Path == "/v1/pages/"+pageID:
			_ = json.NewEncoder(w).Encode(pageResp{ID: pageID, URL: "http://p"})
		case r.URL.Path == "/v1/blocks/"+pageID+"/children":
			resp := blockChildrenResp{Results: []blockChild{}}
			b := blockChild{Type: "paragraph"}
			b.Paragraph.RichText = []struct {
				PlainText string `json:"plain_text"`
			}{{PlainText: "hello "}, {PlainText: "world"}}
			resp.Results = append(resp.Results, b)
			_ = json.NewEncoder(w).Encode(resp)
		default:
			t.Errorf("path = %s", r.URL.Path)
		}
	}))
	defer srv.Close()
	c, store := newTestConnector(srv.URL)
	_ = store.Save(context.Background(), tenant, Name, connectors.Token{AccessToken: "tok"})
	doc, err := c.Fetch(context.Background(), tenant, pageID)
	if err != nil {
		t.Fatalf("Fetch: %v", err)
	}
	if !strings.Contains(string(doc.Body), "hello world") {
		t.Errorf("body = %q", doc.Body)
	}
}

func TestSearch_PassesQuery(t *testing.T) {
	tenant := uuid.New()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req searchReq
		body, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(body, &req)
		if req.Query != "kittens" {
			t.Errorf("query = %q", req.Query)
		}
		_ = json.NewEncoder(w).Encode(searchResp{
			Results: []searchResult{{Object: "page", ID: "p1", URL: "http://p1"}},
		})
	}))
	defer srv.Close()
	c, store := newTestConnector(srv.URL)
	_ = store.Save(context.Background(), tenant, Name, connectors.Token{AccessToken: "tok"})
	got, err := c.Search(context.Background(), tenant, "kittens")
	if err != nil || len(got) != 1 || got[0].ID != "p1" {
		t.Fatalf("Search: got=%+v err=%v", got, err)
	}
}

func TestWatch_FallsBackToPolling(t *testing.T) {
	tenant := uuid.New()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/v1/webhooks":
			http.Error(w, `{"error":"unsupported"}`, http.StatusForbidden)
		case "/v1/search":
			_ = json.NewEncoder(w).Encode(searchResp{
				Results: []searchResult{{
					Object: "page", ID: "p1", URL: "http://p1",
					LastEditedTime: time.Now(),
				}},
			})
		default:
			t.Errorf("path = %s", r.URL.Path)
		}
	}))
	defer srv.Close()
	c, store := newTestConnector(srv.URL)
	_ = store.Save(context.Background(), tenant, Name, connectors.Token{AccessToken: "tok"})
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	ch, err := c.Watch(ctx, tenant)
	if err != nil {
		t.Fatalf("Watch: %v", err)
	}
	select {
	case ev, ok := <-ch:
		if !ok {
			t.Fatal("channel closed without event")
		}
		if ev.ID != "p1" {
			t.Errorf("event = %+v", ev)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timeout waiting for poll event")
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
