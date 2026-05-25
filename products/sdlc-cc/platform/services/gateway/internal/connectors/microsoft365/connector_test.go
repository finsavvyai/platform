package microsoft365

import (
	"context"
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

func newTestConnector(t *testing.T, login, graph *httptest.Server) (*Connector, *connectors.MemoryStore, uuid.UUID) {
	t.Helper()
	store := connectors.NewMemoryStore()
	cfg := Config{ClientID: "cid", ClientSecret: "sec", TenantID: "abc-tenant", RedirectURI: "https://gw/cb", LoginURL: login.URL, BaseURL: graph.URL}
	return New(cfg, store, nil), store, uuid.New()
}

func TestAuthenticate_ExchangesCodeAndPersistsToken(t *testing.T) {
	login := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.Contains(r.URL.Path, "/abc-tenant/oauth2/v2.0/token") {
			t.Errorf("bad path: %s", r.URL.Path)
		}
		_ = r.ParseForm()
		if r.PostForm.Get("code") != "the-code" || r.PostForm.Get("grant_type") != "authorization_code" {
			t.Errorf("bad form: %v", r.PostForm)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"access_token":"AT","refresh_token":"RT","expires_in":3600,"token_type":"Bearer","scope":"Files.Read.All"}`))
	}))
	defer login.Close()
	graph := httptest.NewServer(http.NewServeMux())
	defer graph.Close()
	c, store, tid := newTestConnector(t, login, graph)
	if err := c.Authenticate(context.Background(), tid, "the-code"); err != nil {
		t.Fatalf("Authenticate: %v", err)
	}
	tok, err := store.Load(context.Background(), tid, Name)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if tok.AccessToken != "AT" || tok.RefreshToken != "RT" {
		t.Fatalf("unexpected token: %+v", tok)
	}
}

func TestAuthenticate_PropagatesUpstreamError(t *testing.T) {
	login := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(`{"error":"invalid_grant"}`))
	}))
	defer login.Close()
	graph := httptest.NewServer(http.NewServeMux())
	defer graph.Close()
	c, _, tid := newTestConnector(t, login, graph)
	if err := c.Authenticate(context.Background(), tid, "x"); err == nil || !strings.Contains(err.Error(), "invalid_grant") {
		t.Fatalf("expected invalid_grant error, got %v", err)
	}
}

func TestListResources_PagesSitesAndDrive(t *testing.T) {
	calls := map[string]int{}
	var graphURL string
	mux := http.NewServeMux()
	mux.HandleFunc("/v1.0/sites", func(w http.ResponseWriter, r *http.Request) {
		calls["sites"]++
		if r.Header.Get("Authorization") != "Bearer AT" {
			t.Errorf("missing bearer")
		}
		next := graphURL + "/v1.0/sites-page2"
		_, _ = w.Write([]byte(`{"value":[{"id":"s1","displayName":"Marketing","webUrl":"https://x/s1"}],"@odata.nextLink":"` + next + `"}`))
	})
	mux.HandleFunc("/v1.0/sites-page2", func(w http.ResponseWriter, r *http.Request) {
		calls["sites2"]++
		_, _ = w.Write([]byte(`{"value":[{"id":"s2","displayName":"Eng","webUrl":"https://x/s2"}]}`))
	})
	mux.HandleFunc("/v1.0/me/drive/root/children", func(w http.ResponseWriter, r *http.Request) {
		calls["drive"]++
		_, _ = w.Write([]byte(`{"value":[{"id":"f1","name":"a.docx","webUrl":"https://x/a","file":{"mimeType":"application/vnd.openxmlformats"}}]}`))
	})
	graph := httptest.NewServer(mux)
	defer graph.Close()
	graphURL = graph.URL
	login := httptest.NewServer(http.NewServeMux())
	defer login.Close()
	c, store, tid := newTestConnector(t, login, graph)
	_ = store.Save(context.Background(), tid, Name, connectors.Token{AccessToken: "AT", Expiry: time.Now().Add(time.Hour)})
	res, err := c.ListResources(context.Background(), tid)
	if err != nil {
		t.Fatalf("ListResources: %v", err)
	}
	if len(res) != 3 {
		t.Fatalf("want 3 resources, got %d: %+v", len(res), res)
	}
	if calls["sites"] != 1 || calls["sites2"] != 1 || calls["drive"] != 1 {
		t.Fatalf("call counts: %+v", calls)
	}
}

func TestFetch_ReturnsContentAndMime(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/v1.0/drives/D1/items/I1/content", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain")
		_, _ = w.Write([]byte("hello world"))
	})
	mux.HandleFunc("/v1.0/drives/D1/items/I1", func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"id":"I1","name":"hello.txt","webUrl":"https://x/h","file":{"mimeType":"text/plain"}}`))
	})
	graph := httptest.NewServer(mux)
	defer graph.Close()
	login := httptest.NewServer(http.NewServeMux())
	defer login.Close()
	c, store, tid := newTestConnector(t, login, graph)
	_ = store.Save(context.Background(), tid, Name, connectors.Token{AccessToken: "AT", Expiry: time.Now().Add(time.Hour)})
	doc, err := c.Fetch(context.Background(), tid, "drive:D1/I1")
	if err != nil {
		t.Fatalf("Fetch: %v", err)
	}
	if string(doc.Body) != "hello world" || doc.MimeType != "text/plain" || doc.Title != "hello.txt" {
		t.Fatalf("unexpected doc: %+v", doc)
	}
}

