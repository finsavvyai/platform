package services

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/sirupsen/logrus"
)

func TestNewWSHub(t *testing.T) {
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	hub := NewWSHub(logger)

	if hub == nil {
		t.Fatal("NewWSHub returned nil")
	}
	if hub.clients == nil {
		t.Error("clients map is nil")
	}
	if hub.broadcast == nil {
		t.Error("broadcast channel is nil")
	}
	if hub.register == nil {
		t.Error("register channel is nil")
	}
	if hub.unregister == nil {
		t.Error("unregister channel is nil")
	}
}

func TestHub_RegisterUnregister(t *testing.T) {
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	hub := NewWSHub(logger)
	go hub.Run()

	client := &WSClient{
		Send:   make(chan []byte, 256),
		Hub:    hub,
		Logger: logger,
	}

	// Register
	hub.register <- client
	time.Sleep(50 * time.Millisecond)

	// Unregister
	hub.unregister <- client
	time.Sleep(50 * time.Millisecond)

	// Send channel should be closed after unregister
	_, open := <-client.Send
	if open {
		t.Error("Send channel should be closed after unregister")
	}
}

func TestHub_Broadcast(t *testing.T) {
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	hub := NewWSHub(logger)
	go hub.Run()

	client1 := &WSClient{
		Send:   make(chan []byte, 256),
		Hub:    hub,
		Logger: logger,
	}
	client2 := &WSClient{
		Send:   make(chan []byte, 256),
		Hub:    hub,
		Logger: logger,
	}

	hub.register <- client1
	hub.register <- client2
	time.Sleep(50 * time.Millisecond)

	// Broadcast a message
	hub.Broadcast("test_event", "payload_data")
	time.Sleep(50 * time.Millisecond)

	// Both clients should receive the message
	select {
	case msg := <-client1.Send:
		var wsMsg WSMessage
		if err := json.Unmarshal(msg, &wsMsg); err != nil {
			t.Fatalf("Unmarshal client1 msg error: %v", err)
		}
		if wsMsg.Type != "test_event" {
			t.Errorf("client1 Type = %q, want %q", wsMsg.Type, "test_event")
		}
	default:
		t.Error("client1 did not receive broadcast")
	}

	select {
	case msg := <-client2.Send:
		var wsMsg WSMessage
		if err := json.Unmarshal(msg, &wsMsg); err != nil {
			t.Fatalf("Unmarshal client2 msg error: %v", err)
		}
		if wsMsg.Type != "test_event" {
			t.Errorf("client2 Type = %q, want %q", wsMsg.Type, "test_event")
		}
	default:
		t.Error("client2 did not receive broadcast")
	}
}

func TestWSMessage_Serialization(t *testing.T) {
	msg := WSMessage{
		Type:    "cluster_update",
		Payload: map[string]interface{}{"nodes": 3},
	}

	data, err := json.Marshal(msg)
	if err != nil {
		t.Fatalf("Marshal error: %v", err)
	}

	var decoded WSMessage
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Unmarshal error: %v", err)
	}
	if decoded.Type != "cluster_update" {
		t.Errorf("Type = %q, want %q", decoded.Type, "cluster_update")
	}
}

func TestWSMessage_NilPayload(t *testing.T) {
	msg := WSMessage{Type: "ping", Payload: nil}
	data, err := json.Marshal(msg)
	if err != nil {
		t.Fatalf("Marshal error: %v", err)
	}

	var decoded WSMessage
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Unmarshal error: %v", err)
	}
	if decoded.Type != "ping" {
		t.Errorf("Type = %q, want %q", decoded.Type, "ping")
	}
	if decoded.Payload != nil {
		t.Error("Payload should be nil")
	}
}

func TestHub_BroadcastMethod(t *testing.T) {
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	hub := NewWSHub(logger)
	go hub.Run()

	client := &WSClient{
		Send:   make(chan []byte, 256),
		Hub:    hub,
		Logger: logger,
	}

	hub.register <- client
	time.Sleep(50 * time.Millisecond)

	hub.Broadcast("node_added", "node-123")
	time.Sleep(50 * time.Millisecond)

	select {
	case msg := <-client.Send:
		var wsMsg WSMessage
		json.Unmarshal(msg, &wsMsg)
		if wsMsg.Type != "node_added" {
			t.Errorf("Type = %q, want %q", wsMsg.Type, "node_added")
		}
	default:
		t.Error("client did not receive broadcast from Broadcast method")
	}
}

func TestHub_UnregisterNonexistentClient(t *testing.T) {
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	hub := NewWSHub(logger)
	go hub.Run()

	client := &WSClient{
		Send:   make(chan []byte, 256),
		Hub:    hub,
		Logger: logger,
	}

	// Unregister without registering - should not panic
	hub.unregister <- client
	time.Sleep(50 * time.Millisecond)
}
