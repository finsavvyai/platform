// Package events publishes gateway-side domain events to Redis pub/sub so
// the realtime service (services/realtime) can fan them out to connected
// WebSocket clients. Channels are tenant-scoped; cross-tenant leakage is
// impossible by construction because the tenant_id is part of the channel.
package events

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"sync/atomic"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
)

// Event types. Keep in sync with services/realtime/src/types/events.ts.
const (
	TypeDocUploaded    = "doc.uploaded"
	TypeDocProcessed   = "doc.processed"
	TypeDocFailed      = "doc.failed"
	TypePolicyChanged  = "policy.changed"
	TypeAuditEvent     = "audit.event"
	TypeTenantAlert    = "tenant.alert"
)

// Event is the on-wire shape. All fields are required except Payload.
type Event struct {
	ID        string          `json:"id"`
	Type      string          `json:"type"`
	TenantID  string          `json:"tenant_id"`
	ActorID   string          `json:"actor_id,omitempty"`
	Resource  string          `json:"resource,omitempty"`
	Payload   json.RawMessage `json:"payload,omitempty"`
	Timestamp time.Time       `json:"timestamp"`
}

// tenantIDPattern restricts tenant IDs to a conservative alphabet so they
// can safely appear in Redis channel names and downstream glob subscriptions
// (PSUBSCRIBE) without wildcard injection risk.
var tenantIDPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{1,64}$`)

// Publisher publishes Events to Redis. Safe for concurrent use.
type Publisher struct {
	rdb     *redis.Client
	prefix  string
	logger  *logrus.Logger
	dropped uint64 // events_dropped_total counter (atomic)
}

// NewPublisher constructs a Publisher. prefix is prepended to every channel
// name (e.g. "sdlc:events:"). Passing an empty prefix uses "events:".
// A nil rdb is accepted for tests and dev, but in that case every Publish
// call increments the Dropped() counter and logs a warning — SOC2 CC7
// requires audit events to be observable, not silent.
func NewPublisher(rdb *redis.Client, prefix string) *Publisher {
	if prefix == "" {
		prefix = "events:"
	}
	return &Publisher{rdb: rdb, prefix: prefix, logger: logrus.StandardLogger()}
}

// WithLogger attaches a custom logger. Returns the Publisher for chaining.
func (p *Publisher) WithLogger(l *logrus.Logger) *Publisher {
	if l != nil {
		p.logger = l
	}
	return p
}

// Dropped returns the cumulative count of events that could not be published
// because the Redis client was nil. Callers should surface this via a
// Prometheus gauge (events_dropped_total) so alerting catches silent gaps.
func (p *Publisher) Dropped() uint64 {
	return atomic.LoadUint64(&p.dropped)
}

// Channel returns the Redis channel for a tenant. Callers rarely need this
// directly; it's exposed so tests and the realtime service can subscribe
// with the same scheme.
func (p *Publisher) Channel(tenantID string) string {
	return fmt.Sprintf("%s%s", p.prefix, tenantID)
}

// Publish emits an Event on the tenant channel. It fills ID + Timestamp
// when unset so callers only need to set Type + TenantID + optional
// Resource/Payload.
func (p *Publisher) Publish(ctx context.Context, e Event) error {
	if e.TenantID == "" {
		return fmt.Errorf("events: tenant_id required")
	}
	if !tenantIDPattern.MatchString(e.TenantID) {
		return fmt.Errorf("events: tenant_id must match %s", tenantIDPattern)
	}
	if e.Type == "" {
		return fmt.Errorf("events: type required")
	}
	if e.ID == "" {
		e.ID = uuid.NewString()
	}
	if e.Timestamp.IsZero() {
		e.Timestamp = time.Now().UTC()
	}

	body, err := json.Marshal(e)
	if err != nil {
		return fmt.Errorf("events: marshal: %w", err)
	}

	if p.rdb == nil {
		// Silent drops would violate SOC2 CC7 monitoring requirements.
		// Record + log every miss so operators can alert on it.
		atomic.AddUint64(&p.dropped, 1)
		if p.logger != nil {
			p.logger.WithFields(logrus.Fields{
				"event_id":  e.ID,
				"type":      e.Type,
				"tenant_id": e.TenantID,
				"resource":  e.Resource,
			}).Warn("events: Redis not configured; event dropped")
		}
		return nil
	}

	return p.rdb.Publish(ctx, p.Channel(e.TenantID), body).Err()
}

// PublishDoc is a convenience for document lifecycle events.
func (p *Publisher) PublishDoc(ctx context.Context, tenantID, actorID, docID, eventType string, payload map[string]any) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("events: marshal payload: %w", err)
	}
	return p.Publish(ctx, Event{
		Type:     eventType,
		TenantID: tenantID,
		ActorID:  actorID,
		Resource: "document:" + docID,
		Payload:  body,
	})
}

// PublishPolicyChange emits a policy.changed event.
func (p *Publisher) PublishPolicyChange(ctx context.Context, tenantID, actorID, policyID, action string) error {
	body, _ := json.Marshal(map[string]any{"policy_id": policyID, "action": action})
	return p.Publish(ctx, Event{
		Type:     TypePolicyChanged,
		TenantID: tenantID,
		ActorID:  actorID,
		Resource: "policy:" + policyID,
		Payload:  body,
	})
}
