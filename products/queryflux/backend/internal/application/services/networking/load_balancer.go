package networking

import (
	"fmt"
	"sync"
	"time"

	"github.com/queryflux/backend/internal/application/services/connection"
	"go.uber.org/zap"
)

// LoadBalancer manages load balancing across database connections
type LoadBalancer struct {
	config       LoadBalancingConfig
	connections  []*ConnectionInfo
	logger       *zap.Logger
	mu           sync.RWMutex
	currentIndex int64                   // For round-robin
	sessionMap   map[string]*SessionInfo // For sticky sessions
	metrics      *LoadBalancerMetrics
}

// ConnectionInfo holds information about a connection for load balancing
type ConnectionInfo struct {
	ID              string
	Pool            *connection.ConnectionPool
	Weight          int
	ResponseTime    time.Duration
	ConnectionCount int64
	ErrorCount      int64
	ErrorRate       float64
	Location        string
	IsActive        bool
	LastUsed        time.Time
}

// SessionInfo holds session information for sticky sessions
type SessionInfo struct {
	SessionID    string
	ConnectionID string
	LastActivity time.Time
	ExpiresAt    time.Time
}

// LoadBalancerMetrics tracks load balancing statistics
type LoadBalancerMetrics struct {
	TotalRequests         int64              `json:"total_requests"`
	RequestsPerConnection map[string]int64   `json:"requests_per_connection"`
	AvgResponseTime       time.Duration      `json:"avg_response_time"`
	ConnectionUtilization map[string]float64 `json:"connection_utilization"`
	ErrorRate             float64            `json:"error_rate"`
	SessionAffinityHits   int64              `json:"session_affinity_hits"`
	SessionAffinityMisses int64              `json:"session_affinity_misses"`
	LastDistribution      map[string]int64   `json:"last_distribution"`
	BalanceScore          float64            `json:"balance_score"`
}

// NewLoadBalancer creates a new load balancer
func NewLoadBalancer(config LoadBalancingConfig, logger *zap.Logger) *LoadBalancer {
	return &LoadBalancer{
		config:      config,
		connections: make([]*ConnectionInfo, 0),
		logger:      logger,
		sessionMap:  make(map[string]*SessionInfo),
		metrics: &LoadBalancerMetrics{
			RequestsPerConnection: make(map[string]int64),
			ConnectionUtilization: make(map[string]float64),
			LastDistribution:      make(map[string]int64),
		},
	}
}

// AddConnection adds a connection to the load balancer
func (lb *LoadBalancer) AddConnection(id string, pool *connection.ConnectionPool, weight int, location string) error {
	lb.mu.Lock()
	defer lb.mu.Unlock()

	// Check if connection already exists
	for _, conn := range lb.connections {
		if conn.ID == id {
			return fmt.Errorf("connection %s already exists", id)
		}
	}

	// Set default weight if not provided
	if weight == 0 {
		weight = 1
	}

	connInfo := &ConnectionInfo{
		ID:       id,
		Pool:     pool,
		Weight:   weight,
		IsActive: true,
		LastUsed: time.Now(),
	}

	if location != "" {
		connInfo.Location = location
	}

	lb.connections = append(lb.connections, connInfo)

	lb.logger.Info("Connection added to load balancer",
		zap.String("connection_id", id),
		zap.Int("weight", weight),
		zap.String("location", location),
		zap.Int("total_connections", len(lb.connections)))

	return nil
}

// RemoveConnection removes a connection from the load balancer
func (lb *LoadBalancer) RemoveConnection(id string) error {
	lb.mu.Lock()
	defer lb.mu.Unlock()

	for i, conn := range lb.connections {
		if conn.ID == id {
			lb.connections = append(lb.connections[:i], lb.connections[i+1:]...)

			// Clean up sessions using this connection
			lb.cleanupSessionsForConnection(id)

			lb.logger.Info("Connection removed from load balancer",
				zap.String("connection_id", id))
			return nil
		}
	}

	return fmt.Errorf("connection %s not found", id)
}

