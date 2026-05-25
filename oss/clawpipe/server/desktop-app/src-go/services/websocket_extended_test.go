package services

import (
	"net/http"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/sirupsen/logrus"
)

var testUpgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

func newTestLogger() *logrus.Logger {
	l := logrus.New()
	l.SetLevel(logrus.ErrorLevel)
	return l
}

func TestHub_RegisterMethod(t *testing.T) {
	logger := newTestLogger()
	hub := NewWSHub(logger)
	go hub.Run()

	client := &WSClient{
		Send:   make(chan []byte, 256),
		Hub:    hub,
		Logger: logger,
	}

	hub.Register(client)
	time.Sleep(50 * time.Millisecond)

	hub.Broadcast("test", "data")
	time.Sleep(50 * time.Millisecond)

	select {
	case <-client.Send:
	default:
		t.Error("client not registered via Register method")
	}
}

func TestHub_UnregisterMethod(t *testing.T) {
	logger := newTestLogger()
	hub := NewWSHub(logger)
	go hub.Run()

	client := &WSClient{
		Send:   make(chan []byte, 256),
		Hub:    hub,
		Logger: logger,
	}

	hub.Register(client)
	time.Sleep(50 * time.Millisecond)

	hub.Unregister(client)
	time.Sleep(50 * time.Millisecond)

	_, open := <-client.Send
	if open {
		t.Error("Send channel should be closed after Unregister")
	}
}

func TestHub_BroadcastFullChannel(t *testing.T) {
	logger := newTestLogger()
	hub := NewWSHub(logger)
	go hub.Run()

	client := &WSClient{
		Send:   make(chan []byte),
		Hub:    hub,
		Logger: logger,
	}

	hub.Register(client)
	time.Sleep(50 * time.Millisecond)

	hub.Broadcast("overflow", "data")
	time.Sleep(100 * time.Millisecond)
}

func TestHub_BroadcastNoClients(t *testing.T) {
	logger := newTestLogger()
	hub := NewWSHub(logger)
	go hub.Run()

	hub.Broadcast("empty", "data")
	time.Sleep(50 * time.Millisecond)
}

func TestHub_Run_DirectBroadcast(t *testing.T) {
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	hub := NewWSHub(logger)
	go hub.Run()

	client := &WSClient{
		Send:   make(chan []byte, 256),
		Hub:    hub,
		Logger: logger,
	}
	hub.Register(client)
	time.Sleep(50 * time.Millisecond)

	hub.broadcast <- WSMessage{Type: "valid", Payload: "data"}
	time.Sleep(50 * time.Millisecond)

	select {
	case <-client.Send:
	default:
		t.Error("client did not receive direct broadcast")
	}
}
