package lemonsqueezy_test

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/billing/lemonsqueezy"
)

const (
	testSecret    = "test-webhook-secret"
	testProductID = "12345"
)

// sign produces the correct X-Signature for a payload using testSecret.
func sign(t *testing.T, payload []byte) string {
	t.Helper()
	mac := hmac.New(sha256.New, []byte(testSecret))
	mac.Write(payload)
	return hex.EncodeToString(mac.Sum(nil))
}

// buildPayload returns a minimal LS webhook JSON body for productID.
func buildPayload(t *testing.T, productID int64, event string) []byte {
	t.Helper()
	type attrs struct {
		ProductID int64 `json:"product_id"`
	}
	type dataT struct {
		Attributes attrs `json:"attributes"`
	}
	type metaT struct {
		EventName string `json:"event_name"`
		StoreID   int64  `json:"store_id"`
	}
	body, err := json.Marshal(struct {
		Meta metaT `json:"meta"`
		Data dataT `json:"data"`
	}{
		Meta: metaT{EventName: event, StoreID: 99},
		Data: dataT{Attributes: attrs{ProductID: productID}},
	})
	if err != nil {
		t.Fatal(err)
	}
	return body
}

func post(handler http.Handler, body []byte, sig string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/webhooks/lemonsqueezy", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Signature", sig)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	return rr
}

// TestWebhook_ValidSignatureOurProduct — correct sig + our product_id → 200 {received:true}.
func TestWebhook_ValidSignatureOurProduct(t *testing.T) {
	h := lemonsqueezy.New(testSecret, testProductID)
	body := buildPayload(t, 12345, "subscription_created")
	rr := post(h, body, sign(t, body))

	if rr.Code != http.StatusOK {
		t.Fatalf("want 200, got %d: %s", rr.Code, rr.Body.String())
	}
	var resp map[string]any
	if err := json.NewDecoder(rr.Body).Decode(&resp); err != nil {
		t.Fatal(err)
	}
	if resp["received"] != true {
		t.Errorf("want received=true, got %v", resp)
	}
	if _, hasIgnored := resp["ignored"]; hasIgnored {
		t.Errorf("our-product event should not set ignored; got %v", resp)
	}
}

// TestWebhook_InvalidSignature — tampered body → 401.
func TestWebhook_InvalidSignature(t *testing.T) {
	h := lemonsqueezy.New(testSecret, testProductID)
	body := buildPayload(t, 12345, "subscription_created")
	tampered := append(body, []byte("extra")...)
	rr := post(h, tampered, sign(t, body)) // sig computed over original body

	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("want 401 for tampered body, got %d: %s", rr.Code, rr.Body.String())
	}
}

// TestWebhook_ForeignProductIgnored — valid sig, different product_id → 200 {received:true, ignored:true}.
func TestWebhook_ForeignProductIgnored(t *testing.T) {
	h := lemonsqueezy.New(testSecret, testProductID)
	// product_id 99999 belongs to a sibling product (e.g. OpenSyber)
	body := buildPayload(t, 99999, "subscription_created")
	rr := post(h, body, sign(t, body))

	if rr.Code != http.StatusOK {
		t.Fatalf("want 200 for foreign product, got %d: %s", rr.Code, rr.Body.String())
	}
	var resp map[string]any
	if err := json.NewDecoder(rr.Body).Decode(&resp); err != nil {
		t.Fatal(err)
	}
	if resp["ignored"] != true {
		t.Errorf("want ignored=true for foreign product, got %v", resp)
	}
}

// TestWebhook_EmptySignatureRejected — missing X-Signature → 401.
func TestWebhook_EmptySignatureRejected(t *testing.T) {
	h := lemonsqueezy.New(testSecret, testProductID)
	body := buildPayload(t, 12345, "order_created")
	rr := post(h, body, "") // no sig

	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("want 401 for empty signature, got %d", rr.Code)
	}
}

// TestVerifySignature_GoldenVector — known-good HMAC pair.
func TestVerifySignature_GoldenVector(t *testing.T) {
	payload := []byte(`{"meta":{"event_name":"subscription_created"}}`)
	secret := "golden-secret"
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(payload)
	sig := hex.EncodeToString(mac.Sum(nil))

	if !lemonsqueezy.VerifySignature(payload, sig, secret) {
		t.Error("golden vector should verify")
	}
	if lemonsqueezy.VerifySignature(payload, sig+"x", secret) {
		t.Error("corrupted signature should not verify")
	}
}
