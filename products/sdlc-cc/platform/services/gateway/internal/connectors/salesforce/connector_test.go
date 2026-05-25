package salesforce

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/sdlc-ai/platform/services/gateway/internal/connectors"
)

func TestAuthenticate_StoresInstanceURL(t *testing.T) {
	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("ok"))
	}))
	defer api.Close()
	login := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/services/oauth2/token" {
			t.Errorf("bad path: %s", r.URL.Path)
		}
		_ = r.ParseForm()
		if r.PostForm.Get("grant_type") != "authorization_code" || r.PostForm.Get("code") != "C" {
			t.Errorf("bad form: %v", r.PostForm)
		}
		_, _ = w.Write([]byte(`{"access_token":"AT","instance_url":"` + api.URL + `","token_type":"Bearer"}`))
	}))
	defer login.Close()
	store := connectors.NewMemoryStore()
	c := New(Config{ClientID: "cid", ClientSecret: "sec", RedirectURI: "https://gw/cb", LoginURL: login.URL}, store, nil)
	tid := uuid.New()
	if err := c.Authenticate(context.Background(), tid, "C"); err != nil {
		t.Fatalf("Authenticate: %v", err)
	}
	tok, err := store.Load(context.Background(), tid, Name)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if tok.AccessToken != "AT" || tok.Extra["instance_url"] != api.URL {
		t.Fatalf("unexpected token: %+v", tok)
	}
}

func TestListResources_QueriesEachObject(t *testing.T) {
	calls := map[string]int{}
	mux := http.NewServeMux()
	mux.HandleFunc("/services/data/v59.0/query", func(w http.ResponseWriter, r *http.Request) {
		soql := r.URL.Query().Get("q")
		switch {
		case strings.Contains(soql, "FROM Account"):
			calls["Account"]++
			_, _ = w.Write([]byte(`{"done":true,"totalSize":1,"records":[{"Id":"001A","Name":"Acme","LastModifiedDate":"2026-04-25T12:00:00.000+0000"}]}`))
		case strings.Contains(soql, "FROM Contact"):
			calls["Contact"]++
			_, _ = w.Write([]byte(`{"done":true,"totalSize":1,"records":[{"Id":"003C","Name":"Jane Doe"}]}`))
		case strings.Contains(soql, "FROM Opportunity"):
			calls["Opportunity"]++
			_, _ = w.Write([]byte(`{"done":true,"totalSize":1,"records":[{"Id":"006O","Name":"Big Deal","StageName":"Won","Amount":1000}]}`))
		case strings.Contains(soql, "FROM Case"):
			calls["Case"]++
			_, _ = w.Write([]byte(`{"done":true,"totalSize":1,"records":[{"Id":"500K","CaseNumber":"00001","Subject":"Fail"}]}`))
		default:
			t.Errorf("unexpected soql: %s", soql)
		}
	})
	api := httptest.NewServer(mux)
	defer api.Close()
	store := connectors.NewMemoryStore()
	c := New(Config{BaseURL: api.URL}, store, nil)
	tid := uuid.New()
	_ = store.Save(context.Background(), tid, Name, connectors.Token{AccessToken: "AT", Expiry: time.Now().Add(time.Hour), Extra: map[string]string{"instance_url": api.URL}})
	res, err := c.ListResources(context.Background(), tid)
	if err != nil {
		t.Fatalf("ListResources: %v", err)
	}
	if len(res) != 4 {
		t.Fatalf("want 4 records, got %d: %+v", len(res), res)
	}
	for _, k := range []string{"Account", "Contact", "Opportunity", "Case"} {
		if calls[k] != 1 {
			t.Fatalf("missing query for %s: %+v", k, calls)
		}
	}
}

func TestFetch_ReturnsJSONBodyAndTitle(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/services/data/v59.0/sobjects/Account/001X", func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"Id":"001X","Name":"Acme","Industry":"Tech","LastModifiedDate":"2026-04-26T00:00:00.000+0000"}`))
	})
	api := httptest.NewServer(mux)
	defer api.Close()
	store := connectors.NewMemoryStore()
	c := New(Config{BaseURL: api.URL}, store, nil)
	tid := uuid.New()
	_ = store.Save(context.Background(), tid, Name, connectors.Token{AccessToken: "AT", Extra: map[string]string{"instance_url": api.URL}})
	doc, err := c.Fetch(context.Background(), tid, "Account:001X")
	if err != nil {
		t.Fatalf("Fetch: %v", err)
	}
	if doc.Title != "Acme" || doc.MimeType != "application/json" {
		t.Fatalf("unexpected doc: %+v", doc)
	}
	var rec map[string]any
	_ = json.Unmarshal(doc.Body, &rec)
	if rec["Industry"] != "Tech" {
		t.Fatalf("body lost field: %+v", rec)
	}
}

