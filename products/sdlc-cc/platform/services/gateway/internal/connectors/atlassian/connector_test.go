package atlassian

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

func newCloud(t *testing.T) (*Connector, *connectors.MemoryStore, uuid.UUID, *httptest.Server, *httptest.Server) {
	t.Helper()
	authMux := http.NewServeMux()
	authMux.HandleFunc("/oauth/token", func(w http.ResponseWriter, r *http.Request) {
		var body map[string]string
		raw, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(raw, &body)
		if body["grant_type"] != "authorization_code" {
			t.Errorf("bad grant_type: %v", body)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"access_token":"AT","refresh_token":"RT","expires_in":3600,"token_type":"Bearer","scope":"read:jira-work"}`))
	})
	auth := httptest.NewServer(authMux)
	apiMux := http.NewServeMux()
	apiMux.HandleFunc("/oauth/token/accessible-resources", func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`[{"id":"cloud-123","url":"https://acme.atlassian.net","name":"Acme"}]`))
	})
	api := httptest.NewServer(apiMux)
	store := connectors.NewMemoryStore()
	c := New(Config{Mode: ModeCloud, ClientID: "cid", ClientSecret: "sec", RedirectURI: "https://gw/cb", AuthURL: auth.URL, BaseURL: api.URL}, store, nil)
	return c, store, uuid.New(), auth, api
}

func TestAuthenticate_CloudExchangesAndStoresCloudID(t *testing.T) {
	c, store, tid, auth, api := newCloud(t)
	defer auth.Close()
	defer api.Close()
	if err := c.Authenticate(context.Background(), tid, "the-code"); err != nil {
		t.Fatalf("Authenticate: %v", err)
	}
	tok, err := store.Load(context.Background(), tid, Name)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if tok.AccessToken != "AT" || tok.Extra["cloud_id"] != "cloud-123" {
		t.Fatalf("unexpected token: %+v", tok)
	}
}

func TestAuthenticate_ServerStoresPATWithoutCloudCall(t *testing.T) {
	store := connectors.NewMemoryStore()
	c := New(Config{Mode: ModeServer, BaseURL: "https://jira.acme.local"}, store, nil)
	tid := uuid.New()
	if err := c.Authenticate(context.Background(), tid, "PAT-XYZ"); err != nil {
		t.Fatalf("Authenticate: %v", err)
	}
	tok, _ := store.Load(context.Background(), tid, Name)
	if tok.AccessToken != "PAT-XYZ" || tok.Extra["mode"] != ModeServer {
		t.Fatalf("unexpected token: %+v", tok)
	}
}

func TestListResources_CloudCallsJiraAndConfluence(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/oauth/token/accessible-resources", func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`[{"id":"cid1","url":"https://x"}]`))
	})
	mux.HandleFunc("/ex/jira/cid1/rest/api/3/search", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer AT" {
			t.Errorf("missing bearer")
		}
		_, _ = w.Write([]byte(`{"issues":[{"id":"10001","key":"PROJ-1","fields":{"summary":"login bug","updated":"2026-04-25T10:00:00.000Z"}}],"total":1,"maxResults":100,"startAt":0}`))
	})
	mux.HandleFunc("/ex/confluence/cid1/wiki/rest/api/content", func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"results":[{"id":"p1","type":"page","title":"Runbook","_links":{"webui":"/spaces/X/pages/p1"}}],"start":0,"size":1,"limit":100}`))
	})
	api := httptest.NewServer(mux)
	defer api.Close()
	store := connectors.NewMemoryStore()
	c := New(Config{Mode: ModeCloud, BaseURL: api.URL}, store, nil)
	tid := uuid.New()
	_ = store.Save(context.Background(), tid, Name, connectors.Token{AccessToken: "AT", Expiry: time.Now().Add(time.Hour), Extra: map[string]string{"mode": ModeCloud, "cloud_id": "cid1"}})
	res, err := c.ListResources(context.Background(), tid)
	if err != nil {
		t.Fatalf("ListResources: %v", err)
	}
	if len(res) != 2 {
		t.Fatalf("want 2, got %d: %+v", len(res), res)
	}
	if res[0].Type != "issue" || res[1].Type != "page" {
		t.Fatalf("types: %+v", res)
	}
}

