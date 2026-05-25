package integrate

import (
	"testing"
	"time"
)

type mockConnector struct {
	name   string
	events []Event
}

func (m *mockConnector) Name() string       { return m.name }
func (m *mockConnector) Send(e Event) error { m.events = append(m.events, e); return nil }

func TestHubBroadcast(t *testing.T) {
	hub := NewHub()
	c1 := &mockConnector{name: "jira"}
	c2 := &mockConnector{name: "sentry"}
	hub.Register(c1)
	hub.Register(c2)

	event := Event{Type: "run_passed", RunID: "r1", Timestamp: time.Now()}
	errs := hub.Broadcast(event)
	if len(errs) != 0 {
		t.Errorf("errors = %v", errs)
	}
	if len(c1.events) != 1 {
		t.Errorf("c1 events = %d, want 1", len(c1.events))
	}
	if len(c2.events) != 1 {
		t.Errorf("c2 events = %d, want 1", len(c2.events))
	}
}

func TestJiraNoToken(t *testing.T) {
	j := &JiraConnector{}
	if err := j.Send(Event{}); err == nil {
		t.Error("expected error without token")
	}
}

func TestPagerDutyOnlyAlertOnFailure(t *testing.T) {
	pd := &PagerDutyConnector{RoutingKey: "test"}
	if err := pd.Send(Event{Type: "run_passed"}); err != nil {
		t.Errorf("unexpected error for non-failure: %v", err)
	}
}

func TestSentryNoConfig(t *testing.T) {
	s := &SentryConnector{}
	if err := s.Send(Event{}); err == nil {
		t.Error("expected error without DSN")
	}
}
