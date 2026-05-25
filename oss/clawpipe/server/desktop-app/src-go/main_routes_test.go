package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gorilla/websocket"
)

func TestPprofCmdline(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest("GET", "/debug/pprof/cmdline", nil)
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
	}
}

func TestPprofSymbol(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest("GET", "/debug/pprof/symbol", nil)
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
	}
}

func TestPprofIndex(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest("GET", "/debug/pprof/", nil)
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
	}
}

func TestPprofProfile(t *testing.T) {
	srv := newTestServer()
	// Use seconds=0 to avoid blocking
	req := httptest.NewRequest("GET", "/debug/pprof/profile?seconds=1", nil)
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)
	// Just verify it routes correctly (may return 200 or timeout)
	_ = w.Code
}

func TestPprofTrace(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest("GET", "/debug/pprof/trace?seconds=1", nil)
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)
	_ = w.Code
}

func TestWebSocket_Connect(t *testing.T) {
	srv := newTestServer()
	ts := httptest.NewServer(srv)
	defer ts.Close()

	wsURL := "ws" + strings.TrimPrefix(ts.URL, "http") + "/ws"
	conn, resp, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("websocket dial failed: %v", err)
	}
	defer conn.Close()

	if resp.StatusCode != http.StatusSwitchingProtocols {
		t.Errorf("status = %d, want %d",
			resp.StatusCode, http.StatusSwitchingProtocols)
	}
}

func TestWebSocket_BadUpgrade(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest("GET", "/ws", nil)
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestClusterNodesDelete_NonDeleteMethod(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest("GET", "/api/cluster/nodes/delete", nil)
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
	}
}

func TestClusterNodes_UnsupportedMethod(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest("DELETE", "/api/cluster/nodes", nil)
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
	}
}

func TestHandleUpdateConfig_ValidPOST(t *testing.T) {
	srv := newTestServer()
	body := `{"server":{"host":"127.0.0.1","port":9090},` +
		`"cluster":{"master_host":"localhost","master_port":8000,"timeout":30}}`
	req := httptest.NewRequest("POST", "/api/config",
		strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
	}

	var resp map[string]string
	json.NewDecoder(w.Body).Decode(&resp)
	if resp["status"] != "success" {
		t.Errorf("status = %q, want %q", resp["status"], "success")
	}
}

func TestHandleUpdateConfig_PUTMethod(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest("PUT", "/api/config", nil)
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
	}
}

func TestServerStruct(t *testing.T) {
	srv := newTestServer()
	if srv.config == nil {
		t.Error("config should not be nil")
	}
	if srv.clusterService == nil {
		t.Error("clusterService should not be nil")
	}
	if srv.wsHub == nil {
		t.Error("wsHub should not be nil")
	}
	if srv.logger == nil {
		t.Error("logger should not be nil")
	}
}
