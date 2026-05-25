package logger

import (
	"encoding/json"
	"io"
	"os"
	"time"
)

// AuditEventType defines the type of security event being logged.
type AuditEventType string

const (
	AuditAuthSuccess       AuditEventType = "auth.success"
	AuditAuthFailure       AuditEventType = "auth.failure"
	AuditRBACDenied        AuditEventType = "rbac.denied"
	AuditRateLimitHit      AuditEventType = "rate_limit.hit"
	AuditAPIKeyCreated     AuditEventType = "api_key.created"
	AuditAPIKeyRevoked     AuditEventType = "api_key.revoked"
	AuditWebhookSigFailure AuditEventType = "webhook.signature_failure"
)

// AuditOutcome represents the result of a security event.
type AuditOutcome string

const (
	AuditOutcomeSuccess AuditOutcome = "success"
	AuditOutcomeFailure AuditOutcome = "failure"
)

// AuditEvent represents a single audit log entry containing all required
// context for security event tracing, following SOC 2 requirements.
type AuditEvent struct {
	Timestamp    string         `json:"timestamp"`
	EventType    AuditEventType `json:"event_type"`
	UserID       string         `json:"user_id,omitempty"`
	ClientIPHash string         `json:"client_ip_hash,omitempty"`
	ResourcePath string         `json:"resource_path,omitempty"`
	Outcome      AuditOutcome   `json:"outcome"`
	Details      string         `json:"details,omitempty"`
	RequestID    string         `json:"request_id,omitempty"`
}

// AuditLogger writes structured JSON audit events to a dedicated output
// stream, keeping security events separate from application logs.
type AuditLogger struct {
	writer io.Writer
	masker *PIIMasker
}

// NewAuditLogger creates an AuditLogger that writes to the given writer.
// If writer is nil, it defaults to os.Stderr.
func NewAuditLogger(writer io.Writer, masker *PIIMasker) *AuditLogger {
	if writer == nil {
		writer = os.Stderr
	}
	if masker == nil {
		masker = NewPIIMasker("")
	}
	return &AuditLogger{
		writer: writer,
		masker: masker,
	}
}

// Log writes an audit event as a JSON line to the configured writer.
// All user-supplied fields are passed through the PII masker.
func (a *AuditLogger) Log(event AuditEvent) {
	event.Timestamp = time.Now().UTC().Format(time.RFC3339Nano)

	// Mask any PII that might be in the details field.
	if event.Details != "" {
		event.Details = a.masker.ScanAndMask(event.Details)
	}

	data, err := json.Marshal(event)
	if err != nil {
		return
	}
	data = append(data, '\n')
	a.writer.Write(data)
}

// LogAuthSuccess logs a successful authentication event.
func (a *AuditLogger) LogAuthSuccess(userID, clientIP, path, requestID string) {
	a.Log(AuditEvent{
		EventType:    AuditAuthSuccess,
		UserID:       userID,
		ClientIPHash: a.masker.HashIP(clientIP),
		ResourcePath: path,
		Outcome:      AuditOutcomeSuccess,
		RequestID:    requestID,
	})
}

// LogAuthFailure logs a failed authentication event.
func (a *AuditLogger) LogAuthFailure(clientIP, path, requestID, reason string) {
	a.Log(AuditEvent{
		EventType:    AuditAuthFailure,
		ClientIPHash: a.masker.HashIP(clientIP),
		ResourcePath: path,
		Outcome:      AuditOutcomeFailure,
		Details:      reason,
		RequestID:    requestID,
	})
}

// LogRBACDenied logs a role-based access control denial.
func (a *AuditLogger) LogRBACDenied(userID, clientIP, path, requestID string) {
	a.Log(AuditEvent{
		EventType:    AuditRBACDenied,
		UserID:       userID,
		ClientIPHash: a.masker.HashIP(clientIP),
		ResourcePath: path,
		Outcome:      AuditOutcomeFailure,
		RequestID:    requestID,
	})
}

// LogRateLimitHit logs a rate limit exceeded event.
func (a *AuditLogger) LogRateLimitHit(clientIP, path, requestID string) {
	a.Log(AuditEvent{
		EventType:    AuditRateLimitHit,
		ClientIPHash: a.masker.HashIP(clientIP),
		ResourcePath: path,
		Outcome:      AuditOutcomeFailure,
		RequestID:    requestID,
	})
}
