package notify

import "fmt"

// Status represents the outcome of a CI run.
type Status string

const (
	StatusPassed Status = "passed"
	StatusFailed Status = "failed"
)

// CheckResult holds the outcome of a single check.
type CheckResult struct {
	Name     string
	Status   Status
	Duration string
	Output   string
}

// NotifyEvent carries all data needed for a notification.
type NotifyEvent struct {
	Repo     string
	Branch   string
	Status   Status
	Duration string
	URL      string
	Checks   []CheckResult
}

// Notifier sends notifications about CI run results.
type Notifier interface {
	Send(event NotifyEvent) error
}

// FormatMessage returns a markdown summary of a run.
func FormatMessage(event NotifyEvent) string {
	icon := "✅"
	if event.Status == StatusFailed {
		icon = "❌"
	}
	msg := fmt.Sprintf(
		"%s **%s** on `%s` — %s (%s)\n\n",
		icon, event.Repo, event.Branch,
		string(event.Status), event.Duration,
	)
	for _, c := range event.Checks {
		ci := "✅"
		if c.Status == StatusFailed {
			ci = "❌"
		}
		msg += fmt.Sprintf("  %s %s (%s)\n", ci, c.Name, c.Duration)
	}
	if event.URL != "" {
		msg += fmt.Sprintf("\n[View Run](%s)\n", event.URL)
	}
	return msg
}
