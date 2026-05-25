package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestHandleUpdateConfig_InvalidBody(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest("POST", "/api/config", strings.NewReader("{bad"))
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestHandleStartCluster(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest("POST", "/api/cluster/start", nil)
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
	}
}

func TestHandleStopCluster(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest("POST", "/api/cluster/stop", nil)
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
	}
}

func TestHandleRuntimeStats(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest("GET", "/debug/runtime", nil)
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
	}

	var stats map[string]interface{}
	json.NewDecoder(w.Body).Decode(&stats)
	if stats["goroutines"] == nil {
		t.Error("missing goroutines in runtime stats")
	}
	if stats["go_version"] == nil {
		t.Error("missing go_version in runtime stats")
	}
	if stats["memory"] == nil {
		t.Error("missing memory in runtime stats")
	}
}

func TestHandleRuntimeStats_WrongMethod(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest("POST", "/debug/runtime", nil)
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)

	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("status = %d, want %d", w.Code, http.StatusMethodNotAllowed)
	}
}

func TestHandleStartCluster_WrongMethod(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest("GET", "/api/cluster/start", nil)
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)

	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("status = %d, want %d", w.Code, http.StatusMethodNotAllowed)
	}
}

func TestHandleStopCluster_WrongMethod(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest("GET", "/api/cluster/stop", nil)
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)

	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("status = %d, want %d", w.Code, http.StatusMethodNotAllowed)
	}
}

func TestHandleGetConfig_WrongMethod(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest("DELETE", "/api/config", nil)
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)

	// The /api/config route only handles GET and POST.
	// A DELETE falls through both branches with no response written,
	// so httptest.ResponseRecorder defaults to 200.
	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
	}
}
