package events

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	domainevents "github.com/queryflux/backend/internal/domain/events"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

// RedisEventBus implements EventBus using Redis streams
type RedisEventBus struct {
	client         *redis.Client
	logger         *zap.Logger
	handlers       map[string][]domainevents.EventHandler
	consumerGroups map[string]string
	subscriptions  map[string]*redis.PubSub
	mutex          sync.RWMutex
	config         EventBusConfig
	publisher      *EventPublisher
}

// EventBusConfig represents event bus configuration
type EventBusConfig struct {
	StreamMaxLength int64         `json:"stream_max_length"`
	ConsumerGroup   string        `json:"consumer_group"`
	BatchSize       int64         `json:"batch_size"`
	BlockTime       time.Duration `json:"block_time"`
	ReadTimeout     time.Duration `json:"read_timeout"`
	MaxRetries      int           `json:"max_retries"`
	RetryDelay      time.Duration `json:"retry_delay"`
	DLQPrefix       string        `json:"dlq_prefix"`
}

// NewRedisEventBus creates a new Redis event bus
func NewRedisEventBus(client *redis.Client, config EventBusConfig, logger *zap.Logger) (*RedisEventBus, error) {
	bus := &RedisEventBus{
		client:         client,
		logger:         logger,
		handlers:       make(map[string][]domainevents.EventHandler),
		consumerGroups: make(map[string]string),
		subscriptions:  make(map[string]*redis.PubSub),
		config:         config,
		publisher:      NewEventPublisher(client, config, logger),
	}

	// Initialize consumer group
	if err := bus.initConsumerGroup(context.Background()); err != nil {
		return nil, fmt.Errorf("failed to initialize consumer group: %w", err)
	}

	return bus, nil
}

// Publish publishes an event to the bus
func (b *RedisEventBus) Publish(ctx context.Context, event domainevents.DomainEvent) error {
	// Serialize event
	eventData, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal event: %w", err)
	}

	// Create stream entry
	values := map[string]interface{}{
		"id":             event.ID(),
		"aggregate_id":   event.AggregateID(),
		"aggregate_type": event.AggregateType(),
		"event_type":     event.EventType(),
		"version":        event.Version(),
		"occurred_at":    event.OccurredAt().UnixMilli(),
		"data":           string(eventData),
	}

	// Get metadata
	if metadata := event.Metadata(); metadata != nil {
		metadataJSON, err := json.Marshal(metadata)
		if err != nil {
			b.logger.Error("Failed to marshal event metadata", zap.Error(err))
		} else {
			values["metadata"] = string(metadataJSON)
		}
	}

	// Add to Redis stream
	streamKey := fmt.Sprintf("events:%s", event.EventType())
	_, err = b.client.XAdd(ctx, &redis.XAddArgs{
		Stream: streamKey,
		MaxLen: b.config.StreamMaxLength,
		Approx: true,
		ID:     "*",
		Values: values,
	}).Result()

	if err != nil {
		return fmt.Errorf("failed to add event to stream: %w", err)
	}

	// Also publish to pub/sub for immediate notifications
	pubSubKey := fmt.Sprintf("events:%s", event.EventType())
	if err := b.client.Publish(ctx, pubSubKey, string(eventData)).Err(); err != nil {
		b.logger.Error("Failed to publish to pub/sub", zap.Error(err))
	}

	b.logger.Debug("Event published",
		zap.String("event_id", event.ID()),
		zap.String("event_type", event.EventType()),
		zap.String("aggregate_id", event.AggregateID()))

	return nil
}

