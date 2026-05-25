package server

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"testing"
	"time"

	"github.com/finsavvyai/pipewarden/internal/logging"
)

func freePort(t *testing.T) int {
	t.Helper()
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	defer func() { _ = l.Close() }()
	return l.Addr().(*net.TCPAddr).Port
}

func TestServerListensAndShutsDown(t *testing.T) {
	port := freePort(t)
	mux := http.NewServeMux()
	mux.HandleFunc("/ping", func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("pong"))
	})

	s := New(mux, port, logging.NewDefault())
	errCh := make(chan error, 1)
	go func() { errCh <- s.ListenAndServe() }()

	deadline := time.Now().Add(2 * time.Second)
	url := fmt.Sprintf("http://127.0.0.1:%d/ping", port)
	for time.Now().Before(deadline) {
		resp, err := http.Get(url)
		if err == nil {
			_ = resp.Body.Close()
			if resp.StatusCode == 200 {
				goto serving
			}
		}
		time.Sleep(20 * time.Millisecond)
	}
	t.Fatalf("server never accepted requests on port %d", port)

serving:
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	if err := s.Shutdown(ctx); err != nil {
		t.Fatalf("shutdown: %v", err)
	}

	select {
	case err := <-errCh:
		if err != nil && err != http.ErrServerClosed {
			t.Fatalf("ListenAndServe: %v", err)
		}
	case <-time.After(time.Second):
		t.Fatalf("ListenAndServe did not return after shutdown")
	}
}
