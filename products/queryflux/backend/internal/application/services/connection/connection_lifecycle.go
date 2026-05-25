package connection

import (
	"context"
	"fmt"
	"sync"
	"time"

	"go.uber.org/zap"
)

// LifecycleState represents the state of a connection in its lifecycle
type LifecycleState string

const (
	StateInitializing LifecycleState = "initializing"
	StateActive       LifecycleState = "active"
	StateIdle         LifecycleState = "idle"
	StateDraining     LifecycleState = "draining"
	StateMaintenance  LifecycleState = "maintenance"
	StateClosing      LifecycleState = "closing"
	StateClosed       LifecycleState = "closed"
	StateError        LifecycleState = "error"
)

// LifecycleEvent represents a lifecycle event
type LifecycleEvent struct {
	ID           string                 `json:"id"`
	ConnectionID string                 `json:"connection_id"`
	StateFrom    LifecycleState         `json:"state_from"`
	StateTo      LifecycleState         `json:"state_to"`
	Timestamp    time.Time              `json:"timestamp"`
	Reason       string                 `json:"reason"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
}

// LifecycleConfig represents lifecycle management configuration
type LifecycleConfig struct {
	IdleTimeout             time.Duration `json:"idle_timeout"`
	MaxLifetime             time.Duration `json:"max_lifetime"`
	HealthCheckInterval     time.Duration `json:"health_check_interval"`
	MaintenanceInterval     time.Duration `json:"maintenance_interval"`
	GracefulShutdownTimeout time.Duration `json:"graceful_shutdown_timeout"`
	AutoRecovery            bool          `json:"auto_recovery"`
	MaxRecoveryAttempts     int           `json:"max_recovery_attempts"`
	RecoveryDelay           time.Duration `json:"recovery_delay"`
	EnableLifecycleMetrics  bool          `json:"enable_lifecycle_metrics"`
}

// LifecycleManager manages connection lifecycle
type LifecycleManager struct {
	connections      map[string]*ConnectionLifecycle
	config           LifecycleConfig
	logger           *zap.Logger
	mu               sync.RWMutex
	ctx              context.Context
	cancel           context.CancelFunc
	eventChan        chan LifecycleEvent
	metrics          *LifecycleMetrics
	stateTransitions map[LifecycleState][]LifecycleState
}

// ConnectionLifecycle tracks the lifecycle of a single connection
type ConnectionLifecycle struct {
	ID               string
	Connection       *PooledConnection
	CurrentState     LifecycleState
	PreviousState    LifecycleState
	CreatedAt        time.Time
	LastActivity     time.Time
	LastHealthCheck  time.Time
	HealthScore      float64
	ErrorCount       int
	RecoveryAttempts int
	StateHistory     []LifecycleEvent
	mu               sync.RWMutex
}

// LifecycleMetrics tracks lifecycle statistics
type LifecycleMetrics struct {
	TotalConnections      int64            `json:"total_connections"`
	ActiveConnections     int64            `json:"active_connections"`
	IdleConnections       int64            `json:"idle_connections"`
	ClosedConnections     int64            `json:"closed_connections"`
	ErrorConnections      int64            `json:"error_connections"`
	StateTransitions      map[string]int64 `json:"state_transitions"`
	AvgConnectionLifetime time.Duration    `json:"avg_connection_lifetime"`
	TotalRecoveryAttempts int64            `json:"total_recovery_attempts"`
	SuccessfulRecoveries  int64            `json:"successful_recoveries"`
	FailedRecoveries      int64            `json:"failed_recoveries"`
	LastMaintenanceRun    time.Time        `json:"last_maintenance_run"`
	HealthCheckCount      int64            `json:"health_check_count"`
	HealthCheckFailures   int64            `json:"health_check_failures"`
}

// NewLifecycleManager creates a new lifecycle manager
func NewLifecycleManager(config LifecycleConfig, logger *zap.Logger) *LifecycleManager {
	ctx, cancel := context.WithCancel(context.Background())

	lm := &LifecycleManager{
		connections: make(map[string]*ConnectionLifecycle),
		config:      config,
		logger:      logger,
		ctx:         ctx,
		cancel:      cancel,
		eventChan:   make(chan LifecycleEvent, 1000),
		metrics: &LifecycleMetrics{
			StateTransitions: make(map[string]int64),
		},
		stateTransitions: map[LifecycleState][]LifecycleState{
			StateInitializing: {StateActive, StateError, StateClosed},
			StateActive:       {StateIdle, StateMaintenance, StateDraining, StateError, StateClosed},
			StateIdle:         {StateActive, StateMaintenance, StateDraining, StateClosed},
			StateMaintenance:  {StateActive, StateError, StateClosed},
			StateDraining:     {StateClosed, StateError},
			StateClosing:      {StateClosed, StateError},
			StateError:        {StateActive, StateMaintenance, StateClosed},
			StateClosed:       {}, // Terminal state
		},
	}

	return lm
}

// Start starts the lifecycle manager
func (lm *LifecycleManager) Start() error {
	lm.logger.Info("Starting connection lifecycle manager")

	// Start background processes
	go lm.eventProcessor()
	go lm.lifecycleMonitor()
	go lm.maintenanceScheduler()

	return nil
}

// Stop stops the lifecycle manager
func (lm *LifecycleManager) Stop() error {
	lm.cancel()
	close(lm.eventChan)

	lm.logger.Info("Connection lifecycle manager stopped")
	return nil
}

// RegisterConnection registers a connection for lifecycle management
func (lm *LifecycleManager) RegisterConnection(conn *PooledConnection) error {
	lm.mu.Lock()
	defer lm.mu.Unlock()

	if _, exists := lm.connections[conn.ID]; exists {
		return fmt.Errorf("connection %s already registered", conn.ID)
	}

	lifecycle := &ConnectionLifecycle{
		ID:              conn.ID,
		Connection:      conn,
		CurrentState:    StateInitializing,
		CreatedAt:       time.Now(),
		LastActivity:    time.Now(),
		LastHealthCheck: time.Now(),
		HealthScore:     100.0,
		StateHistory:    make([]LifecycleEvent, 0),
	}

	lm.connections[conn.ID] = lifecycle

	// Emit initial state transition event
	lm.emitEvent(lifecycle, StateInitializing, "connection_registered")

	// Transition to active state
	lm.transitionState(lifecycle, StateActive, "initialization_complete")

	lm.metrics.TotalConnections++
	lm.metrics.ActiveConnections++

	lm.logger.Info("Connection registered for lifecycle management",
		zap.String("connection_id", conn.ID),
		zap.String("database_type", conn.Config.Type))

	return nil
}

// UnregisterConnection unregisters a connection from lifecycle management
func (lm *LifecycleManager) UnregisterConnection(connectionID string) error {
	lm.mu.Lock()
	defer lm.mu.Unlock()

	lifecycle, exists := lm.connections[connectionID]
	if !exists {
		return fmt.Errorf("connection %s not found", connectionID)
	}

	// Transition to closing then closed
	lm.transitionState(lifecycle, StateClosing, "unregister_requested")
	lm.transitionState(lifecycle, StateClosed, "connection_closed")

	delete(lm.connections, connectionID)

	lm.metrics.ActiveConnections--
	lm.metrics.ClosedConnections++

	lm.logger.Info("Connection unregistered from lifecycle management",
		zap.String("connection_id", connectionID))

	return nil
}

// UpdateActivity updates the last activity time for a connection
func (lm *LifecycleManager) UpdateActivity(connectionID string) error {
	lm.mu.RLock()
	lifecycle, exists := lm.connections[connectionID]
	lm.mu.RUnlock()

	if !exists {
		return fmt.Errorf("connection %s not found", connectionID)
	}

	lifecycle.mu.Lock()
	defer lifecycle.mu.Unlock()

	lifecycle.LastActivity = time.Now()

	// Transition from idle to active if needed
	if lifecycle.CurrentState == StateIdle {
		lm.emitEventUnsafe(lifecycle, lifecycle.CurrentState, StateActive, "activity_detected")
		lifecycle.CurrentState = StateActive
	}

	return nil
}

// RecordError records an error for a connection
func (lm *LifecycleManager) RecordError(connectionID string, err error) {
	lm.mu.RLock()
	lifecycle, exists := lm.connections[connectionID]
	lm.mu.RUnlock()

	if !exists {
		return
	}

	lifecycle.mu.Lock()
	defer lifecycle.mu.Unlock()

	lifecycle.ErrorCount++

	// Transition to error state if error threshold exceeded
	if lifecycle.ErrorCount >= 3 && lifecycle.CurrentState != StateError {
		lm.emitEventUnsafe(lifecycle, lifecycle.CurrentState, StateError, fmt.Sprintf("error_threshold_exceeded: %v", err))
		lifecycle.CurrentState = StateError
	}

	lm.logger.Warn("Connection error recorded",
		zap.String("connection_id", connectionID),
		zap.Int("error_count", lifecycle.ErrorCount),
		zap.Error(err))
}

// transitionState transitions a connection to a new state
func (lm *LifecycleManager) transitionState(lifecycle *ConnectionLifecycle, newState LifecycleState, reason string) error {
	lifecycle.mu.Lock()
	defer lifecycle.mu.Unlock()

	// Check if transition is valid
	validStates, exists := lm.stateTransitions[lifecycle.CurrentState]
	if !exists {
		return fmt.Errorf("invalid current state: %s", lifecycle.CurrentState)
	}

	// Check if new state is valid
	valid := false
	for _, state := range validStates {
		if state == newState {
			valid = true
			break
		}
	}

	if !valid {
		return fmt.Errorf("invalid state transition from %s to %s", lifecycle.CurrentState, newState)
	}

	lm.emitEventUnsafe(lifecycle, lifecycle.CurrentState, newState, reason)

	lifecycle.PreviousState = lifecycle.CurrentState
	lifecycle.CurrentState = newState

	return nil
}

// emitEvent emits a lifecycle event
func (lm *LifecycleManager) emitEvent(lifecycle *ConnectionLifecycle, newState LifecycleState, reason string) {
	lifecycle.mu.Lock()
	defer lifecycle.mu.Unlock()

	lm.emitEventUnsafe(lifecycle, lifecycle.CurrentState, newState, reason)
}

// emitEventUnsafe emits an event without acquiring locks (internal use)
func (lm *LifecycleManager) emitEventUnsafe(lifecycle *ConnectionLifecycle, fromState, toState LifecycleState, reason string) {
	event := LifecycleEvent{
		ID:           fmt.Sprintf("lifecycle_%d_%s", time.Now().UnixNano(), lifecycle.ID),
		ConnectionID: lifecycle.ID,
		StateFrom:    fromState,
		StateTo:      toState,
		Timestamp:    time.Now(),
		Reason:       reason,
		Metadata:     make(map[string]interface{}),
	}

	// Add metadata
	event.Metadata["health_score"] = lifecycle.HealthScore
	event.Metadata["error_count"] = lifecycle.ErrorCount
	event.Metadata["connection_age"] = time.Since(lifecycle.CreatedAt)

	// Add to history
	lifecycle.StateHistory = append(lifecycle.StateHistory, event)

	// Keep only last 100 events in history
	if len(lifecycle.StateHistory) > 100 {
		lifecycle.StateHistory = lifecycle.StateHistory[1:]
	}

	// Send to event channel (non-blocking)
	select {
	case lm.eventChan <- event:
	default:
		lm.logger.Warn("Event channel full, dropping lifecycle event",
			zap.String("connection_id", lifecycle.ID))
	}

	// Update metrics
	transitionKey := fmt.Sprintf("%s->%s", fromState, toState)
	lm.metrics.StateTransitions[transitionKey]++
}

// eventProcessor processes lifecycle events
func (lm *LifecycleManager) eventProcessor() {
	for {
		select {
		case <-lm.ctx.Done():
			return
		case event := <-lm.eventChan:
			lm.processEvent(event)
		}
	}
}

// processEvent processes a single lifecycle event
func (lm *LifecycleManager) processEvent(event LifecycleEvent) {
	lm.logger.Debug("Processing lifecycle event",
		zap.String("event_id", event.ID),
		zap.String("connection_id", event.ConnectionID),
		zap.String("transition", fmt.Sprintf("%s->%s", event.StateFrom, event.StateTo)),
		zap.String("reason", event.Reason))

	// Handle specific state transitions
	switch event.StateTo {
	case StateError:
		if lm.config.AutoRecovery {
			go lm.attemptRecovery(event.ConnectionID)
		}
	case StateIdle:
		// Schedule connection for potential cleanup
		go lm.scheduleIdleCheck(event.ConnectionID)
	case StateClosed:
		// Perform cleanup tasks
		go lm.cleanupConnection(event.ConnectionID)
	}
}

// lifecycleMonitor monitors connection lifecycles
func (lm *LifecycleManager) lifecycleMonitor() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-lm.ctx.Done():
			return
		case <-ticker.C:
			lm.performHealthChecks()
			lm.checkConnectionAges()
			lm.updateMetrics()
		}
	}
}

// performHealthChecks performs health checks on all connections
func (lm *LifecycleManager) performHealthChecks() {
	lm.mu.RLock()
	connections := make([]*ConnectionLifecycle, 0, len(lm.connections))
	for _, lifecycle := range lm.connections {
		connections = append(connections, lifecycle)
	}
	lm.mu.RUnlock()

	var wg sync.WaitGroup
	for _, lifecycle := range connections {
		wg.Add(1)
		go func(lc *ConnectionLifecycle) {
			defer wg.Done()
			lm.checkConnectionHealth(lc)
		}(lifecycle)
	}

	wg.Wait()
}

// checkConnectionHealth checks the health of a single connection
func (lm *LifecycleManager) checkConnectionHealth(lifecycle *ConnectionLifecycle) {
	lifecycle.mu.Lock()
	defer lifecycle.mu.Unlock()

	now := time.Now()
	lifecycle.LastHealthCheck = now

	// Perform actual health check using the connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err := lifecycle.Connection.DB.PingContext(ctx)
	if err != nil {
		lifecycle.HealthScore -= 10
		lm.metrics.HealthCheckFailures++

		// Transition to error state if health score is too low
		if lifecycle.HealthScore < 50 && lifecycle.CurrentState != StateError {
			lm.emitEventUnsafe(lifecycle, lifecycle.CurrentState, StateError, fmt.Sprintf("health_check_failed: %v", err))
			lifecycle.CurrentState = StateError
		}
	} else {
		// Recover health score gradually
		if lifecycle.HealthScore < 100 {
			lifecycle.HealthScore += 5
		}

		// Recover from error state if health is good
		if lifecycle.CurrentState == StateError && lifecycle.HealthScore > 80 {
			lm.emitEventUnsafe(lifecycle, StateError, StateActive, "health_recovered")
			lifecycle.CurrentState = StateActive
		}
	}

	lm.metrics.HealthCheckCount++
}

// checkConnectionAges checks for connections that exceed their maximum lifetime
func (lm *LifecycleManager) checkConnectionAges() {
	lm.mu.RLock()
	defer lm.mu.RUnlock()

	for _, lifecycle := range lm.connections {
		lifecycle.mu.Lock()
		age := time.Since(lifecycle.CreatedAt)

		// Check for maximum lifetime
		if lm.config.MaxLifetime > 0 && age > lm.config.MaxLifetime {
			lm.logger.Info("Connection exceeded maximum lifetime",
				zap.String("connection_id", lifecycle.ID),
				zap.Duration("age", age),
				zap.Duration("max_lifetime", lm.config.MaxLifetime))

			if lifecycle.CurrentState == StateActive {
				lm.emitEventUnsafe(lifecycle, StateActive, StateDraining, "max_lifetime_exceeded")
				lifecycle.CurrentState = StateDraining
			}
		}

		// Check for idle timeout
		if lm.config.IdleTimeout > 0 && time.Since(lifecycle.LastActivity) > lm.config.IdleTimeout {
			if lifecycle.CurrentState == StateActive {
				lm.emitEventUnsafe(lifecycle, StateActive, StateIdle, "idle_timeout")
				lifecycle.CurrentState = StateIdle
			}
		}

		lifecycle.mu.Unlock()
	}
}

// attemptRecovery attempts to recover a connection from error state
func (lm *LifecycleManager) attemptRecovery(connectionID string) {
	lm.mu.RLock()
	lifecycle, exists := lm.connections[connectionID]
	lm.mu.RUnlock()

	if !exists {
		return
	}

	lifecycle.mu.Lock()
	if lifecycle.CurrentState != StateError {
		lifecycle.mu.Unlock()
		return
	}

	if lifecycle.RecoveryAttempts >= lm.config.MaxRecoveryAttempts {
		lm.logger.Warn("Maximum recovery attempts exceeded",
			zap.String("connection_id", connectionID),
			zap.Int("attempts", lifecycle.RecoveryAttempts))
		lifecycle.mu.Unlock()
		return
	}

	lifecycle.RecoveryAttempts++
	lm.metrics.TotalRecoveryAttempts++

	lm.logger.Info("Attempting connection recovery",
		zap.String("connection_id", connectionID),
		zap.Int("attempt", lifecycle.RecoveryAttempts))

	lifecycle.mu.Unlock()

	// Wait before recovery attempt
	time.Sleep(lm.config.RecoveryDelay)

	// Attempt recovery by reconnecting
	err := lm.recoverConnection(lifecycle)
	if err != nil {
		lm.logger.Error("Connection recovery failed",
			zap.String("connection_id", connectionID),
			zap.Error(err))
		lm.metrics.FailedRecoveries++
	} else {
		lm.logger.Info("Connection recovery successful",
			zap.String("connection_id", connectionID))
		lm.metrics.SuccessfulRecoveries++

		// Reset error count and recovery attempts
		lifecycle.mu.Lock()
		lifecycle.ErrorCount = 0
		lifecycle.RecoveryAttempts = 0
		lifecycle.HealthScore = 100.0
		lm.emitEventUnsafe(lifecycle, StateError, StateActive, "recovery_successful")
		lifecycle.CurrentState = StateActive
		lifecycle.mu.Unlock()
	}
}

// recoverConnection attempts to recover a connection
func (lm *LifecycleManager) recoverConnection(lifecycle *ConnectionLifecycle) error {
	// This would implement actual recovery logic
	// For now, just simulate recovery
	time.Sleep(100 * time.Millisecond)
	return nil
}

// scheduleIdleCheck schedules an idle check for a connection
func (lm *LifecycleManager) scheduleIdleCheck(connectionID string) {
	time.Sleep(lm.config.IdleTimeout)

	lm.mu.RLock()
	lifecycle, exists := lm.connections[connectionID]
	lm.mu.RUnlock()

	if !exists {
		return
	}

	lifecycle.mu.Lock()
	defer lifecycle.mu.Unlock()

	// Check if connection is still idle
	if lifecycle.CurrentState == StateIdle &&
		time.Since(lifecycle.LastActivity) > lm.config.IdleTimeout {

		lm.logger.Info("Closing idle connection",
			zap.String("connection_id", connectionID),
			zap.Duration("idle_time", time.Since(lifecycle.LastActivity)))

		lm.emitEventUnsafe(lifecycle, StateIdle, StateClosing, "idle_cleanup")
		lifecycle.CurrentState = StateClosing
	}
}

// cleanupConnection performs cleanup for a closed connection
func (lm *LifecycleManager) cleanupConnection(connectionID string) {
	lm.mu.RLock()
	lifecycle, exists := lm.connections[connectionID]
	lm.mu.RUnlock()

	if !exists {
		return
	}

	lm.logger.Info("Performing connection cleanup",
		zap.String("connection_id", connectionID))

	// Perform cleanup tasks
	if lifecycle.Connection != nil && lifecycle.Connection.DB != nil {
		lifecycle.Connection.DB.Close()
	}

	// Update metrics
	lm.metrics.ActiveConnections--
	lm.metrics.ClosedConnections++
}

// maintenanceScheduler runs periodic maintenance tasks
func (lm *LifecycleManager) maintenanceScheduler() {
	if lm.config.MaintenanceInterval == 0 {
		return
	}

	ticker := time.NewTicker(lm.config.MaintenanceInterval)
	defer ticker.Stop()

	for {
		select {
		case <-lm.ctx.Done():
			return
		case <-ticker.C:
			lm.performMaintenance()
		}
	}
}

// performMaintenance performs maintenance tasks
func (lm *LifecycleManager) performMaintenance() {
	lm.logger.Info("Performing lifecycle maintenance")

	lm.mu.RLock()
	defer lm.mu.RUnlock()

	for _, lifecycle := range lm.connections {
		lifecycle.mu.Lock()

		// Transition to maintenance state if currently active
		if lifecycle.CurrentState == StateActive {
			lm.emitEventUnsafe(lifecycle, StateActive, StateMaintenance, "scheduled_maintenance")
			lifecycle.CurrentState = StateMaintenance
		}

		lifecycle.mu.Unlock()
	}

	lm.metrics.LastMaintenanceRun = time.Now()

	// Simulate maintenance work
	time.Sleep(5 * time.Second)

	// Return connections to active state
	for _, lifecycle := range lm.connections {
		lifecycle.mu.Lock()
		if lifecycle.CurrentState == StateMaintenance {
			lm.emitEventUnsafe(lifecycle, StateMaintenance, StateActive, "maintenance_complete")
			lifecycle.CurrentState = StateActive
		}
		lifecycle.mu.Unlock()
	}

	lm.logger.Info("Lifecycle maintenance completed")
}

// updateMetrics updates lifecycle metrics
func (lm *LifecycleManager) updateMetrics() {
	lm.mu.RLock()
	defer lm.mu.RUnlock()

	// Reset counts
	lm.metrics.ActiveConnections = 0
	lm.metrics.IdleConnections = 0
	lm.metrics.ErrorConnections = 0

	var totalLifetime time.Duration
	var connectionCount int

	for _, lifecycle := range lm.connections {
		lifecycle.mu.RLock()

		switch lifecycle.CurrentState {
		case StateActive:
			lm.metrics.ActiveConnections++
		case StateIdle:
			lm.metrics.IdleConnections++
		case StateError:
			lm.metrics.ErrorConnections++
		}

		totalLifetime += time.Since(lifecycle.CreatedAt)
		connectionCount++

		lifecycle.mu.RUnlock()
	}

	// Calculate average connection lifetime
	if connectionCount > 0 {
		lm.metrics.AvgConnectionLifetime = totalLifetime / time.Duration(connectionCount)
	}
}

// GetMetrics returns current lifecycle metrics
func (lm *LifecycleManager) GetMetrics() LifecycleMetrics {
	lm.mu.RLock()
	defer lm.mu.RUnlock()

	return *lm.metrics
}

// GetConnectionLifecycle returns lifecycle information for a connection
func (lm *LifecycleManager) GetConnectionLifecycle(connectionID string) (*ConnectionLifecycle, error) {
	lm.mu.RLock()
	defer lm.mu.RUnlock()

	lifecycle, exists := lm.connections[connectionID]
	if !exists {
		return nil, fmt.Errorf("connection %s not found", connectionID)
	}

	// Return a copy to avoid race conditions
	lifecycle.mu.RLock()
	lifecycleCopy := &ConnectionLifecycle{
		ID:               lifecycle.ID,
		CurrentState:     lifecycle.CurrentState,
		PreviousState:    lifecycle.PreviousState,
		CreatedAt:        lifecycle.CreatedAt,
		LastActivity:     lifecycle.LastActivity,
		LastHealthCheck:  lifecycle.LastHealthCheck,
		HealthScore:      lifecycle.HealthScore,
		ErrorCount:       lifecycle.ErrorCount,
		RecoveryAttempts: lifecycle.RecoveryAttempts,
		StateHistory:     make([]LifecycleEvent, len(lifecycle.StateHistory)),
	}
	for i, event := range lifecycle.StateHistory {
		lifecycleCopy.StateHistory[i] = event
	}
	lifecycle.mu.RUnlock()

	return lifecycleCopy, nil
}

// GetAllConnectionLifecycles returns lifecycle information for all connections
func (lm *LifecycleManager) GetAllConnectionLifecycles() map[string]*ConnectionLifecycle {
	lm.mu.RLock()
	defer lm.mu.RUnlock()

	result := make(map[string]*ConnectionLifecycle)
	for id, lifecycle := range lm.connections {
		lifecycle.mu.RLock()
		lifecycleCopy := &ConnectionLifecycle{
			ID:               lifecycle.ID,
			CurrentState:     lifecycle.CurrentState,
			PreviousState:    lifecycle.PreviousState,
			CreatedAt:        lifecycle.CreatedAt,
			LastActivity:     lifecycle.LastActivity,
			LastHealthCheck:  lifecycle.LastHealthCheck,
			HealthScore:      lifecycle.HealthScore,
			ErrorCount:       lifecycle.ErrorCount,
			RecoveryAttempts: lifecycle.RecoveryAttempts,
			StateHistory:     make([]LifecycleEvent, len(lifecycle.StateHistory)),
		}
		for i, event := range lifecycle.StateHistory {
			lifecycleCopy.StateHistory[i] = event
		}
		lifecycle.mu.RUnlock()
		result[id] = lifecycleCopy
	}

	return result
}
