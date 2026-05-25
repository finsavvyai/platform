package analytics

import (
	"os"
	"sync"
)

const (
	defaultPostHogEndpoint = "https://us.i.posthog.com/i/v0/e/"
	envAPIKey              = "POSTHOG_API_KEY"
	envEndpoint            = "ANALYTICS_ENDPOINT"
	envMode                = "ANALYTICS_MODE" // "log", "http", "noop"
)

var (
	defaultSinkMu sync.RWMutex
	defaultSink   Sink = NoopSink{}
)

// Default returns the process-wide sink. Safe for concurrent
// readers; writers go through Configure.
func Default() Sink {
	defaultSinkMu.RLock()
	defer defaultSinkMu.RUnlock()
	return defaultSink
}

// Configure swaps the process-wide sink. Tests use this to inject
// a capturing sink and assert emissions; production wiring calls
// it once during startup with the env-derived sink.
func Configure(s Sink) {
	defaultSinkMu.Lock()
	defer defaultSinkMu.Unlock()
	if s == nil {
		defaultSink = NoopSink{}
		return
	}
	defaultSink = s
}

// FromEnv returns a sink derived from environment variables:
//   - ANALYTICS_MODE=noop    → NoopSink
//   - ANALYTICS_MODE=log     → LogSink (stderr)
//   - POSTHOG_API_KEY set    → HTTPSink to ANALYTICS_ENDPOINT or
//     defaultPostHogEndpoint
//   - otherwise              → NoopSink
func FromEnv() Sink {
	switch os.Getenv(envMode) {
	case "noop":
		return NoopSink{}
	case "log":
		return LogSink{}
	}
	if key := os.Getenv(envAPIKey); key != "" {
		ep := os.Getenv(envEndpoint)
		if ep == "" {
			ep = defaultPostHogEndpoint
		}
		return NewHTTPSink(ep, key, nil)
	}
	return NoopSink{}
}
