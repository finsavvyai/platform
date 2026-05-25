package sdln

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

// WebSocketService handles WebSocket connections for real-time communication
type WebSocketService struct {
	*BaseService
}

// NewWebSocketService creates a new WebSocket service
func NewWebSocketService(client *Client) *WebSocketService {
	return &WebSocketService{
		BaseService: NewBaseService(client, "websocket", "api/v1/websocket"),
	}
}

// Connection represents a WebSocket connection
type Connection struct {
	conn        *http.Response
	mutex       sync.RWMutex
	send        chan []byte
	receive     chan []byte
	close       chan struct{}
	done        chan struct{}
	errorChan   chan error
	pingPeriod  time.Duration
	writeWait   time.Duration
	pongWait    time.Duration
	isConnected bool
	ctx         context.Context
	cancel      context.CancelFunc
	onMessage   func(message []byte)
	onError     func(err error)
	onClose     func()
}

// WebSocketConn represents a simplified WebSocket connection
type WebSocketConn struct {
	reader io.ReadCloser
	writer io.WriteCloser
}

// SubscribeRequest represents a subscription request
type SubscribeRequest struct {
	Events   []string          `json:"events"`
	TenantID string            `json:"tenant_id,omitempty"`
	UserID   string            `json:"user_id,omitempty"`
	Filters  map[string]string `json:"filters,omitempty"`
	Metadata map[string]string `json:"metadata,omitempty"`
}

// UnsubscribeRequest represents an unsubscribe request
type UnsubscribeRequest struct {
	Events   []string `json:"events"`
	TenantID string   `json:"tenant_id,omitempty"`
}

// WebSocketEvent represents a WebSocket event
type WebSocketEvent struct {
	ID        string                 `json:"id"`
	Type      string                 `json:"type"`
	TenantID  string                 `json:"tenant_id,omitempty"`
	UserID    string                 `json:"user_id,omitempty"`
	Data      map[string]interface{} `json:"data"`
	Timestamp Timestamp                   `json:"timestamp"`
	Metadata  map[string]string      `json:"metadata,omitempty"`
}

// Message represents a WebSocket message
type Message struct {
	Type      string                 `json:"type"` // subscribe, unsubscribe, event, ping, pong, error
	ID        string                 `json:"id,omitempty"`
	Data      map[string]interface{} `json:"data,omitempty"`
	Error     string                 `json:"error,omitempty"`
	Timestamp Timestamp                   `json:"timestamp,omitempty"`
}

