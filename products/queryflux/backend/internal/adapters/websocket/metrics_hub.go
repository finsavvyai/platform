package websocket

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/queryflux/backend/internal/application/ports"
	"github.com/queryflux/backend/internal/domain"
	"go.uber.org/zap"
)

// WebSocketHub manages WebSocket connections and real-time metrics broadcasting
type WebSocketHub struct {
	logger        *zap.Logger
	clients       map[string]*Client
	broadcast     chan []byte
	register      chan *Client
	unregister    chan *Client
	subscriptions map[string]*Subscription
	mu            sync.RWMutex
	ctx           context.Context
	cancel        context.CancelFunc
	wg            sync.WaitGroup
}

// Client represents a WebSocket client connection
type Client struct {
	hub           *WebSocketHub
	conn          *websocket.Conn
	send          chan []byte
	id            string
	subscriptions map[string]bool // subscription IDs
	mu            sync.RWMutex
	connected     bool
	lastPing      time.Time
}

// Subscription represents a WebSocket subscription
type Subscription struct {
	ID       string                 `json:"id"`
	Type     string                 `json:"type"` // metrics, alerts, dashboards
	ClientID string                 `json:"client_id"`
	Filters  map[string]interface{} `json:"filters"`
	Interval time.Duration          `json:"interval"`
	LastSent time.Time              `json:"last_sent"`
	Active   bool                   `json:"active"`
}

