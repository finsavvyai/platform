package services

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"quantumbeam/internal/config"

	"github.com/stretchr/testify/assert"
)

func newTestLSService(serverURL string) *LemonSqueezyService {
	cfg := config.LemonSqueezyConfig{
		APIKey:        "test-api-key",
		StoreID:       "store-123",
		WebhookSecret: "test-webhook-secret",
		APIURL:        serverURL,
		Timeout:       5 * time.Second,
	}
	return NewLemonSqueezyService(cfg, &mockBillingLogger{})
}

func TestNewLemonSqueezyService_Constructor(t *testing.T) {
	svc := newTestLSService("https://api.test.com")
	assert.NotNil(t, svc)
	assert.Equal(t, "test-api-key", svc.apiKey)
	assert.Equal(t, "store-123", svc.storeID)
	assert.Equal(t, "test-webhook-secret", svc.webhookSecret)
	assert.NotNil(t, svc.client)
}

func TestVerifyWebhookSignature_WithSecret(t *testing.T) {
	svc := newTestLSService("https://api.test.com")
	result := svc.VerifyWebhookSignature([]byte("payload"), "sig")
	assert.True(t, result)
}

func TestVerifyWebhookSignature_EmptySecret(t *testing.T) {
	cfg := config.LemonSqueezyConfig{
		APIKey:  "key",
		APIURL:  "https://api.test.com",
		Timeout: 5 * time.Second,
	}
	svc := NewLemonSqueezyService(cfg, &mockBillingLogger{})
	result := svc.VerifyWebhookSignature([]byte("payload"), "sig")
	assert.True(t, result)
}

func TestGetUsage_ReturnsTrackedMap(t *testing.T) {
	svc := newTestLSService("https://api.test.com")
	usage, err := svc.GetUsage(context.Background(), "sub-123")
	assert.NoError(t, err)
	assert.Equal(t, "sub-123", usage["subscription_id"])
	assert.Equal(t, true, usage["usage_tracked"])
}

func TestMakeRequest_SuccessfulGET(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "GET", r.Method)
		assert.Equal(t, "Bearer test-api-key", r.Header.Get("Authorization"))
		assert.Equal(t, "application/vnd.api+json", r.Header.Get("Accept"))
		w.WriteHeader(http.StatusOK)
		resp := map[string]interface{}{"data": map[string]string{"id": "123"}}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	svc := newTestLSService(server.URL)
	resp, err := svc.makeRequest(context.Background(), "GET", "/v1/test", nil)
	assert.NoError(t, err)
	assert.NotNil(t, resp)
}

func TestMakeRequest_WithBody(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "POST", r.Method)
		assert.Equal(t, "application/vnd.api+json", r.Header.Get("Content-Type"))
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]interface{}{"data": nil})
	}))
	defer server.Close()

	svc := newTestLSService(server.URL)
	body := map[string]string{"key": "value"}
	resp, err := svc.makeRequest(context.Background(), "POST", "/v1/test", body)
	assert.NoError(t, err)
	assert.NotNil(t, resp)
}

func TestMakeRequest_APIError_WithErrorBody(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		resp := map[string]interface{}{
			"error": map[string]string{
				"code":    "BAD_REQUEST",
				"message": "invalid input",
			},
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	svc := newTestLSService(server.URL)
	_, err := svc.makeRequest(context.Background(), "GET", "/v1/test", nil)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid input")
}

func TestMakeRequest_APIError_PlainText(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte("server error"))
	}))
	defer server.Close()

	svc := newTestLSService(server.URL)
	_, err := svc.makeRequest(context.Background(), "GET", "/v1/test", nil)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "server error")
}

func TestGetCustomer_Success(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/v1/customers/cust-1", r.URL.Path)
		data := CustomerData{
			Type: "customers", ID: "cust-1",
			Attributes: CustomerAttributes{Email: "test@test.com", Name: "Test"},
		}
		raw, _ := json.Marshal(data)
		resp := map[string]json.RawMessage{"data": raw}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	svc := newTestLSService(server.URL)
	customer, err := svc.GetCustomer(context.Background(), "cust-1")
	assert.NoError(t, err)
	assert.Equal(t, "cust-1", customer.Data.ID)
	assert.Equal(t, "test@test.com", customer.Data.Attributes.Email)
}

func TestGetVariant_Success(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/v1/variants/var-1", r.URL.Path)
		data := VariantData{
			Type: "variants", ID: "var-1",
			Attributes: VariantAttributes{
				Name: "Pro Plan", Price: 49.99, ProductID: "prod-1",
			},
		}
		raw, _ := json.Marshal(data)
		json.NewEncoder(w).Encode(map[string]json.RawMessage{"data": raw})
	}))
	defer server.Close()

	svc := newTestLSService(server.URL)
	variant, err := svc.GetVariant(context.Background(), "var-1")
	assert.NoError(t, err)
	assert.Equal(t, "Pro Plan", variant.Data.Attributes.Name)
	assert.InDelta(t, 49.99, variant.Data.Attributes.Price, 0.01)
}

func TestCancelSubscription_CallsUpdate(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "PATCH", r.Method)
		assert.Contains(t, r.URL.Path, "/v1/subscriptions/sub-1")
		data := SubscriptionData{
			Type: "subscriptions", ID: "sub-1",
			Attributes: SubscriptionAttributes{Status: "cancelled"},
		}
		raw, _ := json.Marshal(data)
		json.NewEncoder(w).Encode(map[string]json.RawMessage{"data": raw})
	}))
	defer server.Close()

	svc := newTestLSService(server.URL)
	sub, err := svc.CancelSubscription(context.Background(), "sub-1")
	assert.NoError(t, err)
	assert.Equal(t, "cancelled", sub.Data.Attributes.Status)
}

func TestMakeRequest_ConnectionRefused(t *testing.T) {
	svc := newTestLSService("http://127.0.0.1:1")
	_, err := svc.makeRequest(context.Background(), "GET", "/v1/test", nil)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to make request")
}
