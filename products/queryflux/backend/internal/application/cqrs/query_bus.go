package cqrs

import (
	"context"
	"errors"
	"reflect"
	"sync"
	"time"

	"go.uber.org/zap"
)

// Query represents a query in CQRS
type Query interface {
	// ID returns the unique identifier of the query
	ID() string
	// Validate validates the query
	Validate() error
}

// QueryResult represents the result of a query
type QueryResult interface {
	// IsValid returns true if the result is valid
	IsValid() bool
}

// QueryHandler handles queries
type QueryHandler[Q Query, R QueryResult] interface {
	Handle(ctx context.Context, query Q) (R, error)
	CanHandle(query Query) bool
}

// QueryBus dispatches queries to handlers
type QueryBus interface {
	// Query dispatches a query to its handler
	Query(ctx context.Context, query Query) (QueryResult, error)
	// Register registers a query handler
	Register(queryType string, handler interface{}) error
}

// InMemoryQueryBus implements QueryBus with in-memory registration
type InMemoryQueryBus struct {
	handlers map[string]interface{}
	logger   *zap.Logger
	mutex    sync.RWMutex
}

// NewInMemoryQueryBus creates a new in-memory query bus
func NewInMemoryQueryBus(logger *zap.Logger) *InMemoryQueryBus {
	return &InMemoryQueryBus{
		handlers: make(map[string]interface{}),
		logger:   logger,
	}
}

// Register registers a query handler
func (bus *InMemoryQueryBus) Register(queryType string, handler interface{}) error {
	bus.mutex.Lock()
	defer bus.mutex.Unlock()

	if _, exists := bus.handlers[queryType]; exists {
		return errors.New("handler already registered for query type: " + queryType)
	}

	bus.handlers[queryType] = handler
	bus.logger.Debug("Query handler registered",
		zap.String("query_type", queryType),
		zap.String("handler_type", reflect.TypeOf(handler).String()))

	return nil
}

// Query dispatches a query to its handler
func (bus *InMemoryQueryBus) Query(ctx context.Context, query Query) (QueryResult, error) {
	if query == nil {
		return nil, errors.New("query cannot be nil")
	}

	if err := query.Validate(); err != nil {
		bus.logger.Error("Query validation failed",
			zap.String("query_id", query.ID()),
			zap.String("query_type", reflect.TypeOf(query).String()),
			zap.Error(err))
		return nil, err
	}

	queryType := reflect.TypeOf(query).String()

	bus.mutex.RLock()
	handler, exists := bus.handlers[queryType]
	bus.mutex.RUnlock()

	if !exists {
		bus.logger.Error("No handler registered for query type",
			zap.String("query_id", query.ID()),
			zap.String("query_type", queryType))
		return nil, errors.New("no handler registered for query type: " + queryType)
	}

	// Use reflection to call the handler
	handlerValue := reflect.ValueOf(handler)
	handleMethod := handlerValue.MethodByName("Handle")
	if !handleMethod.IsValid() {
		return nil, errors.New("handler does not have Handle method")
	}

	bus.logger.Debug("Executing query",
		zap.String("query_id", query.ID()),
		zap.String("query_type", queryType))

	// Call Handle method with reflection
	results := handleMethod.Call([]reflect.Value{
		reflect.ValueOf(ctx),
		reflect.ValueOf(query),
	})

	if len(results) != 2 {
		return nil, errors.New("handler Handle method should return 2 values")
	}

	result := results[0].Interface()
	err, _ := results[1].Interface().(error)

	if err != nil {
		return nil, err
	}

	queryResult, ok := result.(QueryResult)
	if !ok {
		return nil, errors.New("handler did not return a QueryResult")
	}

	return queryResult, nil
}

// QueryMiddleware allows for cross-cutting concerns
type QueryMiddleware interface {
	// Handle processes the query
	Handle(ctx context.Context, query Query, next QueryHandlerFunc) (QueryResult, error)
}

// QueryHandlerFunc is a function type for query handling
type QueryHandlerFunc func(ctx context.Context, query Query) (QueryResult, error)

// CacheMiddleware provides caching for query results
type CacheMiddleware struct {
	logger *zap.Logger
	cache  map[string]CacheEntry
	ttl    time.Duration
	mutex  sync.RWMutex
}

// CacheEntry represents a cached query result
type CacheEntry struct {
	Result    QueryResult
	ExpiresAt time.Time
}

// NewCacheMiddleware creates a new cache middleware
func NewCacheMiddleware(logger *zap.Logger, ttl time.Duration) *CacheMiddleware {
	return &CacheMiddleware{
		logger: logger,
		cache:  make(map[string]CacheEntry),
		ttl:    ttl,
	}
}

