package sdln

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestWebSocketService_Connect(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	tests := []struct {
		name          string
		setupMock     func()
		options       *WebSocketOptions
		expectedError bool
		errorMsg      string
	}{
		{
			name: "successful connection",
			setupMock: func() {
				response := map[string]interface{}{
					"connection_id": "ws-conn-123",
					"status":        "connected",
					"server_url":    server.URL() + "/ws",
					"connected_at":  time.Now().Format(time.RFC3339),
				}
				server.SetResponse("POST", "/api/v1/websocket/connect", response)
			},
			options: &WebSocketOptions{
				Protocols: []string{"json"},
				Headers:   map[string]string{"User-Agent": "sdlc-sdk-go"},
			},
			expectedError: false,
		},
		{
			name: "connection failure",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "connection failed",
						"code":    500,
					},
				}
				server.SetResponse("POST", "/api/v1/websocket/connect", errorResp)
			},
			options: &WebSocketOptions{
				Protocols: []string{"json"},
			},
			expectedError: true,
			errorMsg:      "connection failed",
		},
		{
			name: "invalid protocol",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "unsupported protocol",
						"code":    400,
					},
				}
				server.SetResponse("POST", "/api/v1/websocket/connect", errorResp)
			},
			options: &WebSocketOptions{
				Protocols: []string{"invalid-protocol"},
			},
			expectedError: true,
			errorMsg:      "unsupported protocol",
		},
		{
			name: "server unavailable",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "websocket server unavailable",
						"code":    503,
					},
				}
				server.SetResponse("POST", "/api/v1/websocket/connect", errorResp)
			},
			options:       &WebSocketOptions{},
			expectedError: true,
			errorMsg:      "websocket server unavailable",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupMock != nil {
				tt.setupMock()
			}

			result, err := client.WebSocket.Connect(TestContext(), tt.options)

			if tt.expectedError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(strings.ToLower(err.Error()), strings.ToLower(tt.errorMsg)) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}
				if result == nil {
					t.Fatal("Expected non-nil result")
				}
				if result.ConnectionID == "" {
					t.Fatal("Expected connection ID to be set")
				}
				if result.Status != "connected" {
					t.Fatalf("Expected connected status, got %s", result.Status)
				}
			}
		})
	}
}

func TestWebSocketService_Disconnect(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	tests := []struct {
		name          string
		setupMock     func()
		connectionID  string
		expectedError bool
		errorMsg      string
	}{
		{
			name: "successful disconnection",
			setupMock: func() {
				response := map[string]interface{}{
					"success":       true,
					"message":       "disconnected",
					"connection_id": "ws-conn-123",
				}
				server.SetResponse("POST", "/api/v1/websocket/disconnect", response)
			},
			connectionID:  "ws-conn-123",
			expectedError: false,
		},
		{
			name:          "empty connection ID",
			connectionID:  "",
			expectedError: true,
			errorMsg:      "connection ID cannot be empty",
		},
		{
			name: "connection not found",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "connection not found",
						"code":    404,
					},
				}
				server.SetResponse("POST", "/api/v1/websocket/disconnect", errorResp)
			},
			connectionID:  "nonexistent",
			expectedError: true,
			errorMsg:      "connection not found",
		},
		{
			name: "already disconnected",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "connection already disconnected",
						"code":    400,
					},
				}
				server.SetResponse("POST", "/api/v1/websocket/disconnect", errorResp)
			},
			connectionID:  "already-disconnected",
			expectedError: true,
			errorMsg:      "connection already disconnected",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupMock != nil {
				tt.setupMock()
			}

			err := client.WebSocket.Disconnect(TestContext(), tt.connectionID)

			if tt.expectedError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(strings.ToLower(err.Error()), strings.ToLower(tt.errorMsg)) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}
			}
		})
	}
}

