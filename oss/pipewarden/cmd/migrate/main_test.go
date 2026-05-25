package main

import (
	"bytes"
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/finsavvyai/pipewarden/internal/storage"
)

func TestRunMissingURL(t *testing.T) {
	if err := run(env{Driver: "postgres", OpenFn: storage.Open}); err == nil {
		t.Fatalf("expected error when URL empty")
	}
}

func TestRunSqliteHappyPath(t *testing.T) {
	dir := t.TempDir()
	var buf bytes.Buffer
	err := run(env{
		URL:     dir + "/test.db",
		Driver:  "sqlite",
		Timeout: 10 * time.Second,
		OpenFn:  storage.Open,
		Out:     &buf,
	})
	if err != nil {
		t.Fatalf("run: %v", err)
	}
	if !strings.Contains(buf.String(), "migrate ok") {
		t.Fatalf("missing success line: %q", buf.String())
	}
}

func TestRunOpenError(t *testing.T) {
	err := run(env{
		URL:     "anything",
		Driver:  "postgres",
		Timeout: 1 * time.Second,
		OpenFn: func(_ storage.Config) (*storage.DB, error) {
			return nil, errors.New("forced open failure")
		},
		Out: &bytes.Buffer{},
	})
	if err == nil || !strings.Contains(err.Error(), "forced open failure") {
		t.Fatalf("expected forced failure to propagate, got %v", err)
	}
}

func TestRunTimeout(t *testing.T) {
	err := run(env{
		URL:     "anything",
		Driver:  "postgres",
		Timeout: 10 * time.Millisecond,
		OpenFn: func(_ storage.Config) (*storage.DB, error) {
			time.Sleep(200 * time.Millisecond)
			return nil, errors.New("too late")
		},
		Out: &bytes.Buffer{},
	})
	if err == nil || !strings.Contains(err.Error(), "timed out") {
		t.Fatalf("expected timeout, got %v", err)
	}
	_ = context.Canceled // imported only above
}

func TestLoadEnvDefaults(t *testing.T) {
	t.Setenv("PIPEWARDEN_DATABASE_URL", "url-from-env")
	t.Setenv("PIPEWARDEN_DATABASE_DRIVER", "")
	e := loadEnv()
	if e.URL != "url-from-env" {
		t.Fatalf("URL: %q", e.URL)
	}
	if e.Driver != "postgres" {
		t.Fatalf("driver default should be postgres, got %q", e.Driver)
	}
}

func TestLoadEnvFallbackToDATABASE_URL(t *testing.T) {
	t.Setenv("PIPEWARDEN_DATABASE_URL", "")
	t.Setenv("DATABASE_URL", "fallback-url")
	t.Setenv("PIPEWARDEN_DATABASE_DRIVER", "sqlite")
	e := loadEnv()
	if e.URL != "fallback-url" {
		t.Fatalf("URL fallback: %q", e.URL)
	}
	if e.Driver != "sqlite" {
		t.Fatalf("driver override: %q", e.Driver)
	}
}
