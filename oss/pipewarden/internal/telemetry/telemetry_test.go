package telemetry

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestEnabledDefaultsOff(t *testing.T) {
	t.Setenv("PIPEWARDEN_TELEMETRY", "")
	if Enabled() {
		t.Fatal("telemetry should be off when env unset")
	}
}

func TestEnabledRecognisedOptIns(t *testing.T) {
	for _, v := range []string{"1", "on", "On", "TRUE", "yes"} {
		t.Setenv("PIPEWARDEN_TELEMETRY", v)
		if !Enabled() {
			t.Errorf("expected Enabled true for %q", v)
		}
	}
}

func TestEnabledRejectsUnknown(t *testing.T) {
	for _, v := range []string{"0", "off", "false", "no", "maybe", " "} {
		t.Setenv("PIPEWARDEN_TELEMETRY", v)
		if Enabled() {
			t.Errorf("expected Enabled false for %q", v)
		}
	}
}

func TestSendIsNoopWhenDisabled(t *testing.T) {
	t.Setenv("PIPEWARDEN_TELEMETRY", "")
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		t.Error("server should not have been hit")
	}))
	defer srv.Close()
	t.Setenv("PIPEWARDEN_TELEMETRY_HOST", srv.URL)
	if err := New().Send(context.Background(), Event{Name: "scan_run"}); err != nil {
		t.Errorf("noop send returned error: %v", err)
	}
}

func TestSendPostsAnonymizedEvent(t *testing.T) {
	t.Setenv("PIPEWARDEN_TELEMETRY", "1")

	var got map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(body, &got)
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()
	t.Setenv("PIPEWARDEN_TELEMETRY_HOST", srv.URL)
	t.Setenv("PIPEWARDEN_TELEMETRY_KEY", "phc_test")

	err := New().Send(context.Background(), Event{
		Name:       "scan_run",
		Properties: map[string]any{"findings": 7, "duration_ms": 1234},
	})
	if err != nil {
		t.Fatalf("send: %v", err)
	}
	if got["event"] != "scan_run" {
		t.Errorf("event: %v", got["event"])
	}
	if got["api_key"] != "phc_test" {
		t.Errorf("api_key: %v", got["api_key"])
	}
	if got["distinct_id"] == nil || len(got["distinct_id"].(string)) != 16 {
		t.Errorf("distinct_id should be 16 hex chars, got %v", got["distinct_id"])
	}
	props, _ := got["properties"].(map[string]any)
	if props["findings"].(float64) != 7 {
		t.Errorf("findings prop: %v", props["findings"])
	}
	if props["os"] == nil || props["arch"] == nil {
		t.Errorf("missing os/arch in props: %v", props)
	}
}

func TestSendPropagatesServerError(t *testing.T) {
	t.Setenv("PIPEWARDEN_TELEMETRY", "1")
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusForbidden)
	}))
	defer srv.Close()
	t.Setenv("PIPEWARDEN_TELEMETRY_HOST", srv.URL)
	err := New().Send(context.Background(), Event{Name: "boom"})
	if err == nil {
		t.Fatal("expected error for 403 response")
	}
}