// SelectConnection selects a connection based on the load balancing strategy
func (lb *LoadBalancer) SelectConnection(sessionID string) (*ConnectionInfo, error) {
	lb.mu.Lock()
	defer lb.mu.Unlock()

	// Filter active connections
	activeConns := lb.getActiveConnections()
	if len(activeConns) == 0 {
		return nil, fmt.Errorf("no active connections available")
	}

	var selectedConn *ConnectionInfo

	// Apply sticky session if enabled and session ID is provided
	if lb.config.StickySession && sessionID != "" {
		if conn := lb.getSessionConnection(sessionID); conn != nil {
			selectedConn = conn
			lb.metrics.SessionAffinityHits++
		} else {
			lb.metrics.SessionAffinityMisses++
		}
	}

	// If no connection selected via session, use load balancing strategy
	if selectedConn == nil {
		var err error
		selectedConn, err = lb.selectByStrategy(activeConns)
		if err != nil {
			return nil, err
		}
	}

	// Update session affinity if enabled
	if lb.config.StickySession && sessionID != "" {
		lb.updateSession(sessionID, selectedConn.ID)
	}

	// Update connection metrics
	selectedConn.LastUsed = time.Now()
	selectedConn.ConnectionCount++

	// Update load balancer metrics
	lb.metrics.TotalRequests++
	lb.metrics.RequestsPerConnection[selectedConn.ID]++

	return selectedConn, nil
}

// selectByStrategy selects a connection based on the configured strategy
func (lb *LoadBalancer) selectByStrategy(connections []*ConnectionInfo) (*ConnectionInfo, error) {
	switch lb.config.Strategy {
	case LoadBalancingRoundRobin:
		return lb.selectRoundRobin(connections)
	case LoadBalancingLeastConn:
		return lb.selectLeastConnections(connections)
	case LoadBalancingWeighted:
		return lb.selectWeighted(connections)
	case LoadBalancingResponseTime:
		return lb.selectByResponseTime(connections)
	case LoadBalancingGeographic:
		return lb.selectGeographic(connections)
	default:
		return nil, fmt.Errorf("unsupported load balancing strategy: %s", lb.config.Strategy)
	}
}

// selectRoundRobin implements round-robin selection
func (lb *LoadBalancer) selectRoundRobin(connections []*ConnectionInfo) (*ConnectionInfo, error) {
	if len(connections) == 0 {
		return nil, fmt.Errorf("no connections available")
	}

	// Use atomic counter for thread safety
	index := int(lb.currentIndex) % len(connections)
	lb.currentIndex++

	return connections[index], nil
}

// selectLeastConnections implements least connections selection
func (lb *LoadBalancer) selectLeastConnections(connections []*ConnectionInfo) (*ConnectionInfo, error) {
	if len(connections) == 0 {
		return nil, fmt.Errorf("no connections available")
	}

	var selectedConn *ConnectionInfo
	minConnections := int64(^uint64(0) >> 1) // Max int64

	for _, conn := range connections {
		if conn.ConnectionCount < minConnections {
			minConnections = conn.ConnectionCount
			selectedConn = conn
		}
	}

	return selectedConn, nil
}

// selectWeighted implements weighted selection
func (lb *LoadBalancer) selectWeighted(connections []*ConnectionInfo) (*ConnectionInfo, error) {
	if len(connections) == 0 {
		return nil, fmt.Errorf("no connections available")
	}

	// Calculate total weight
	totalWeight := 0
	for _, conn := range connections {
		totalWeight += conn.Weight
	}

	if totalWeight == 0 {
		// Fallback to round-robin if all weights are 0
		return lb.selectRoundRobin(connections)
	}

	// Simple weighted selection (could be improved with better algorithms)
	// For now, we'll use a probabilistic approach
	target := time.Now().UnixNano() % int64(totalWeight)
	currentWeight := int64(0)

	for _, conn := range connections {
		currentWeight += int64(conn.Weight)
		if currentWeight >= target {
			return conn, nil
		}
	}

	// Fallback (shouldn't happen)
	return connections[0], nil
}

// selectByResponseTime implements response time-based selection
func (lb *LoadBalancer) selectByResponseTime(connections []*ConnectionInfo) (*ConnectionInfo, error) {
	if len(connections) == 0 {
		return nil, fmt.Errorf("no connections available")
	}

	var selectedConn *ConnectionInfo
	bestScore := float64(-1)

	for _, conn := range connections {
		// Calculate score based on response time and error rate
		score := lb.calculateConnectionScore(conn)
		if score > bestScore {
			bestScore = score
			selectedConn = conn
		}
	}

	return selectedConn, nil
}

