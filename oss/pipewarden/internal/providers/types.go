package providers

import (
	"context"
)

type LogEntry struct {
	Timestamp string
	Level     string
	Message   string
}

type Provider interface {
	Name() string
	TestConnection(ctx context.Context) error
	GetLogs(ctx context.Context, jobName string) ([]LogEntry, error)
}

type Config struct {
	Name        string
	Platform    string
	Token       string
	Username    string
	AppPassword string
	BaseURL     string
}
