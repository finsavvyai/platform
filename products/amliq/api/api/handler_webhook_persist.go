package api

import (
	"log"
	"time"

	"github.com/aegis-aml/aegis/internal/billing"
	"github.com/aegis-aml/aegis/internal/domain"
)

type webhookEventHandler struct {
	svc *billing.BillingService
}

func NewWebhookEventHandler(svc *billing.BillingService) *webhookEventHandler {
	return &webhookEventHandler{svc: svc}
}

func (h *webhookEventHandler) HandleSubscriptionCreated(event billing.WebhookEvent) error {
	tenantStr, err := billing.ExtractTenantID(event)
	if err != nil {
		return err
	}
	tenantID, err := domain.NewTenantID(tenantStr)
	if err != nil {
		return err
	}
	sub := buildSubscriptionFromEvent(tenantStr, event)
	if err := h.svc.CreateSubscription(nil, tenantID, sub); err != nil {
		log.Printf("webhook: create subscription failed: %v", err)
		return err
	}
	return h.recordEvent(tenantID, domain.EventSubscriptionCreated, event)
}

func (h *webhookEventHandler) HandleSubscriptionUpdated(event billing.WebhookEvent) error {
	return h.handleSubEvent(event, domain.EventSubscriptionUpdated)
}

func (h *webhookEventHandler) HandleSubscriptionPaymentSuccess(event billing.WebhookEvent) error {
	return h.handleSubEvent(event, domain.EventPaymentSuccess)
}

func (h *webhookEventHandler) HandleSubscriptionPaymentFailed(event billing.WebhookEvent) error {
	return h.handleSubEvent(event, domain.EventPaymentFailed)
}

func (h *webhookEventHandler) HandleSubscriptionCancelled(event billing.WebhookEvent) error {
	return h.handleSubEvent(event, domain.EventSubscriptionCancelled)
}

func (h *webhookEventHandler) HandleOrderCreated(event billing.WebhookEvent) error {
	tenantStr, err := billing.ExtractTenantID(event)
	if err != nil {
		return err
	}
	tenantID, err := domain.NewTenantID(tenantStr)
	if err != nil {
		return err
	}
	log.Printf("webhook: order_created for tenant %s", tenantStr)
	return h.recordEvent(tenantID, domain.EventOrderCreated, event)
}

func (h *webhookEventHandler) handleSubEvent(
	event billing.WebhookEvent, evtType domain.BillingEventType,
) error {
	tenantStr, err := billing.ExtractTenantID(event)
	if err != nil {
		return err
	}
	tenantID, err := domain.NewTenantID(tenantStr)
	if err != nil {
		return err
	}
	return h.recordEvent(tenantID, evtType, event)
}

func (h *webhookEventHandler) recordEvent(
	tenantID domain.TenantID, evtType domain.BillingEventType, event billing.WebhookEvent,
) error {
	billingEvt, err := domain.NewBillingEvent(evtType, tenantID, event.Data)
	if err != nil {
		return err
	}
	return h.svc.RecordEvent(nil, billingEvt)
}

func buildSubscriptionFromEvent(tenantID string, event billing.WebhookEvent) domain.Subscription {
	now := time.Now().UTC()
	return domain.Subscription{
		ID:        "sub_" + now.Format("20060102150405"),
		TenantID:  tenantID,
		Status:    domain.StatusActive,
		CreatedAt: now,
		UpdatedAt: now,
	}
}
