package billing

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestNewLemonSqueezyClient(t *testing.T) {
	client := NewLemonSqueezyClient("test_key")
	if client.apiKey != "test_key" {
		t.Errorf("apiKey = %s, want test_key", client.apiKey)
	}
	if client.baseURL != "https://api.lemonsqueezy.com/v1" {
		t.Errorf("baseURL = %s", client.baseURL)
	}
}

func TestNewRequest(t *testing.T) {
	client := NewLemonSqueezyClient("test_key")
	req, err := client.newRequest("GET", "/test", nil)
	if err != nil {
		t.Fatalf("newRequest() error = %v", err)
	}
	if req.Header.Get("Authorization") != "Bearer test_key" {
		t.Error("Authorization header not set correctly")
	}
	if req.Header.Get("Content-Type") != "application/json" {
		t.Error("Content-Type header not set correctly")
	}
}

func TestGetSubscription(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"data":{"id":"sub_123","status":"active"}}`))
	}))
	defer server.Close()

	client := NewLemonSqueezyClient("test_key")
	client.baseURL = server.URL

	result, err := client.GetSubscription("sub_123")
	if err != nil {
		t.Fatalf("GetSubscription() error = %v", err)
	}
	if result == nil {
		t.Error("GetSubscription() result is nil")
	}
}

func TestUpdateSubscription(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	client := NewLemonSqueezyClient("test_key")
	client.baseURL = server.URL

	err := client.UpdateSubscription("sub_123", map[string]interface{}{"status": "paused"})
	if err != nil {
		t.Errorf("UpdateSubscription() error = %v", err)
	}
}

func TestCancelSubscription(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	client := NewLemonSqueezyClient("test_key")
	client.baseURL = server.URL

	err := client.CancelSubscription("sub_123")
	if err != nil {
		t.Errorf("CancelSubscription() error = %v", err)
	}
}