func TestFetch_IssueAndPage(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/ex/jira/c1/rest/api/3/issue/PROJ-7", func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"id":"7","key":"PROJ-7","fields":{"summary":"hi","updated":"2026-04-26T00:00:00.000Z"}}`))
	})
	mux.HandleFunc("/ex/confluence/c1/wiki/rest/api/content/p7", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("expand") != "body.storage" {
			t.Errorf("missing expand")
		}
		_, _ = w.Write([]byte(`{"id":"p7","title":"Runbook","_links":{"webui":"/x"},"body":{"storage":{"value":"<p>hi</p>"}}}`))
	})
	api := httptest.NewServer(mux)
	defer api.Close()
	store := connectors.NewMemoryStore()
	c := New(Config{Mode: ModeCloud, BaseURL: api.URL}, store, nil)
	tid := uuid.New()
	_ = store.Save(context.Background(), tid, Name, connectors.Token{AccessToken: "AT", Extra: map[string]string{"mode": ModeCloud, "cloud_id": "c1"}})
	d1, err := c.Fetch(context.Background(), tid, "jira:PROJ-7")
	if err != nil || d1.Title != "hi" {
		t.Fatalf("issue fetch: %v %+v", err, d1)
	}
	d2, err := c.Fetch(context.Background(), tid, "conf:p7")
	if err != nil || string(d2.Body) != "<p>hi</p>" {
		t.Fatalf("page fetch: %v %+v", err, d2)
	}
}

func TestSearch_BuildsJQLAndCQL(t *testing.T) {
	var jiraURL, confURL string
	mux := http.NewServeMux()
	mux.HandleFunc("/ex/jira/c1/rest/api/3/search", func(w http.ResponseWriter, r *http.Request) {
		jiraURL = r.URL.RawQuery
		_, _ = w.Write([]byte(`{"issues":[{"id":"1","key":"X-1","fields":{"summary":"hit"}}]}`))
	})
	mux.HandleFunc("/ex/confluence/c1/wiki/rest/api/content/search", func(w http.ResponseWriter, r *http.Request) {
		confURL = r.URL.RawQuery
		_, _ = w.Write([]byte(`{"results":[{"id":"P1","title":"PageHit","_links":{"webui":"/y"}}]}`))
	})
	api := httptest.NewServer(mux)
	defer api.Close()
	store := connectors.NewMemoryStore()
	c := New(Config{Mode: ModeCloud, BaseURL: api.URL}, store, nil)
	tid := uuid.New()
	_ = store.Save(context.Background(), tid, Name, connectors.Token{AccessToken: "AT", Extra: map[string]string{"mode": ModeCloud, "cloud_id": "c1"}})
	res, err := c.Search(context.Background(), tid, "outage")
	if err != nil {
		t.Fatalf("Search: %v", err)
	}
	if len(res) != 2 {
		t.Fatalf("want 2 hits, got %d", len(res))
	}
	if !strings.Contains(jiraURL, "text") || !strings.Contains(jiraURL, "outage") {
		t.Fatalf("jql wrong: %s", jiraURL)
	}
	if !strings.Contains(confURL, "type%3Dpage") && !strings.Contains(confURL, "type=page") {
		t.Fatalf("cql wrong: %s", confURL)
	}
}

func TestWatch_RegistersWebhookAndClosesOnCancel(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/ex/jira/c1/rest/api/3/webhook", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("want POST, got %s", r.Method)
		}
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte(`{"webhookRegistrationResult":[{"createdWebhookId":1}]}`))
	})
	api := httptest.NewServer(mux)
	defer api.Close()
	store := connectors.NewMemoryStore()
	c := New(Config{Mode: ModeCloud, BaseURL: api.URL, RedirectURI: "https://gw"}, store, nil)
	tid := uuid.New()
	_ = store.Save(context.Background(), tid, Name, connectors.Token{AccessToken: "AT", Extra: map[string]string{"mode": ModeCloud, "cloud_id": "c1"}})
	ctx, cancel := context.WithCancel(context.Background())
	ch, err := c.Watch(ctx, tid)
	if err != nil {
		t.Fatalf("Watch: %v", err)
	}
	cancel()
	select {
	case _, ok := <-ch:
		if ok {
			t.Fatalf("channel should be closed")
		}
	case <-time.After(time.Second):
		t.Fatalf("channel did not close")
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
	if meta.Vendor != "Atlassian" || meta.Category != "devtools" {
		t.Fatalf("unexpected metadata: %+v", meta)
	}
}