// Subscribe subscribes to events of a specific type
func (b *RedisEventBus) Subscribe(ctx context.Context, eventType string, handler domainevents.EventHandler) error {
	b.mutex.Lock()
	defer b.mutex.Unlock()

	// Add handler to list
	if _, exists := b.handlers[eventType]; !exists {
		b.handlers[eventType] = []domainevents.EventHandler{}
	}
	b.handlers[eventType] = append(b.handlers[eventType], handler)

	// Start consumer if not already running
	consumerKey := fmt.Sprintf("%s:%s", b.config.ConsumerGroup, eventType)
	if _, exists := b.consumerGroups[consumerKey]; !exists {
		go b.startConsumer(ctx, eventType)
		b.consumerGroups[consumerKey] = eventType
	}

	b.logger.Info("Event handler subscribed",
		zap.String("event_type", eventType),
		zap.String("handler_type", fmt.Sprintf("%T", handler)))

	return nil
}

// initConsumerGroup initializes Redis consumer group
func (b *RedisEventBus) initConsumerGroup(ctx context.Context) error {
	// Get all event types
	eventTypes := []string{
		"connection.created",
		"connection.connected",
		"connection.disconnected",
		"connection.query_executed",
		"connection.failed",
		"connection.security",
		"connection.metrics",
	}

	for _, eventType := range eventTypes {
		streamKey := fmt.Sprintf("events:%s", eventType)

		// Try to create consumer group
		err := b.client.XGroupCreate(ctx, streamKey, b.config.ConsumerGroup, "0").Err()
		if err != nil && err != redis.Nil {
			if err.Error() == "BUSYGROUP Consumer Group name already exists" {
				// Group already exists, which is fine
				continue
			}
			return fmt.Errorf("failed to create consumer group for %s: %w", eventType, err)
		}
	}

	return nil
}

// startConsumer starts a consumer for event type
func (b *RedisEventBus) startConsumer(ctx context.Context, eventType string) {
	streamKey := fmt.Sprintf("events:%s", eventType)
	consumerName := fmt.Sprintf("%s-%d", b.config.ConsumerGroup, time.Now().Unix())

	b.logger.Info("Starting event consumer",
		zap.String("event_type", eventType),
		zap.String("consumer_name", consumerName))

	for {
		select {
		case <-ctx.Done():
			b.logger.Info("Stopping event consumer", zap.String("event_type", eventType))
			return
		default:
			// Read from stream
			_, err := b.client.XReadGroup(ctx, &redis.XReadGroupArgs{
				Group:    b.config.ConsumerGroup,
				Consumer: consumerName,
				Streams:  []string{streamKey, ">"},
				Count:    b.config.BatchSize,
				Block:    b.config.BlockTime,
			}).Result()

			if err != nil {
				if err != redis.Nil {
					b.logger.Error("Failed to read from stream",
						zap.String("event_type", eventType),
						zap.Error(err))
				}
				time.Sleep(time.Second)
				continue
			}

			// Process pending messages if any
			b.processPendingMessages(ctx, streamKey, consumerName, eventType)

			time.Sleep(time.Millisecond * 100) // Small delay to prevent tight loop
		}
	}
}

// processPendingMessages processes pending messages in consumer group
func (b *RedisEventBus) processPendingMessages(ctx context.Context, streamKey, consumerName, eventType string) {
	for {
		// Get pending messages
		messages, err := b.client.XPendingExt(ctx, &redis.XPendingExtArgs{
			Group:    b.config.ConsumerGroup,
			Start:    "-",
			End:      "+",
			Count:    b.config.BatchSize,
			Consumer: consumerName,
		}).Result()

		if err != nil || len(messages) == 0 {
			return
		}

		for _, msg := range messages {
			// Get the actual message
			xmsgs, err := b.client.XRange(ctx, streamKey, msg.ID, msg.ID).Result()
			if err != nil || len(xmsgs) == 0 {
				continue
			}

			xmsg := xmsgs[0]
			if err := b.handleMessage(ctx, xmsg, eventType); err != nil {
				b.logger.Error("Failed to handle pending message",
					zap.String("message_id", msg.ID),
					zap.Error(err))
			} else {
				// Acknowledge message
				if err := b.client.XAck(ctx, streamKey, b.config.ConsumerGroup, msg.ID).Err(); err != nil {
					b.logger.Error("Failed to acknowledge message",
						zap.String("message_id", msg.ID),
						zap.Error(err))
				}
			}
		}
	}
}

