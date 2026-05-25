package fingerprint

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func okHandler(t *testing.T) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sig, ok := FromContext(r.Context())
		require.True(t, ok, "signals should be in context")
		assert.Equal(t, "Mozilla/5.0", sig.UserAgent)
		w.WriteHeader(http.StatusOK)
	})
}

func callWithUA(h http.Handler, ua string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("User-Agent", ua)
	req.Header.Set("Accept-Language", "en-US")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestMiddleware_AttachesSignalsToContext(t *testing.T) {
	h := Middleware(Options{})(okHandler(t))
	rec := callWithUA(h, "Mozilla/5.0")
	assert.Equal(t, http.StatusOK, rec.Code)
}

func TestMiddleware_ValidatorBlocks(t *testing.T) {
	called := false
	h := Middleware(Options{
		Validator: func(r *http.Request, hash string, s Signals) error {
			called = true
			return errors.New("stored fingerprint mismatch")
		},
	})(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("next handler must not run on validator error")
	}))

	rec := callWithUA(h, "Mozilla/5.0")
	assert.True(t, called)
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
	assert.Contains(t, rec.Body.String(), "FINGERPRINT_MISMATCH")
	assert.Contains(t, rec.Body.String(), "stored fingerprint mismatch")
}

func TestMiddleware_ValidatorPasses(t *testing.T) {
	h := Middleware(Options{
		Validator: func(r *http.Request, hash string, s Signals) error { return nil },
	})(okHandler(t))
	rec := callWithUA(h, "Mozilla/5.0")
	assert.Equal(t, http.StatusOK, rec.Code)
}

func TestMiddleware_RequireStable_BlocksSparse(t *testing.T) {
	h := Middleware(Options{RequireStable: true})(
		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			t.Fatal("handler should not run")
		}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	// only UA — one signal, Stable() = false
	req.Header.Set("User-Agent", "ua")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
	assert.Contains(t, rec.Body.String(), "FINGERPRINT_UNSTABLE")
}

func TestMiddleware_ClientIPResolver(t *testing.T) {
	var seenIP string
	h := Middleware(Options{
		ClientIP: func(r *http.Request) string { return "10.0.0.1" },
		Validator: func(r *http.Request, hash string, s Signals) error {
			seenIP = s.IP
			return nil
		},
	})(okHandler(t))
	callWithUA(h, "Mozilla/5.0")
	assert.Equal(t, "10.0.0.1", seenIP)
}

func TestFromContext_AbsentReturnsFalse(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	_, ok := FromContext(req.Context())
	assert.False(t, ok)
}

func TestValidator_ControlBytesInErrorAreEscapedToValidJSON(t *testing.T) {
	// Regression for H1: hand-rolled escape only handled "\\n\\r\\t and
	// produced invalid JSON for bytes like 0x01 or 0x08. Now uses
	// encoding/json which escapes every control byte per RFC 8259.
	msg := "pre\x01mid\x08end\"quoted\\\n"
	h := Middleware(Options{
		Validator: func(r *http.Request, hash string, s Signals) error {
			return errors.New(msg)
		},
	})(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("next must not run")
	}))

	rec := callWithUA(h, "Mozilla/5.0")
	require.Equal(t, http.StatusUnauthorized, rec.Code)

	var parsed map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &parsed),
		"response body must be valid JSON despite control bytes in validator message")
	errObj, _ := parsed["error"].(map[string]any)
	assert.Equal(t, "FINGERPRINT_MISMATCH", errObj["code"])
	assert.Equal(t, msg, errObj["message"],
		"message round-trips exactly through JSON encode/decode")
}
