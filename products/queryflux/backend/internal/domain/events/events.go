package events

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// DomainEvent represents a domain event
type DomainEvent interface {
	// ID returns the unique identifier of the event
	ID() string
	// AggregateID returns the ID of the aggregate that generated the event
	AggregateID() string
	// AggregateType returns the type of the aggregate
	AggregateType() string
	// EventType returns the type of the event
	EventType() string
	// Version returns the version of the aggregate
	Version() int
	// OccurredAt returns when the event occurred
	OccurredAt() time.Time
	// Data returns the event payload
	Data() interface{}
	// Metadata returns event metadata
	Metadata() map[string]interface{}
}

// BaseEvent provides a base implementation for domain events
type BaseEvent struct {
	id           string
	aggregateID  string
	aggregateType string
	eventType    string
	version      int
	occurredAt   time.Time
	data         interface{}
	metadata     map[string]interface{}
}

// NewBaseEvent creates a new base event
func NewBaseEvent(aggregateID, aggregateType, eventType string, version int, data interface{}) *BaseEvent {
	return &BaseEvent{
		id:            uuid.New().String(),
		aggregateID:   aggregateID,
		aggregateType: aggregateType,
		eventType:     eventType,
		version:       version,
		occurredAt:    time.Now().UTC(),
		data:          data,
		metadata:      make(map[string]interface{}),
	}
}

// Implement DomainEvent interface
func (e *BaseEvent) ID() string           { return e.id }
func (e *BaseEvent) AggregateID() string  { return e.aggregateID }
func (e *BaseEvent) AggregateType() string { return e.aggregateType }
func (e *BaseEvent) EventType() string    { return e.eventType }
func (e *BaseEvent) Version() int         { return e.version }
func (e *BaseEvent) OccurredAt() time.Time { return e.occurredAt }
func (e *BaseEvent) Data() interface{}    { return e.data }
func (e *BaseEvent) Metadata() map[string]interface{} { return e.metadata }

// WithMetadata adds metadata to the event
func (e *BaseEvent) WithMetadata(key string, value interface{}) *BaseEvent {
	e.metadata[key] = value
	return e
}

// EventStore defines the interface for event storage
type EventStore interface {
	// SaveEvents saves events to the store
	SaveEvents(ctx context.Context, aggregateID string, events []DomainEvent, expectedVersion int) error
	// GetEvents retrieves events for an aggregate
	GetEvents(ctx context.Context, aggregateID string, fromVersion int) ([]DomainEvent, error)
	// GetEventsByType retrieves events by type
	GetEventsByType(ctx context.Context, eventType string, from time.Time, to time.Time) ([]DomainEvent, error)
	// GetSnapshot retrieves a snapshot of an aggregate
	GetSnapshot(ctx context.Context, aggregateID string) (Snapshot, error)
	// SaveSnapshot saves a snapshot of an aggregate
	SaveSnapshot(ctx context.Context, snapshot Snapshot) error
}

// Snapshot represents a snapshot of an aggregate
type Snapshot struct {
	ID          string    `json:"id"`
	AggregateID string    `json:"aggregate_id"`
	Data        []byte    `json:"data"`
	Version     int       `json:"version"`
	CreatedAt   time.Time `json:"created_at"`
}

// EventBus defines the interface for publishing events
type EventBus interface {
	// Publish publishes an event to the bus
	Publish(ctx context.Context, event DomainEvent) error
	// Subscribe subscribes to events of a specific type
	Subscribe(ctx context.Context, eventType string, handler EventHandler) error
}

// EventHandler handles domain events
type EventHandler interface {
	// Handle handles the event
	Handle(ctx context.Context, event DomainEvent) error
	// CanHandle returns true if the handler can handle the event type
	CanHandle(eventType string) bool
}

// EventDispatcher dispatches events to handlers
type EventDispatcher interface {
	// Dispatch dispatches an event to registered handlers
	Dispatch(ctx context.Context, event DomainEvent) error
	// Register registers a handler for an event type
	Register(eventType string, handler EventHandler) error
}

// EventStorageConfig represents event storage configuration
type EventStorageConfig struct {
	MaxSnapshotInterval int           `json:"max_snapshot_interval"`
	MaxEventsPerSlice   int           `json:"max_events_per_slice"`
	RetentionPeriod     time.Duration `json:"retention_period"`
	CompressionEnabled  bool          `json:"compression_enabled"`
	EncryptionEnabled   bool          `json:"encryption_enabled"`
}

