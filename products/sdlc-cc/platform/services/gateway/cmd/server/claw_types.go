package main

import "time"

type ClawToolDefinition struct {
	Name        string         `json:"name"`
	Description string         `json:"description"`
	InputSchema map[string]any `json:"input_schema"`
}

type ClawCapabilitiesResponse struct {
	Status       string               `json:"status"`
	Version      string               `json:"version"`
	Tools        []ClawToolDefinition `json:"tools"`
	Memory       map[string]any       `json:"memory"`
	DiscoveredAt time.Time            `json:"discovered_at"`
}

type ClawHealthResponse struct {
	Status           string         `json:"status"`
	Version          string         `json:"version"`
	MemoryStore      string         `json:"memory_store"`
	PolicyEngine     string         `json:"policy_engine"`
	RegisteredSvcs   int            `json:"registered_services"`
	Checks           map[string]any `json:"checks"`
	Timestamp        time.Time      `json:"timestamp"`
	AvailableTools   []string       `json:"available_tools"`
	AvailableMemory  bool           `json:"available_memory"`
}

type ClawSessionRegisterRequest struct {
	SessionID string         `json:"session_id"`
	TenantID  string         `json:"tenant_id"`
	UserID    string         `json:"user_id"`
	ProjectID string         `json:"project_id"`
	Adapter   string         `json:"adapter"`
	AgentID   string         `json:"agent_id,omitempty"`
	Metadata  map[string]any `json:"metadata,omitempty"`
}

type ClawSession struct {
	SessionID  string         `json:"session_id"`
	TenantID   string         `json:"tenant_id"`
	UserID     string         `json:"user_id"`
	ProjectID  string         `json:"project_id"`
	Adapter    string         `json:"adapter"`
	AgentID    string         `json:"agent_id,omitempty"`
	Metadata   map[string]any `json:"metadata,omitempty"`
	LastSeenAt time.Time      `json:"last_seen_at"`
	CreatedAt  time.Time      `json:"created_at"`
}

type ClawToolCallRequest struct {
	Tool      string         `json:"tool"`
	Arguments map[string]any `json:"arguments"`
}

type ClawToolCallResponse struct {
	Tool      string         `json:"tool"`
	Success   bool           `json:"success"`
	Result    any            `json:"result,omitempty"`
	Error     string         `json:"error,omitempty"`
	Timestamp time.Time      `json:"timestamp"`
	Metadata  map[string]any `json:"metadata,omitempty"`
}

type ClawMemoryWriteRequest struct {
	TenantID   string         `json:"tenant_id"`
	UserID     string         `json:"user_id"`
	SessionID  string         `json:"session_id,omitempty"`
	AgentID    string         `json:"agent_id,omitempty"`
	Type       string         `json:"type"`
	Content    string         `json:"content"`
	Source     string         `json:"source,omitempty"`
	Importance int            `json:"importance,omitempty"`
	Tags       []string       `json:"tags,omitempty"`
	Metadata   map[string]any `json:"metadata,omitempty"`
}

type ClawMemorySearchRequest struct {
	TenantID  string   `json:"tenant_id"`
	UserID    string   `json:"user_id"`
	SessionID string   `json:"session_id,omitempty"`
	Type      string   `json:"type,omitempty"`
	Query     string   `json:"query,omitempty"`
	Tags      []string `json:"tags,omitempty"`
	Limit     int      `json:"limit,omitempty"`
}

type ClawMemoryRecord struct {
	ID         string         `json:"id"`
	TenantID   string         `json:"tenant_id"`
	UserID     string         `json:"user_id"`
	SessionID  string         `json:"session_id,omitempty"`
	AgentID    string         `json:"agent_id,omitempty"`
	Type       string         `json:"type"`
	Content    string         `json:"content"`
	Source     string         `json:"source,omitempty"`
	Importance int            `json:"importance"`
	Tags       []string       `json:"tags,omitempty"`
	Metadata   map[string]any `json:"metadata,omitempty"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
}

type ClawDocumentSearchRequest struct {
	TenantID       string `json:"tenant_id"`
	Query          string `json:"query"`
	Limit          int    `json:"limit,omitempty"`
	Classification string `json:"classification,omitempty"`
	Status         string `json:"status,omitempty"`
}

type ClawDocumentSearchResult struct {
	DocumentID       string    `json:"document_id"`
	Filename         string    `json:"filename"`
	ContentType      string    `json:"content_type"`
	Classification   string    `json:"classification"`
	ProcessingStatus string    `json:"processing_status"`
	CreatedAt        time.Time `json:"created_at"`
}

type ClawRAGQueryRequest struct {
	TenantID string `json:"tenant_id"`
	Query    string `json:"query"`
	Limit    int    `json:"limit,omitempty"`
}

type ClawRAGResult struct {
	ChunkID       string         `json:"chunk_id"`
	DocumentID    string         `json:"document_id"`
	DocumentTitle string         `json:"document_title"`
	ChunkIndex    int            `json:"chunk_index"`
	Content       string         `json:"content"`
	Score         float64        `json:"score"`
	Metadata      map[string]any `json:"metadata,omitempty"`
}

type ClawPolicyCheckRequest struct {
	TenantID  string         `json:"tenant_id"`
	UserID    string         `json:"user_id"`
	Query     string         `json:"query"`
	Action    string         `json:"action"`
	Resource  string         `json:"resource"`
	RequestID string         `json:"request_id,omitempty"`
	Data      map[string]any `json:"data,omitempty"`
	Context   map[string]any `json:"context,omitempty"`
}

type ClawAuditWriteRequest struct {
	TenantID         string         `json:"tenant_id"`
	UserID           string         `json:"user_id,omitempty"`
	Action           string         `json:"action"`
	ResourceType     string         `json:"resource_type"`
	ResourceID       string         `json:"resource_id,omitempty"`
	Details          map[string]any `json:"details,omitempty"`
	IPAddress        string         `json:"ip_address,omitempty"`
	UserAgent        string         `json:"user_agent,omitempty"`
	SessionID        string         `json:"session_id,omitempty"`
	RequestID        string         `json:"request_id,omitempty"`
	ResponseStatus   int            `json:"response_status,omitempty"`
	ProcessingTimeMs int            `json:"processing_time_ms,omitempty"`
	Metadata         map[string]any `json:"metadata,omitempty"`
	ComplianceTags   []string       `json:"compliance_tags,omitempty"`
}
