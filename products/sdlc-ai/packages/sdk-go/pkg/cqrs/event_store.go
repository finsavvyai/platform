package cqrs

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/shaharsolomon/sdln/pkg/domain"
)

// InMemoryEventStore provides in-memory event store implementation
type InMemoryEventStore struct {
	events    map[string][]domain.Event
	snapshots map[string]*domain.Snapshot
}

// NewInMemoryEventStore creates a new in-memory event store
func NewInMemoryEventStore() *InMemoryEventStore {
	return &InMemoryEventStore{
		events:    make(map[string][]domain.Event),
		snapshots: make(map[string]*domain.Snapshot),
	}
}

// SaveEvents saves events to the store
func (s *InMemoryEventStore) SaveEvents(aggregateID string, events []domain.Event, expectedVersion int) error {
	if expectedVersion != 0 {
		existingEvents, exists := s.events[aggregateID]
		if exists && len(existingEvents) != expectedVersion {
			return fmt.Errorf("expected version %d, but got %d", expectedVersion, len(existingEvents))
		}
	}

	if s.events[aggregateID] == nil {
		s.events[aggregateID] = []domain.Event{}
	}

	s.events[aggregateID] = append(s.events[aggregateID], events...)
	return nil
}

// GetEvents gets events for an aggregate from a specific version
func (s *InMemoryEventStore) GetEvents(aggregateID string, fromVersion int) ([]domain.Event, error) {
	events, exists := s.events[aggregateID]
	if !exists {
		return []domain.Event{}, nil
	}

	if fromVersion <= 0 {
		return events, nil
	}

	if fromVersion > len(events) {
		return []domain.Event{}, nil
	}

	return events[fromVersion:], nil
}

// GetEventsFromSnapshot gets events from the latest snapshot
func (s *InMemoryEventStore) GetEventsFromSnapshot(aggregateID string, fromVersion int) ([]domain.Event, error) {
	snapshot, exists := s.snapshots[aggregateID]
	if exists && snapshot.Version >= fromVersion {
		return s.GetEvents(aggregateID, snapshot.Version)
	}

	return s.GetEvents(aggregateID, fromVersion)
}

// SaveSnapshot saves a snapshot
func (s *InMemoryEventStore) SaveSnapshot(aggregateID string, snapshot domain.Snapshot) error {
	s.snapshots[aggregateID] = &snapshot
	return nil
}

// GetSnapshot gets the latest snapshot for an aggregate
func (s *InMemoryEventStore) GetSnapshot(aggregateID string) (*domain.Snapshot, error) {
	snapshot, exists := s.snapshots[aggregateID]
	if !exists {
		return nil, nil
	}

	return snapshot, nil
}

// CloudflareEventStore provides Cloudflare D1-based event store implementation
type CloudflareEventStore struct {
	// Cloudflare D1 client would be injected here
	db     D1Database
	logger Logger
}

// D1Database interface for Cloudflare D1 database
type D1Database interface {
	Prepare(query string) PreparedStatement
	Exec(query string, args ...interface{}) (Result, error)
	Query(query string, args ...interface{}) (Rows, error)
}

// PreparedStatement interface for prepared statements
type PreparedStatement interface {
	Bind(args ...interface{}) PreparedStatement
	First() (Row, error)
	All() ([]Row, error)
	Run() (Result, error)
}

// Result interface for query results
type Result interface {
	LastInsertId() (int64, error)
	RowsAffected() (int64, error)
}

// Rows interface for query rows
type Rows interface {
	Next() bool
	Scan(dest ...interface{}) error
	Close() error
}

// Row interface for query row
type Row interface {
	Scan(dest ...interface{}) error
}

// Logger interface for logging
type Logger interface {
	Info(msg string, fields ...interface{})
	Error(msg string, fields ...interface{})
	Debug(msg string, fields ...interface{})
}

// NewCloudflareEventStore creates a new Cloudflare-based event store
func NewCloudflareEventStore(db D1Database, logger Logger) *CloudflareEventStore {
	return &CloudflareEventStore{
		db:     db,
		logger: logger,
	}
}

