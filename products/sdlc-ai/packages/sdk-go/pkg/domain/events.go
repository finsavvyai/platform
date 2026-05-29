package domain

import (
	"time"

	"github.com/google/uuid"
)

// BaseEvent represents the base structure for all domain events
type BaseEvent struct {
	ID            string                 `json:"id"`
	AggregateID   string                 `json:"aggregate_id"`
	AggregateType string                 `json:"aggregate_type"`
	EventType     string                 `json:"event_type"`
	Version       int                    `json:"version"`
	OccurredAt    time.Time              `json:"occurred_at"`
	Data          map[string]interface{} `json:"data"`
	Metadata      map[string]interface{} `json:"metadata"`
}

// NewBaseEvent creates a new base event
func NewBaseEvent(aggregateID, aggregateType, eventType string, version int, data map[string]interface{}) *BaseEvent {
	return &BaseEvent{
		ID:            uuid.New().String(),
		AggregateID:   aggregateID,
		AggregateType: aggregateType,
		EventType:     eventType,
		Version:       version,
		OccurredAt:    time.Now().UTC(),
		Data:          data,
		Metadata:      make(map[string]interface{}),
	}
}

// EventStore interface for event sourcing persistence
type EventStore interface {
	SaveEvents(aggregateID string, events []Event, expectedVersion int) error
	GetEvents(aggregateID string, fromVersion int) ([]Event, error)
	GetEventsFromSnapshot(aggregateID string, fromVersion int) ([]Event, error)
	SaveSnapshot(aggregateID string, snapshot Snapshot) error
	GetSnapshot(aggregateID string) (*Snapshot, error)
}

// Event represents a domain event
type Event interface {
	GetID() string
	GetAggregateID() string
	GetEventType() string
	GetVersion() int
	GetOccurredAt() time.Time
	GetData() map[string]interface{}
	GetMetadata() map[string]interface{}
}

// Snapshot represents aggregate state at a point in time
type Snapshot struct {
	AggregateID   string      `json:"aggregate_id"`
	AggregateType string      `json:"aggregate_type"`
	Version       int         `json:"version"`
	Data          interface{} `json:"data"`
	CreatedAt     time.Time   `json:"created_at"`
}

// EventPublisher interface for publishing events
type EventPublisher interface {
	Publish(event Event) error
	PublishAsync(event Event)
}

// EventHandler interface for handling events
type EventHandler interface {
	Handle(event Event) error
	CanHandle(eventType string) bool
}

// EventProjector interface for creating read models from events
type EventProjector interface {
	Project(event Event) error
	GetProjectionName() string
}

// Domain Events

// UserEvents
type UserRegisteredEvent struct {
	*BaseEvent
	Email    string `json:"email"`
	TenantID string `json:"tenant_id"`
	Role     string `json:"role"`
}

type UserAuthenticatedEvent struct {
	*BaseEvent
	UserID    string `json:"user_id"`
	SessionID string `json:"session_id"`
	IPAddress string `json:"ip_address"`
	UserAgent string `json:"user_agent"`
}

type UserUpdatedEvent struct {
	*BaseEvent
	UserID        string   `json:"user_id"`
	UpdatedFields []string `json:"updated_fields"`
}

// DocumentEvents
type DocumentUploadedEvent struct {
	*BaseEvent
	DocumentID  string `json:"document_id"`
	UserID      string `json:"user_id"`
	TenantID    string `json:"tenant_id"`
	FileName    string `json:"file_name"`
	FileSize    int64  `json:"file_size"`
	ContentType string `json:"content_type"`
	Checksum    string `json:"checksum"`
}

type DocumentProcessedEvent struct {
	*BaseEvent
	DocumentID   string   `json:"document_id"`
	ChunksCount  int      `json:"chunks_count"`
	VectorCount  int      `json:"vector_count"`
	ProcessingMs int64    `json:"processing_ms"`
	Tags         []string `json:"tags"`
}

type DocumentDeletedEvent struct {
	*BaseEvent
	DocumentID string `json:"document_id"`
	DeletedBy  string `json:"deleted_by"`
}

// RAQEvents
type QuerySubmittedEvent struct {
	*BaseEvent
	QueryID     string    `json:"query_id"`
	UserID      string    `json:"user_id"`
	TenantID    string    `json:"tenant_id"`
	Query       string    `json:"query"`
	VectorQuery []float32 `json:"vector_query"`
	Context     []string  `json:"context"`
}

type QueryProcessedEvent struct {
	*BaseEvent
	QueryID      string     `json:"query_id"`
	Response     string     `json:"response"`
	Citations    []Citation `json:"citations"`
	Confidence   float64    `json:"confidence"`
	ProcessingMs int64      `json:"processing_ms"`
	TokenUsage   TokenUsage `json:"token_usage"`
}

type Citation struct {
	DocumentID string  `json:"document_id"`
	ChunkID    string  `json:"chunk_id"`
	Text       string  `json:"text"`
	Score      float64 `json:"score"`
}

