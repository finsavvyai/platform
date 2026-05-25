package server

import (
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/sirupsen/logrus"
)

// Client represents a WebSocket client connection
type Client struct {
	hub      *Hub
	conn     *websocket.Conn
	send     chan []byte
	userID   string
	rooms    map[string]bool
	mutex    sync.RWMutex
	lastSeen time.Time
	metadata map[string]interface{}
}

// NewClient creates a new WebSocket client
func NewClient(hub *Hub, conn *websocket.Conn, userID string) *Client {
	return &Client{
		hub:      hub,
		conn:     conn,
		send:     make(chan []byte, 256),
		userID:   userID,
		rooms:    make(map[string]bool),
		lastSeen: time.Now(),
		metadata: make(map[string]interface{}),
	}
}

// readPump pumps messages from the websocket connection to the hub
func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		c.lastSeen = time.Now()
		return nil
	})

	for {
		_, messageBytes, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				logrus.WithError(err).Error("WebSocket error")
			}
			break
		}

		c.lastSeen = time.Now()

		var msg WebSocketMessage
		if err := json.Unmarshal(messageBytes, &msg); err != nil {
			logrus.WithError(err).Error("Failed to unmarshal WebSocket message")
			c.sendError("Invalid message format")
			continue
		}
		c.handleMessage(&msg)
	}
}

// writePump pumps messages from the hub to the websocket connection
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

			n := len(c.send)
			for i := 0; i < n; i++ {
				w.Write([]byte{'\n'})
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

func (c *Client) handleMessage(msg *WebSocketMessage) {
	switch msg.Type {
	case MessageTypeSubscribe:
		c.handleSubscribe(msg)
	case MessageTypeUnsubscribe:
		c.handleUnsubscribe(msg)
	case MessageTypeQueryCancel:
		c.handleQueryCancel(msg)
	case MessageTypeCollabEdit:
		c.handleCollaborativeEdit(msg)
	case MessageTypeCollabCursor:
		c.handleCursorUpdate(msg)
	case MessageTypeHeartbeat:
		c.lastSeen = time.Now()
	default:
		logrus.WithField("type", msg.Type).Warn("Unknown message type received")
		c.sendError(fmt.Sprintf("Unknown message type: %s", msg.Type))
	}
}

func (c *Client) handleSubscribe(msg *WebSocketMessage) {
	if msg.Room == "" {
		c.sendError("Room name is required for subscription")
		return
	}
	if !c.canAccessRoom(msg.Room) {
		c.sendError("Access denied to room: " + msg.Room)
		return
	}
	c.hub.addToRoom(msg.Room, c)
	c.sendMessage(&WebSocketMessage{
		Type: "subscribed", Room: msg.Room, Timestamp: time.Now(),
	})
}

func (c *Client) handleUnsubscribe(msg *WebSocketMessage) {
	if msg.Room == "" {
		c.sendError("Room name is required for unsubscription")
		return
	}
	c.hub.removeFromRoom(msg.Room, c)
	c.sendMessage(&WebSocketMessage{
		Type: "unsubscribed", Room: msg.Room, Timestamp: time.Now(),
	})
}

func (c *Client) handleQueryCancel(msg *WebSocketMessage) {
	data, ok := msg.Data.(map[string]interface{})
	if !ok {
		c.sendError("Invalid query cancel data")
		return
	}
	queryID, ok := data["query_id"].(string)
	if !ok {
		c.sendError("Query ID is required for cancellation")
		return
	}
	logrus.WithFields(logrus.Fields{
		"user_id": c.userID, "query_id": queryID,
	}).Info("Query cancellation requested")

	c.sendMessage(&WebSocketMessage{
		Type:      "query_cancelled",
		Data:      map[string]string{"query_id": queryID},
		Timestamp: time.Now(),
		RequestID: queryID,
	})
}

