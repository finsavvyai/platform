package main

import (
	"testing"

	"github.com/finsavvyai/pipewarden/internal/config"
)

func TestInitLoggingDefault(t *testing.T) {
	cfg := &config.Config{}
	cfg.Logging.Level = "info"
	cfg.Logging.JSON = false
	l := initLogging(cfg)
	if l == nil {
		t.Fatal("nil logger")
	}
	defer func() { _ = l.Sync() }()
}

func TestInitLoggingWithTracingEnabled(t *testing.T) {
	t.Setenv("PIPEWARDEN_TRACE", "1")
	t.Setenv("PIPEWARDEN_TRACE_PATH", t.TempDir()+"/cmd.trace")
	cfg := &config.Config{}
	cfg.Logging.Level = "warn"
	l := initLogging(cfg)
	if l == nil {
		t.Fatal("nil logger with tracing")
	}
	defer func() { _ = l.Sync() }()
}