type TokenUsage struct {
	InputTokens  int `json:"input_tokens"`
	OutputTokens int `json:"output_tokens"`
	TotalTokens  int `json:"total_tokens"`
}

// TenantEvents
type TenantCreatedEvent struct {
	*BaseEvent
	TenantID  string `json:"tenant_id"`
	Name      string `json:"name"`
	Plan      string `json:"plan"`
	CreatedBy string `json:"created_by"`
}

type TenantUpdatedEvent struct {
	*BaseEvent
	TenantID      string   `json:"tenant_id"`
	UpdatedFields []string `json:"updated_fields"`
}

type TenantSuspendedEvent struct {
	*BaseEvent
	TenantID    string `json:"tenant_id"`
	Reason      string `json:"reason"`
	SuspendedBy string `json:"suspended_by"`
}

// PolicyEvents
type PolicyCreatedEvent struct {
	*BaseEvent
	PolicyID  string       `json:"policy_id"`
	TenantID  string       `json:"tenant_id"`
	Name      string       `json:"name"`
	Type      string       `json:"type"`
	Rules     []PolicyRule `json:"rules"`
	CreatedBy string       `json:"created_by"`
}

type PolicyUpdatedEvent struct {
	*BaseEvent
	PolicyID     string       `json:"policy_id"`
	UpdatedRules []PolicyRule `json:"updated_rules"`
	UpdatedBy    string       `json:"updated_by"`
}

type PolicyEnforcedEvent struct {
	*BaseEvent
	PolicyID   string `json:"policy_id"`
	ResourceID string `json:"resource_id"`
	Action     string `json:"action"`
	Result     string `json:"result"` // ALLOW, DENY, MODIFY
	Reason     string `json:"reason"`
}

type PolicyRule struct {
	ID         string                 `json:"id"`
	Name       string                 `json:"name"`
	Condition  string                 `json:"condition"`
	Action     string                 `json:"action"`
	Priority   int                    `json:"priority"`
	Parameters map[string]interface{} `json:"parameters"`
}

// PaymentEvents (PCI DSS Compliance)
type PaymentMethodAddedEvent struct {
	*BaseEvent
	UserID      string `json:"user_id"`
	TenantID    string `json:"tenant_id"`
	TokenID     string `json:"token_id"` // Tokenized payment method
	CardType    string `json:"card_type"`
	LastFour    string `json:"last_four"`
	ExpiryMonth string `json:"expiry_month"`
	ExpiryYear  string `json:"expiry_year"`
	CardBrand   string `json:"card_brand"`
	CreatedBy   string `json:"created_by"`
}

type PaymentMethodRemovedEvent struct {
	*BaseEvent
	UserID    string `json:"user_id"`
	TokenID   string `json:"token_id"`
	RemovedBy string `json:"removed_by"`
}

type PaymentProcessedEvent struct {
	*BaseEvent
	PaymentID    string `json:"payment_id"`
	UserID       string `json:"user_id"`
	TenantID     string `json:"tenant_id"`
	Amount       int64  `json:"amount"` // in cents
	Currency     string `json:"currency"`
	TokenID      string `json:"token_id"`
	Description  string `json:"description"`
	Status       string `json:"status"`
	ProcessorID  string `json:"processor_id"`
	GatewayTxnID string `json:"gateway_txn_id"`
}

type PaymentFailedEvent struct {
	*BaseEvent
	PaymentID     string `json:"payment_id"`
	UserID        string `json:"user_id"`
	Amount        int64  `json:"amount"`
	Currency      string `json:"currency"`
	FailureCode   string `json:"failure_code"`
	FailureReason string `json:"failure_reason"`
	Retryable     bool   `json:"retryable"`
}

// SecurityEvents (PCI DSS Compliance)
type SecurityViolationEvent struct {
	*BaseEvent
	UserID        string `json:"user_id"`
	TenantID      string `json:"tenant_id"`
	ViolationType string `json:"violation_type"`
	Severity      string `json:"severity"`
	Description   string `json:"description"`
	IPAddress     string `json:"ip_address"`
	UserAgent     string `json:"user_agent"`
	ResourceID    string `json:"resource_id,omitempty"`
}

type DataAccessEvent struct {
	*BaseEvent
	UserID     string `json:"user_id"`
	TenantID   string `json:"tenant_id"`
	ResourceID string `json:"resource_id"`
	Action     string `json:"action"`      // READ, WRITE, DELETE
	AccessType string `json:"access_type"` // AUTHORIZED, UNAUTHORIZED, BLOCKED
	IPAddress  string `json:"ip_address"`
	UserAgent  string `json:"user_agent"`
}

type AuditLogEvent struct {
	*BaseEvent
	UserID    string                 `json:"user_id"`
	TenantID  string                 `json:"tenant_id"`
	Action    string                 `json:"action"`
	Resource  string                 `json:"resource"`
	Outcome   string                 `json:"outcome"`
	Details   map[string]interface{} `json:"details"`
	IPAddress string                 `json:"ip_address"`
	UserAgent string                 `json:"user_agent"`
}
