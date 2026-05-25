package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"finsavvyai-desktop/config"

	"github.com/sirupsen/logrus"
)

func TestNewServer(t *testing.T) {
	cfg := config.Default()
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)

	srv := NewServer(cfg, logger)
	if srv == nil {
		t.Fatal("NewServer returned nil")
	}
	if srv.config != cfg {
		t.Error("config mismatch")
	}
	if srv.clusterService == nil {
		t.Error("clusterService should not be nil")
	}
	if srv.wsHub == nil {
		t.Error("wsHub should not be nil")
	}
}

func TestListenAndServe_Shutdown(t *testing.T) {
	cfg := config.Default()
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)

	srv := NewServer(cfg, logger)
	srv.ListenAndServe(0) // port 0 = OS picks a free port
	srv.Shutdown()

	// Verify httpServer was set
	if srv.httpServer == nil {
		t.Error("httpServer should be set after ListenAndServe")
	}
}

func TestShutdown_DoubleShutdown(t *testing.T) {
	cfg := config.Default()
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)

	srv := NewServer(cfg, logger)
	srv.ListenAndServe(0)
	srv.Shutdown()
	// Second shutdown triggers error path (already closed)
	srv.Shutdown()
}

func TestResolvePort_Default(t *testing.T) {
	os.Unsetenv("PORT")
	port := resolvePort()
	if port != 8080 {
		t.Errorf("port = %d, want 8080", port)
	}
}

func TestResolvePort_FromEnv(t *testing.T) {
	os.Setenv("PORT", "9999")
	defer os.Unsetenv("PORT")
	port := resolvePort()
	if port != 9999 {
		t.Errorf("port = %d, want 9999", port)
	}
}

func TestResolvePort_InvalidEnv(t *testing.T) {
	os.Setenv("PORT", "notanumber")
	defer os.Unsetenv("PORT")
	port := resolvePort()
	if port != 8080 {
		t.Errorf("port = %d, want 8080 for invalid PORT", port)
	}
}

// Direct handler method-guard tests

func TestHandleClusterNodes_DirectWrongMethod(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest("POST", "/direct", nil)
	w := httptest.NewRecorder()
	srv.handleClusterNodes(w, req)

	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("status = %d, want %d",
			w.Code, http.StatusMethodNotAllowed)
	}
}

func TestHandleAddNode_DirectWrongMethod(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest("GET", "/direct", nil)
	w := httptest.NewRecorder()
	srv.handleAddNode(w, req)

	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("status = %d, want %d",
			w.Code, http.StatusMethodNotAllowed)
	}
}

func TestHandleRemoveNode_DirectWrongMethod(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest("GET", "/direct", nil)
	w := httptest.NewRecorder()
	srv.handleRemoveNode(w, req)

	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("status = %d, want %d",
			w.Code, http.StatusMethodNotAllowed)
	}
}

func TestHandleGetConfig_DirectWrongMethod(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest("POST", "/direct", nil)
	w := httptest.NewRecorder()
	srv.handleGetConfig(w, req)

	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("status = %d, want %d",
			w.Code, http.StatusMethodNotAllowed)
	}
}

func TestHandleUpdateConfig_DirectWrongMethod(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest("GET", "/direct", nil)
	w := httptest.NewRecorder()
	srv.handleUpdateConfig(w, req)

	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("status = %d, want %d",
			w.Code, http.StatusMethodNotAllowed)
	}
}
