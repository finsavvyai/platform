package logger

import (
	"bytes"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func parseAuditEvent(t *testing.T, buf *bytes.Buffer) AuditEvent {
	t.Helper()
	var event AuditEvent
	require.NoError(t, json.Unmarshal(buf.Bytes(), &event))
	return event
}

func TestAuditLogger_LogAuthSuccess(t *testing.T) {
	var buf bytes.Buffer
	logger := NewAuditLogger(&buf, NewPIIMasker("salt"))

	logger.LogAuthSuccess("user-123", "192.168.1.1", "/api/v1/auth/login", "req-abc")

	event := parseAuditEvent(t, &buf)
	assert.Equal(t, AuditAuthSuccess, event.EventType)
	assert.Equal(t, "user-123", event.UserID)
	assert.Equal(t, AuditOutcomeSuccess, event.Outcome)
	assert.Equal(t, "/api/v1/auth/login", event.ResourcePath)
	assert.Equal(t, "req-abc", event.RequestID)
	assert.NotEmpty(t, event.Timestamp)
	// IP should be hashed, not raw
	assert.NotEqual(t, "192.168.1.1", event.ClientIPHash)
	assert.NotEmpty(t, event.ClientIPHash)
}

func TestAuditLogger_LogAuthFailure(t *testing.T) {
	var buf bytes.Buffer
	logger := NewAuditLogger(&buf, NewPIIMasker("salt"))

	logger.LogAuthFailure("10.0.0.1", "/api/v1/auth/login", "req-def", "invalid token")

	event := parseAuditEvent(t, &buf)
	assert.Equal(t, AuditAuthFailure, event.EventType)
	assert.Equal(t, AuditOutcomeFailure, event.Outcome)
	assert.Equal(t, "invalid token", event.Details)
	assert.Empty(t, event.UserID)
}

func TestAuditLogger_LogRBACDenied(t *testing.T) {
	var buf bytes.Buffer
	logger := NewAuditLogger(&buf, NewPIIMasker("salt"))

	logger.LogRBACDenied("user-456", "10.0.0.2", "/api/v1/admin/users", "req-xyz")

	event := parseAuditEvent(t, &buf)
	assert.Equal(t, AuditRBACDenied, event.EventType)
	assert.Equal(t, "user-456", event.UserID)
	assert.Equal(t, AuditOutcomeFailure, event.Outcome)
}

func TestAuditLogger_LogRateLimitHit(t *testing.T) {
	var buf bytes.Buffer
	logger := NewAuditLogger(&buf, NewPIIMasker("salt"))

	logger.LogRateLimitHit("172.16.0.1", "/api/v1/fraud/analyze", "req-rl")

	event := parseAuditEvent(t, &buf)
	assert.Equal(t, AuditRateLimitHit, event.EventType)
	assert.Equal(t, AuditOutcomeFailure, event.Outcome)
}

func TestAuditLogger_MasksPIIInDetails(t *testing.T) {
	var buf bytes.Buffer
	logger := NewAuditLogger(&buf, NewPIIMasker("salt"))

	logger.Log(AuditEvent{
		EventType: AuditAuthFailure,
		Outcome:   AuditOutcomeFailure,
		Details:   "Failed login for user@example.com with card 4111111111111111",
	})

	event := parseAuditEvent(t, &buf)
	assert.NotContains(t, event.Details, "user@example.com")
	assert.NotContains(t, event.Details, "4111111111111111")
}

func TestAuditLogger_OutputIsJSON(t *testing.T) {
	var buf bytes.Buffer
	logger := NewAuditLogger(&buf, NewPIIMasker("salt"))

	logger.LogAuthSuccess("u1", "1.2.3.4", "/test", "r1")

	// Verify it's valid JSON ending with newline
	raw := buf.Bytes()
	assert.True(t, len(raw) > 0)
	assert.Equal(t, byte('\n'), raw[len(raw)-1])
	assert.True(t, json.Valid(raw[:len(raw)-1]))
}

func TestAuditLogger_NilWriterDefaultsToStderr(t *testing.T) {
	// Just verify it doesn't panic with nil writer
	logger := NewAuditLogger(nil, nil)
	assert.NotNil(t, logger)
}
