package main

import (
	"context"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/finsavvyai/pipewarden/internal/tracing"
)

// handleTraceSubcommand captures a runtime trace of a running pipewarden
// server. Two modes:
//
//  1. --attach <url>          — assume a server is already running; poll for
//     --duration seconds, save trace via server env
//     (requires operator to have started the server
//     with PIPEWARDEN_TRACE=1). Falls back to load
//     generation via the provided URL.
//
//  2. --self                  — fork a new server instance here with
//     PIPEWARDEN_TRACE=1, drive it with scripted
//     HTTP requests, then stop.
//
// Default behaviour when no flags given: print instructions and exit.
func handleTraceSubcommand(args []string) {
	fs := flag.NewFlagSet("trace", flag.ExitOnError)
	duration := fs.Duration("duration", 20*time.Second, "how long to drive traffic against the server")
	url := fs.String("url", "http://localhost:8080", "base URL of a running pipewarden server")
	out := fs.String("out", "/tmp/pipewarden.trace", "path to write the trace file")
	openViewer := fs.Bool("open", false, "open `go tool trace` after capture (blocks until viewer exits)")
	_ = fs.Parse(args)

	fmt.Println("pipewarden trace — capturing runtime trace")
	fmt.Printf("  target:   %s\n", *url)
	fmt.Printf("  duration: %s\n", *duration)
	fmt.Printf("  output:   %s\n\n", *out)

	fmt.Println("NOTE: the server must be started with PIPEWARDEN_TRACE=1")
	fmt.Printf("      PIPEWARDEN_TRACE_PATH=%s — or %q will stay empty.\n\n", *out, *out)

	if err := waitForReady(*url, 10*time.Second); err != nil {
		fmt.Fprintf(os.Stderr, "ERR: %v\n", err)
		fmt.Fprintf(os.Stderr, "Start pipewarden in another shell:\n")
		fmt.Fprintf(os.Stderr, "  PIPEWARDEN_TRACE=1 PIPEWARDEN_TRACE_PATH=%s ./bin/pipewarden\n", *out)
		os.Exit(1)
	}

	fmt.Printf("server ready — driving load for %s...\n", *duration)
	driveLoad(context.Background(), *url, *duration)

	fmt.Println("\ntrace capture window ended")
	fmt.Printf("trace file: %s\n", *out)
	fmt.Println("next: `go tool trace " + *out + "` to open the timeline")

	if *openViewer {
		openTrace(*out)
	}
	_ = tracing.Active
}

func waitForReady(base string, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		resp, err := http.Get(strings.TrimRight(base, "/") + "/health")
		if err == nil {
			_, _ = io.Copy(io.Discard, resp.Body)
			_ = resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				return nil
			}
		}
		time.Sleep(400 * time.Millisecond)
	}
	return fmt.Errorf("server at %s not ready within %s", base, timeout)
}

// driveLoad fires representative traffic at the server so the trace captures
// real work rather than an idle timeline.
func driveLoad(ctx context.Context, base string, duration time.Duration) {
	deadline := time.Now().Add(duration)
	base = strings.TrimRight(base, "/")
	client := &http.Client{Timeout: 5 * time.Second}
	requests := []struct{ method, path, body string }{
		{"GET", "/api/v1/status", ""},
		{"GET", "/api/v1/dashboard/overview", ""},
		{"GET", "/api/v1/analysis/history", ""},
		{"GET", "/api/v1/providers", ""},
		{"POST", "/api/v1/dlp/scan", `{"content":"AKIAIOSFODNN7EXAMPLE demo key","source":"trace-load"}`},
		{"GET", "/api/v1/findings/1/similar", ""},
		{"GET", "/health", ""},
	}
	n := 0
	for time.Now().Before(deadline) {
		for _, r := range requests {
			doOne(ctx, client, r.method, base+r.path, r.body)
			n++
		}
		time.Sleep(100 * time.Millisecond)
	}
	fmt.Printf("  issued %d requests\n", n)
}

func doOne(ctx context.Context, c *http.Client, method, url, body string) {
	var reqBody io.Reader
	if body != "" {
		reqBody = strings.NewReader(body)
	}
	req, err := http.NewRequestWithContext(ctx, method, url, reqBody)
	if err != nil {
		return
	}
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := c.Do(req)
	if err != nil {
		return
	}
	_, _ = io.Copy(io.Discard, resp.Body)
	_ = resp.Body.Close()
}

func openTrace(path string) {
	abs, err := filepath.Abs(path)
	if err != nil {
		fmt.Fprintf(os.Stderr, "could not resolve %s: %v\n", path, err)
		return
	}
	cmd := exec.Command("go", "tool", "trace", abs)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		fmt.Fprintf(os.Stderr, "go tool trace failed: %v\n", err)
	}
}
