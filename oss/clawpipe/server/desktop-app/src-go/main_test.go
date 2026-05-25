package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"finsavvyai-desktop/config"
	"finsavvyai-desktop/services"

	"github.com/sirupsen/logrus"
)

func newTestServer() *Server {
	cfg := config.Default()
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	hub := services.NewWSHub(logger)
	go hub.Run()

	return &Server{
		config:         cfg,
		clusterService: services.NewClusterService(cfg, logger),
		wsHub:          hub,
		logger:         logger,
		configSaver:    config.Save,
	}
}

func TestCORSHeaders(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest("GET", "/api/cluster/status", nil)
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)

	if got := w.Header().Get("Access-Control-Allow-Origin"); got != "*" {
		t.Errorf("CORS Allow-Origin = %q, want %q", got, "*")
	}
	if got := w.Header().Get("Access-Control-Allow-Methods"); got == "" {
		t.Error("CORS Allow-Methods is empty")
	}
	if got := w.Header().Get("Access-Control-Allow-Headers"); got == "" {
		t.Error("CORS Allow-Headers is empty")
	}
}

func TestOPTIONS_Preflight(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest("OPTIONS", "/api/cluster/status", nil)
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("OPTIONS status = %d, want %d", w.Code, http.StatusOK)
	}
}

func TestNotFound(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest("GET", "/nonexistent", nil)
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("status = %d, want %d", w.Code, http.StatusNotFound)
	}
}

func TestHandleClusterStatus_GET(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest("GET", "/api/cluster/status", nil)
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
	}
	if ct := w.Header().Get("Content-Type"); ct != "application/json" {
		t.Errorf("Content-Type = %q, want application/json", ct)
	}
}

func TestHandleClusterStatus_WrongMethod(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest("POST", "/api/cluster/status", nil)
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)

	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("status = %d, want %d", w.Code, http.StatusMethodNotAllowed)
	}
}

func TestHandleClusterNodes_GET(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest("GET", "/api/cluster/nodes", nil)
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
	}
}

func TestHandleAddNode_POST(t *testing.T) {
	srv := newTestServer()
	body := `{"name":"test-node","host":"10.0.0.1","port":8001,"models":["gpt-4"]}`
	req := httptest.NewRequest("POST", "/api/cluster/nodes", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
	}

	var resp map[string]string
	json.NewDecoder(w.Body).Decode(&resp)
	if resp["node_id"] == "" {
		t.Error("node_id should not be empty")
	}
}

func TestHandleAddNode_InvalidBody(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest("POST", "/api/cluster/nodes", strings.NewReader("invalid"))
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestHandleRemoveNode_MissingID(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest("DELETE", "/api/cluster/nodes/delete", nil)
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestHandleRemoveNode_WithID(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest("DELETE", "/api/cluster/nodes/delete?id=node-1", nil)
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
	}
}

func TestHandleGetConfig(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest("GET", "/api/config", nil)
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
	}

	var cfg config.Config
	json.NewDecoder(w.Body).Decode(&cfg)
	if cfg.Server.Host != "localhost" {
		t.Errorf("Host = %q, want %q", cfg.Server.Host, "localhost")
	}
}
