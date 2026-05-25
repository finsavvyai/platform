package server

import (
	"time"

	"github.com/queryflux/backend/internal/services"
)

// Request/Response types for subscription handlers

type CancelSubscriptionRequest struct {
	Reason string `json:"reason"`
}

type PauseSubscriptionRequest struct {
	PauseDays int        `json:"pause_days"`
	ResumeAt  *time.Time `json:"resume_at"`
}

type ChangePlanRequest struct {
	VariantID string `json:"variant_id"`
}

type FeatureAccessResponse struct {
	Feature   string `json:"feature"`
	HasAccess bool   `json:"has_access"`
}

type SuccessResponse struct {
	Message string `json:"message"`
}

type PlanInfo struct {
	ID        string            `json:"id"`
	Name      string            `json:"name"`
	VariantID string            `json:"variant_id"`
	Price     float64           `json:"price"`
	Currency  string            `json:"currency"`
	Features  services.Features `json:"features"`
}

type PlansResponse struct {
	Plans []PlanInfo `json:"plans"`
}