// handleMessage handles a single message from Redis stream
func (b *RedisEventBus) handleMessage(ctx context.Context, msg redis.XMessage, eventType string) error {
	// Extract event data
	eventDataStr, ok := msg.Values["data"].(string)
	if !ok {
		return fmt.Errorf("missing event data in message")
	}

	// Deserialize event
	var eventMap map[string]interface{}
	if err := json.Unmarshal([]byte(eventDataStr), &eventMap); err != nil {
		return fmt.Errorf("failed to unmarshal event: %w", err)
	}

	// Extract fields from map
	var (
		id            string
		aggregateID   string
		aggregateType string
		eventTypeStr  string
		version       int
		occurredAt    time.Time
		metadata      map[string]interface{}
	)

	if idVal, ok := eventMap["id"].(string); ok {
		id = idVal
	}
	if aggID, ok := eventMap["aggregate_id"].(string); ok {
		aggregateID = aggID
	}
	if aggType, ok := eventMap["aggregate_type"].(string); ok {
		aggregateType = aggType
	}
	if evtType, ok := eventMap["event_type"].(string); ok {
		eventTypeStr = evtType
	}
	if ver, ok := eventMap["version"].(float64); ok {
		version = int(ver)
	}
	if occurred, ok := eventMap["occurred_at"].(float64); ok {
		occurredAt = time.UnixMilli(int64(occurred))
	}
	if meta, ok := eventMap["metadata"].(map[string]interface{}); ok {
		metadata = meta
	}

	// Create infrastructure event
	baseEvent := NewInfrastructureEvent(
		id,
		aggregateID,
		aggregateType,
		eventTypeStr,
		version,
		occurredAt,
		eventMap, // Use the entire map as data
		metadata,
	)

	// Get handlers for event type
	b.mutex.RLock()
	handlers, exists := b.handlers[eventType]
	b.mutex.RUnlock()

	if !exists {
		b.logger.Warn("No handlers registered for event type", zap.String("event_type", eventType))
		return nil
	}

	// Dispatch to all handlers
	var errors []error
	for _, handler := range handlers {
		if err := handler.Handle(ctx, baseEvent); err != nil {
			b.logger.Error("Event handler failed",
				zap.String("event_type", eventType),
				zap.String("event_id", baseEvent.ID()),
				zap.Error(err))
			errors = append(errors, err)
		}
	}

	if len(errors) > 0 {
		return fmt.Errorf("some handlers failed: %v", errors)
	}

	return nil
}

// EventPublisher handles reliable event publishing
type EventPublisher struct {
	client    *redis.Client
	logger    *zap.Logger
	config    EventBusConfig
	semaphore chan struct{}
}

// NewEventPublisher creates a new event publisher
func NewEventPublisher(client *redis.Client, config EventBusConfig, logger *zap.Logger) *EventPublisher {
	return &EventPublisher{
		client:    client,
		logger:    logger,
		config:    config,
		semaphore: make(chan struct{}, 10), // Limit concurrent publishes
	}
}

// PublishWithRetry publishes event with retry logic
func (p *EventPublisher) PublishWithRetry(ctx context.Context, event domainevents.DomainEvent) error {
	// Acquire semaphore
	select {
	case p.semaphore <- struct{}{}:
	case <-ctx.Done():
		return ctx.Err()
	}
	defer func() { <-p.semaphore }()

	var lastErr error
	for attempt := 0; attempt <= p.config.MaxRetries; attempt++ {
		if attempt > 0 {
			select {
			case <-time.After(p.config.RetryDelay):
			case <-ctx.Done():
				return ctx.Err()
			}
		}

		if err := p.publish(ctx, event); err != nil {
			lastErr = err
			p.logger.Warn("Event publish failed, retrying",
				zap.Int("attempt", attempt+1),
				zap.String("event_id", event.ID()),
				zap.Error(err))
			continue
		}

		// Success
		return nil
	}

	// All retries failed, send to DLQ
	if err := p.sendToDLQ(ctx, event, lastErr); err != nil {
		p.logger.Error("Failed to send event to DLQ",
			zap.String("event_id", event.ID()),
			zap.Error(err))
	}

	return fmt.Errorf("failed to publish after %d attempts: %w", p.config.MaxRetries+1, lastErr)
}

