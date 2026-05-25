package cqrs

import (
	"context"
	"errors"
	"reflect"
	"sync"
	"time"

	"go.uber.org/zap"
)

// Command represents a command in CQRS
type Command interface {
	// ID returns the unique identifier of the command
	ID() string
	// AggregateID returns the ID of the aggregate the command targets
	AggregateID() string
	// Validate validates the command
	Validate() error
}

// CommandHandler handles commands
type CommandHandler[C Command] interface {
	Handle(ctx context.Context, command C) error
	CanHandle(command Command) bool
}

// CommandBus dispatches commands to handlers
type CommandBus interface {
	// Dispatch dispatches a command to its handler
	Dispatch(ctx context.Context, command Command) error
	// Register registers a command handler
	Register(commandType string, handler CommandHandler[Command]) error
}

// InMemoryCommandBus implements CommandBus with in-memory registration
type InMemoryCommandBus struct {
	handlers map[string]CommandHandler[Command]
	logger   *zap.Logger
	mutex    sync.RWMutex
}

// NewInMemoryCommandBus creates a new in-memory command bus
func NewInMemoryCommandBus(logger *zap.Logger) *InMemoryCommandBus {
	return &InMemoryCommandBus{
		handlers: make(map[string]CommandHandler[Command]),
		logger:   logger,
	}
}

// Register registers a command handler
func (bus *InMemoryCommandBus) Register(commandType string, handler CommandHandler[Command]) error {
	bus.mutex.Lock()
	defer bus.mutex.Unlock()

	if _, exists := bus.handlers[commandType]; exists {
		return errors.New("handler already registered for command type: " + commandType)
	}

	bus.handlers[commandType] = handler
	bus.logger.Debug("Command handler registered",
		zap.String("command_type", commandType),
		zap.String("handler_type", reflect.TypeOf(handler).String()))

	return nil
}

// Dispatch dispatches a command to its handler
func (bus *InMemoryCommandBus) Dispatch(ctx context.Context, command Command) error {
	if command == nil {
		return errors.New("command cannot be nil")
	}

	if err := command.Validate(); err != nil {
		bus.logger.Error("Command validation failed",
			zap.String("command_id", command.ID()),
			zap.String("command_type", reflect.TypeOf(command).String()),
			zap.Error(err))
		return err
	}

	commandType := reflect.TypeOf(command).String()

	bus.mutex.RLock()
	handler, exists := bus.handlers[commandType]
	bus.mutex.RUnlock()

	if !exists {
		bus.logger.Error("No handler registered for command type",
			zap.String("command_id", command.ID()),
			zap.String("command_type", commandType))
		return errors.New("no handler registered for command type: " + commandType)
	}

	if !handler.CanHandle(command) {
		bus.logger.Error("Handler cannot handle command",
			zap.String("command_id", command.ID()),
			zap.String("command_type", commandType))
		return errors.New("handler cannot handle command: " + commandType)
	}

	bus.logger.Debug("Dispatching command",
		zap.String("command_id", command.ID()),
		zap.String("command_type", commandType),
		zap.String("aggregate_id", command.AggregateID()))

	return handler.Handle(ctx, command)
}

// CommandMiddleware allows for cross-cutting concerns
type CommandMiddleware interface {
	// Handle processes the command
	Handle(ctx context.Context, command Command, next CommandHandlerFunc) error
}

// CommandHandlerFunc is a function type for command handling
type CommandHandlerFunc func(ctx context.Context, command Command) error

// ValidationMiddleware adds command validation
type ValidationMiddleware struct {
	logger *zap.Logger
}

// NewValidationMiddleware creates a new validation middleware
func NewValidationMiddleware(logger *zap.Logger) *ValidationMiddleware {
	return &ValidationMiddleware{logger: logger}
}

