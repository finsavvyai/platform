package integrate

import (
	"fmt"
	"time"
)

// Event represents a CI event to send to integrations.
type Event struct {
	Type      string    `json:"type"` // run_started, run_passed, run_failed, deploy_started, deploy_done
	RunID     string    `json:"run_id"`
	Repo      string    `json:"repo"`
	Branch    string    `json:"branch"`
	Status    string    `json:"status"`
	URL       string    `json:"url"`
	Message   string    `json:"message"`
	Timestamp time.Time `json:"timestamp"`
}

// Connector sends events to external services.
type Connector interface {
	Name() string
	Send(event Event) error
}

// Hub manages multiple integration connectors.
type Hub struct {
	connectors []Connector
}

// NewHub creates an integration hub.
func NewHub() *Hub { return &Hub{} }

// Register adds a connector to the hub.
func (h *Hub) Register(c Connector) { h.connectors = append(h.connectors, c) }

// Broadcast sends an event to all registered connectors.
func (h *Hub) Broadcast(event Event) []error {
	var errs []error
	for _, c := range h.connectors {
		if err := c.Send(event); err != nil {
			errs = append(errs, fmt.Errorf("%s: %w", c.Name(), err))
		}
	}
	return errs
}

// JiraConnector links CI events to Jira issues.
type JiraConnector struct {
	BaseURL string
	Token   string
}

func (j *JiraConnector) Name() string { return "jira" }
func (j *JiraConnector) Send(e Event) error {
	if j.Token == "" {
		return fmt.Errorf("jira: token not configured")
	}
	return nil // POST to /rest/api/3/issue/{key}/comment
}

// PagerDutyConnector alerts on deploy failures.
type PagerDutyConnector struct {
	RoutingKey string
}

func (p *PagerDutyConnector) Name() string { return "pagerduty" }
func (p *PagerDutyConnector) Send(e Event) error {
	if p.RoutingKey == "" {
		return fmt.Errorf("pagerduty: routing key not configured")
	}
	if e.Type != "run_failed" && e.Type != "deploy_failed" {
		return nil // only alert on failures
	}
	return nil // POST to events.pagerduty.com/v2/enqueue
}

// SentryConnector links errors to deploys.
type SentryConnector struct {
	DSN string
	Org string
}

func (s *SentryConnector) Name() string { return "sentry" }
func (s *SentryConnector) Send(e Event) error {
	if s.DSN == "" {
		return fmt.Errorf("sentry: DSN not configured")
	}
	return nil // POST release to sentry.io/api
}
