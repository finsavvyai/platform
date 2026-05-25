package logging

import (
	"testing"

	"github.com/finsavvyai/pipewarden/internal/config"
)

func TestNewWithEachLevel(t *testing.T) {
	for _, lvl := range []string{"debug", "info", "warn", "error"} {
		l, err := New(&config.LoggingConfig{Level: lvl, JSON: false})
		if err != nil {
			t.Fatalf("level %q: %v", lvl, err)
		}
		if l == nil || l.SugaredLogger == nil {
			t.Fatalf("level %q produced nil logger", lvl)
		}
	}
}

func TestNewJSONFormat(t *testing.T) {
	l, err := New(&config.LoggingConfig{Level: "info", JSON: true})
	if err != nil {
		t.Fatalf("json logger: %v", err)
	}
	l.Infow("ping", "k", "v")
}

func TestNewRejectsInvalidLevel(t *testing.T) {
	_, err := New(&config.LoggingConfig{Level: "loud", JSON: false})
	if err == nil {
		t.Fatalf("expected error for invalid level")
	}
}

func TestNewDefault(t *testing.T) {
	l := NewDefault()
	if l == nil || l.SugaredLogger == nil {
		t.Fatalf("NewDefault returned nil")
	}
	l.Info("default works")
}
