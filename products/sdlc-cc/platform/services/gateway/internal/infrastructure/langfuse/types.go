// Package langfuse implements an API shim compatible with Langfuse's
// public ingest endpoints (traces, scores, prompts). The shim accepts the
// Langfuse SDK's wire format unchanged so existing applications can point
// LANGFUSE_HOST at the gateway and gain DLP / OPA / audit on their LLM
// telemetry without code changes.
//
// We deliberately implement only the 80% subset (traces, scores, prompts)
// that almost every Langfuse user touches, and document the gap rather
// than chase the full Langfuse surface.
package langfuse

import "time"

// Trace mirrors Langfuse's POST /api/public/traces request body.
// All fields are pointer / omitempty where Langfuse marks them optional.
type Trace struct {
	ID        string         `json:"id,omitempty"`
	Name      string         `json:"name,omitempty"`
	UserID    string         `json:"userId,omitempty"`
	SessionID string         `json:"sessionId,omitempty"`
	Input     any            `json:"input,omitempty"`
	Output    any            `json:"output,omitempty"`
	Metadata  map[string]any `json:"metadata,omitempty"`
	Tags      []string       `json:"tags,omitempty"`
	Timestamp time.Time      `json:"timestamp,omitempty"`
	Public    bool           `json:"public,omitempty"`
}

// Score mirrors POST /api/public/scores. Langfuse supports both numeric
// and categorical scores; we capture both via the Value/StringValue split.
type Score struct {
	ID            string    `json:"id,omitempty"`
	TraceID       string    `json:"traceId"`
	ObservationID string    `json:"observationId,omitempty"`
	Name          string    `json:"name"`
	Value         *float64  `json:"value,omitempty"`
	StringValue   string    `json:"stringValue,omitempty"`
	DataType      string    `json:"dataType,omitempty"`
	Comment       string    `json:"comment,omitempty"`
	Timestamp     time.Time `json:"timestamp,omitempty"`
}

// Prompt mirrors GET / POST /api/public/prompts. Langfuse stores text and
// chat-style prompts in the same table, distinguished by Type.
type Prompt struct {
	ID       string         `json:"id,omitempty"`
	Name     string         `json:"name"`
	Version  int            `json:"version,omitempty"`
	Type     string         `json:"type,omitempty"` // "text" | "chat"
	Prompt   any            `json:"prompt"`         // string or []ChatMessage
	Config   map[string]any `json:"config,omitempty"`
	Tags     []string       `json:"tags,omitempty"`
	Labels   []string       `json:"labels,omitempty"`
	IsActive bool           `json:"isActive,omitempty"`
}

// IngestEnvelope is the response shape Langfuse uses for batch ingest:
// `{"successes":[...], "errors":[...]}`. We honor it for cross-SDK
// compatibility even when ingesting one item at a time.
type IngestEnvelope struct {
	Successes []IngestStatus `json:"successes"`
	Errors    []IngestStatus `json:"errors"`
}

// IngestStatus is the per-item status entry returned by Langfuse ingest.
type IngestStatus struct {
	ID      string `json:"id"`
	Status  int    `json:"status,omitempty"`
	Message string `json:"message,omitempty"`
	Error   string `json:"error,omitempty"`
}