func TestWebSocketService_SendMessage(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	tests := []struct {
		name          string
		setupMock     func()
		connectionID  string
		message       *WebSocketMessage
		expectedError bool
		errorMsg      string
	}{
		{
			name: "successful message send",
			setupMock: func() {
				response := map[string]interface{}{
					"success":       true,
					"message_id":    "msg-123",
					"connection_id": "ws-conn-123",
					"sent_at":       time.Now().Format(time.RFC3339),
				}
				server.SetResponse("POST", "/api/v1/websocket/send", response)
			},
			connectionID: "ws-conn-123",
			message: &WebSocketMessage{
				Type: "chat",
				Data: map[string]interface{}{
					"text": "Hello, world!",
				},
			},
			expectedError: false,
		},
		{
			name:          "empty connection ID",
			connectionID:  "",
			message:       &WebSocketMessage{Type: "test"},
			expectedError: true,
			errorMsg:      "connection ID cannot be empty",
		},
		{
			name:          "nil message",
			connectionID:  "ws-conn-123",
			message:       nil,
			expectedError: true,
			errorMsg:      "message cannot be nil",
		},
		{
			name:         "empty message type",
			connectionID: "ws-conn-123",
			message: &WebSocketMessage{
				Type: "",
				Data: map[string]interface{}{"test": "data"},
			},
			expectedError: true,
			errorMsg:      "message type cannot be empty",
		},
		{
			name: "connection not found",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "connection not found",
						"code":    404,
					},
				}
				server.SetResponse("POST", "/api/v1/websocket/send", errorResp)
			},
			connectionID: "nonexistent",
			message: &WebSocketMessage{
				Type: "test",
				Data: map[string]interface{}{"test": "data"},
			},
			expectedError: true,
			errorMsg:      "connection not found",
		},
		{
			name: "message too large",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "message too large",
						"code":    413,
					},
				}
				server.SetResponse("POST", "/api/v1/websocket/send", errorResp)
			},
			connectionID: "ws-conn-123",
			message: &WebSocketMessage{
				Type: "large",
				Data: map[string]interface{}{
					"text": strings.Repeat("x", 1024*1024), // 1MB string
				},
			},
			expectedError: true,
			errorMsg:      "message too large",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupMock != nil {
				tt.setupMock()
			}

			result, err := client.WebSocket.SendMessage(TestContext(), tt.connectionID, tt.message)

			if tt.expectedError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(strings.ToLower(err.Error()), strings.ToLower(tt.errorMsg)) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}
				if result == nil {
					t.Fatal("Expected non-nil result")
				}
				if result.MessageID == "" {
					t.Fatal("Expected message ID to be set")
				}
			}
		})
	}
}

func TestWebSocketService_ReceiveMessage(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	tests := []struct {
		name          string
		setupMock     func()
		connectionID  string
		expectedError bool
		errorMsg      string
	}{
		{
			name: "successful message receive",
			setupMock: func() {
				response := WebSocketMessage{
					ID:   "msg-123",
					Type: "chat",
					Data: map[string]interface{}{
						"text": "Hello back!",
					},
					Timestamp: time.Now(),
				}
				server.SetResponse("GET", "/api/v1/websocket/receive", response)
			},
			connectionID:  "ws-conn-123",
			expectedError: false,
		},
		{
			name:          "empty connection ID",
			connectionID:  "",
			expectedError: true,
			errorMsg:      "connection ID cannot be empty",
		},
		{
			name: "connection not found",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "connection not found",
						"code":    404,
					},
				}
				server.SetResponse("GET", "/api/v1/websocket/receive", errorResp)
			},
			connectionID:  "nonexistent",
			expectedError: true,
			errorMsg:      "connection not found",
		},
		{
			name: "no messages available",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "no messages available",
						"code":    404,
					},
				}
				server.SetResponse("GET", "/api/v1/websocket/receive", errorResp)
			},
			connectionID:  "ws-conn-123",
			expectedError: true,
			errorMsg:      "no messages available",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupMock != nil {
				tt.setupMock()
			}

			result, err := client.WebSocket.ReceiveMessage(TestContext(), tt.connectionID)

			if tt.expectedError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(strings.ToLower(err.Error()), strings.ToLower(tt.errorMsg)) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}
				if result == nil {
					t.Fatal("Expected non-nil result")
				}
				if result.ID == "" {
					t.Fatal("Expected message ID to be set")
				}
				if result.Type == "" {
					t.Fatal("Expected message type to be set")
				}
			}
		})
	}
}