// SaveEvents saves events to Cloudflare D1
func (s *CloudflareEventStore) SaveEvents(aggregateID string, events []domain.Event, expectedVersion int) error {
	ctx := context.Background()

	// Check version concurrency
	if expectedVersion != 0 {
		var currentVersion int
		err := s.db.Query(`
			SELECT MAX(version) as version
			FROM events
			WHERE aggregate_id = ? AND tenant_id = ?
		`, aggregateID).Scan(&currentVersion)

		if err != nil {
			s.logger.Error("Failed to check event version", "aggregate_id", aggregateID, "error", err)
			return fmt.Errorf("failed to check event version: %w", err)
		}

		if currentVersion != expectedVersion {
			return fmt.Errorf("expected version %d, but got %d", expectedVersion, currentVersion)
		}
	}

	// Insert events
	for _, event := range events {
		eventData, err := json.Marshal(event.GetData())
		if err != nil {
			s.logger.Error("Failed to marshal event data", "error", err)
			return fmt.Errorf("failed to marshal event data: %w", err)
		}

		metadataData, err := json.Marshal(event.GetMetadata())
		if err != nil {
			s.logger.Error("Failed to marshal event metadata", "error", err)
			return fmt.Errorf("failed to marshal event metadata: %w", err)
		}

		_, err = s.db.Exec(`
			INSERT INTO events (
				id, aggregate_id, aggregate_type, event_type, version,
				occurred_at, data, metadata, tenant_id
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		`,
			event.GetID(),
			event.GetAggregateID(),
			"placeholder", // Would extract from event
			event.GetEventType(),
			event.GetVersion(),
			event.GetOccurredAt(),
			string(eventData),
			string(metadataData),
			"placeholder", // Would extract from context
		)

		if err != nil {
			s.logger.Error("Failed to save event", "error", err)
			return fmt.Errorf("failed to save event: %w", err)
		}
	}

	s.logger.Info("Events saved successfully", "count", len(events), "aggregate_id", aggregateID)
	return nil
}

// GetEvents gets events from Cloudflare D1
func (s *CloudflareEventStore) GetEvents(aggregateID string, fromVersion int) ([]domain.Event, error) {
	ctx := context.Background()

	query := `
		SELECT id, aggregate_id, aggregate_type, event_type, version,
			   occurred_at, data, metadata
		FROM events
		WHERE aggregate_id = ? AND version >= ?
		ORDER BY version ASC
	`

	rows, err := s.db.Query(query, aggregateID, fromVersion)
	if err != nil {
		s.logger.Error("Failed to query events", "error", err)
		return nil, fmt.Errorf("failed to query events: %w", err)
	}
	defer rows.Close()

	var events []domain.Event
	for rows.Next() {
		var id, aggregateID, aggregateType, eventType string
		var version int
		var occurredAt time.Time
		var dataStr, metadataStr string

		err := rows.Scan(&id, &aggregateID, &aggregateType, &eventType,
			&version, &occurredAt, &dataStr, &metadataStr)
		if err != nil {
			s.logger.Error("Failed to scan event row", "error", err)
			return nil, fmt.Errorf("failed to scan event row: %w", err)
		}

		var data map[string]interface{}
		err = json.Unmarshal([]byte(dataStr), &data)
		if err != nil {
			s.logger.Error("Failed to unmarshal event data", "error", err)
			return nil, fmt.Errorf("failed to unmarshal event data: %w", err)
		}

		var metadata map[string]interface{}
		err = json.Unmarshal([]byte(metadataStr), &metadata)
		if err != nil {
			s.logger.Error("Failed to unmarshal event metadata", "error", err)
			return nil, fmt.Errorf("failed to unmarshal event metadata: %w", err)
		}

		// Create appropriate event type based on event_type
		baseEvent := &domain.BaseEvent{
			ID:            id,
			AggregateID:   aggregateID,
			AggregateType: aggregateType,
			EventType:     eventType,
			Version:       version,
			OccurredAt:    occurredAt,
			Data:          data,
			Metadata:      metadata,
		}

		event, err := s.createEventFromType(eventType, baseEvent)
		if err != nil {
			s.logger.Error("Failed to create event from type", "event_type", eventType, "error", err)
			continue
		}

		events = append(events, event)
	}

	return events, nil
}

