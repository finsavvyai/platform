package tasklog

import "time"

// Status represents the outcome of a task execution.
type Status string

const (
	StatusRunning  Status = "running"
	StatusSuccess  Status = "success"
	StatusFailed   Status = "failed"
	StatusCanceled Status = "canceled"
)

// Entry records a single execution of a scheduled/manual task.
type Entry struct {
	ID        string    `json:"id"`
	TaskName  string    `json:"task_name"`
	TenantID  string    `json:"tenant_id,omitempty"`
	Trigger   string    `json:"trigger"` // "manual", "cron", "webhook"
	Status    Status    `json:"status"`
	StartedAt time.Time `json:"started_at"`
	EndedAt   *time.Time `json:"ended_at,omitempty"`
	DurationMs int64    `json:"duration_ms"`
	Output    string    `json:"output,omitempty"`
	Error     string    `json:"error,omitempty"`
	ActorID   string    `json:"actor_id,omitempty"`
}