func TestWebSocketService_Subscribe(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	tests := []struct {
		name          string
		setupMock     func()
		connectionID  string
		subscription  *WebSocketSubscription
		expectedError bool
		errorMsg      string
	}{
		{
			name: "successful subscription",
			setupMock: func() {
				response := map[string]interface{}{
					"success":         true,
					"subscription_id": "sub-123",
					"connection_id":   "ws-conn-123",
					"channel":         "chat.room1",
					"subscribed_at":   time.Now().Format(time.RFC3339),
				}
				server.SetResponse("POST", "/api/v1/websocket/subscribe", response)
			},
			connectionID: "ws-conn-123",
			subscription: &WebSocketSubscription{
				Channel: "chat.room1",
				Filters: map[string]interface{}{
					"user_id": "user-123",
				},
			},
			expectedError: false,
		},
		{
			name:          "empty connection ID",
			connectionID:  "",
			subscription:  &WebSocketSubscription{Channel: "test"},
			expectedError: true,
			errorMsg:      "connection ID cannot be empty",
		},
		{
			name:          "nil subscription",
			connectionID:  "ws-conn-123",
			subscription:  nil,
			expectedError: true,
			errorMsg:      "subscription cannot be nil",
		},
		{
			name:         "empty channel",
			connectionID: "ws-conn-123",
			subscription: &WebSocketSubscription{
				Channel: "",
				Filters: map[string]interface{}{"test": "filter"},
			},
			expectedError: true,
			errorMsg:      "channel cannot be empty",
		},
		{
			name: "connection not found",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "connection not found",
						"code":    404,
					},
				}
				server.SetResponse("POST", "/api/v1/websocket/subscribe", errorResp)
			},
			connectionID: "nonexistent",
			subscription: &WebSocketSubscription{
				Channel: "test.channel",
			},
			expectedError: true,
			errorMsg:      "connection not found",
		},
		{
			name: "already subscribed",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "already subscribed to channel",
						"code":    409,
					},
				}
				server.SetResponse("POST", "/api/v1/websocket/subscribe", errorResp)
			},
			connectionID: "ws-conn-123",
			subscription: &WebSocketSubscription{
				Channel: "already.subscribed",
			},
			expectedError: true,
			errorMsg:      "already subscribed",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupMock != nil {
				tt.setupMock()
			}

			result, err := client.WebSocket.Subscribe(TestContext(), tt.connectionID, tt.subscription)

			if tt.expectedError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(strings.ToLower(err.Error()), strings.ToLower(tt.errorMsg)) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}
				if result == nil {
					t.Fatal("Expected non-nil result")
				}
				if result.SubscriptionID == "" {
					t.Fatal("Expected subscription ID to be set")
				}
				if result.Channel != tt.subscription.Channel {
					t.Fatalf("Expected channel %q, got %q", tt.subscription.Channel, result.Channel)
				}
			}
		})
	}
}

func TestWebSocketService_Unsubscribe(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	tests := []struct {
		name           string
		setupMock      func()
		connectionID   string
		subscriptionID string
		expectedError  bool
		errorMsg       string
	}{
		{
			name: "successful unsubscription",
			setupMock: func() {
				response := map[string]interface{}{
					"success":         true,
					"subscription_id": "sub-123",
					"connection_id":   "ws-conn-123",
					"channel":         "chat.room1",
					"unsubscribed_at": time.Now().Format(time.RFC3339),
				}
				server.SetResponse("POST", "/api/v1/websocket/unsubscribe", response)
			},
			connectionID:   "ws-conn-123",
			subscriptionID: "sub-123",
			expectedError:  false,
		},
		{
			name:           "empty connection ID",
			connectionID:   "",
			subscriptionID: "sub-123",
			expectedError:  true,
			errorMsg:       "connection ID cannot be empty",
		},
		{
			name:           "empty subscription ID",
			connectionID:   "ws-conn-123",
			subscriptionID: "",
			expectedError:  true,
			errorMsg:       "subscription ID cannot be empty",
		},
		{
			name: "connection not found",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "connection not found",
						"code":    404,
					},
				}
				server.SetResponse("POST", "/api/v1/websocket/unsubscribe", errorResp)
			},
			connectionID:   "nonexistent",
			subscriptionID: "sub-123",
			expectedError:  true,
			errorMsg:       "connection not found",
		},
		{
			name: "subscription not found",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "subscription not found",
						"code":    404,
					},
				}
				server.SetResponse("POST", "/api/v1/websocket/unsubscribe", errorResp)
			},
			connectionID:   "ws-conn-123",
			subscriptionID: "nonexistent",
			expectedError:  true,
			errorMsg:       "subscription not found",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupMock != nil {
				tt.setupMock()
			}

			err := client.WebSocket.Unsubscribe(TestContext(), tt.connectionID, tt.subscriptionID)

			if tt.expectedError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(strings.ToLower(err.Error()), strings.ToLower(tt.errorMsg)) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}
			}
		})
	}
}

