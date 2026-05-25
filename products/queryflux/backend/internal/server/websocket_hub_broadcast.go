package server

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"

	"github.com/sirupsen/logrus"
)

// BroadcastMetrics broadcasts database metrics to metrics rooms
func (h *Hub) BroadcastMetrics(connectionID string, metrics *entities.DatabaseMetrics) {
	room := fmt.Sprintf("%s_%s", RoomTypeMetrics, connectionID)
	message := WebSocketMessage{
		Type: MessageTypeMetrics, Room: room,
		Data: metrics, Timestamp: time.Now(),
	}
	data, err := json.Marshal(message)
	if err != nil {
		logrus.WithError(err).Error("Failed to marshal metrics message")
		return
	}
	h.roomBroadcast <- RoomMessage{Room: room, Message: data}
}

// BroadcastQueryProgress broadcasts query execution progress
func (h *Hub) BroadcastQueryProgress(queryID string, progress *QueryProgressData) {
	room := fmt.Sprintf("%s_%s", RoomTypeQuery, queryID)
	message := WebSocketMessage{
		Type: MessageTypeQueryProgress, Room: room,
		Data: progress, Timestamp: time.Now(), RequestID: queryID,
	}
	data, err := json.Marshal(message)
	if err != nil {
		logrus.WithError(err).Error("Failed to marshal query progress message")
		return
	}
	h.roomBroadcast <- RoomMessage{Room: room, Message: data}
}

// BroadcastQueryResult broadcasts final query results
func (h *Hub) BroadcastQueryResult(queryID string, query *entities.Query) {
	room := fmt.Sprintf("%s_%s", RoomTypeQuery, queryID)
	message := WebSocketMessage{
		Type: MessageTypeQueryResult, Room: room,
		Data: query, Timestamp: time.Now(), RequestID: queryID,
	}
	data, err := json.Marshal(message)
	if err != nil {
		logrus.WithError(err).Error("Failed to marshal query result message")
		return
	}
	h.roomBroadcast <- RoomMessage{Room: room, Message: data}
}

// BroadcastCollaborativeEdit broadcasts collaborative editing operations
func (h *Hub) BroadcastCollaborativeEdit(documentID string, editData *CollaborativeEditData, exclude *Client) {
	room := fmt.Sprintf("%s_%s", RoomTypeCollabEdit, documentID)
	message := WebSocketMessage{
		Type: MessageTypeCollabEdit, Room: room,
		Data: editData, Timestamp: time.Now(), UserID: editData.UserID,
	}
	data, err := json.Marshal(message)
	if err != nil {
		logrus.WithError(err).Error("Failed to marshal collaborative edit message")
		return
	}
	h.roomBroadcast <- RoomMessage{Room: room, Message: data, Exclude: exclude}
}

// GetStats returns hub statistics
func (h *Hub) GetStats() map[string]interface{} {
	h.mutex.RLock()
	defer h.mutex.RUnlock()
	roomStats := make(map[string]int)
	for room, clients := range h.rooms {
		roomStats[room] = len(clients)
	}
	return map[string]interface{}{
		"total_clients": len(h.clients),
		"total_rooms":   len(h.rooms),
		"room_stats":    roomStats,
	}
}

// Shutdown gracefully shuts down the hub
func (h *Hub) Shutdown() {
	logrus.Info("Shutting down WebSocket hub")
	h.cancel()
	h.mutex.Lock()
	defer h.mutex.Unlock()
	for client := range h.clients {
		close(client.send)
		client.conn.Close()
	}
}

// Test helper methods

func (h *Hub) GetRegisterChannel() chan *Client              { return h.register }
func (h *Hub) GetUnregisterChannel() chan *Client             { return h.unregister }
func (h *Hub) AddToRoom(room string, client *Client)          { h.addToRoom(room, client) }
func (h *Hub) RemoveFromRoom(room string, client *Client)     { h.removeFromRoom(room, client) }