func TestSearch_PostsSearchRequestAndParsesHits(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/v1.0/search/query", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("want POST got %s", r.Method)
		}
		raw, _ := io.ReadAll(r.Body)
		var got map[string]any
		_ = json.Unmarshal(raw, &got)
		if _, ok := got["requests"]; !ok {
			t.Errorf("missing requests body: %s", string(raw))
		}
		_, _ = w.Write([]byte(`{"value":[{"hitsContainers":[{"hits":[{"hitId":"h1","resource":{"id":"X1","name":"q.txt","webUrl":"https://x/q"}}]}]}]}`))
	})
	graph := httptest.NewServer(mux)
	defer graph.Close()
	login := httptest.NewServer(http.NewServeMux())
	defer login.Close()
	c, store, tid := newTestConnector(t, login, graph)
	_ = store.Save(context.Background(), tid, Name, connectors.Token{AccessToken: "AT", Expiry: time.Now().Add(time.Hour)})
	res, err := c.Search(context.Background(), tid, "quarterly")
	if err != nil {
		t.Fatalf("Search: %v", err)
	}
	if len(res) != 1 || res[0].Title != "q.txt" || res[0].ID != "drive:X1" {
		t.Fatalf("unexpected: %+v", res)
	}
}

func TestWatch_CreatesSubscriptionAndChannelClosesOnCancel(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/v1.0/subscriptions", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("want POST got %s", r.Method)
		}
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte(`{"id":"sub1"}`))
	})
	graph := httptest.NewServer(mux)
	defer graph.Close()
	login := httptest.NewServer(http.NewServeMux())
	defer login.Close()
	c, store, tid := newTestConnector(t, login, graph)
	_ = store.Save(context.Background(), tid, Name, connectors.Token{AccessToken: "AT", Expiry: time.Now().Add(time.Hour)})
	ctx, cancel := context.WithCancel(context.Background())
	ch, err := c.Watch(ctx, tid)
	if err != nil {
		t.Fatalf("Watch: %v", err)
	}
	cancel()
	select {
	case _, ok := <-ch:
		if ok {
			t.Fatalf("channel should be closed on cancel")
		}
	case <-time.After(time.Second):
		t.Fatalf("channel not closed within 1s")
	}
}

func TestRegister_InstallsConnectorWithMetadata(t *testing.T) {
	r := connectors.NewRegistry()
	if err := Register(r, nil); err != nil {
		t.Fatalf("Register: %v", err)
	}
	meta, err := r.Meta(Name)
	if err != nil {
		t.Fatalf("Meta: %v", err)
	}
	if meta.Vendor != "Microsoft" || meta.Category != "productivity" {
		t.Fatalf("unexpected metadata: %+v", meta)
	}
}
