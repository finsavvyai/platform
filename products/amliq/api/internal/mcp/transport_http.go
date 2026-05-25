package mcp

import (
	"crypto/subtle"
	"encoding/json"
	"net/http"
	"time"
)

// HTTPHandler returns an http.Handler that exposes the MCP JSON-RPC
// dispatcher over HTTP at /mcp and a /healthz check. When bearer is
// non-empty the request must carry a matching Authorization: Bearer
// header (constant-time compared so the secret isn't leaked via
// timing).
func HTTPHandler(s *Server, bearer string) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})
	mux.HandleFunc("/mcp", mcpHTTPHandler(s, bearer))
	return mux
}

func mcpHTTPHandler(s *Server, bearer string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "POST only", http.StatusMethodNotAllowed)
			return
		}
		if !checkBearer(bearer, r) {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req JSONRPCRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest,
				errorResp("", -32700, "parse error"))
			return
		}
		resp := s.Handle(req)
		if resp.ID == "" && resp.Error == nil {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		writeJSON(w, http.StatusOK, resp)
	}
}

func checkBearer(expected string, r *http.Request) bool {
	if expected == "" {
		return true
	}
	auth := r.Header.Get("Authorization")
	const prefix = "Bearer "
	if len(auth) <= len(prefix) || auth[:len(prefix)] != prefix {
		return false
	}
	got := auth[len(prefix):]
	return subtle.ConstantTimeCompare([]byte(got), []byte(expected)) == 1
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// ServeHTTP starts an HTTP server bound to addr serving the MCP
// endpoint. Used by the cmd/mcp-server binary; tests should use
// HTTPHandler with httptest instead.
func ServeHTTP(s *Server, addr, bearer string) error {
	srv := &http.Server{
		Addr:              addr,
		Handler:           HTTPHandler(s, bearer),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      60 * time.Second,
	}
	return srv.ListenAndServe()
}
