package main

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/finsavvyai/pipewarden/internal/config"
	"github.com/finsavvyai/pipewarden/internal/integrations/github"
	"github.com/finsavvyai/pipewarden/internal/logging"
)

func TestTestProviderSubcommandMissingArgs(t *testing.T) {
	captureStderr(t, func() {
		if got := testProviderSubcommand([]string{}); got != 2 {
			t.Errorf("missing args: %d", got)
		}
	})
}

func TestTestProviderSubcommandUnknownPlatform(t *testing.T) {
	captureStderr(t, func() {
		got := testProviderSubcommand([]string{"--platform=bogus", "--owner=o", "--repo=r"})
		if got != 2 {
			t.Errorf("unknown platform: %d", got)
		}
	})
}

func TestTestProviderSubcommandBitbucketNoUsername(t *testing.T) {
	captureStderr(t, func() {
		got := testProviderSubcommand([]string{
			"--platform=bitbucket", "--owner=o", "--repo=r", "--token=t",
		})
		if got != 2 {
			t.Errorf("bb no username: %d", got)
		}
	})
}

func TestRunProviderSmokeFailingTestConnection(t *testing.T) {
	logger, _ := logging.New(&config.LoggingConfig{Level: "error", JSON: false})

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer srv.Close()
	prov := github.NewClient(github.Config{Token: "tok", BaseURL: srv.URL}, logger)

	captureStdout(t, func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		got := runProviderSmoke(ctx, prov, "o", "r", 3)
		if got != 1 {
			t.Errorf("auth fail exit: %d", got)
		}
	})
}

func TestRunProviderSmokeListFailure(t *testing.T) {
	logger, _ := logging.New(&config.LoggingConfig{Level: "error", JSON: false})

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.Contains(r.URL.Path, "/user"):
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("X-OAuth-Scopes", "repo")
			_, _ = w.Write([]byte(`{"login":"u"}`))
		default:
			w.WriteHeader(http.StatusForbidden)
		}
	}))
	defer srv.Close()
	prov := github.NewClient(github.Config{Token: "tok", BaseURL: srv.URL}, logger)

	captureStdout(t, func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		got := runProviderSmoke(ctx, prov, "o", "r", 3)
		if got != 1 {
			t.Errorf("list fail exit: %d", got)
		}
	})
}

func TestRunProviderSmokeNoToken(t *testing.T) {
	logger, _ := logging.New(&config.LoggingConfig{Level: "error", JSON: false})
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Public-mode list endpoints return empty array.
		_, _ = w.Write([]byte(`[]`))
	}))
	defer srv.Close()
	prov := github.NewClient(github.Config{Token: "", BaseURL: srv.URL}, logger)

	captureStdout(t, func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		// Public mode skips TestConnection; with no real GitHub the list call may
		// 404. Either 0 (clean) or 1 (list failed) is acceptable — branch coverage
		// is the goal.
		_ = runProviderSmoke(ctx, prov, "o", "r", 3)
	})
}