// publish publishes a single event
func (p *EventPublisher) publish(ctx context.Context, event domainevents.DomainEvent) error {
	eventData, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal event: %w", err)
	}

	streamKey := fmt.Sprintf("events:%s", event.EventType())
	values := map[string]interface{}{
		"id":             event.ID(),
		"aggregate_id":   event.AggregateID(),
		"aggregate_type": event.AggregateType(),
		"event_type":     event.EventType(),
		"version":        event.Version(),
		"occurred_at":    event.OccurredAt().UnixMilli(),
		"data":           string(eventData),
	}

	_, err = p.client.XAdd(ctx, &redis.XAddArgs{
		Stream: streamKey,
		MaxLen: p.config.StreamMaxLength,
		Approx: true,
		ID:     "*",
		Values: values,
	}).Result()

	return err
}

// sendToDLQ sends failed event to dead letter queue
func (p *EventPublisher) sendToDLQ(ctx context.Context, event domainevents.DomainEvent, originalErr error) error {
	dlqKey := fmt.Sprintf("%s:%s", p.config.DLQPrefix, event.EventType())

	dlqEntry := map[string]interface{}{
		"event":       event,
		"error":       originalErr.Error(),
		"failed_at":   time.Now().UnixMilli(),
		"retry_count": p.config.MaxRetries + 1,
	}

	eventJSON, err := json.Marshal(dlqEntry)
	if err != nil {
		return err
	}

	return p.client.LPush(ctx, dlqKey, eventJSON).Err()
}

// ReplayEvents replays events from a stream
func (b *RedisEventBus) ReplayEvents(ctx context.Context, eventType string, from, to time.Time, handler domainevents.EventHandler) error {
	streamKey := fmt.Sprintf("events:%s", eventType)

	// Convert times to Redis IDs
	startID := fmt.Sprintf("%d", from.UnixMilli())
	endID := fmt.Sprintf("%d", to.UnixMilli())

	// Read messages from stream
	messages, err := b.client.XRange(ctx, streamKey, startID, endID).Result()
	if err != nil {
		return fmt.Errorf("failed to read events for replay: %w", err)
	}

	b.logger.Info("Replaying events",
		zap.String("event_type", eventType),
		zap.Int("count", len(messages)))

	for _, msg := range messages {
		if err := b.handleMessage(ctx, msg, eventType); err != nil {
			b.logger.Error("Failed to handle replayed event",
				zap.String("message_id", msg.ID),
				zap.Error(err))
		}
	}

	return nil
}

// GetStats returns event bus statistics
func (b *RedisEventBus) GetStats(ctx context.Context) (map[string]interface{}, error) {
	stats := make(map[string]interface{})

	// Get stream lengths for each event type
	eventTypes := []string{
		"connection.created",
		"connection.connected",
		"connection.disconnected",
		"connection.query_executed",
		"connection.failed",
		"connection.security",
		"connection.metrics",
	}

	for _, eventType := range eventTypes {
		streamKey := fmt.Sprintf("events:%s", eventType)
		length, err := b.client.XLen(ctx, streamKey).Result()
		if err != nil {
			b.logger.Error("Failed to get stream length",
				zap.String("stream", streamKey),
				zap.Error(err))
			continue
		}
		stats[fmt.Sprintf("stream_%s", eventType)] = length
	}

	// Get handler counts
	b.mutex.RLock()
	handlerCounts := make(map[string]int)
	for eventType, handlers := range b.handlers {
		handlerCounts[eventType] = len(handlers)
	}
	b.mutex.RUnlock()
	stats["handlers"] = handlerCounts

	return stats, nil
}
