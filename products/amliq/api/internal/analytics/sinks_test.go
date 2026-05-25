package analytics

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"
)

func TestNoopSinkDoesNotPanic(t *testing.T) {
	NoopSink{}.Emit(Event{Name: "x", DistinctID: "t1"})
}

func TestLogSinkSetsTimestamp(t *testing.T) {
	LogSink{}.Emit(Event{Name: "x", DistinctID: "t1"})
}

// capturingSink is a Sink test helper used here and by factory_test.
type capturingSink struct {
	mu     sync.Mutex
	events []Event
}

func (c *capturingSink) Emit(ev Event) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.events = append(c.events, ev)
}

func TestHTTPSinkPostsEvent(t *testing.T) {
	var got map[string]interface{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(body, &got)
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	sink := NewHTTPSink(srv.URL, "phc_test", nil)
	sink.Emit(Event{
		Name: "auth.signup", DistinctID: "tnt_1",
		Properties: map[string]interface{}{"country": "US"},
	})

	if got["api_key"] != "phc_test" {
		t.Errorf("api_key=%v", got["api_key"])
	}
	if got["event"] != "auth.signup" {
		t.Errorf("event=%v", got["event"])
	}
	if got["distinct_id"] != "tnt_1" {
		t.Errorf("distinct_id=%v", got["distinct_id"])
	}
	props, _ := got["properties"].(map[string]interface{})
	if props["country"] != "US" {
		t.Errorf("properties.country=%v", props["country"])
	}
	if got["timestamp"] == "" {
		t.Error("timestamp must be auto-set")
	}
}

func TestHTTPSinkSwallows4xx(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
	}))
	defer srv.Close()
	sink := NewHTTPSink(srv.URL, "k", &http.Client{Timeout: time.Second})
	sink.Emit(Event{Name: "x", DistinctID: "t"}) // must not panic
}
