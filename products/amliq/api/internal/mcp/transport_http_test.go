package mcp

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHTTPToolsList(t *testing.T) {
	srv := httptest.NewServer(HTTPHandler(testServer(), ""))
	defer srv.Close()

	body := []byte(`{"jsonrpc":"2.0","id":"1","method":"tools/list"}`)
	resp, err := http.Post(srv.URL+"/mcp", "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		t.Fatalf("status=%d", resp.StatusCode)
	}
	var out JSONRPCResponse
	_ = json.NewDecoder(resp.Body).Decode(&out)
	var res map[string]interface{}
	_ = json.Unmarshal(out.Result, &res)
	tools, _ := res["tools"].([]interface{})
	if len(tools) < 6 {
		t.Fatalf("expected >=6 tools, got %d", len(tools))
	}
}

func TestHTTPBearerRequired(t *testing.T) {
	srv := httptest.NewServer(HTTPHandler(testServer(), "s3cret"))
	defer srv.Close()

	resp, err := http.Post(srv.URL+"/mcp", "application/json",
		bytes.NewReader([]byte(`{"jsonrpc":"2.0","id":"1","method":"tools/list"}`)))
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp.StatusCode)
	}

	req, _ := http.NewRequest("POST", srv.URL+"/mcp",
		bytes.NewReader([]byte(`{"jsonrpc":"2.0","id":"1","method":"tools/list"}`)))
	req.Header.Set("Authorization", "Bearer s3cret")
	resp, err = http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != 200 {
		t.Fatalf("expected 200 with valid bearer, got %d", resp.StatusCode)
	}
}

func TestHTTPGetRejected(t *testing.T) {
	srv := httptest.NewServer(HTTPHandler(testServer(), ""))
	defer srv.Close()
	resp, err := http.Get(srv.URL + "/mcp")
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405, got %d", resp.StatusCode)
	}
}

func TestHTTPBadJSON(t *testing.T) {
	srv := httptest.NewServer(HTTPHandler(testServer(), ""))
	defer srv.Close()
	resp, err := http.Post(srv.URL+"/mcp", "application/json",
		bytes.NewReader([]byte(`{not-json`)))
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp.StatusCode)
	}
}

func TestHTTPHealthz(t *testing.T) {
	srv := httptest.NewServer(HTTPHandler(testServer(), ""))
	defer srv.Close()
	resp, err := http.Get(srv.URL + "/healthz")
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", resp.StatusCode)
	}
}