// selectGeographic implements geographic preference selection
func (lb *LoadBalancer) selectGeographic(connections []*ConnectionInfo) (*ConnectionInfo, error) {
	if len(connections) == 0 {
		return nil, fmt.Errorf("no connections available")
	}

	// If no geographic preference, fallback to round-robin
	if len(lb.config.GeographicPreference) == 0 {
		return lb.selectRoundRobin(connections)
	}

	// Try to find connection in preferred location
	for _, preferredLoc := range lb.config.GeographicPreference {
		for _, conn := range connections {
			if conn.Location == preferredLoc {
				return conn, nil
			}
		}
	}

	// Fallback to round-robin if no preferred location found
	return lb.selectRoundRobin(connections)
}

// calculateConnectionScore calculates a score for a connection
func (lb *LoadBalancer) calculateConnectionScore(conn *ConnectionInfo) float64 {
	score := 100.0

	// Penalize high response times
	if conn.ResponseTime > 0 {
		responseTimeMs := float64(conn.ResponseTime.Nanoseconds()) / 1e6
		score -= (responseTimeMs / 1000.0) * lb.config.ResponseTimeWeight
	}

	// Penalize high connection counts
	connWeight := float64(conn.ConnectionCount) * lb.config.ConnectionCountWeight
	score -= connWeight

	// Penalize high error rates
	errorWeight := conn.ErrorRate * lb.config.ErrorRateWeight
	score -= errorWeight * 100

	// Ensure score is not negative
	if score < 0 {
		score = 0
	}

	return score
}

// getActiveConnections returns active connections
func (lb *LoadBalancer) getActiveConnections() []*ConnectionInfo {
	active := make([]*ConnectionInfo, 0)
	for _, conn := range lb.connections {
		if conn.IsActive {
			active = append(active, conn)
		}
	}
	return active
}

// getSessionConnection gets connection for a session
func (lb *LoadBalancer) getSessionConnection(sessionID string) *ConnectionInfo {
	session, exists := lb.sessionMap[sessionID]
	if !exists {
		return nil
	}

	// Check if session has expired
	if time.Now().After(session.ExpiresAt) {
		delete(lb.sessionMap, sessionID)
		return nil
	}

	// Find the connection
	for _, conn := range lb.connections {
		if conn.ID == session.ConnectionID && conn.IsActive {
			return conn
		}
	}

	// Connection not found or inactive, remove session
	delete(lb.sessionMap, sessionID)
	return nil
}

// updateSession updates session information
func (lb *LoadBalancer) updateSession(sessionID, connectionID string) {
	session := &SessionInfo{
		SessionID:    sessionID,
		ConnectionID: connectionID,
		LastActivity: time.Now(),
		ExpiresAt:    time.Now().Add(lb.config.SessionAffinityTimeout),
	}

	lb.sessionMap[sessionID] = session
}

// cleanupSessionsForConnection removes sessions for a specific connection
func (lb *LoadBalancer) cleanupSessionsForConnection(connectionID string) {
	for sessionID, session := range lb.sessionMap {
		if session.ConnectionID == connectionID {
			delete(lb.sessionMap, sessionID)
		}
	}
}

// UpdateConnectionMetrics updates metrics for a connection
func (lb *LoadBalancer) UpdateConnectionMetrics(connectionID string, responseTime time.Duration, isError bool) {
	lb.mu.Lock()
	defer lb.mu.Unlock()

	for _, conn := range lb.connections {
		if conn.ID == connectionID {
			// Update response time (rolling average)
			if conn.ResponseTime == 0 {
				conn.ResponseTime = responseTime
			} else {
				conn.ResponseTime = time.Duration(float64(conn.ResponseTime)*0.9 + float64(responseTime)*0.1)
			}

			// Update error count
			if isError {
				conn.ErrorCount++
			}

			// Update error rate
			if conn.ConnectionCount > 0 {
				conn.ErrorRate = float64(conn.ErrorCount) / float64(conn.ConnectionCount)
			}

			break
		}
	}

	// Update load balancer metrics
	lb.updateLoadBalancerMetrics()
}