func TestWebSocketService_ListConnections(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	tests := []struct {
		name          string
		setupMock     func()
		expectedError bool
		errorMsg      string
	}{
		{
			name: "successful list connections",
			setupMock: func() {
				response := []WebSocketConnection{
					{
						ID:          "ws-conn-1",
						Status:      "connected",
						ServerURL:   server.URL() + "/ws",
						ConnectedAt: time.Now(),
					},
					{
						ID:          "ws-conn-2",
						Status:      "connected",
						ServerURL:   server.URL() + "/ws",
						ConnectedAt: time.Now(),
					},
				}
				server.SetResponse("GET", "/api/v1/websocket/connections", response)
			},
			expectedError: false,
		},
		{
			name: "empty connections list",
			setupMock: func() {
				response := []WebSocketConnection{}
				server.SetResponse("GET", "/api/v1/websocket/connections", response)
			},
			expectedError: false,
		},
		{
			name: "server error",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "failed to list connections",
						"code":    500,
					},
				}
				server.SetResponse("GET", "/api/v1/websocket/connections", errorResp)
			},
			expectedError: true,
			errorMsg:      "failed to list connections",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupMock != nil {
				tt.setupMock()
			}

			result, err := client.WebSocket.ListConnections(TestContext())

			if tt.expectedError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(strings.ToLower(err.Error()), strings.ToLower(tt.errorMsg)) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}
				if result == nil {
					t.Fatal("Expected non-nil result")
				}
			}
		})
	}
}

func TestWebSocketService_GetConnection(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	tests := []struct {
		name          string
		setupMock     func()
		connectionID  string
		expectedError bool
		errorMsg      string
	}{
		{
			name: "successful get connection",
			setupMock: func() {
				response := WebSocketConnection{
					ID:          "ws-conn-123",
					Status:      "connected",
					ServerURL:   server.URL() + "/ws",
					ConnectedAt: time.Now(),
					Subscriptions: []WebSocketSubscription{
						{
							SubscriptionID: "sub-1",
							Channel:        "chat.room1",
						},
					},
				}
				server.SetResponse("GET", "/api/v1/websocket/connections/ws-conn-123", response)
			},
			connectionID:  "ws-conn-123",
			expectedError: false,
		},
		{
			name:          "empty connection ID",
			connectionID:  "",
			expectedError: true,
			errorMsg:      "connection ID cannot be empty",
		},
		{
			name: "connection not found",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "connection not found",
						"code":    404,
					},
				}
				server.SetResponse("GET", "/api/v1/websocket/connections/nonexistent", errorResp)
			},
			connectionID:  "nonexistent",
			expectedError: true,
			errorMsg:      "connection not found",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupMock != nil {
				tt.setupMock()
			}

			result, err := client.WebSocket.GetConnection(TestContext(), tt.connectionID)

			if tt.expectedError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(strings.ToLower(err.Error()), strings.ToLower(tt.errorMsg)) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}
				if result == nil {
					t.Fatal("Expected non-nil result")
				}
				if result.ID != tt.connectionID {
					t.Fatalf("Expected connection ID %q, got %q", tt.connectionID, result.ID)
				}
			}
		})
	}
}

