package analytics

import "testing"

func TestConfigureReplacesDefault(t *testing.T) {
	cs := &capturingSink{}
	Configure(cs)
	t.Cleanup(func() { Configure(NoopSink{}) })

	Default().Emit(Event{Name: "auth.login", DistinctID: "tnt_2"})
	if len(cs.events) != 1 {
		t.Fatalf("captured %d events, want 1", len(cs.events))
	}
	if cs.events[0].Name != "auth.login" {
		t.Errorf("name=%q", cs.events[0].Name)
	}
}

func TestConfigureNilFallsBackToNoop(t *testing.T) {
	Configure(nil)
	t.Cleanup(func() { Configure(NoopSink{}) })
	if _, ok := Default().(NoopSink); !ok {
		t.Errorf("expected NoopSink, got %T", Default())
	}
}

func TestFromEnvNoopWhenUnset(t *testing.T) {
	t.Setenv("ANALYTICS_MODE", "")
	t.Setenv("POSTHOG_API_KEY", "")
	if _, ok := FromEnv().(NoopSink); !ok {
		t.Errorf("expected NoopSink, got %T", FromEnv())
	}
}

func TestFromEnvLogMode(t *testing.T) {
	t.Setenv("ANALYTICS_MODE", "log")
	t.Setenv("POSTHOG_API_KEY", "")
	if _, ok := FromEnv().(LogSink); !ok {
		t.Errorf("expected LogSink, got %T", FromEnv())
	}
}

func TestFromEnvHTTPWhenAPIKeySet(t *testing.T) {
	t.Setenv("ANALYTICS_MODE", "")
	t.Setenv("POSTHOG_API_KEY", "phc_xyz")
	t.Setenv("ANALYTICS_ENDPOINT", "https://example/capture")
	s, ok := FromEnv().(*HTTPSink)
	if !ok {
		t.Fatalf("expected *HTTPSink, got %T", FromEnv())
	}
	if s.apiKey != "phc_xyz" || s.endpoint != "https://example/capture" {
		t.Errorf("HTTPSink not configured from env: %+v", s)
	}
}