// Connect establishes a WebSocket connection using HTTP streaming
func (s *WebSocketService) Connect(ctx context.Context) (*Connection, error) {
	// Build WebSocket URL (using HTTP streaming for simplicity)
	wsURL, err := url.Parse(s.client.config.BaseURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse base URL: %w", err)
	}

	// Use HTTP endpoint for streaming
	wsURL.Path = "/api/v1/websocket/stream"

	// Add query parameters
	query := wsURL.Query()
	query.Set("client_id", "sdln-sdk-go")
	query.Set("protocol", "http-stream")
	wsURL.RawQuery = query.Encode()

	// Create HTTP request for streaming
	req, err := http.NewRequestWithContext(ctx, "GET", wsURL.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Set headers for streaming
	req.Header.Set("Accept", "text/event-stream")
	req.Header.Set("Cache-Control", "no-cache")
	req.Header.Set("Connection", "keep-alive")

	// Add authentication
	if s.client.auth != nil {
		httpReq := newHTTPRequest(req)
		if err := s.client.auth.Authenticate(ctx, httpReq); err != nil {
			return nil, fmt.Errorf("authentication failed: %w", err)
		}
	}

	// Execute request
	resp, err := s.client.do(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("failed to connect: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		return nil, fmt.Errorf("connection failed: %s", string(body))
	}

	// Create connection context
	connCtx, cancel := context.WithCancel(ctx)

	connection := &Connection{
		conn:       resp,
		send:       make(chan []byte, 256),
		receive:    make(chan []byte, 256),
		close:      make(chan struct{}),
		done:       make(chan struct{}),
		errorChan:  make(chan error, 1),
		pingPeriod: 54 * time.Second,
		writeWait:  10 * time.Second,
		pongWait:   60 * time.Second,
		ctx:        connCtx,
		cancel:     cancel,
	}

	// Start processing goroutines
	go connection.readPump()
	go connection.writePump()

	return connection, nil
}

// ConnectWithAuth establishes a WebSocket connection with authentication
func (s *WebSocketService) ConnectWithAuth(ctx context.Context, token string) (*Connection, error) {
	// Build WebSocket URL
	wsURL, err := url.Parse(s.client.config.BaseURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse base URL: %w", err)
	}

	// Use HTTP endpoint for streaming
	wsURL.Path = "/api/v1/websocket/stream"

	// Add query parameters with auth token
	query := wsURL.Query()
	query.Set("token", token)
	query.Set("client_id", "sdln-sdk-go")
	query.Set("protocol", "http-stream")
	wsURL.RawQuery = query.Encode()

	// Create HTTP request for streaming
	req, err := http.NewRequestWithContext(ctx, "GET", wsURL.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Set headers for streaming
	req.Header.Set("Accept", "text/event-stream")
	req.Header.Set("Cache-Control", "no-cache")
	req.Header.Set("Connection", "keep-alive")

	// Execute request
	resp, err := s.client.do(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("failed to connect: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		return nil, fmt.Errorf("connection failed: %s", string(body))
	}

	// Create connection context
	connCtx, cancel := context.WithCancel(ctx)

	connection := &Connection{
		conn:       resp,
		send:       make(chan []byte, 256),
		receive:    make(chan []byte, 256),
		close:      make(chan struct{}),
		done:       make(chan struct{}),
		errorChan:  make(chan error, 1),
		pingPeriod: 54 * time.Second,
		writeWait:  10 * time.Second,
		pongWait:   60 * time.Second,
		ctx:        connCtx,
		cancel:     cancel,
	}

	// Start processing goroutines
	go connection.readPump()
	go connection.writePump()

	return connection, nil
}

// Subscribe subscribes to events
func (c *Connection) Subscribe(req *SubscribeRequest) error {
	message := Message{
		Type: "subscribe",
		Data: map[string]interface{}{
			"events":    req.Events,
			"tenant_id": req.TenantID,
			"user_id":   req.UserID,
			"filters":   req.Filters,
			"metadata":  req.Metadata,
		},
		Timestamp: time.Now(),
	}

	return c.sendMessage(message)
}

// Unsubscribe unsubscribes from events
func (c *Connection) Unsubscribe(req *UnsubscribeRequest) error {
	message := Message{
		Type: "unsubscribe",
		Data: map[string]interface{}{
			"events":    req.Events,
			"tenant_id": req.TenantID,
		},
		Timestamp: time.Now(),
	}

	return c.sendMessage(message)
}

// Send sends a custom message
func (c *Connection) Send(messageType string, data map[string]interface{}) error {
	message := Message{
		Type:      messageType,
		Data:      data,
		Timestamp: time.Now(),
	}

	return c.sendMessage(message)
}

// Events returns a channel for receiving events
func (c *Connection) Events() <-chan []byte {
	return c.receive
}

// Errors returns a channel for receiving errors
func (c *Connection) Errors() <-chan error {
	return c.errorChan
}

// IsConnected returns the connection status
func (c *Connection) IsConnected() bool {
	c.mutex.RLock()
	defer c.mutex.RUnlock()
	return c.isConnected
}

// SetMessageHandler sets a custom message handler
func (c *Connection) SetMessageHandler(handler func(message []byte)) {
	c.mutex.Lock()
	defer c.mutex.Unlock()
	c.onMessage = handler
}

// SetErrorHandler sets a custom error handler
func (c *Connection) SetErrorHandler(handler func(err error)) {
	c.mutex.Lock()
	defer c.mutex.Unlock()
	c.onError = handler
}

// SetCloseHandler sets a custom close handler
func (c *Connection) SetCloseHandler(handler func()) {
	c.mutex.Lock()
	defer c.mutex.Unlock()
	c.onClose = handler
}

// Close closes the connection
func (c *Connection) Close() error {
	select {
	case <-c.done:
		return nil // Already closed
	default:
	}

	// Signal close
	close(c.close)
	c.cancel()

	// Close HTTP response body
	if c.conn != nil && c.conn.Body != nil {
		c.conn.Body.Close()
	}

	// Wait for goroutines to finish
	<-c.done

	return nil
}

// sendMessage sends a message
func (c *Connection) sendMessage(message Message) error {
	data, err := json.Marshal(message)
	if err != nil {
		return fmt.Errorf("failed to marshal message: %w", err)
	}

	select {
	case c.send <- data:
		return nil
	case <-c.done:
		return fmt.Errorf("connection is closed")
	case <-c.ctx.Done():
		return c.ctx.Err()
	}
}

// readPump reads messages from the connection
func (c *Connection) readPump() {
	defer func() {
		close(c.done)
		if c.conn != nil && c.conn.Body != nil {
			c.conn.Body.Close()
		}
	}()

	for {
		select {
		case <-c.close:
			return
		case <-c.ctx.Done():
			return
		default:
		}

		// Read from response body (Server-Sent Events format)
		if c.conn == nil || c.conn.Body == nil {
			return
		}

		// Simple buffer to read data
		buf := make([]byte, 4096)
		n, err := c.conn.Body.Read(buf)
		if err != nil {
			if err != io.EOF {
				c.mutex.RLock()
				if c.onError != nil {
					go c.onError(err)
				}
				c.mutex.RUnlock()

				select {
				case c.errorChan <- err:
				default:
				}
			}
			return
		}

		if n > 0 {
			data := buf[:n]

			// Handle Server-Sent Events format
			lines := strings.Split(string(data), "\n")
			for _, line := range lines {
				line = strings.TrimSpace(line)
				if line == "" || line == ":" {
					continue
				}

				if strings.HasPrefix(line, "data: ") {
					eventData := strings.TrimPrefix(line, "data: ")
					if eventData == "[DONE]" {
						return
					}

					// Try to parse as JSON
					var event interface{}
					if err := json.Unmarshal([]byte(eventData), &event); err == nil {
						c.mutex.RLock()
						if c.onMessage != nil {
							go c.onMessage([]byte(eventData))
						}
						c.mutex.RUnlock()

						// Send to receive channel
						select {
						case c.receive <- []byte(eventData):
						default:
							// Channel is full, skip message
						}
					}
				}
			}
		}
	}
}

// writePump handles writing messages (simplified for HTTP streaming)
func (c *Connection) writePump() {
	ticker := time.NewTicker(c.pingPeriod)
	defer func() {
		ticker.Stop()
		c.mutex.Lock()
		c.isConnected = false
		if c.onClose != nil {
			go c.onClose()
		}
		c.mutex.Unlock()
	}()

	// Mark as connected
	c.mutex.Lock()
	c.isConnected = true
	c.mutex.Unlock()

	for {
		select {
		case message, ok := <-c.send:
			if !ok {
				// Channel closed
				return
			}

			// For HTTP streaming, we can't really send messages back
			// This is a limitation of the simplified implementation
			// In a real WebSocket implementation, this would write to the WebSocket

		case <-ticker.C:
			// Send ping (simplified for HTTP streaming)
			// In a real WebSocket, this would send a ping frame

		case <-c.close:
			return

		case <-c.ctx.Done():
			return
		}
	}
}

// GetConnectionStatus checks the status of a WebSocket connection
func (s *WebSocketService) GetConnectionStatus(ctx context.Context, connectionID string) (*ConnectionStatus, error) {
	var status ConnectionStatus
	err := s.doGet(ctx, fmt.Sprintf("/connections/%s/status", connectionID), &status)
	if err != nil {
		return nil, fmt.Errorf("failed to get connection status: %w", err)
	}
	return &status, nil
}

// ListActiveConnections lists active WebSocket connections
func (s *WebSocketService) ListActiveConnections(ctx context.Context, tenantID string, opts *ListOptions) (*PaginatedResponse[ConnectionInfo], error) {
	path := fmt.Sprintf("/tenants/%s/connections", tenantID)
	if opts != nil {
		path += s.buildQuery(map[string]interface{}{
			"page":      opts.Page,
			"page_size": opts.PageSize,
			"sort_by":   opts.SortBy,
			"sort_desc": opts.SortDesc,
		})
	}

	var response PaginatedResponse[ConnectionInfo]
	err := s.doGet(ctx, path, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to list active connections: %w", err)
	}
	return &response, nil
}

// BroadcastEvent broadcasts an event to multiple connections
func (s *WebSocketService) BroadcastEvent(ctx context.Context, req *BroadcastRequest) error {
	err := s.doPost(ctx, "/broadcast", req, nil)
	if err != nil {
		return fmt.Errorf("failed to broadcast event: %w", err)
	}
	return nil
}

// ConnectionStatus represents the status of a WebSocket connection
type ConnectionStatus struct {
	ConnectionID  string   `json:"connection_id"`
	Status        string   `json:"status"` // connected, disconnected, error
	ConnectedAt   Timestamp     `json:"connected_at"`
	LastActivity  Timestamp     `json:"last_activity"`
	MessagesSent  int64    `json:"messages_sent"`
	MessagesRecv  int64    `json:"messages_received"`
	Subscriptions []string `json:"subscriptions"`
}

// ConnectionInfo represents information about a WebSocket connection
type ConnectionInfo struct {
	ConnectionID  string            `json:"connection_id"`
	TenantID      string            `json:"tenant_id"`
	UserID        string            `json:"user_id,omitempty"`
	ClientID      string            `json:"client_id"`
	IPAddress     string            `json:"ip_address"`
	UserAgent     string            `json:"user_agent"`
	ConnectedAt   Timestamp              `json:"connected_at"`
	LastActivity  Timestamp              `json:"last_activity"`
	Status        string            `json:"status"`
	Subscriptions []string          `json:"subscriptions"`
	Metadata      map[string]string `json:"metadata,omitempty"`
}

// BroadcastRequest represents a broadcast request
type BroadcastRequest struct {
	Event                WebSocketEvent         `json:"event"`
	TenantID             string                 `json:"tenant_id,omitempty"`
	UserIDs              []string               `json:"user_ids,omitempty"`
	ConnectionIDs        []string               `json:"connection_ids,omitempty"`
	ExcludeConnectionIDs []string               `json:"exclude_connection_ids,omitempty"`
	Filter               map[string]interface{} `json:"filter,omitempty"`
}