func TestWebSocketService_ListSubscriptions(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	tests := []struct {
		name          string
		setupMock     func()
		connectionID  string
		expectedError bool
		errorMsg      string
	}{
		{
			name: "successful list subscriptions",
			setupMock: func() {
				response := []WebSocketSubscription{
					{
						SubscriptionID: "sub-1",
						Channel:        "chat.room1",
						Filters: map[string]interface{}{
							"user_id": "user-1",
						},
					},
					{
						SubscriptionID: "sub-2",
						Channel:        "notifications.global",
						Filters:        map[string]interface{}{},
					},
				}
				server.SetResponse("GET", "/api/v1/websocket/connections/ws-conn-123/subscriptions", response)
			},
			connectionID:  "ws-conn-123",
			expectedError: false,
		},
		{
			name: "empty subscriptions list",
			setupMock: func() {
				response := []WebSocketSubscription{}
				server.SetResponse("GET", "/api/v1/websocket/connections/ws-conn-123/subscriptions", response)
			},
			connectionID:  "ws-conn-123",
			expectedError: false,
		},
		{
			name: "connection not found",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "connection not found",
						"code":    404,
					},
				}
				server.SetResponse("GET", "/api/v1/websocket/connections/nonexistent/subscriptions", errorResp)
			},
			connectionID:  "nonexistent",
			expectedError: true,
			errorMsg:      "connection not found",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupMock != nil {
				tt.setupMock()
			}

			result, err := client.WebSocket.ListSubscriptions(TestContext(), tt.connectionID)

			if tt.expectedError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(strings.ToLower(err.Error()), strings.ToLower(tt.errorMsg)) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}
				if result == nil {
					t.Fatal("Expected non-nil result")
				}
			}
		})
	}
}

func TestWebSocketService_Broadcast(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	tests := []struct {
		name          string
		setupMock     func()
		channel       string
		message       *WebSocketMessage
		expectedError bool
		errorMsg      string
	}{
		{
			name: "successful broadcast",
			setupMock: func() {
				response := map[string]interface{}{
					"success":    true,
					"message_id": "broadcast-123",
					"channel":    "chat.global",
					"recipients": 15,
					"sent_at":    time.Now().Format(time.RFC3339),
				}
				server.SetResponse("POST", "/api/v1/websocket/broadcast", response)
			},
			channel: "chat.global",
			message: &WebSocketMessage{
				Type: "announcement",
				Data: map[string]interface{}{
					"text": "Welcome to the chat!",
				},
			},
			expectedError: false,
		},
		{
			name:          "empty channel",
			channel:       "",
			message:       &WebSocketMessage{Type: "test"},
			expectedError: true,
			errorMsg:      "channel cannot be empty",
		},
		{
			name:          "nil message",
			channel:       "test.channel",
			message:       nil,
			expectedError: true,
			errorMsg:      "message cannot be nil",
		},
		{
			name:    "empty message type",
			channel: "test.channel",
			message: &WebSocketMessage{
				Type: "",
				Data: map[string]interface{}{"test": "data"},
			},
			expectedError: true,
			errorMsg:      "message type cannot be empty",
		},
		{
			name: "channel not found",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "channel not found",
						"code":    404,
					},
				}
				server.SetResponse("POST", "/api/v1/websocket/broadcast", errorResp)
			},
			channel: "nonexistent.channel",
			message: &WebSocketMessage{
				Type: "test",
				Data: map[string]interface{}{"test": "data"},
			},
			expectedError: true,
			errorMsg:      "channel not found",
		},
		{
			name: "broadcast to inactive channel",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "no active subscribers in channel",
						"code":    404,
					},
				}
				server.SetResponse("POST", "/api/v1/websocket/broadcast", errorResp)
			},
			channel: "inactive.channel",
			message: &WebSocketMessage{
				Type: "test",
				Data: map[string]interface{}{"test": "data"},
			},
			expectedError: true,
			errorMsg:      "no active subscribers",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupMock != nil {
				tt.setupMock()
			}

			result, err := client.WebSocket.Broadcast(TestContext(), tt.channel, tt.message)

			if tt.expectedError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(strings.ToLower(err.Error()), strings.ToLower(tt.errorMsg)) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}
				if result == nil {
					t.Fatal("Expected non-nil result")
				}
				if result.MessageID == "" {
					t.Fatal("Expected message ID to be set")
				}
				if result.Channel != tt.channel {
					t.Fatalf("Expected channel %q, got %q", tt.channel, result.Channel)
				}
			}
		})
	}
}

