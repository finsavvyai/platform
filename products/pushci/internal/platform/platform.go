package platform

import (
	"context"
	"net/http"
)

// Event represents a normalized webhook event from any platform.
type Event struct {
	Provider string // "github", "gitlab", "bitbucket"
	Action   string // "push", "pull_request", "merge_request"
	Repo     string // "owner/repo"
	Branch   string
	SHA      string
	CloneURL string
	PRNumber int
	Sender   string
}

// Status represents a CI status to post back to the platform.
type Status struct {
	SHA         string
	State       State  // pending, success, failure, error
	Context     string // e.g. "pushci/ci"
	Description string
	TargetURL   string
}

// State is the CI check state.
type State string

const (
	StatePending State = "pending"
	StateSuccess State = "success"
	StateFailure State = "failure"
	StateError   State = "error"
)

// Provider abstracts GitHub, GitLab, and Bitbucket APIs.
type Provider interface {
	ParseWebhook(r *http.Request) (*Event, error)
	PostStatus(ctx context.Context, event *Event, status *Status) error
	PostComment(ctx context.Context, event *Event, body string) error
}