// DefaultEventStorageConfig returns default configuration
func DefaultEventStorageConfig() EventStorageConfig {
	return EventStorageConfig{
		MaxSnapshotInterval: 100,
		MaxEventsPerSlice:   1000,
		RetentionPeriod:     365 * 24 * time.Hour, // 1 year
		CompressionEnabled:  true,
		EncryptionEnabled:   true,
	}
}

// Event represents a stored event in the database
type Event struct {
	ID            string                 `json:"id" db:"id"`
	AggregateID   string                 `json:"aggregate_id" db:"aggregate_id"`
	AggregateType string                 `json:"aggregate_type" db:"aggregate_type"`
	EventType     string                 `json:"event_type" db:"event_type"`
	Version       int                    `json:"version" db:"version"`
	Data          []byte                 `json:"data" db:"data"`
	Metadata      map[string]interface{} `json:"metadata" db:"metadata"`
	OccurredAt    time.Time              `json:"occurred_at" db:"occurred_at"`
	CreatedAt     time.Time              `json:"created_at" db:"created_at"`
}

// ToJSON converts event to JSON
func (e *Event) ToJSON() ([]byte, error) {
	return json.Marshal(e)
}

// FromJSON creates event from JSON
func FromJSON(data []byte) (*Event, error) {
	var event Event
	err := json.Unmarshal(data, &event)
	if err != nil {
		return nil, err
	}
	return &event, nil
}

// EventMetadata represents metadata for events
type EventMetadata struct {
	CorrelationID string                 `json:"correlation_id,omitempty"`
	CausationID   string                 `json:"causation_id,omitempty"`
	UserID        string                 `json:"user_id,omitempty"`
	TenantID      string                 `json:"tenant_id,omitempty"`
	SessionID     string                 `json:"session_id,omitempty"`
	RequestID     string                 `json:"request_id,omitempty"`
	IP            string                 `json:"ip,omitempty"`
	UserAgent     string                 `json:"user_agent,omitempty"`
	Extra         map[string]interface{} `json:"extra,omitempty"`
}

// WithStandardMetadata adds standard metadata to an event
func (e *BaseEvent) WithStandardMetadata(userID, tenantID, sessionID, requestID, ip, userAgent string) *BaseEvent {
	e.metadata["correlation_id"] = uuid.New().String()
	e.metadata["user_id"] = userID
	e.metadata["tenant_id"] = tenantID
	e.metadata["session_id"] = sessionID
	e.metadata["request_id"] = requestID
	e.metadata["ip"] = ip
	e.metadata["user_agent"] = userAgent
	return e
}

// EventReplayConfiguration represents configuration for event replay
type EventReplayConfiguration struct {
	FromVersion    int                    `json:"from_version"`
	ToVersion      int                    `json:"to_version"`
	FromTime       *time.Time             `json:"from_time,omitempty"`
	ToTime         *time.Time             `json:"to_time,omitempty"`
	EventTypes     []string               `json:"event_types,omitempty"`
	BatchSize      int                    `json:"batch_size"`
	Parallelism    int                    `json:"parallelism"`
	ErrorStrategy  EventReplayErrorStrategy `json:"error_strategy"`
}

// EventReplayErrorStrategy defines how to handle errors during replay
type EventReplayErrorStrategy string

const (
	ErrorStrategyStop    EventReplayErrorStrategy = "stop"
	ErrorStrategySkip    EventReplayErrorStrategy = "skip"
	ErrorStrategyRetry   EventReplayErrorStrategy = "retry"
	ErrorStrategyDeadLetter EventReplayErrorStrategy = "dead_letter"
)

// EventProjection represents a projection built from events
type EventProjection interface {
	// Name returns the projection name
	Name() string
	// Project applies an event to the projection
	Project(ctx context.Context, event DomainEvent) error
	// Reset resets the projection
	Reset(ctx context.Context) error
	// GetStatus returns the projection status
	GetStatus(ctx context.Context) (*ProjectionStatus, error)
}

// ProjectionStatus represents the status of a projection
type ProjectionStatus struct {
	Name         string    `json:"name"`
	LastEventID  string    `json:"last_event_id"`
	LastProcessedAt time.Time `json:"last_processed_at"`
	IsCatchingUp bool      `json:"is_catching_up"`
	Error        *string   `json:"error,omitempty"`
}