func TestWebSocketService_ContextCancellation(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	ctx, cancel := context.WithCancel(context.Background())

	// Cancel the context immediately
	cancel()

	options := &WebSocketOptions{
		Protocols: []string{"json"},
	}

	_, err := client.WebSocket.Connect(ctx, options)
	if err == nil {
		t.Fatal("Expected context cancellation error")
	}
	if !strings.Contains(strings.ToLower(err.Error()), "context canceled") {
		t.Fatalf("Expected context cancellation error, got %v", err)
	}
}

func TestWebSocketService_StreamingMessages(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	// Test successful streaming
	t.Run("successful streaming", func(t *testing.T) {
		// Setup mock response for streaming
		response := map[string]interface{}{
			"streaming": true,
			"messages": []WebSocketMessage{
				{
					ID:   "msg-1",
					Type: "chat",
					Data: map[string]interface{}{"text": "Hello"},
				},
				{
					ID:   "msg-2",
					Type: "chat",
					Data: map[string]interface{}{"text": "World"},
				},
			},
		}
		server.SetResponse("GET", "/api/v1/websocket/stream", response)

		ctx := TestContext()
		messageChan, err := client.WebSocket.StreamMessages(ctx, "ws-conn-123")
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}

		if messageChan == nil {
			t.Fatal("Expected non-nil message channel")
		}

		// Test channel reception
		select {
		case message, ok := <-messageChan:
			if !ok {
				t.Fatal("Channel closed unexpectedly")
			}
			if message.ID == "" {
				t.Fatal("Expected message ID to be set")
			}
			if message.Type == "" {
				t.Fatal("Expected message type to be set")
			}
		case <-time.After(5 * time.Second):
			t.Fatal("Timeout waiting for streaming message")
		}
	})

	// Test streaming error
	t.Run("streaming error", func(t *testing.T) {
		errorResp := map[string]interface{}{
			"error": map[string]interface{}{
				"message": "streaming failed",
				"code":    500,
			},
		}
		server.SetResponse("GET", "/api/v1/websocket/stream", errorResp)

		ctx := TestContext()
		_, err := client.WebSocket.StreamMessages(ctx, "invalid-connection")
		if err == nil {
			t.Fatal("Expected error but got none")
		}
		if !strings.Contains(strings.ToLower(err.Error()), "streaming failed") {
			t.Fatalf("Expected streaming error, got %v", err)
		}
	})
}

