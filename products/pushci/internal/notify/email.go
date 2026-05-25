package notify

import (
	"fmt"
	"html"
	"net/smtp"
	"strings"
)

// SMTPConfig holds SMTP connection details.
type SMTPConfig struct {
	Host     string
	Port     int
	Username string
	Password string
	From     string
}

// EmailNotifier sends notifications via SMTP email.
type EmailNotifier struct {
	Config SMTPConfig
	To     []string
}

// NewEmailNotifier creates an EmailNotifier.
func NewEmailNotifier(cfg SMTPConfig, to []string) *EmailNotifier {
	return &EmailNotifier{Config: cfg, To: to}
}

// Send delivers an HTML email with the run results.
func (e *EmailNotifier) Send(event NotifyEvent) error {
	subject := fmt.Sprintf("PushCI: %s %s on %s",
		event.Repo, string(event.Status), event.Branch)
	body := buildHTML(event)
	msg := formatEmail(e.Config.From, e.To, subject, body)
	addr := fmt.Sprintf("%s:%d", e.Config.Host, e.Config.Port)
	auth := smtp.PlainAuth("", e.Config.Username, e.Config.Password, e.Config.Host)
	return smtp.SendMail(addr, auth, e.Config.From, e.To, []byte(msg))
}

func formatEmail(from string, to []string, subject, body string) string {
	headers := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\n",
		from, strings.Join(to, ","), subject)
	headers += "MIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n"
	return headers + body
}

func buildHTML(event NotifyEvent) string {
	color := "#36a64f"
	if event.Status == StatusFailed {
		color = "#e01e5a"
	}
	var sb strings.Builder
	repo := html.EscapeString(event.Repo)
	branch := html.EscapeString(event.Branch)
	fmt.Fprintf(&sb,
		"<h2 style=\"color:%s\">%s — %s</h2>",
		color, repo, string(event.Status))
	fmt.Fprintf(&sb,
		"<p>Branch: <code>%s</code> | Duration: %s</p><ul>",
		branch, html.EscapeString(event.Duration))
	for _, c := range event.Checks {
		icon := "&#9989;"
		if c.Status == StatusFailed {
			icon = "&#10060;"
		}
		fmt.Fprintf(&sb, "<li>%s %s (%s)</li>",
			icon, html.EscapeString(c.Name), html.EscapeString(c.Duration))
	}
	sb.WriteString("</ul>")
	if event.URL != "" {
		fmt.Fprintf(&sb,
			"<p><a href=\"%s\">View Run</a></p>", html.EscapeString(event.URL))
	}
	return sb.String()
}