// WebSocketMessage represents a message sent over WebSocket
type WebSocketMessage struct {
	Type      string                 `json:"type"` // metric, alert, dashboard, error, ping
	Data      interface{}            `json:"data"`
	Timestamp time.Time              `json:"timestamp"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
}

// MetricsUpdate represents a metrics update message
type MetricsUpdate struct {
	Metrics []*domain.Metric `json:"metrics"`
	Source  string           `json:"source"`
}

// AlertUpdate represents an alert update message
type AlertUpdate struct {
	Alert  *domain.Alert `json:"alert"`
	Action string        `json:"action"` // created, updated, resolved, silenced
}

// DashboardUpdate represents a dashboard update message
type DashboardUpdate struct {
	DashboardID string                 `json:"dashboard_id"`
	Data        map[string]interface{} `json:"data"`
}

// NewWebSocketHub creates a new WebSocket hub
func NewWebSocketHub(logger *zap.Logger) *WebSocketHub {
	ctx, cancel := context.WithCancel(context.Background())

	return &WebSocketHub{
		logger:        logger,
		clients:       make(map[string]*Client),
		broadcast:     make(chan []byte, 256),
		register:      make(chan *Client),
		unregister:    make(chan *Client),
		subscriptions: make(map[string]*Subscription),
		ctx:           ctx,
		cancel:        cancel,
	}
}

// Start starts the WebSocket hub
func (h *WebSocketHub) Start(ctx context.Context) error {
	h.logger.Info("Starting WebSocket hub")

	h.wg.Add(1)
	go h.run()

	h.wg.Add(1)
	go h.pingClients()

	h.logger.Info("WebSocket hub started")
	return nil
}

// Stop stops the WebSocket hub
func (h *WebSocketHub) Stop(ctx context.Context) error {
	h.logger.Info("Stopping WebSocket hub")

	h.cancel()
	close(h.broadcast)
	close(h.register)
	close(h.unregister)

	h.wg.Wait()

	// Close all client connections
	h.mu.Lock()
	for _, client := range h.clients {
		client.close()
	}
	h.mu.Unlock()

	h.logger.Info("WebSocket hub stopped")
	return nil
}

// RegisterClient registers a new WebSocket client
func (h *WebSocketHub) RegisterClient(conn *websocket.Conn, clientID string) *Client {
	client := &Client{
		hub:           h,
		conn:          conn,
		send:          make(chan []byte, 256),
		id:            clientID,
		subscriptions: make(map[string]bool),
		connected:     true,
		lastPing:      time.Now(),
	}

	h.register <- client

	h.wg.Add(1)
	go client.writePump()
	go client.readPump()

	return client
}

// SubscribeToMetrics subscribes a client to metrics updates
func (h *WebSocketHub) SubscribeToMetrics(ctx context.Context, subscription *ports.MetricsSubscription) error {
	sub := &Subscription{
		ID:       subscription.ID,
		Type:     "metrics",
		ClientID: subscription.ClientID,
		Filters: map[string]interface{}{
			"names":   subscription.Filters.Names,
			"labels":  subscription.Filters.Labels,
			"sources": subscription.Filters.Sources,
		},
		Interval: subscription.Interval,
		LastSent: time.Now(),
		Active:   true,
	}

	h.mu.Lock()
	h.subscriptions[subscription.ID] = sub
	h.mu.Unlock()

	h.logger.Info("Client subscribed to metrics",
		zap.String("client_id", subscription.ClientID),
		zap.String("subscription_id", subscription.ID))

	return nil
}

// UnsubscribeFromMetrics unsubscribes a client from metrics updates
func (h *WebSocketHub) UnsubscribeFromMetrics(ctx context.Context, subscriptionID string) error {
	h.mu.Lock()
	if sub, exists := h.subscriptions[subscriptionID]; exists {
		sub.Active = false
		delete(h.subscriptions, subscriptionID)
	}
	h.mu.Unlock()

	h.logger.Info("Client unsubscribed from metrics", zap.String("subscription_id", subscriptionID))
	return nil
}

// SubscribeToAlerts subscribes a client to alert updates
func (h *WebSocketHub) SubscribeToAlerts(ctx context.Context, subscription *ports.AlertsSubscription) error {
	sub := &Subscription{
		ID:       subscription.ID,
		Type:     "alerts",
		ClientID: subscription.ClientID,
		Filters: map[string]interface{}{
			"severity": subscription.Filters.Severity,
			"status":   subscription.Filters.Status,
			"sources":  subscription.Filters.Sources,
		},
		Interval: 0, // Real-time for alerts
		LastSent: time.Now(),
		Active:   true,
	}

	h.mu.Lock()
	h.subscriptions[subscription.ID] = sub
	h.mu.Unlock()

	h.logger.Info("Client subscribed to alerts",
		zap.String("client_id", subscription.ClientID),
		zap.String("subscription_id", subscription.ID))

	return nil
}

// UnsubscribeFromAlerts unsubscribes a client from alert updates
func (h *WebSocketHub) UnsubscribeFromAlerts(ctx context.Context, subscriptionID string) error {
	h.mu.Lock()
	if sub, exists := h.subscriptions[subscriptionID]; exists {
		sub.Active = false
		delete(h.subscriptions, subscriptionID)
	}
	h.mu.Unlock()

	h.logger.Info("Client unsubscribed from alerts", zap.String("subscription_id", subscriptionID))
	return nil
}

// BroadcastMetric broadcasts a metric to subscribed clients
func (h *WebSocketHub) BroadcastMetric(ctx context.Context, metric *domain.Metric) error {
	message := WebSocketMessage{
		Type:      "metric",
		Data:      metric,
		Timestamp: time.Now(),
	}

	data, err := json.Marshal(message)
	if err != nil {
		return fmt.Errorf("failed to marshal metric message: %w", err)
	}

	select {
	case h.broadcast <- data:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

// BroadcastAlert broadcasts an alert to subscribed clients
func (h *WebSocketHub) BroadcastAlert(ctx context.Context, alert *domain.Alert) error {
	message := WebSocketMessage{
		Type:      "alert",
		Data:      alert,
		Timestamp: time.Now(),
	}

	data, err := json.Marshal(message)
	if err != nil {
		return fmt.Errorf("failed to marshal alert message: %w", err)
	}

	select {
	case h.broadcast <- data:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

// GetActiveSubscriptions returns all active subscriptions
func (h *WebSocketHub) GetActiveSubscriptions(ctx context.Context) ([]*ports.Subscription, error) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	var subscriptions []*ports.Subscription
	for _, sub := range h.subscriptions {
		if sub.Active {
			subscriptions = append(subscriptions, &ports.Subscription{
				ID:        sub.ID,
				Type:      sub.Type,
				ClientID:  sub.ClientID,
				Filters:   sub.Filters,
				Interval:  sub.Interval,
				CreatedAt: sub.LastSent, // Using LastSent as CreatedAt for simplicity
				LastSeen:  sub.LastSent,
			})
		}
	}

	return subscriptions, nil
}

// SendToClient sends a message to a specific client
func (h *WebSocketHub) SendToClient(clientID string, message WebSocketMessage) error {
	h.mu.RLock()
	client, exists := h.clients[clientID]
	h.mu.RUnlock()

	if !exists {
		return fmt.Errorf("client %s not found", clientID)
	}

	data, err := json.Marshal(message)
	if err != nil {
		return fmt.Errorf("failed to marshal message: %w", err)
	}

	select {
	case client.send <- data:
		return nil
	default:
		return fmt.Errorf("client send buffer full")
	}
}

// GetClientCount returns the number of connected clients
func (h *WebSocketHub) GetClientCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}

// Hub run loop
func (h *WebSocketHub) run() {
	defer h.wg.Done()

	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client.id] = client
			h.mu.Unlock()
			h.logger.Info("Client registered", zap.String("client_id", client.id))

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client.id]; ok {
				delete(h.clients, client.id)
				close(client.send)
				client.close()
			}
			h.mu.Unlock()
			h.logger.Info("Client unregistered", zap.String("client_id", client.id))

		case message := <-h.broadcast:
			h.broadcastToClients(message)

		case <-h.ctx.Done():
			return
		}
	}
}

// broadcastToClients sends a message to all relevant clients based on subscriptions
func (h *WebSocketHub) broadcastToClients(message []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	// Parse the message to determine type and content
	var wsMessage WebSocketMessage
	if err := json.Unmarshal(message, &wsMessage); err != nil {
		h.logger.Error("Failed to parse broadcast message", zap.Error(err))
		return
	}

	// Send to all clients that are subscribed to this message type
	for _, client := range h.clients {
		if client.shouldReceiveMessage(wsMessage) {
			select {
			case client.send <- message:
			default:
				close(client.send)
				delete(h.clients, client.id)
			}
		}
	}
}

// pingClients periodically pings clients to detect disconnections
func (h *WebSocketHub) pingClients() {
	defer h.wg.Done()

	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			h.pingAllClients()
		case <-h.ctx.Done():
			return
		}
	}
}

func (h *WebSocketHub) pingAllClients() {
	h.mu.RLock()
	defer h.mu.RUnlock()

	for _, client := range h.clients {
		if time.Since(client.lastPing) > 60*time.Second {
			h.logger.Info("Client timeout, disconnecting", zap.String("client_id", client.id))
			client.close()
			delete(h.clients, client.id)
			continue
		}

		ping := WebSocketMessage{
			Type:      "ping",
			Data:      map[string]interface{}{"timestamp": time.Now()},
			Timestamp: time.Now(),
		}

		data, _ := json.Marshal(ping)
		select {
		case client.send <- data:
		default:
			client.close()
			delete(h.clients, client.id)
		}
	}
}

// Client methods

func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadLimit(512)
	c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		c.mu.Lock()
		c.lastPing = time.Now()
		c.mu.Unlock()
		return nil
	})

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				c.hub.logger.Error("WebSocket error", zap.Error(err), zap.String("client_id", c.id))
			}
			break
		}

		c.handleMessage(message)
	}
}

func (c *Client) writePump() {
	ticker := time.NewTicker(54 * time.Second)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			// Add queued chat messages to the current websocket message.
			n := len(c.send)
			for i := 0; i < n; i++ {
				w.Write(newline)
				w.Write(<-c.send)
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (c *Client) handleMessage(message []byte) {
	var wsMessage WebSocketMessage
	if err := json.Unmarshal(message, &wsMessage); err != nil {
		c.hub.logger.Error("Failed to parse client message", zap.Error(err), zap.String("client_id", c.id))
		return
	}

	switch wsMessage.Type {
	case "pong":
		c.mu.Lock()
		c.lastPing = time.Now()
		c.mu.Unlock()

	case "subscribe":
		// Handle subscription requests
		if data, ok := wsMessage.Data.(map[string]interface{}); ok {
			c.handleSubscription(data)
		}

	case "unsubscribe":
		// Handle unsubscription requests
		if data, ok := wsMessage.Data.(map[string]interface{}); ok {
			c.handleUnsubscription(data)
		}

	default:
		c.hub.logger.Warn("Unknown message type from client",
			zap.String("type", wsMessage.Type),
			zap.String("client_id", c.id))
	}
}

func (c *Client) handleSubscription(data map[string]interface{}) {
	subType, ok := data["type"].(string)
	if !ok {
		return
	}

	var subID string
	switch subType {
	case "metrics":
		subID = fmt.Sprintf("metrics_%s_%d", c.id, time.Now().UnixNano())
		subscription := &ports.MetricsSubscription{
			ID:       subID,
			ClientID: c.id,
			Interval: 5 * time.Second, // Default interval
		}

		// Parse filters if provided
		if filters, ok := data["filters"].(map[string]interface{}); ok {
			if names, ok := filters["names"].([]interface{}); ok {
				for _, name := range names {
					if nameStr, ok := name.(string); ok {
						subscription.Filters.Names = append(subscription.Filters.Names, nameStr)
					}
				}
			}
		}

		c.mu.Lock()
		c.subscriptions[subID] = true
		c.mu.Unlock()

		c.hub.SubscribeToMetrics(c.hub.ctx, subscription)

	case "alerts":
		subID = fmt.Sprintf("alerts_%s_%d", c.id, time.Now().UnixNano())
		subscription := &ports.AlertsSubscription{
			ID:       subID,
			ClientID: c.id,
		}

		c.mu.Lock()
		c.subscriptions[subID] = true
		c.mu.Unlock()

		c.hub.SubscribeToAlerts(c.hub.ctx, subscription)
	}

	// Send confirmation
	confirm := WebSocketMessage{
		Type: "subscription_confirmed",
		Data: map[string]interface{}{
			"subscription_id": subID,
			"type":            subType,
		},
		Timestamp: time.Now(),
	}

	msgData, _ := json.Marshal(confirm)
	select {
	case c.send <- msgData:
	default:
	}
}

func (c *Client) handleUnsubscription(data map[string]interface{}) {
	subID, ok := data["subscription_id"].(string)
	if !ok {
		return
	}

	c.mu.Lock()
	delete(c.subscriptions, subID)
	c.mu.Unlock()

	// Remove from hub subscriptions
	if strings.HasPrefix(subID, "metrics_") {
		c.hub.UnsubscribeFromMetrics(c.hub.ctx, subID)
	} else if strings.HasPrefix(subID, "alerts_") {
		c.hub.UnsubscribeFromAlerts(c.hub.ctx, subID)
	}

	// Send confirmation
	confirm := WebSocketMessage{
		Type: "unsubscription_confirmed",
		Data: map[string]interface{}{
			"subscription_id": subID,
		},
		Timestamp: time.Now(),
	}

	msgData, _ := json.Marshal(confirm)
	select {
	case c.send <- msgData:
	default:
	}
}

func (c *Client) shouldReceiveMessage(message WebSocketMessage) bool {
	c.mu.RLock()
	defer c.mu.RUnlock()

	// Check if client has relevant subscriptions
	for subID := range c.subscriptions {
		if strings.HasPrefix(subID, "metrics_") && message.Type == "metric" {
			return true
		}
		if strings.HasPrefix(subID, "alerts_") && message.Type == "alert" {
			return true
		}
	}

	return false
}

func (c *Client) close() {
	c.mu.Lock()
	if c.connected {
		c.conn.Close()
		c.connected = false
	}
	c.mu.Unlock()
}

var newline = []byte{'\n'}
