// Package automation defines trigger→condition→action rules
// for reacting to screening events.
package automation

import (
	"errors"
	"time"
)

// TriggerType names the event that fires a rule.
type TriggerType string

const (
	TriggerAlertCreated    TriggerType = "alert.created"
	TriggerAlertEscalated  TriggerType = "alert.escalated"
	TriggerMatchHighRisk   TriggerType = "match.high_risk"
	TriggerListUpdated     TriggerType = "list.updated"
	TriggerScreenComplete  TriggerType = "screen.complete"
)

// ActionType names the side effect to perform.
type ActionType string

const (
	ActionEmail    ActionType = "email"
	ActionSMS      ActionType = "sms"
	ActionWhatsApp ActionType = "whatsapp"
	ActionWebhook  ActionType = "webhook"
	ActionOpenCase ActionType = "open_case"
)

// Condition restricts when the rule fires.
type Condition struct {
	Field    string `json:"field"`    // e.g. "score", "list", "country"
	Operator string `json:"operator"` // gte, lte, eq, in
	Value    string `json:"value"`
}

// Action is what happens when the rule matches.
type Action struct {
	Type   ActionType             `json:"type"`
	Config map[string]interface{} `json:"config"` // email_to, sms_to, webhook_url
}

// Rule is a trigger → conditions → actions chain.
type Rule struct {
	ID         string      `json:"id"`
	TenantID   string      `json:"tenant_id"`
	Name       string      `json:"name"`
	Enabled    bool        `json:"enabled"`
	Trigger    TriggerType `json:"trigger"`
	Conditions []Condition `json:"conditions"`
	Actions    []Action    `json:"actions"`
	CreatedAt  time.Time   `json:"created_at"`
	UpdatedAt  time.Time   `json:"updated_at"`
}

// Validate checks required fields.
func (r *Rule) Validate() error {
	if r.Name == "" {
		return errors.New("name required")
	}
	if r.Trigger == "" {
		return errors.New("trigger required")
	}
	if len(r.Actions) == 0 {
		return errors.New("at least one action required")
	}
	for _, a := range r.Actions {
		if a.Type == "" {
			return errors.New("action type required")
		}
	}
	return nil
}
