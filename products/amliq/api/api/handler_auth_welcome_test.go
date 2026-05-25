package api

import (
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/aegis-aml/aegis/internal/email"
)

type captureSender struct {
	mu                 sync.Mutex
	to, subject, html  string
	called             bool
}

func (c *captureSender) Send(to, subject, html string) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.to, c.subject, c.html = to, subject, html
	c.called = true
	return nil
}

func (c *captureSender) wait(t *testing.T, deadline time.Duration) {
	t.Helper()
	end := time.Now().Add(deadline)
	for time.Now().Before(end) {
		c.mu.Lock()
		called := c.called
		c.mu.Unlock()
		if called {
			return
		}
		time.Sleep(2 * time.Millisecond)
	}
	t.Fatalf("welcome sender never called within %s", deadline)
}

// TestSendWelcomeAsyncDispatches verifies the new welcome-email
// hook on signup. We bypass the HTTP layer and call the helper
// directly with a capturing sender so the test stays decoupled
// from auth/JWT plumbing.
func TestSendWelcomeAsyncDispatches(t *testing.T) {
	cs := &captureSender{}
	h := &AuthHandler{}
	h.WithEmailSender(cs)

	h.sendWelcomeAsync("ops@acme.com", "Acme Bank")
	cs.wait(t, 200*time.Millisecond)

	if cs.to != "ops@acme.com" {
		t.Errorf("to=%q", cs.to)
	}
	if cs.subject != email.WelcomeSubject {
		t.Errorf("subject=%q", cs.subject)
	}
	if !strings.Contains(cs.html, "Acme Bank") {
		t.Errorf("html does not include org name")
	}
}

// TestSendWelcomeAsyncNoopWhenSenderNil ensures a nil sender does
// not panic — the dev / no-DB branch.
func TestSendWelcomeAsyncNoopWhenSenderNil(t *testing.T) {
	h := &AuthHandler{}
	h.sendWelcomeAsync("ops@acme.com", "Acme Bank") // must not panic
}
