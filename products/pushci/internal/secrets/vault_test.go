package secrets_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"

	"github.com/finsavvyai/pushci/internal/secrets"
)

func TestVaultClient(t *testing.T) {
	var revoked atomic.Bool
	mux := http.NewServeMux()
	mux.HandleFunc("/v1/auth/approle/login", func(w http.ResponseWriter, r *http.Request) {
		var req map[string]string
		json.NewDecoder(r.Body).Decode(&req)
		if req["role_id"] != "good-role" {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"auth": map[string]any{"client_token": "test-tok", "lease_duration": 0},
		})
	})
	mux.HandleFunc("/v1/secret/data/pilot/maven", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"data": map[string]any{"data": map[string]string{"token": "mvn-secret", "user": "svc-bot"}},
		})
	})
	mux.HandleFunc("/v1/auth/token/revoke-self", func(w http.ResponseWriter, r *http.Request) {
		revoked.Store(true)
		w.WriteHeader(http.StatusNoContent)
	})
	mux.HandleFunc("/v1/auth/token/lookup-self", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"data": map[string]any{"policies": []string{"pushci-pilot", "default"}},
		})
	})
	srv := httptest.NewServer(mux)
	defer srv.Close()

	t.Run("BadRoleID", func(t *testing.T) {
		_, err := secrets.NewVaultClient(context.Background(), srv.URL, "wrong", "any")
		if err == nil {
			t.Fatal("want error for bad role-id, got nil")
		}
	})
	t.Run("HappyPath", func(t *testing.T) {
		vc, err := secrets.NewVaultClient(context.Background(), srv.URL, "good-role", "any")
		if err != nil {
			t.Fatalf("login: %v", err)
		}
		defer vc.Close()
		got, err := vc.Resolve(context.Background(), "vault://secret/data/pilot/maven#token")
		if err != nil {
			t.Fatalf("resolve: %v", err)
		}
		if got != "mvn-secret" {
			t.Errorf("got %q, want mvn-secret", got)
		}
	})
	t.Run("MissingField", func(t *testing.T) {
		vc, err := secrets.NewVaultClient(context.Background(), srv.URL, "good-role", "any")
		if err != nil {
			t.Fatalf("login: %v", err)
		}
		defer vc.Close()
		_, err = vc.Resolve(context.Background(), "vault://secret/data/pilot/maven#nonexistent")
		if err == nil {
			t.Fatal("want error for missing field, got nil")
		}
	})
	t.Run("RevokeOnClose", func(t *testing.T) {
		revoked.Store(false)
		vc, err := secrets.NewVaultClient(context.Background(), srv.URL, "good-role", "any")
		if err != nil {
			t.Fatalf("login: %v", err)
		}
		vc.Close()
		if !revoked.Load() {
			t.Fatal("want revoke-self called on Close")
		}
	})
}
