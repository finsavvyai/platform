package events

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	domainevents "github.com/queryflux/backend/internal/domain/events"
	"go.uber.org/zap"
)

// PostgresEventStore implements EventStore using PostgreSQL
type PostgresEventStore struct {
	db        *pgxpool.Pool
	logger    *zap.Logger
	config    domainevents.EventStorageConfig
	snapshots SnapshotStore
}

// NewPostgresEventStore creates a new PostgreSQL event store
func NewPostgresEventStore(db *pgxpool.Pool, config domainevents.EventStorageConfig, logger *zap.Logger) (*PostgresEventStore, error) {
	// Initialize tables
	if err := createEventTables(context.Background(), db, config); err != nil {
		return nil, fmt.Errorf("failed to create event tables: %w", err)
	}

	snapshotStore := NewPostgresSnapshotStore(db, logger)

	return &PostgresEventStore{
		db:        db,
		logger:    logger,
		config:    config,
		snapshots: snapshotStore,
	}, nil
}

// SaveEvents saves events to the store
func (s *PostgresEventStore) SaveEvents(ctx context.Context, aggregateID string, events []domainevents.DomainEvent, expectedVersion int) error {
	if len(events) == 0 {
		return nil
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Check for concurrency conflict
	if expectedVersion >= 0 {
		var currentVersion int
		err := tx.QueryRow(ctx,
			"SELECT version FROM events WHERE aggregate_id = $1 ORDER BY version DESC LIMIT 1",
			aggregateID).Scan(&currentVersion)

		if err != nil && err != sql.ErrNoRows {
			return fmt.Errorf("failed to check aggregate version: %w", err)
		}

		if currentVersion != expectedVersion {
			return fmt.Errorf("optimistic concurrency conflict: expected version %d, got %d",
				expectedVersion, currentVersion)
		}
	}

	// Insert events
	for i, event := range events {
		version := expectedVersion + i + 1

		eventData, err := json.Marshal(event.Data())
		if err != nil {
			return fmt.Errorf("failed to marshal event data: %w", err)
		}

		metadata, err := json.Marshal(event.Metadata())
		if err != nil {
			return fmt.Errorf("failed to marshal event metadata: %w", err)
		}

		query := `
			INSERT INTO events (
				id, aggregate_id, aggregate_type, event_type, version,
				data, metadata, occurred_at, created_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`

		_, err = tx.Exec(ctx, query,
			event.ID(),
			aggregateID,
			event.AggregateType(),
			event.EventType(),
			version,
			eventData,
			metadata,
			event.OccurredAt(),
			time.Now().UTC())

		if err != nil {
			return fmt.Errorf("failed to insert event: %w", err)
		}
	}

	// Check if snapshot should be created
	newVersion := expectedVersion + len(events)
	if newVersion%s.config.MaxSnapshotInterval == 0 {
		if err := s.createSnapshot(ctx, tx, aggregateID, newVersion); err != nil {
			s.logger.Warn("Failed to create snapshot",
				zap.String("aggregate_id", aggregateID),
				zap.Error(err))
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	s.logger.Debug("Events saved",
		zap.String("aggregate_id", aggregateID),
		zap.Int("count", len(events)),
		zap.Int("version", expectedVersion+len(events)))

	return nil
}

// GetEvents retrieves events for an aggregate
func (s *PostgresEventStore) GetEvents(ctx context.Context, aggregateID string, fromVersion int) ([]domainevents.DomainEvent, error) {
	// First check for snapshot
	snapshot, err := s.snapshots.GetSnapshot(ctx, aggregateID)
	if err == nil && snapshot.Version >= fromVersion {
		// Load from snapshot
		events, err := s.getEventsFromVersion(ctx, aggregateID, snapshot.Version+1)
		if err != nil {
			return nil, err
		}

		// Reconstruct aggregate state from snapshot and events
		// This would be handled by the aggregate root
		return events, nil
	}

	return s.getEventsFromVersion(ctx, aggregateID, fromVersion)
}

// getEventsFromVersion retrieves events from a specific version
func (s *PostgresEventStore) getEventsFromVersion(ctx context.Context, aggregateID string, fromVersion int) ([]domainevents.DomainEvent, error) {
	query := `
		SELECT id, aggregate_type, event_type, version, data, metadata, occurred_at
		FROM events
		WHERE aggregate_id = $1 AND version >= $2
		ORDER BY version ASC`

	rows, err := s.db.Query(ctx, query, aggregateID, fromVersion)
	if err != nil {
		return nil, fmt.Errorf("failed to query events: %w", err)
	}
	defer rows.Close()

	var events []domainevents.DomainEvent
	for rows.Next() {
		var (
			id            string
			aggregateType string
			eventType     string
			version       int
			data          []byte
			metadata      []byte
			occurredAt    time.Time
		)

		if err := rows.Scan(&id, &aggregateType, &eventType, &version, &data, &metadata, &occurredAt); err != nil {
			return nil, fmt.Errorf("failed to scan event row: %w", err)
		}

		event, err := s.deserializeEvent(id, aggregateType, eventType, version, data, metadata, occurredAt)
		if err != nil {
			return nil, fmt.Errorf("failed to deserialize event: %w", err)
		}

		events = append(events, event)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating events: %w", err)
	}

	return events, nil
}

// GetEventsByType retrieves events by type
func (s *PostgresEventStore) GetEventsByType(ctx context.Context, eventType string, from, to time.Time) ([]domainevents.DomainEvent, error) {
	query := `
		SELECT id, aggregate_id, aggregate_type, event_type, version, data, metadata, occurred_at
		FROM events
		WHERE event_type = $1 AND occurred_at BETWEEN $2 AND $3
		ORDER BY occurred_at ASC`

	rows, err := s.db.Query(ctx, query, eventType, from, to)
	if err != nil {
		return nil, fmt.Errorf("failed to query events by type: %w", err)
	}
	defer rows.Close()

	var events []domainevents.DomainEvent
	for rows.Next() {
		var (
			id            string
			aggregateID   string
			aggregateType string
			version       int
			data          []byte
			metadata      []byte
			occurredAt    time.Time
		)

		if err := rows.Scan(&id, &aggregateID, &aggregateType, &eventType, &version, &data, &metadata, &occurredAt); err != nil {
			return nil, fmt.Errorf("failed to scan event row: %w", err)
		}

		event, err := s.deserializeEvent(id, aggregateType, eventType, version, data, metadata, occurredAt)
		if err != nil {
			return nil, fmt.Errorf("failed to deserialize event: %w", err)
		}

		events = append(events, event)
	}

	return events, nil
}

// GetSnapshot retrieves a snapshot of an aggregate
func (s *PostgresEventStore) GetSnapshot(ctx context.Context, aggregateID string) (domainevents.Snapshot, error) {
	return s.snapshots.GetSnapshot(ctx, aggregateID)
}

// SaveSnapshot saves a snapshot of an aggregate
func (s *PostgresEventStore) SaveSnapshot(ctx context.Context, snapshot domainevents.Snapshot) error {
	return s.snapshots.SaveSnapshot(ctx, snapshot)
}

// createSnapshot creates a snapshot of an aggregate
func (s *PostgresEventStore) createSnapshot(ctx context.Context, tx pgx.Tx, aggregateID string, version int) error {
	// This would create a snapshot of the aggregate state
	// Implementation depends on aggregate reconstruction logic
	s.logger.Debug("Creating snapshot",
		zap.String("aggregate_id", aggregateID),
		zap.Int("version", version))

	return nil
}

// deserializeEvent deserializes an event from database
func (s *PostgresEventStore) deserializeEvent(id, aggregateType, eventType string, version int, data, metadata []byte, occurredAt time.Time) (domainevents.DomainEvent, error) {
	// Parse metadata
	var metadataMap map[string]interface{}
	if len(metadata) > 0 {
		if err := json.Unmarshal(metadata, &metadataMap); err != nil {
			return nil, fmt.Errorf("failed to unmarshal metadata: %w", err)
		}
	}

	// Parse event data based on type
	eventData, err := s.parseEventData(eventType, data)
	if err != nil {
		return nil, err
	}

	// Create final event with data
	finalEvent := NewInfrastructureEvent(
		id,
		"", // aggregateID from event
		aggregateType,
		eventType,
		version,
		occurredAt,
		eventData,
		metadataMap,
	)

	// Create specific event type based on eventType
	switch eventType {
	case "connection.created":
		return s.createConnectionCreatedEvent(finalEvent, eventData)
	case "connection.connected":
		return s.createConnectionConnectedEvent(finalEvent, eventData)
	case "connection.query_executed":
		return s.createQueryExecutedEvent(finalEvent, eventData)
	default:
		return finalEvent, nil
	}
}

// parseEventData parses event data based on type
func (s *PostgresEventStore) parseEventData(eventType string, data []byte) (interface{}, error) {
	var eventData interface{}
	if err := json.Unmarshal(data, &eventData); err != nil {
		return nil, fmt.Errorf("failed to unmarshal event data: %w", err)
	}
	return eventData, nil
}

// Helper methods for creating specific event types
func (s *PostgresEventStore) createConnectionCreatedEvent(base domainevents.DomainEvent, data interface{}) (domainevents.DomainEvent, error) {
	// Implementation for creating ConnectionCreatedEvent
	return base, nil
}

func (s *PostgresEventStore) createConnectionConnectedEvent(base domainevents.DomainEvent, data interface{}) (domainevents.DomainEvent, error) {
	// Implementation for creating ConnectionConnectedEvent
	return base, nil
}

func (s *PostgresEventStore) createQueryExecutedEvent(base domainevents.DomainEvent, data interface{}) (domainevents.DomainEvent, error) {
	// Implementation for creating QueryExecutedEvent
	return base, nil
}

// createEventTables creates event store tables
func createEventTables(ctx context.Context, db *pgxpool.Pool, config domainevents.EventStorageConfig) error {
	queries := []string{
		// Events table
		`CREATE TABLE IF NOT EXISTS events (
			id VARCHAR(255) PRIMARY KEY,
			aggregate_id VARCHAR(255) NOT NULL,
			aggregate_type VARCHAR(100) NOT NULL,
			event_type VARCHAR(100) NOT NULL,
			version INTEGER NOT NULL,
			data JSONB NOT NULL,
			metadata JSONB,
			occurred_at TIMESTAMP WITH TIME ZONE NOT NULL,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			UNIQUE(aggregate_id, version)
		)`,

		// Indexes for events
		`CREATE INDEX IF NOT EXISTS idx_events_aggregate_id ON events(aggregate_id)`,
		`CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type)`,
		`CREATE INDEX IF NOT EXISTS idx_events_occurred_at ON events(occurred_at)`,
		`CREATE INDEX IF NOT EXISTS idx_events_aggregate_type ON events(aggregate_type)`,

		// Snapshots table
		`CREATE TABLE IF NOT EXISTS snapshots (
			id VARCHAR(255) PRIMARY KEY,
			aggregate_id VARCHAR(255) NOT NULL UNIQUE,
			data BYTEA NOT NULL,
			version INTEGER NOT NULL,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		)`,

		// Index for snapshots
		`CREATE INDEX IF NOT EXISTS idx_snapshots_aggregate_id ON snapshots(aggregate_id)`,
	}

	for _, query := range queries {
		if _, err := db.Exec(ctx, query); err != nil {
			return fmt.Errorf("failed to execute query: %s, error: %w", query, err)
		}
	}

	return nil
}

// PostgresSnapshotStore implements SnapshotStore using PostgreSQL
type PostgresSnapshotStore struct {
	db     *pgxpool.Pool
	logger *zap.Logger
}

// NewPostgresSnapshotStore creates a new PostgreSQL snapshot store
func NewPostgresSnapshotStore(db *pgxpool.Pool, logger *zap.Logger) *PostgresSnapshotStore {
	return &PostgresSnapshotStore{
		db:     db,
		logger: logger,
	}
}

// GetSnapshot retrieves a snapshot
func (s *PostgresSnapshotStore) GetSnapshot(ctx context.Context, aggregateID string) (domainevents.Snapshot, error) {
	var snapshot domainevents.Snapshot
	query := `SELECT id, aggregate_id, data, version, created_at FROM snapshots WHERE aggregate_id = $1`

	err := s.db.QueryRow(ctx, query, aggregateID).Scan(
		&snapshot.ID,
		&snapshot.AggregateID,
		&snapshot.Data,
		&snapshot.Version,
		&snapshot.CreatedAt)

	if err != nil {
		if err == sql.ErrNoRows {
			return domainevents.Snapshot{}, fmt.Errorf("snapshot not found")
		}
		return domainevents.Snapshot{}, fmt.Errorf("failed to get snapshot: %w", err)
	}

	return snapshot, nil
}

// SaveSnapshot saves a snapshot
func (s *PostgresSnapshotStore) SaveSnapshot(ctx context.Context, snapshot domainevents.Snapshot) error {
	query := `
		INSERT INTO snapshots (id, aggregate_id, data, version, created_at)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (aggregate_id) DO UPDATE SET
			data = EXCLUDED.data,
			version = EXCLUDED.version,
			created_at = EXCLUDED.created_at`

	_, err := s.db.Exec(ctx, query,
		snapshot.ID,
		snapshot.AggregateID,
		snapshot.Data,
		snapshot.Version,
		snapshot.CreatedAt)

	if err != nil {
		return fmt.Errorf("failed to save snapshot: %w", err)
	}

	return nil
}

// SnapshotStore interface
type SnapshotStore interface {
	GetSnapshot(ctx context.Context, aggregateID string) (domainevents.Snapshot, error)
	SaveSnapshot(ctx context.Context, snapshot domainevents.Snapshot) error
}
