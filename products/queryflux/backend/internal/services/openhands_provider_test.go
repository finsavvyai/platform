package services

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestOpenHandsProvider_ConvertNLToSQL(t *testing.T) {
	// Mock OpenHands Engine server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/api/queryflux/generate-sql", r.URL.Path)
		assert.Equal(t, "POST", r.Method)
		assert.Equal(t, "application/json", r.Header.Get("Content-Type"))

		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"sql": "SELECT * FROM users"}`))
	}))
	defer server.Close()

	provider := NewOpenHandsProvider(server.URL, "")

	sql, err := provider.ConvertNLToSQL(context.Background(), "Get all users", "users(id, name)")
	assert.NoError(t, err)
	assert.Equal(t, "SELECT * FROM users", sql)
}

func TestOpenHandsProvider_IsHealthy(t *testing.T) {
	provider := NewOpenHandsProvider("http://localhost:8787", "")
	assert.True(t, provider.IsHealthy(context.Background()))
}
