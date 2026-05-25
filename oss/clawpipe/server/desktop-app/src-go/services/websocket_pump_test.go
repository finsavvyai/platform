package services

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

func TestReadPump_ClosesOnError(t *testing.T) {
	logger := newTestLogger()
	hub := NewWSHub(logger)
	go hub.Run()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := testUpgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		client := &WSClient{Conn: conn, Send: make(chan []byte, 256), Hub: hub, Logger: logger}
		hub.Register(client)
		client.ReadPump()
	}))
	defer srv.Close()

	wsURL := "ws" + strings.TrimPrefix(srv.URL, "http")
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("dial error: %v", err)
	}
	conn.Close()
	time.Sleep(200 * time.Millisecond)
}

func TestReadPump_WithMessages(t *testing.T) {
	logger := newTestLogger()
	hub := NewWSHub(logger)
	go hub.Run()

	done := make(chan struct{})
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := testUpgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		client := &WSClient{Conn: conn, Send: make(chan []byte, 256), Hub: hub, Logger: logger}
		hub.Register(client)
		go func() {
			client.ReadPump()
			close(done)
		}()
	}))
	defer srv.Close()

	wsURL := "ws" + strings.TrimPrefix(srv.URL, "http")
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("dial error: %v", err)
	}
	conn.WriteMessage(websocket.TextMessage, []byte("hello"))
	time.Sleep(50 * time.Millisecond)
	conn.Close()

	select {
	case <-done:
	case <-time.After(3 * time.Second):
		t.Error("ReadPump did not exit after client close")
	}
}

func TestReadPump_PongHandler(t *testing.T) {
	logger := newTestLogger()
	hub := NewWSHub(logger)
	go hub.Run()

	done := make(chan struct{})
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := testUpgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		client := &WSClient{Conn: conn, Send: make(chan []byte, 256), Hub: hub, Logger: logger}
		hub.Register(client)
		go func() {
			client.ReadPump()
			close(done)
		}()
	}))
	defer srv.Close()

	wsURL := "ws" + strings.TrimPrefix(srv.URL, "http")
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("dial error: %v", err)
	}
	conn.WriteMessage(websocket.PongMessage, nil)
	time.Sleep(50 * time.Millisecond)
	conn.WriteMessage(websocket.CloseMessage,
		websocket.FormatCloseMessage(websocket.CloseGoingAway, ""))
	conn.Close()

	select {
	case <-done:
	case <-time.After(3 * time.Second):
		t.Error("ReadPump did not exit")
	}
}

func TestWritePump_ChannelClose(t *testing.T) {
	logger := newTestLogger()
	hub := NewWSHub(logger)
	go hub.Run()

	done := make(chan struct{})
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := testUpgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		client := &WSClient{Conn: conn, Send: make(chan []byte, 256), Hub: hub, Logger: logger}
		go func() {
			client.WritePump()
			close(done)
		}()
		time.Sleep(50 * time.Millisecond)
		close(client.Send)
	}))
	defer srv.Close()

	wsURL := "ws" + strings.TrimPrefix(srv.URL, "http")
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("dial error: %v", err)
	}
	defer conn.Close()

	select {
	case <-done:
	case <-time.After(3 * time.Second):
		t.Error("WritePump did not exit after Send channel closed")
	}
}

func TestWritePump_SendMessage(t *testing.T) {
	logger := newTestLogger()
	hub := NewWSHub(logger)
	go hub.Run()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := testUpgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		client := &WSClient{Conn: conn, Send: make(chan []byte, 256), Hub: hub, Logger: logger}
		go client.WritePump()
		client.Send <- []byte("hello")
	}))
	defer srv.Close()

	wsURL := "ws" + strings.TrimPrefix(srv.URL, "http")
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("dial error: %v", err)
	}
	defer conn.Close()

	conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	_, msg, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("read error: %v", err)
	}
	if string(msg) != "hello" {
		t.Errorf("received = %q, want %q", string(msg), "hello")
	}
}

