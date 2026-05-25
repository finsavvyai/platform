package ui

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"finsavvyai-desktop/config"
	"finsavvyai-desktop/services"
)

func clusterConfigFromURL(url string) *config.Config {
	parts := strings.SplitN(strings.TrimPrefix(url, "http://"), ":", 2)
	host := parts[0]
	port := 0
	if len(parts) == 2 {
		for _, c := range parts[1] {
			if c >= '0' && c <= '9' {
				port = port*10 + int(c-'0')
			}
		}
	}
	cfg := config.Default()
	cfg.Cluster.MasterHost = host
	cfg.Cluster.MasterPort = port
	cfg.Cluster.Timeout = 2
	return cfg
}

func TestRunMonitoringTick_StatusError(t *testing.T) {
	// Server returns invalid JSON for status endpoint to trigger error
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`not-json`))
	}))
	defer srv.Close()

	cfg := clusterConfigFromURL(srv.URL)
	logger := newTestLogger()
	clusterSvc := services.NewClusterService(cfg, logger)
	hub := services.NewWSHub(logger)
	go hub.Run()

	ctx := context.Background()
	// Should not panic - error path returns early
	runMonitoringTick(ctx, clusterSvc, hub, logger)
}

func TestRunMonitoringTick_MetricsAfterStatus(t *testing.T) {
	// Server returns valid status, so we reach the metrics path
	callCount := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		callCount++
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"cluster_id":   "test",
			"total_nodes":  1,
			"online_nodes": 1,
			"is_running":   true,
		})
	}))
	defer srv.Close()

	cfg := clusterConfigFromURL(srv.URL)
	logger := newTestLogger()
	clusterSvc := services.NewClusterService(cfg, logger)
	hub := services.NewWSHub(logger)
	go hub.Run()

	client := &services.WSClient{
		Send:   make(chan []byte, 256),
		Hub:    hub,
		Logger: logger,
	}
	hub.Register(client)
	time.Sleep(50 * time.Millisecond)

	ctx := context.Background()
	go runMonitoringTick(ctx, clusterSvc, hub, logger)

	// Should receive at least one broadcast
	select {
	case <-client.Send:
		// success
	case <-time.After(2 * time.Second):
		t.Error("no broadcast received")
	}
}

func TestStartSystemMonitoringWithCtx_MultiTicks(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"cluster_id": "multi-tick", "total_nodes": 0,
		})
	}))
	defer srv.Close()

	cfg := clusterConfigFromURL(srv.URL)
	logger := newTestLogger()
	clusterSvc := services.NewClusterService(cfg, logger)
	hub := services.NewWSHub(logger)
	go hub.Run()

	ctx, cancel := context.WithCancel(context.Background())
	go startSystemMonitoringWithCtx(ctx, clusterSvc, hub, logger, 15*time.Millisecond)

	// Let multiple ticks happen
	time.Sleep(100 * time.Millisecond)
	cancel()
}

func TestRunMonitoringTick_FullPath(t *testing.T) {
	// Return valid status so the full path executes
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"cluster_id":   "full",
			"total_nodes":  3,
			"online_nodes": 2,
			"is_running":   true,
			"timestamp":    "2026-01-01T00:00:00Z",
		})
	}))
	defer srv.Close()

	cfg := clusterConfigFromURL(srv.URL)
	logger := newTestLogger()
	clusterSvc := services.NewClusterService(cfg, logger)
	hub := services.NewWSHub(logger)
	go hub.Run()

	client := &services.WSClient{
		Send:   make(chan []byte, 256),
		Hub:    hub,
		Logger: logger,
	}
	hub.Register(client)
	time.Sleep(50 * time.Millisecond)

	ctx := context.Background()
	go runMonitoringTick(ctx, clusterSvc, hub, logger)

	// Collect broadcasts with timeout
	received := 0
	deadline := time.After(2 * time.Second)
loop:
	for received < 2 {
		select {
		case <-client.Send:
			received++
		case <-deadline:
			break loop
		}
	}
	if received < 1 {
		t.Errorf("received %d broadcasts, want at least 1", received)
	}
}