// Handle implements QueryMiddleware
func (m *CacheMiddleware) Handle(ctx context.Context, query Query, next QueryHandlerFunc) (QueryResult, error) {
	cacheKey := generateCacheKey(query)

	// Check cache
	m.mutex.RLock()
	if entry, exists := m.cache[cacheKey]; exists && time.Now().Before(entry.ExpiresAt) {
		m.mutex.RUnlock()
		m.logger.Debug("Cache hit", zap.String("query_id", query.ID()))
		return entry.Result, nil
	}
	m.mutex.RUnlock()

	// Execute query
	result, err := next(ctx, query)
	if err != nil {
		return nil, err
	}

	// Cache result
	m.mutex.Lock()
	m.cache[cacheKey] = CacheEntry{
		Result:    result,
		ExpiresAt: time.Now().Add(m.ttl),
	}
	m.mutex.Unlock()

	m.logger.Debug("Cached query result", zap.String("query_id", query.ID()))
	return result, nil
}

// generateCacheKey generates a cache key for a query
func generateCacheKey(query Query) string {
	queryType := reflect.TypeOf(query).String()
	return queryType + ":" + query.ID()
}

// ReadOnlyMiddleware ensures queries are read-only
type ReadOnlyMiddleware struct {
	logger *zap.Logger
}

// NewReadOnlyMiddleware creates a new read-only middleware
func NewReadOnlyMiddleware(logger *zap.Logger) *ReadOnlyMiddleware {
	return &ReadOnlyMiddleware{logger: logger}
}

// Handle implements QueryMiddleware
func (m *ReadOnlyMiddleware) Handle(ctx context.Context, query Query, next QueryHandlerFunc) (QueryResult, error) {
	start := time.Now()

	m.logger.Debug("Executing read-only query",
		zap.String("query_id", query.ID()),
		zap.String("query_type", reflect.TypeOf(query).String()))

	result, err := next(ctx, query)

	duration := time.Since(start)

	if err != nil {
		m.logger.Error("Query failed",
			zap.String("query_id", query.ID()),
			zap.Duration("duration", duration),
			zap.Error(err))
	} else {
		m.logger.Debug("Query completed successfully",
			zap.String("query_id", query.ID()),
			zap.Duration("duration", duration))
	}

	return result, err
}

// QueryMetrics tracks query execution metrics
type QueryMetrics struct {
	QueryType    string        `json:"query_type"`
	Count        int64         `json:"count"`
	SuccessCount int64         `json:"success_count"`
	ErrorCount   int64         `json:"error_count"`
	AvgDuration  time.Duration `json:"avg_duration"`
	MinDuration  time.Duration `json:"min_duration"`
	MaxDuration  time.Duration `json:"max_duration"`
	CacheHitRate float64       `json:"cache_hit_rate"`
}

// QueryMetricsMiddleware tracks query metrics
type QueryMetricsMiddleware struct {
	logger      *zap.Logger
	metrics     map[string]*QueryMetrics
	cacheHits   int64
	cacheMisses int64
	mutex       sync.RWMutex
}

// NewQueryMetricsMiddleware creates a new query metrics middleware
func NewQueryMetricsMiddleware(logger *zap.Logger) *QueryMetricsMiddleware {
	return &QueryMetricsMiddleware{
		logger:    logger,
		metrics:   make(map[string]*QueryMetrics),
	}
}

// Handle implements QueryMiddleware
func (m *QueryMetricsMiddleware) Handle(ctx context.Context, query Query, next QueryHandlerFunc) (QueryResult, error) {
	start := time.Now()
	queryType := reflect.TypeOf(query).String()

	result, err := next(ctx, query)

	duration := time.Since(start)

	m.mutex.Lock()
	defer m.mutex.Unlock()

	metrics, exists := m.metrics[queryType]
	if !exists {
		metrics = &QueryMetrics{
			QueryType:   queryType,
			MinDuration: duration,
			MaxDuration: duration,
		}
		m.metrics[queryType] = metrics
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

	// Calculate cache hit rate
	total := m.cacheHits + m.cacheMisses
	if total > 0 {
		metrics.CacheHitRate = float64(m.cacheHits) / float64(total)
	}

	return result, err
}

// IncrementCacheHit increments cache hit counter
func (m *QueryMetricsMiddleware) IncrementCacheHit() {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	m.cacheHits++
}

// IncrementCacheMiss increments cache miss counter
func (m *QueryMetricsMiddleware) IncrementCacheMiss() {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	m.cacheMisses++
}

// GetMetrics returns the collected metrics
func (m *QueryMetricsMiddleware) GetMetrics() map[string]*QueryMetrics {
	m.mutex.RLock()
	defer m.mutex.RUnlock()

	result := make(map[string]*QueryMetrics)
	for k, v := range m.metrics {
		result[k] = &QueryMetrics{
			QueryType:    v.QueryType,
			Count:        v.Count,
			SuccessCount: v.SuccessCount,
			ErrorCount:   v.ErrorCount,
			AvgDuration:  v.AvgDuration,
			MinDuration:  v.MinDuration,
			MaxDuration:  v.MaxDuration,
			CacheHitRate: v.CacheHitRate,
		}
	}

	return result
}