// GetEventsFromSnapshot gets events from latest snapshot
func (s *CloudflareEventStore) GetEventsFromSnapshot(aggregateID string, fromVersion int) ([]domain.Event, error) {
	snapshot, err := s.GetSnapshot(aggregateID)
	if err != nil {
		return nil, fmt.Errorf("failed to get snapshot: %w", err)
	}

	if snapshot != nil && snapshot.Version >= fromVersion {
		return s.GetEvents(aggregateID, snapshot.Version)
	}

	return s.GetEvents(aggregateID, fromVersion)
}

// SaveSnapshot saves snapshot to Cloudflare D1
func (s *CloudflareEventStore) SaveSnapshot(aggregateID string, snapshot domain.Snapshot) error {
	ctx := context.Background()

	snapshotData, err := json.Marshal(snapshot.Data)
	if err != nil {
		s.logger.Error("Failed to marshal snapshot data", "error", err)
		return fmt.Errorf("failed to marshal snapshot data: %w", err)
	}

	_, err = s.db.Exec(`
		INSERT OR REPLACE INTO snapshots (
			aggregate_id, aggregate_type, version, data, created_at
		) VALUES (?, ?, ?, ?, ?)
	`,
		snapshot.AggregateID,
		snapshot.AggregateType,
		snapshot.Version,
		string(snapshotData),
		snapshot.CreatedAt,
	)

	if err != nil {
		s.logger.Error("Failed to save snapshot", "error", err)
		return fmt.Errorf("failed to save snapshot: %w", err)
	}

	s.logger.Info("Snapshot saved successfully", "aggregate_id", aggregateID, "version", snapshot.Version)
	return nil
}

// GetSnapshot gets snapshot from Cloudflare D1
func (s *CloudflareEventStore) GetSnapshot(aggregateID string) (*domain.Snapshot, error) {
	ctx := context.Background()

	query := `
		SELECT aggregate_id, aggregate_type, version, data, created_at
		FROM snapshots
		WHERE aggregate_id = ?
		ORDER BY version DESC
		LIMIT 1
	`

	rows, err := s.db.Query(query, aggregateID)
	if err != nil {
		s.logger.Error("Failed to query snapshot", "error", err)
		return nil, fmt.Errorf("failed to query snapshot: %w", err)
	}
	defer rows.Close()

	if !rows.Next() {
		return nil, nil // No snapshot found
	}

	var id, aggregateType string
	var version int
	var dataStr string
	var createdAt time.Time

	err = rows.Scan(&id, &aggregateType, &version, &dataStr, &createdAt)
	if err != nil {
		s.logger.Error("Failed to scan snapshot row", "error", err)
		return nil, fmt.Errorf("failed to scan snapshot row: %w", err)
	}

	var data interface{}
	err = json.Unmarshal([]byte(dataStr), &data)
	if err != nil {
		s.logger.Error("Failed to unmarshal snapshot data", "error", err)
		return nil, fmt.Errorf("failed to unmarshal snapshot data: %w", err)
	}

	snapshot := &domain.Snapshot{
		AggregateID:   id,
		AggregateType: aggregateType,
		Version:       version,
		Data:          data,
		CreatedAt:     createdAt,
	}

	return snapshot, nil
}