// Handle implements CommandMiddleware
func (m *ValidationMiddleware) Handle(ctx context.Context, command Command, next CommandHandlerFunc) error {
	if err := command.Validate(); err != nil {
		m.logger.Error("Command validation failed in middleware",
			zap.String("command_id", command.ID()),
			zap.Error(err))
		return err
	}
	return next(ctx, command)
}

// LoggingMiddleware adds command logging
type LoggingMiddleware struct {
	logger *zap.Logger
}

// NewLoggingMiddleware creates a new logging middleware
func NewLoggingMiddleware(logger *zap.Logger) *LoggingMiddleware {
	return &LoggingMiddleware{logger: logger}
}

// Handle implements CommandMiddleware
func (m *LoggingMiddleware) Handle(ctx context.Context, command Command, next CommandHandlerFunc) error {
	start := time.Now()

	m.logger.Info("Command received",
		zap.String("command_id", command.ID()),
		zap.String("command_type", reflect.TypeOf(command).String()),
		zap.String("aggregate_id", command.AggregateID()))

	err := next(ctx, command)

	duration := time.Since(start)

	if err != nil {
		m.logger.Error("Command failed",
			zap.String("command_id", command.ID()),
			zap.Duration("duration", duration),
			zap.Error(err))
	} else {
		m.logger.Info("Command completed successfully",
			zap.String("command_id", command.ID()),
			zap.Duration("duration", duration))
	}

	return err
}

// CommandMetrics tracks command execution metrics
type CommandMetrics struct {
	CommandType string        `json:"command_type"`
	Count       int64         `json:"count"`
	SuccessCount int64        `json:"success_count"`
	ErrorCount  int64         `json:"error_count"`
	AvgDuration time.Duration `json:"avg_duration"`
	MinDuration time.Duration `json:"min_duration"`
	MaxDuration time.Duration `json:"max_duration"`
}

// MetricsMiddleware tracks command metrics
type MetricsMiddleware struct {
	logger  *zap.Logger
	metrics map[string]*CommandMetrics
	mutex   sync.RWMutex
}

// NewMetricsMiddleware creates a new metrics middleware
func NewMetricsMiddleware(logger *zap.Logger) *MetricsMiddleware {
	return &MetricsMiddleware{
		logger:  logger,
		metrics: make(map[string]*CommandMetrics),
	}
}

// Handle implements CommandMiddleware
func (m *MetricsMiddleware) Handle(ctx context.Context, command Command, next CommandHandlerFunc) error {
	start := time.Now()
	commandType := reflect.TypeOf(command).String()

	err := next(ctx, command)

	duration := time.Since(start)

	m.mutex.Lock()
	defer m.mutex.Unlock()

	metrics, exists := m.metrics[commandType]
	if !exists {
		metrics = &CommandMetrics{
			CommandType: commandType,
			MinDuration: duration,
			MaxDuration: duration,
		}
		m.metrics[commandType] = metrics
	}

	metrics.Count++
	if err == nil {
		metrics.SuccessCount++
	} else {
		metrics.ErrorCount++
	}

	// Update min/max duration
	if duration < metrics.MinDuration {
		metrics.MinDuration = duration
	}
	if duration > metrics.MaxDuration {
		metrics.MaxDuration = duration
	}

	// Update average duration
	totalDuration := metrics.AvgDuration * time.Duration(metrics.Count-1)
	metrics.AvgDuration = (totalDuration + duration) / time.Duration(metrics.Count)

	return err
}

// GetMetrics returns the collected metrics
func (m *MetricsMiddleware) GetMetrics() map[string]*CommandMetrics {
	m.mutex.RLock()
	defer m.mutex.RUnlock()

	result := make(map[string]*CommandMetrics)
	for k, v := range m.metrics {
		result[k] = &CommandMetrics{
			CommandType:  v.CommandType,
			Count:        v.Count,
			SuccessCount: v.SuccessCount,
			ErrorCount:   v.ErrorCount,
			AvgDuration:  v.AvgDuration,
			MinDuration:  v.MinDuration,
			MaxDuration:  v.MaxDuration,
		}
	}

	return result
}