func TestWebSocketService_JsonSerialization(t *testing.T) {
	t.Run("WebSocketMessage serialization", func(t *testing.T) {
		message := &WebSocketMessage{
			ID:        "msg-123",
			Type:      "chat",
			Timestamp: time.Now(),
			Data: map[string]interface{}{
				"text":    "Hello, world!",
				"user_id": "user-123",
				"room":    "general",
			},
		}

		data, err := json.Marshal(message)
		if err != nil {
			t.Fatalf("Failed to marshal WebSocket message: %v", err)
		}

		var decoded WebSocketMessage
		err = json.Unmarshal(data, &decoded)
		if err != nil {
			t.Fatalf("Failed to unmarshal WebSocket message: %v", err)
		}

		if decoded.ID != message.ID {
			t.Fatalf("Expected ID %q, got %q", message.ID, decoded.ID)
		}
		if decoded.Type != message.Type {
			t.Fatalf("Expected type %q, got %q", message.Type, decoded.Type)
		}
		if decoded.Data["text"] != message.Data["text"] {
			t.Fatalf("Expected text %q, got %q", message.Data["text"], decoded.Data["text"])
		}
	})

	t.Run("WebSocketConnection serialization", func(t *testing.T) {
		connection := &WebSocketConnection{
			ID:          "ws-conn-123",
			Status:      "connected",
			ServerURL:   "wss://api.example.com/ws",
			ConnectedAt: time.Now(),
			Subscriptions: []WebSocketSubscription{
				{
					SubscriptionID: "sub-1",
					Channel:        "chat.room1",
					Filters: map[string]interface{}{
						"user_id": "user-123",
					},
				},
			},
		}

		data, err := json.Marshal(connection)
		if err != nil {
			t.Fatalf("Failed to marshal WebSocket connection: %v", err)
		}

		var decoded WebSocketConnection
		err = json.Unmarshal(data, &decoded)
		if err != nil {
			t.Fatalf("Failed to unmarshal WebSocket connection: %v", err)
		}

		if decoded.ID != connection.ID {
			t.Fatalf("Expected ID %q, got %q", connection.ID, decoded.ID)
		}
		if decoded.Status != connection.Status {
			t.Fatalf("Expected status %q, got %q", connection.Status, decoded.Status)
		}
		if len(decoded.Subscriptions) != len(connection.Subscriptions) {
			t.Fatalf("Expected %d subscriptions, got %d", len(connection.Subscriptions), len(decoded.Subscriptions))
		}
	})
}

func TestWebSocketService_ConcurrentOperations(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	// Setup mock responses for concurrent connections
	for i := 0; i < 10; i++ {
		response := map[string]interface{}{
			"connection_id": fmt.Sprintf("ws-conn-%d", i),
			"status":        "connected",
			"server_url":    server.URL() + "/ws",
			"connected_at":  time.Now().Format(time.RFC3339),
		}
		server.SetResponse("POST", "/api/v1/websocket/connect", response)
	}

	// Test concurrent connections
	const numGoroutines = 10
	var wg sync.WaitGroup
	errors := make(chan error, numGoroutines)
	results := make(chan *WebSocketConnection, numGoroutines)

	wg.Add(numGoroutines)
	for i := 0; i < numGoroutines; i++ {
		go func(id int) {
			defer wg.Done()

			options := &WebSocketOptions{
				Protocols: []string{"json"},
				Headers: map[string]string{
					"X-Connection-ID": fmt.Sprintf("test-%d", id),
				},
			}

			connection, err := client.WebSocket.Connect(TestContext(), options)
			if err != nil {
				errors <- err
				return
			}
			results <- connection
		}(i)
	}

	wg.Wait()
	close(errors)
	close(results)

	// Check for errors
	for err := range errors {
		t.Errorf("Concurrent operation failed: %v", err)
	}

	// Check results
	resultCount := 0
	for range results {
		resultCount++
	}

	if resultCount != numGoroutines {
		t.Errorf("Expected %d results, got %d", numGoroutines, resultCount)
	}
}

func TestWebSocketService_MessageValidation(t *testing.T) {
	client, _ := CreateTestClient(t)

	tests := []struct {
		name      string
		message   *WebSocketMessage
		expectErr bool
		errMsg    string
	}{
		{
			name: "valid message",
			message: &WebSocketMessage{
				Type: "chat",
				Data: map[string]interface{}{
					"text": "Hello, world!",
				},
			},
			expectErr: false,
		},
		{
			name: "empty message type",
			message: &WebSocketMessage{
				Type: "",
				Data: map[string]interface{}{"test": "data"},
			},
			expectErr: true,
			errMsg:    "message type cannot be empty",
		},
		{
			name: "nil data",
			message: &WebSocketMessage{
				Type: "test",
				Data: nil,
			},
			expectErr: true,
			errMsg:    "message data cannot be nil",
		},
		{
			name: "oversized message",
			message: &WebSocketMessage{
				Type: "large",
				Data: map[string]interface{}{
					"payload": strings.Repeat("x", 2*1024*1024), // 2MB string
				},
			},
			expectErr: true,
			errMsg:    "message too large",
		},
		{
			name: "invalid characters in type",
			message: &WebSocketMessage{
				Type: "invalid/type/with/slashes",
				Data: map[string]interface{}{"test": "data"},
			},
			expectErr: true,
			errMsg:    "invalid message type format",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := client.WebSocket.SendMessage(TestContext(), "test-connection", tt.message)

			if tt.expectErr {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errMsg != "" && !strings.Contains(strings.ToLower(err.Error()), strings.ToLower(tt.errMsg)) {
					t.Fatalf("Expected error containing %q, got %q", tt.errMsg, err.Error())
				}
			}
		})
	}
}

