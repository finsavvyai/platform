package services

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

func TestWritePump_BatchMessages(t *testing.T) {
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
		client.Send <- []byte("msg1")
		client.Send <- []byte("msg2")
		client.Send <- []byte("msg3")
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
	if len(msg) == 0 {
		t.Error("received empty message")
	}
}

func TestWritePump_ConnWriteError(t *testing.T) {
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
		time.Sleep(20 * time.Millisecond)
		conn.Close()
		client.Send <- []byte("after-close")
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
	case <-time.After(5 * time.Second):
		t.Error("WritePump did not exit on connection error")
	}
}
