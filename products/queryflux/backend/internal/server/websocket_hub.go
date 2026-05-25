package server

import (
	"context"
	"encoding/json"
	"sync"
	"time"

	"github.com/sirupsen/logrus"
)

// Hub maintains the set of active clients and broadcasts messages
type Hub struct {
	clients       map[*Client]bool
	rooms         map[string]map[*Client]bool
	broadcast     chan []byte
	roomBroadcast chan RoomMessage
	register      chan *Client
	unregister    chan *Client
	mutex         sync.RWMutex
	ctx           context.Context
	cancel        context.CancelFunc
}

// NewHub creates a new WebSocket hub
func NewHub(ctx context.Context) *Hub {
	hubCtx, cancel := context.WithCancel(ctx)
	return &Hub{
		clients:       make(map[*Client]bool),
		rooms:         make(map[string]map[*Client]bool),
		broadcast:     make(chan []byte, 256),
		roomBroadcast: make(chan RoomMessage, 256),
		register:      make(chan *Client),
		unregister:    make(chan *Client),
		ctx:           hubCtx,
		cancel:        cancel,
	}
}

// Run starts the WebSocket hub
func (h *Hub) Run() {
	defer h.cancel()

	heartbeatTicker := time.NewTicker(30 * time.Second)
	defer heartbeatTicker.Stop()

	cleanupTicker := time.NewTicker(5 * time.Minute)
	defer cleanupTicker.Stop()

	for {
		select {
		case <-h.ctx.Done():
			logrus.Info("WebSocket hub shutting down")
			return
		case client := <-h.register:
			h.registerClient(client)
		case client := <-h.unregister:
			h.unregisterClient(client)
		case message := <-h.broadcast:
			h.broadcastToAll(message)
		case roomMsg := <-h.roomBroadcast:
			h.broadcastToRoom(roomMsg.Room, roomMsg.Message, roomMsg.Exclude)
		case <-heartbeatTicker.C:
			h.sendHeartbeat()
		case <-cleanupTicker.C:
			h.cleanupInactiveClients()
		}
	}
}

func (h *Hub) registerClient(client *Client) {
	h.mutex.Lock()
	defer h.mutex.Unlock()
	h.clients[client] = true
	client.lastSeen = time.Now()
	logrus.WithFields(logrus.Fields{
		"user_id": client.userID, "total_clients": len(h.clients),
	}).Info("Client connected to WebSocket hub")
}

func (h *Hub) unregisterClient(client *Client) {
	h.mutex.Lock()
	defer h.mutex.Unlock()
	if _, ok := h.clients[client]; ok {
		for room := range client.rooms {
			h.removeFromRoom(room, client)
		}
		delete(h.clients, client)
		close(client.send)
		logrus.WithFields(logrus.Fields{
			"user_id": client.userID, "total_clients": len(h.clients),
		}).Info("Client disconnected from WebSocket hub")
	}
}

func (h *Hub) broadcastToAll(message []byte) {
	h.mutex.RLock()
	defer h.mutex.RUnlock()
	for client := range h.clients {
		select {
		case client.send <- message:
		default:
			h.unregisterClient(client)
		}
	}
}

func (h *Hub) broadcastToRoom(room string, message []byte, exclude *Client) {
	h.mutex.RLock()
	defer h.mutex.RUnlock()
	if clients, exists := h.rooms[room]; exists {
		for client := range clients {
			if exclude != nil && client == exclude {
				continue
			}
			select {
			case client.send <- message:
			default:
				h.unregisterClient(client)
			}
		}
	}
}

func (h *Hub) addToRoom(room string, client *Client) {
	h.mutex.Lock()
	defer h.mutex.Unlock()
	if h.rooms[room] == nil {
		h.rooms[room] = make(map[*Client]bool)
	}
	h.rooms[room][client] = true
	client.mutex.Lock()
	client.rooms[room] = true
	client.mutex.Unlock()
	logrus.WithFields(logrus.Fields{
		"user_id": client.userID, "room": room,
		"room_clients": len(h.rooms[room]),
	}).Debug("Client joined room")
}

func (h *Hub) removeFromRoom(room string, client *Client) {
	if clients, exists := h.rooms[room]; exists {
		delete(clients, client)
		if len(clients) == 0 {
			delete(h.rooms, room)
		}
	}
	client.mutex.Lock()
	delete(client.rooms, room)
	client.mutex.Unlock()
}

func (h *Hub) sendHeartbeat() {
	message := WebSocketMessage{
		Type: MessageTypeHeartbeat, Timestamp: time.Now(),
	}
	data, err := json.Marshal(message)
	if err != nil {
		logrus.WithError(err).Error("Failed to marshal heartbeat message")
		return
	}
	h.broadcastToAll(data)
}

func (h *Hub) cleanupInactiveClients() {
	h.mutex.Lock()
	defer h.mutex.Unlock()
	timeout := 10 * time.Minute
	now := time.Now()
	var inactiveClients []*Client
	for client := range h.clients {
		if now.Sub(client.lastSeen) > timeout {
			inactiveClients = append(inactiveClients, client)
		}
	}
	for _, client := range inactiveClients {
		h.unregisterClient(client)
	}
}

