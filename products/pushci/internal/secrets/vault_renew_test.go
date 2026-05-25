package secrets_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/finsavvyai/pushci/internal/secrets"
)

func TestVaultClient_RenewLoop(t *testing.T) {
	var renewed atomic.Bool
	mux := http.NewServeMux()
	mux.HandleFunc("/v1/auth/approle/login", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"auth": map[string]any{"client_token": "tok", "lease_duration": 1},
		})
	})
	mux.HandleFunc("/v1/auth/token/renew-self", func(w http.ResponseWriter, r *http.Request) {
		renewed.Store(true)
		w.WriteHeader(http.StatusOK)
	})
	mux.HandleFunc("/v1/auth/token/revoke-self", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})
	srv := httptest.NewServer(mux)
	defer srv.Close()
	vc, err := secrets.NewVaultClient(context.Background(), srv.URL, "any", "any")
	if err != nil {
		t.Fatalf("login: %v", err)
	}
	time.Sleep(600 * time.Millisecond)
	vc.Close()
	if !renewed.Load() {
		t.Fatal("want renewal call at TTL/2 (500ms), got none")
	}
}
