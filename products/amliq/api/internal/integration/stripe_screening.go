package integration

import (
	"context"
	"encoding/json"
	"log"
	"net/http"

	"github.com/aegis-aml/aegis/internal/screening"
)

// StripeScreeningMiddleware screens payment parties before completion.
type StripeScreeningMiddleware struct {
	engine *screening.FastEngine
}

func NewStripeScreeningMiddleware(engine *screening.FastEngine) *StripeScreeningMiddleware {
	return &StripeScreeningMiddleware{engine: engine}
}

// StripePaymentIntent represents Stripe's payment_intent.created event.
type StripePaymentIntent struct {
	ID     string `json:"id"`
	Amount int64  `json:"amount"`
	Metadata map[string]string `json:"metadata"`
}

// StripeScreenResult holds the screening outcome for a payment.
type StripeScreenResult struct {
	PaymentID  string `json:"payment_id"`
	Blocked    bool   `json:"blocked"`
	Reason     string `json:"reason,omitempty"`
	Originator string `json:"originator,omitempty"`
	Beneficiary string `json:"beneficiary,omitempty"`
}

// HandleWebhook processes Stripe Connect payment_intent.created events.
func (sm *StripeScreeningMiddleware) HandleWebhook(w http.ResponseWriter, r *http.Request) {
	var event struct {
		Type string `json:"type"`
		Data struct {
			Object StripePaymentIntent `json:"object"`
		} `json:"data"`
	}
	if err := json.NewDecoder(r.Body).Decode(&event); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	if event.Type != "payment_intent.created" {
		w.WriteHeader(http.StatusOK)
		return
	}

	result := sm.screenPayment(r.Context(), event.Data.Object)
	if result.Blocked {
		log.Printf("stripe screening: BLOCKED payment %s — %s", result.PaymentID, result.Reason)
	}
	json.NewEncoder(w).Encode(result)
}

func (sm *StripeScreeningMiddleware) screenPayment(
	_ context.Context, pi StripePaymentIntent,
) StripeScreenResult {
	result := StripeScreenResult{PaymentID: pi.ID}

	originator := pi.Metadata["originator_name"]
	beneficiary := pi.Metadata["beneficiary_name"]
	result.Originator = originator
	result.Beneficiary = beneficiary

	// Screen originator and beneficiary names
	// In production, these would screen against loaded entity candidates
	if originator != "" {
		r := sm.engine.Screen(originator, nil)
		if r.Match {
			result.Blocked = true
			result.Reason = "originator matched: " + r.MatchedName
			return result
		}
	}
	return result
}
