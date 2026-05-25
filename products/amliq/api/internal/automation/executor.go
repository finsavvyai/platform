package automation

import (
	"context"
	"fmt"
	"log"

	"github.com/aegis-aml/aegis/internal/email"
	"github.com/aegis-aml/aegis/internal/notification"
)

// CaseCreator opens a case when the OpenCase action fires.
type CaseCreator interface {
	OpenCase(ctx context.Context, tenantID, subject, details string) error
}

// Executor runs actions from matched rules.
type Executor struct {
	email    email.Sender
	sms      notification.SMSSender
	whatsapp *notification.WhatsAppSender
	webhook  *notification.WebhookSender
	cases    CaseCreator
}

func NewExecutor(
	emailSender email.Sender,
	smsSender notification.SMSSender,
	webhookSender *notification.WebhookSender,
	cases CaseCreator,
) *Executor {
	return &Executor{
		email: emailSender, sms: smsSender,
		whatsapp: notification.NewWhatsAppSender(),
		webhook:  webhookSender, cases: cases,
	}
}

// EventContext carries data about the event that triggered the rules.
type EventContext struct {
	TenantID    string
	Subject     string
	Summary     string
	EntityName  string
	Score       float64
	ListID      string
	PayloadJSON []byte
}

// Execute runs all actions for a rule. Errors are logged but don't halt
// subsequent actions — each action is best-effort.
func (e *Executor) Execute(
	ctx context.Context, rule Rule, evt EventContext,
) {
	if !e.evaluateConditions(rule.Conditions, evt) {
		return
	}
	for _, act := range rule.Actions {
		if err := e.runAction(ctx, act, evt); err != nil {
			log.Printf("automation rule=%s action=%s error: %v",
				rule.ID, act.Type, err)
		}
	}
}

func (e *Executor) runAction(
	ctx context.Context, act Action, evt EventContext,
) error {
	switch act.Type {
	case ActionEmail:
		return e.runEmail(act, evt)
	case ActionSMS:
		return e.runSMS(act, evt)
	case ActionWhatsApp:
		return e.runWhatsApp(act, evt)
	case ActionWebhook:
		return e.runWebhook(ctx, act, evt)
	case ActionOpenCase:
		if e.cases == nil {
			return fmt.Errorf("case creator not configured")
		}
		return e.cases.OpenCase(ctx, evt.TenantID, evt.Subject, evt.Summary)
	}
	return fmt.Errorf("unknown action: %s", act.Type)
}

func (e *Executor) runEmail(act Action, evt EventContext) error {
	to, _ := act.Config["to"].(string)
	if to == "" {
		return fmt.Errorf("email 'to' required")
	}
	html := fmt.Sprintf("<p>%s</p><p>Entity: %s | List: %s | Score: %.2f</p>",
		evt.Summary, evt.EntityName, evt.ListID, evt.Score)
	return e.email.Send(to, "AMLIQ: "+evt.Subject, html)
}

func (e *Executor) runSMS(act Action, evt EventContext) error {
	to, _ := act.Config["to"].(string)
	if to == "" {
		return fmt.Errorf("sms 'to' required")
	}
	body := fmt.Sprintf("AMLIQ Alert: %s — %s", evt.Subject, evt.EntityName)
	return e.sms.Send(to, body)
}

func (e *Executor) runWhatsApp(act Action, evt EventContext) error {
	to, _ := act.Config["to"].(string)
	if to == "" {
		return fmt.Errorf("whatsapp 'to' required")
	}
	body := fmt.Sprintf("🚨 AMLIQ Alert\n%s\n\nEntity: %s\nList: %s\nScore: %.2f",
		evt.Subject, evt.EntityName, evt.ListID, evt.Score)
	return e.whatsapp.Send(to, body)
}

func (e *Executor) runWebhook(
	ctx context.Context, act Action, evt EventContext,
) error {
	url, _ := act.Config["url"].(string)
	if url == "" {
		return fmt.Errorf("webhook 'url' required")
	}
	payload := notification.WebhookPayload{
		Event: evt.Subject, EntityName: evt.EntityName,
		Confidence: evt.Score, MatchedList: evt.ListID,
	}
	return e.webhook.Send(ctx, url, payload)
}