func TestWebSocketService_SubscriptionValidation(t *testing.T) {
	client, _ := CreateTestClient(t)

	tests := []struct {
		name         string
		subscription *WebSocketSubscription
		expectErr    bool
		errMsg       string
	}{
		{
			name: "valid subscription",
			subscription: &WebSocketSubscription{
				Channel: "chat.room1",
				Filters: map[string]interface{}{
					"user_id": "user-123",
				},
			},
			expectErr: false,
		},
		{
			name: "empty channel",
			subscription: &WebSocketSubscription{
				Channel: "",
				Filters: map[string]interface{}{"test": "filter"},
			},
			expectErr: true,
			errMsg:    "channel cannot be empty",
		},
		{
			name: "invalid channel format",
			subscription: &WebSocketSubscription{
				Channel: "invalid channel with spaces",
				Filters: map[string]interface{}{},
			},
			expectErr: true,
			errMsg:    "invalid channel format",
		},
		{
			name: "channel too long",
			subscription: &WebSocketSubscription{
				Channel: strings.Repeat("a", 300), // Very long channel name
				Filters: map[string]interface{}{},
			},
			expectErr: true,
			errMsg:    "channel name too long",
		},
		{
			name: "invalid filter values",
			subscription: &WebSocketSubscription{
				Channel: "test.channel",
				Filters: map[string]interface{}{
					"invalid": func() {}, // Function is not serializable
				},
			},
			expectErr: true,
			errMsg:    "invalid filter values",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := client.WebSocket.Subscribe(TestContext(), "test-connection", tt.subscription)

			if tt.expectErr {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errMsg != "" && !strings.Contains(strings.ToLower(err.Error()), strings.ToLower(tt.errMsg)) {
					t.Fatalf("Expected error containing %q, got %q", tt.errMsg, err.Error())
				}
			}
		})
	}
}

func TestWebSocketService_ConnectionValidation(t *testing.T) {
	client, _ := CreateTestClient(t)

	tests := []struct {
		name      string
		options   *WebSocketOptions
		expectErr bool
		errMsg    string
	}{
		{
			name: "valid options",
			options: &WebSocketOptions{
				Protocols: []string{"json", "xml"},
				Headers: map[string]string{
					"User-Agent": "sdlc-sdk-go",
					"X-API-Key":  "test-key",
				},
			},
			expectErr: false,
		},
		{
			name: "invalid protocol",
			options: &WebSocketOptions{
				Protocols: []string{"invalid-protocol-with-spaces"},
			},
			expectErr: true,
			errMsg:    "invalid protocol format",
		},
		{
			name: "too many protocols",
			options: &WebSocketOptions{
				Protocols: make([]string, 20), // Exceeds typical limit
			},
			expectErr: true,
			errMsg:    "too many protocols",
		},
		{
			name: "invalid header key",
			options: &WebSocketOptions{
				Headers: map[string]string{
					"invalid-header-with-spaces": "value",
				},
			},
			expectErr: true,
			errMsg:    "invalid header key format",
		},
		{
			name: "invalid header value",
			options: &WebSocketOptions{
				Headers: map[string]string{
					"User-Agent": string(rune(0)), // Null character
				},
			},
			expectErr: true,
			errMsg:    "invalid header value",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := client.WebSocket.Connect(TestContext(), tt.options)

			if tt.expectErr {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errMsg != "" && !strings.Contains(strings.ToLower(err.Error()), strings.ToLower(tt.errMsg)) {
					t.Fatalf("Expected error containing %q, got %q", tt.errMsg, err.Error())
				}
			}
		})
	}
}