// createEventFromType creates appropriate event type based on event type string
func (s *CloudflareEventStore) createEventFromType(eventType string, baseEvent *domain.BaseEvent) (domain.Event, error) {
	switch eventType {
	case "user_registered":
		return &domain.UserRegisteredEvent{
			BaseEvent: baseEvent,
			Email:     getString(baseEvent.Data, "email"),
			TenantID:  getString(baseEvent.Data, "tenant_id"),
			Role:      getString(baseEvent.Data, "role"),
		}, nil
	case "user_authenticated":
		return &domain.UserAuthenticatedEvent{
			BaseEvent: baseEvent,
			UserID:    getString(baseEvent.Data, "user_id"),
			SessionID: getString(baseEvent.Data, "session_id"),
			IPAddress: getString(baseEvent.Data, "ip_address"),
			UserAgent: getString(baseEvent.Data, "user_agent"),
		}, nil
	case "user_updated":
		return &domain.UserUpdatedEvent{
			BaseEvent:     baseEvent,
			UserID:        getString(baseEvent.Data, "user_id"),
			UpdatedFields: getStringSlice(baseEvent.Data, "updated_fields"),
		}, nil
	case "document_uploaded":
		return &domain.DocumentUploadedEvent{
			BaseEvent:   baseEvent,
			DocumentID:  getString(baseEvent.Data, "document_id"),
			UserID:      getString(baseEvent.Data, "user_id"),
			TenantID:    getString(baseEvent.Data, "tenant_id"),
			FileName:    getString(baseEvent.Data, "file_name"),
			FileSize:    getInt64(baseEvent.Data, "file_size"),
			ContentType: getString(baseEvent.Data, "content_type"),
			Checksum:    getString(baseEvent.Data, "checksum"),
		}, nil
	case "document_processed":
		return &domain.DocumentProcessedEvent{
			BaseEvent:    baseEvent,
			DocumentID:   getString(baseEvent.Data, "document_id"),
			ChunksCount:  getInt(baseEvent.Data, "chunks_count"),
			VectorCount:  getInt(baseEvent.Data, "vector_count"),
			ProcessingMs: getInt64(baseEvent.Data, "processing_ms"),
			Tags:         getStringSlice(baseEvent.Data, "tags"),
		}, nil
	case "document_deleted":
		return &domain.DocumentDeletedEvent{
			BaseEvent:  baseEvent,
			DocumentID: getString(baseEvent.Data, "document_id"),
			DeletedBy:  getString(baseEvent.Data, "deleted_by"),
		}, nil
	case "query_submitted":
		return &domain.QuerySubmittedEvent{
			BaseEvent:   baseEvent,
			QueryID:     getString(baseEvent.Data, "query_id"),
			UserID:      getString(baseEvent.Data, "user_id"),
			TenantID:    getString(baseEvent.Data, "tenant_id"),
			Query:       getString(baseEvent.Data, "query"),
			VectorQuery: getFloat32Slice(baseEvent.Data, "vector_query"),
			Context:     getStringSlice(baseEvent.Data, "context"),
		}, nil
	case "query_processed":
		return &domain.QueryProcessedEvent{
			BaseEvent: baseEvent,
			QueryID:   getString(baseEvent.Data, "query_id"),
			Response:  getString(baseEvent.Data, "response"),
			// Add other fields as needed
		}, nil
	case "tenant_created":
		return &domain.TenantCreatedEvent{
			BaseEvent: baseEvent,
			TenantID:  getString(baseEvent.Data, "tenant_id"),
			Name:      getString(baseEvent.Data, "name"),
			Plan:      getString(baseEvent.Data, "plan"),
			CreatedBy: getString(baseEvent.Data, "created_by"),
		}, nil
	case "tenant_updated":
		return &domain.TenantUpdatedEvent{
			BaseEvent:     baseEvent,
			TenantID:      getString(baseEvent.Data, "tenant_id"),
			UpdatedFields: getStringSlice(baseEvent.Data, "updated_fields"),
		}, nil
	case "tenant_suspended":
		return &domain.TenantSuspendedEvent{
			BaseEvent:   baseEvent,
			TenantID:    getString(baseEvent.Data, "tenant_id"),
			Reason:      getString(baseEvent.Data, "reason"),
			SuspendedBy: getString(baseEvent.Data, "suspended_by"),
		}, nil
	case "policy_created":
		return &domain.PolicyCreatedEvent{
			BaseEvent: baseEvent,
			PolicyID:  getString(baseEvent.Data, "policy_id"),
			TenantID:  getString(baseEvent.Data, "tenant_id"),
			Name:      getString(baseEvent.Data, "name"),
			Type:      getString(baseEvent.Data, "type"),
			CreatedBy: getString(baseEvent.Data, "created_by"),
		}, nil
	case "payment_method_added":
		return &domain.PaymentMethodAddedEvent{
			BaseEvent: baseEvent,
			UserID:    getString(baseEvent.Data, "user_id"),
			TenantID:  getString(baseEvent.Data, "tenant_id"),
			TokenID:   getString(baseEvent.Data, "token_id"),
			CardType:  getString(baseEvent.Data, "card_type"),
			LastFour:  getString(baseEvent.Data, "last_four"),
		}, nil
	case "payment_processed":
		return &domain.PaymentProcessedEvent{
			BaseEvent: baseEvent,
			PaymentID: getString(baseEvent.Data, "payment_id"),
			UserID:    getString(baseEvent.Data, "user_id"),
			TenantID:  getString(baseEvent.Data, "tenant_id"),
			Amount:    getInt64(baseEvent.Data, "amount"),
			Currency:  getString(baseEvent.Data, "currency"),
			TokenID:   getString(baseEvent.Data, "token_id"),
		}, nil
	case "security_violation":
		return &domain.SecurityViolationEvent{
			BaseEvent:     baseEvent,
			UserID:        getString(baseEvent.Data, "user_id"),
			TenantID:      getString(baseEvent.Data, "tenant_id"),
			ViolationType: getString(baseEvent.Data, "violation_type"),
			Severity:      getString(baseEvent.Data, "severity"),
			Description:   getString(baseEvent.Data, "description"),
			IPAddress:     getString(baseEvent.Data, "ip_address"),
		}, nil
	case "data_access":
		return &domain.DataAccessEvent{
			BaseEvent:  baseEvent,
			UserID:     getString(baseEvent.Data, "user_id"),
			TenantID:   getString(baseEvent.Data, "tenant_id"),
			ResourceID: getString(baseEvent.Data, "resource_id"),
			Action:     getString(baseEvent.Data, "action"),
			AccessType: getString(baseEvent.Data, "access_type"),
			IPAddress:  getString(baseEvent.Data, "ip_address"),
		}, nil
	case "audit_log":
		return &domain.AuditLogEvent{
			BaseEvent: baseEvent,
			UserID:    getString(baseEvent.Data, "user_id"),
			TenantID:  getString(baseEvent.Data, "tenant_id"),
			Action:    getString(baseEvent.Data, "action"),
			Resource:  getString(baseEvent.Data, "resource"),
			Outcome:   getString(baseEvent.Data, "outcome"),
			IPAddress: getString(baseEvent.Data, "ip_address"),
		}, nil
	default:
		return baseEvent, nil
	}
}

// Helper functions for type-safe data extraction
func getString(data map[string]interface{}, key string) string {
	if val, ok := data[key].(string); ok {
		return val
	}
	return ""
}

func getInt(data map[string]interface{}, key string) int {
	if val, ok := data[key].(int); ok {
		return val
	}
	return 0
}

func getInt64(data map[string]interface{}, key string) int64 {
	if val, ok := data[key].(int64); ok {
		return val
	}
	if val, ok := data[key].(int); ok {
		return int64(val)
	}
	return 0
}

func getStringSlice(data map[string]interface{}, key string) []string {
	if val, ok := data[key].([]interface{}); ok {
		var result []string
		for _, item := range val {
			if str, ok := item.(string); ok {
				result = append(result, str)
			}
		}
		return result
	}
	return []string{}
}

func getFloat32Slice(data map[string]interface{}, key string) []float32 {
	if val, ok := data[key].([]interface{}); ok {
		var result []float32
		for _, item := range val {
			if f, ok := item.(float64); ok {
				result = append(result, float32(f))
			}
		}
		return result
	}
	return []float32{}
}
