package events

import (
	"time"

	domainevents "github.com/queryflux/backend/internal/domain/events"
)

// infrastructureEvent is a wrapper for events deserialized from storage
// It implements the DomainEvent interface
type infrastructureEvent struct {
	id            string
	aggregateID   string
	aggregateType string
	eventType     string
	version       int
	occurredAt    time.Time
	data          interface{}
	metadata      map[string]interface{}
}

// NewInfrastructureEvent creates a new infrastructure event
func NewInfrastructureEvent(id, aggregateID, aggregateType, eventType string, version int, occurredAt time.Time, data interface{}, metadata map[string]interface{}) domainevents.DomainEvent {
	return &infrastructureEvent{
		id:            id,
		aggregateID:   aggregateID,
		aggregateType: aggregateType,
		eventType:     eventType,
		version:       version,
		occurredAt:    occurredAt,
		data:          data,
		metadata:      metadata,
	}
}

// Implement DomainEvent interface
func (e *infrastructureEvent) ID() string                       { return e.id }
func (e *infrastructureEvent) AggregateID() string              { return e.aggregateID }
func (e *infrastructureEvent) AggregateType() string            { return e.aggregateType }
func (e *infrastructureEvent) EventType() string                { return e.eventType }
func (e *infrastructureEvent) Version() int                     { return e.version }
func (e *infrastructureEvent) OccurredAt() time.Time            { return e.occurredAt }
func (e *infrastructureEvent) Data() interface{}                { return e.data }
func (e *infrastructureEvent) Metadata() map[string]interface{} { return e.metadata }