// updateLoadBalancerMetrics updates load balancer metrics
func (lb *LoadBalancer) updateLoadBalancerMetrics() {
	// Update connection utilization
	for _, conn := range lb.connections {
		if conn.Pool != nil {
			poolMetrics := conn.Pool.GetMetrics()
			if poolMetrics.ActiveConnections > 0 {
				utilization := float64(poolMetrics.ActiveConnections) / float64(poolMetrics.TotalConnections) * 100
				lb.metrics.ConnectionUtilization[conn.ID] = utilization
			}
		}
	}

	// Calculate average response time
	totalResponseTime := time.Duration(0)
	activeConns := 0
	for _, conn := range lb.connections {
		if conn.IsActive && conn.ResponseTime > 0 {
			totalResponseTime += conn.ResponseTime
			activeConns++
		}
	}

	if activeConns > 0 {
		lb.metrics.AvgResponseTime = totalResponseTime / time.Duration(activeConns)
	}

	// Calculate overall error rate
	totalErrors := int64(0)
	totalRequests := int64(0)
	for _, conn := range lb.connections {
		totalErrors += conn.ErrorCount
		totalRequests += conn.ConnectionCount
	}

	if totalRequests > 0 {
		lb.metrics.ErrorRate = float64(totalErrors) / float64(totalRequests)
	}

	// Update last distribution
	lb.metrics.LastDistribution = make(map[string]int64)
	for _, conn := range lb.connections {
		lb.metrics.LastDistribution[conn.ID] = conn.ConnectionCount
	}

	// Calculate balance score (0-100, higher is better)
	lb.metrics.BalanceScore = lb.calculateBalanceScore()
}

// calculateBalanceScore calculates how well balanced the connections are
func (lb *LoadBalancer) calculateBalanceScore() float64 {
	if len(lb.connections) <= 1 {
		return 100.0
	}

	// Get connection counts
	counts := make([]int64, 0)
	for _, conn := range lb.connections {
		if conn.IsActive {
			counts = append(counts, conn.ConnectionCount)
		}
	}

	if len(counts) == 0 {
		return 100.0
	}

	// Calculate standard deviation
	mean := int64(0)
	for _, count := range counts {
		mean += count
	}
	mean /= int64(len(counts))

	variance := float64(0)
	for _, count := range counts {
		diff := float64(count - mean)
		variance += diff * diff
	}
	variance /= float64(len(counts))

	// Convert to balance score (lower variance = higher score)
	maxVariance := float64(mean * mean) // Worst case
	if maxVariance == 0 {
		return 100.0
	}

	balanceScore := 100.0 * (1.0 - variance/maxVariance)
	if balanceScore < 0 {
		balanceScore = 0
	}

	return balanceScore
}

// CleanupExpiredSessions removes expired sessions
func (lb *LoadBalancer) CleanupExpiredSessions() {
	lb.mu.Lock()
	defer lb.mu.Unlock()

	now := time.Now()
	for sessionID, session := range lb.sessionMap {
		if now.After(session.ExpiresAt) {
			delete(lb.sessionMap, sessionID)
		}
	}
}

// GetMetrics returns current load balancer metrics
func (lb *LoadBalancer) GetMetrics() LoadBalancerMetrics {
	lb.mu.RLock()
	defer lb.mu.RUnlock()

	return *lb.metrics
}

// GetConnectionInfo returns information about all connections
func (lb *LoadBalancer) GetConnectionInfo() []ConnectionInfo {
	lb.mu.RLock()
	defer lb.mu.RUnlock()

	info := make([]ConnectionInfo, len(lb.connections))
	for i, conn := range lb.connections {
		info[i] = *conn
	}
	return info
}

// SetConnectionWeight sets the weight for a connection
func (lb *LoadBalancer) SetConnectionWeight(connectionID string, weight int) error {
	lb.mu.Lock()
	defer lb.mu.Unlock()

	for _, conn := range lb.connections {
		if conn.ID == connectionID {
			conn.Weight = weight
			lb.logger.Info("Connection weight updated",
				zap.String("connection_id", connectionID),
				zap.Int("weight", weight))
			return nil
		}
	}

	return fmt.Errorf("connection %s not found", connectionID)
}

// SetConnectionActive sets the active status for a connection
func (lb *LoadBalancer) SetConnectionActive(connectionID string, active bool) error {
	lb.mu.Lock()
	defer lb.mu.Unlock()

	for _, conn := range lb.connections {
		if conn.ID == connectionID {
			conn.IsActive = active
			lb.logger.Info("Connection active status updated",
				zap.String("connection_id", connectionID),
				zap.Bool("active", active))

			// Clean up sessions if deactivating
			if !active {
				lb.cleanupSessionsForConnection(connectionID)
			}
			return nil
		}
	}

	return fmt.Errorf("connection %s not found", connectionID)
}