func TestFetch_FLSStrip_FieldOmittedWhenRestricted(t *testing.T) {
	// Salesforce omits fields the user lacks FLS for. We simulate that
	// by NOT returning the AnnualRevenue field — and assert it never
	// shows up in the indexable Body.
	mux := http.NewServeMux()
	mux.HandleFunc("/services/data/v59.0/sobjects/Account/001Y", func(w http.ResponseWriter, r *http.Request) {
		// AnnualRevenue intentionally absent — restricted by FLS.
		_, _ = w.Write([]byte(`{"Id":"001Y","Name":"FLS Co","Industry":"Tech"}`))
	})
	api := httptest.NewServer(mux)
	defer api.Close()
	store := connectors.NewMemoryStore()
	c := New(Config{BaseURL: api.URL}, store, nil)
	tid := uuid.New()
	_ = store.Save(context.Background(), tid, Name, connectors.Token{AccessToken: "AT", Extra: map[string]string{"instance_url": api.URL}})
	doc, err := c.Fetch(context.Background(), tid, "Account:001Y")
	if err != nil {
		t.Fatalf("Fetch: %v", err)
	}
	if strings.Contains(string(doc.Body), "AnnualRevenue") {
		t.Fatalf("FLS leak: AnnualRevenue should not be present, body=%s", string(doc.Body))
	}
	var rec map[string]any
	_ = json.Unmarshal(doc.Body, &rec)
	if _, present := rec["AnnualRevenue"]; present {
		t.Fatalf("FLS leak: AnnualRevenue parsed into record")
	}
}

func TestSearch_ParameterizedSearch(t *testing.T) {
	var gotQ string
	mux := http.NewServeMux()
	mux.HandleFunc("/services/data/v59.0/parameterizedSearch", func(w http.ResponseWriter, r *http.Request) {
		gotQ = r.URL.Query().Get("q")
		_, _ = w.Write([]byte(`{"searchRecords":[{"attributes":{"type":"Account"},"Id":"001A","Name":"Acme"},{"attributes":{"type":"Contact"},"Id":"003C","Name":"Jane"}]}`))
	})
	api := httptest.NewServer(mux)
	defer api.Close()
	store := connectors.NewMemoryStore()
	c := New(Config{BaseURL: api.URL}, store, nil)
	tid := uuid.New()
	_ = store.Save(context.Background(), tid, Name, connectors.Token{AccessToken: "AT", Extra: map[string]string{"instance_url": api.URL}})
	res, err := c.Search(context.Background(), tid, "Acme")
	if err != nil {
		t.Fatalf("Search: %v", err)
	}
	if gotQ != "Acme" {
		t.Fatalf("query: %q", gotQ)
	}
	if len(res) != 2 || res[0].Type != "account" || res[1].Type != "contact" {
		t.Fatalf("unexpected results: %+v", res)
	}
}

func TestWatch_PushTopicAcceptedOrConflict(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/services/data/v59.0/sobjects/PushTopic", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("want POST")
		}
		// Return 409 to validate the dup-OK path.
		w.WriteHeader(http.StatusConflict)
	})
	api := httptest.NewServer(mux)
	defer api.Close()
	store := connectors.NewMemoryStore()
	c := New(Config{BaseURL: api.URL}, store, nil)
	tid := uuid.New()
	_ = store.Save(context.Background(), tid, Name, connectors.Token{AccessToken: "AT", Extra: map[string]string{"instance_url": api.URL}})
	ctx, cancel := context.WithCancel(context.Background())
	ch, err := c.Watch(ctx, tid)
	if err != nil {
		t.Fatalf("Watch: %v", err)
	}
	cancel()
	select {
	case _, ok := <-ch:
		if ok {
			t.Fatalf("channel should close on cancel")
		}
	case <-time.After(time.Second):
		t.Fatalf("channel didn't close")
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
	if meta.Vendor != "Salesforce" || meta.Category != "crm" {
		t.Fatalf("unexpected metadata: %+v", meta)
	}
}
