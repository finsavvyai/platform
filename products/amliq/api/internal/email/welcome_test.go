package email

import (
	"strings"
	"testing"
)

type fakeSender struct {
	to, subject, html string
	err               error
}

func (f *fakeSender) Send(to, subject, html string) error {
	f.to, f.subject, f.html = to, subject, html
	return f.err
}

func TestDefaultWelcomeSetsOrgName(t *testing.T) {
	ctx := DefaultWelcome("Acme Bank")
	if ctx.OrgName != "Acme Bank" {
		t.Errorf("OrgName=%q", ctx.OrgName)
	}
	if ctx.FreeDailyCap != 10 {
		t.Errorf("FreeDailyCap=%d, want 10", ctx.FreeDailyCap)
	}
}

func TestRenderWelcomeHTMLContainsCriticalLinks(t *testing.T) {
	html := RenderWelcomeHTML(DefaultWelcome("Acme"))
	mustContain := []string{
		"Welcome to AMLIQ, Acme",
		"https://amliq.com/dashboard",
		"https://amliq.com/docs",
		"support@amliq.com",
		"10 screenings per day",
	}
	for _, s := range mustContain {
		if !strings.Contains(html, s) {
			t.Errorf("html missing %q", s)
		}
	}
}

func TestSendWelcomeRoutesThroughSender(t *testing.T) {
	fs := &fakeSender{}
	if err := SendWelcome(fs, "ops@acme.com", DefaultWelcome("Acme")); err != nil {
		t.Fatalf("send: %v", err)
	}
	if fs.to != "ops@acme.com" {
		t.Errorf("to=%q", fs.to)
	}
	if fs.subject != WelcomeSubject {
		t.Errorf("subject=%q", fs.subject)
	}
	if !strings.Contains(fs.html, "Acme") {
		t.Errorf("html does not include org name")
	}
}

func TestNoopSenderDoesNotError(t *testing.T) {
	if err := (&NoopSender{}).Send("a@b", "s", "<p>x</p>"); err != nil {
		t.Errorf("noop should not error: %v", err)
	}
}
