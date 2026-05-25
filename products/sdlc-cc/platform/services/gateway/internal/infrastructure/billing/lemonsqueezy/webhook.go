package lemonsqueezy

import (
	"encoding/json"
	"io"
	"net/http"
	"strconv"
)

const maxBodyBytes = 1 << 20 // 1 MiB

// Handler is the LemonSqueezy inbound webhook receiver.
//
// It enforces the shared-store contract from Bucket D of the
// integration-debt plan:
//  1. Verify X-Signature (HMAC-SHA256) — reject forged requests.
//  2. Filter data.attributes.product_id — silently accept but ignore
//     events that belong to a sibling product on the same LS store
//     (OpenSyber, TenantIQ, etc.).
//  3. Dispatch by meta.event_name to concrete handlers (shipped in the
//     next iteration as handlers.go).
//
// Env vars: LEMONSQUEEZY_WEBHOOK_SECRET, SDLC_LS_PRODUCT_ID.
type Handler struct {
	secret    string
	productID string // SDLC_LS_PRODUCT_ID, empty = accept all products
}

// New creates a Handler. secret must be the LS webhook signing secret;
// productID is the numeric product id string from SDLC_LS_PRODUCT_ID
// (empty string disables product-id filtering, useful in tests).
func New(secret, productID string) *Handler {
	return &Handler{secret: secret, productID: productID}
}

// lsEnvelope is the minimal shape of a LemonSqueezy webhook payload.
type lsEnvelope struct {
	Meta struct {
		EventName string `json:"event_name"`
		StoreID   int64  `json:"store_id"`
	} `json:"meta"`
	Data struct {
		Attributes struct {
			ProductID int64 `json:"product_id"`
		} `json:"attributes"`
	} `json:"data"`
}

// ServeHTTP implements http.Handler.
func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(io.LimitReader(r.Body, maxBodyBytes))
	if err != nil {
		http.Error(w, "cannot read body", http.StatusBadRequest)
		return
	}

	sig := r.Header.Get("X-Signature")
	if !VerifySignature(body, sig, h.secret) {
		http.Error(w, "invalid signature", http.StatusUnauthorized)
		return
	}

	var env lsEnvelope
	if err := json.Unmarshal(body, &env); err != nil {
		http.Error(w, "invalid JSON", http.StatusBadRequest)
		return
	}

	// Shared-store filter: if the event belongs to a different product
	// on the same store, return 200 {received:true, ignored:true} and
	// write nothing. This prevents sibling-product events from
	// trampling our tenant_billing rows.
	if h.productID != "" && strconv.FormatInt(env.Data.Attributes.ProductID, 10) != h.productID {
		writeJSON(w, http.StatusOK, map[string]any{"received": true, "ignored": true})
		return
	}

	// Dispatch by event name. Subscription lifecycle handlers
	// (order_created, subscription_created, subscription_updated,
	// subscription_cancelled, subscription_expired,
	// subscription_payment_failed) ship in the next iteration.
	// For now the hook is live and signature-gated; all acknowledged
	// events are logged as received.
	writeJSON(w, http.StatusOK, map[string]any{"received": true, "event": env.Meta.EventName})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v) //nolint:errcheck
}
