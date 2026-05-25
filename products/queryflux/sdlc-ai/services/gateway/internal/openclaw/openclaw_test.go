package openclaw

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newTestLogger() *logrus.Logger {
	logger := logrus.New()
	logger.SetLevel(logrus.DebugLevel)
	return logger
}

// ─── Client Tests ────────────────────────────────────────────────────

func TestNewClient(t *testing.T) {
	t.Setenv("OPENCLAW_ENABLED", "true")
	t.Setenv("OPENCLAW_GATEWAY_URL", "http://localhost:9999")
	t.Setenv("OPENCLAW_HOOK_TOKEN", "test-token")

	client := NewClient(newTestLogger())

	assert.NotNil(t, client)
	assert.True(t, client.IsEnabled())
}

func TestNewClientDefaults(t *testing.T) {
	// Clear env
	t.Setenv("OPENCLAW_ENABLED", "false")
	t.Setenv("OPENCLAW_GATEWAY_URL", "")
	t.Setenv("OPENCLAW_HOOK_TOKEN", "")

	client := NewClient(newTestLogger())

	assert.NotNil(t, client)
	assert.False(t, client.IsEnabled())
}

func TestNewClientWithConfig(t *testing.T) {
	cfg := Config{
		Enabled:    true,
		GatewayURL: "http://test:8080",
		HookToken:  "my-token",
	}

	client := NewClientWithConfig(cfg, newTestLogger())

	assert.NotNil(t, client)
	assert.True(t, client.IsEnabled())
}

func TestCheckStatusDisabled(t *testing.T) {
	client := NewClientWithConfig(Config{Enabled: false}, newTestLogger())

	status, err := client.CheckStatus(context.Background())
	assert.NoError(t, err)
	assert.False(t, status.Connected)
	assert.Contains(t, status.Error, "disabled")
}

func TestCheckStatusConnected(t *testing.T) {
	// Start a mock OpenClaw Gateway
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/health" {
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"status":"ok"}`))
		}
	}))
	defer server.Close()

	client := NewClientWithConfig(Config{
		Enabled:    true,
		GatewayURL: server.URL,
	}, newTestLogger())

	status, err := client.CheckStatus(context.Background())
	assert.NoError(t, err)
	assert.True(t, status.Connected)
	assert.NotEmpty(t, status.Latency)
}

func TestSendAgentHookDisabled(t *testing.T) {
	client := NewClientWithConfig(Config{Enabled: false}, newTestLogger())

	resp, err := client.SendAgentHook(context.Background(), HookPayload{
		Message: "test",
		Name:    "test-hook",
	})

	assert.NoError(t, err)
	assert.False(t, resp.Success)
}

func TestSendAgentHookSuccess(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Verify request
		assert.Equal(t, "POST", r.Method)
		assert.Equal(t, "/hooks/agent", r.URL.Path)
		assert.Equal(t, "application/json", r.Header.Get("Content-Type"))
		assert.Equal(t, "Bearer test-token", r.Header.Get("Authorization"))

		var payload HookPayload
		json.NewDecoder(r.Body).Decode(&payload)
		assert.Equal(t, "Hello OpenClaw", payload.Message)
		assert.Equal(t, "test-hook", payload.Name)

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(HookResponse{
			Success:    true,
			SessionKey: "sess-123",
		})
	}))
	defer server.Close()

	client := NewClientWithConfig(Config{
		Enabled:    true,
		GatewayURL: server.URL,
		HookToken:  "test-token",
	}, newTestLogger())

	resp, err := client.SendAgentHook(context.Background(), HookPayload{
		Message: "Hello OpenClaw",
		Name:    "test-hook",
	})

	require.NoError(t, err)
	assert.True(t, resp.Success)
	assert.Equal(t, "sess-123", resp.SessionKey)
}

func TestSendWakeSuccess(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/hooks/wake", r.URL.Path)

		var payload WakePayload
		json.NewDecoder(r.Body).Decode(&payload)
		assert.Equal(t, "Wake up!", payload.Text)
		assert.Equal(t, "now", payload.Mode)

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(HookResponse{Success: true})
	}))
	defer server.Close()

	client := NewClientWithConfig(Config{
		Enabled:    true,
		GatewayURL: server.URL,
	}, newTestLogger())

	resp, err := client.SendWake(context.Background(), "Wake up!", "now")
	require.NoError(t, err)
	assert.True(t, resp.Success)
}

func TestOnTestFailed(t *testing.T) {
	var receivedPayload HookPayload

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewDecoder(r.Body).Decode(&receivedPayload)
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(HookResponse{Success: true})
	}))
	defer server.Close()

	client := NewClientWithConfig(Config{
		Enabled:    true,
		GatewayURL: server.URL,
	}, newTestLogger())

	event := TestFailureEvent{
		TestName:  "Login Test",
		SuiteName: "Auth Suite",
		Platform:  "web",
		Error:     "Element not found",
		RunID:     "run-456",
	}

	resp, err := client.OnTestFailed(context.Background(), event)
	require.NoError(t, err)
	assert.True(t, resp.Success)
	assert.Contains(t, receivedPayload.Message, "Login Test")
	assert.Contains(t, receivedPayload.Message, "Auth Suite")
	assert.Equal(t, "SDLC-AI-TestFailure", receivedPayload.Name)
	assert.Equal(t, "slack", receivedPayload.Channel)
}

func TestOnSuiteCompleted(t *testing.T) {
	var receivedPayload HookPayload

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewDecoder(r.Body).Decode(&receivedPayload)
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(HookResponse{Success: true})
	}))
	defer server.Close()

	client := NewClientWithConfig(Config{
		Enabled:        true,
		GatewayURL:     server.URL,
		DefaultChannel: "slack",
	}, newTestLogger())

	event := SuiteCompletionEvent{
		SuiteName:  "Checkout Flow",
		TotalTests: 12,
		Passed:     11,
		Failed:     1,
		Skipped:    0,
		Duration:   15000,
		Coverage:   87.5,
	}

	resp, err := client.OnSuiteCompleted(context.Background(), event)
	require.NoError(t, err)
	assert.True(t, resp.Success)
	assert.Contains(t, receivedPayload.Message, "Checkout Flow")
	assert.Contains(t, receivedPayload.Message, "11/12")
}

func TestOnSecurityAlert(t *testing.T) {
	var receivedPayload HookPayload

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewDecoder(r.Body).Decode(&receivedPayload)
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(HookResponse{Success: true})
	}))
	defer server.Close()

	client := NewClientWithConfig(Config{
		Enabled:    true,
		GatewayURL: server.URL,
	}, newTestLogger())

	event := SecurityAlertEvent{
		Severity:          "critical",
		Category:          "SQL Injection",
		Description:       "Unparameterized query detected",
		AffectedEndpoints: []string{"/api/users", "/api/orders"},
		Recommendation:    "Use parameterized queries",
	}

	resp, err := client.OnSecurityAlert(context.Background(), event)
	require.NoError(t, err)
	assert.True(t, resp.Success)
	assert.Equal(t, "high", receivedPayload.Thinking)
	assert.Contains(t, receivedPayload.Message, "SQL Injection")
}

func TestDispatch(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(HookResponse{
			Success:    true,
			SessionKey: "dispatch-sess-1",
			RunID:      "run-001",
		})
	}))
	defer server.Close()

	client := NewClientWithConfig(Config{
		Enabled:    true,
		GatewayURL: server.URL,
	}, newTestLogger())

	resp, err := client.Dispatch(context.Background(), DispatchRequest{
		Agent:   "code-reviewer",
		Context: "Review the latest PR",
	})

	require.NoError(t, err)
	assert.True(t, resp.Success)
	assert.Equal(t, "dispatch-sess-1", resp.SessionKey)
}

func TestGetStatus(t *testing.T) {
	client := NewClientWithConfig(Config{
		Enabled:        true,
		GatewayURL:     "http://test:8080",
		DefaultChannel: "slack",
	}, newTestLogger())

	status := client.GetStatus()
	assert.True(t, status["enabled"].(bool))
	assert.Equal(t, "http://test:8080", status["gateway_url"])
	assert.Equal(t, "slack", status["channel"])
}

func TestUpdateConfig(t *testing.T) {
	client := NewClientWithConfig(Config{
		Enabled:    true,
		GatewayURL: "http://old:8080",
	}, newTestLogger())

	client.UpdateConfig(Config{
		Enabled:    false,
		GatewayURL: "http://new:9090",
	})

	assert.False(t, client.IsEnabled())
}

func TestRetryOnServerError(t *testing.T) {
	attempts := 0

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attempts++
		if attempts < 3 {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(`{"error":"server down"}`))
			return
		}
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(HookResponse{Success: true})
	}))
	defer server.Close()

	client := NewClientWithConfig(Config{
		Enabled:      true,
		GatewayURL:   server.URL,
		MaxRetries:   3,
		RetryDelayMs: 10, // Fast for testing
	}, newTestLogger())

	resp, err := client.SendAgentHook(context.Background(), HookPayload{
		Message: "retry test",
		Name:    "retry",
	})

	require.NoError(t, err)
	assert.True(t, resp.Success)
	assert.Equal(t, 3, attempts)
}

// ─── Memory Service Tests ────────────────────────────────────────────

func TestMemoryWrite(t *testing.T) {
	ms := NewMemoryService(newTestLogger())

	entry, err := ms.Write(context.Background(), MemoryWriteRequest{
		Type:    "fact",
		Content: "The gateway is running on port 8080",
		UserID:  "user-1",
		Tags:    []string{"infrastructure", "config"},
	})

	require.NoError(t, err)
	assert.NotEmpty(t, entry.ID)
	assert.Equal(t, "fact", entry.Type)
	assert.Equal(t, "The gateway is running on port 8080", entry.Content)
	assert.Equal(t, "user-1", entry.Metadata.UserID)
	assert.Contains(t, entry.Tags, "infrastructure")
}

func TestMemoryWriteValidation(t *testing.T) {
	ms := NewMemoryService(newTestLogger())

	_, err := ms.Write(context.Background(), MemoryWriteRequest{
		Content: "", // Empty content should fail
	})

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "content is required")
}

func TestMemoryWriteDefaultType(t *testing.T) {
	ms := NewMemoryService(newTestLogger())

	entry, err := ms.Write(context.Background(), MemoryWriteRequest{
		Content: "Default type test",
	})

	require.NoError(t, err)
	assert.Equal(t, "fact", entry.Type) // Default type is "fact"
}

func TestMemoryRead(t *testing.T) {
	ms := NewMemoryService(newTestLogger())

	written, _ := ms.Write(context.Background(), MemoryWriteRequest{
		Content: "Test read",
	})

	read, err := ms.Read(context.Background(), written.ID)
	require.NoError(t, err)
	assert.Equal(t, written.ID, read.ID)
	assert.Equal(t, "Test read", read.Content)
}

func TestMemoryReadNotFound(t *testing.T) {
	ms := NewMemoryService(newTestLogger())

	_, err := ms.Read(context.Background(), "nonexistent-id")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
}

func TestMemoryDelete(t *testing.T) {
	ms := NewMemoryService(newTestLogger())

	entry, _ := ms.Write(context.Background(), MemoryWriteRequest{
		Content: "To delete",
	})

	err := ms.Delete(context.Background(), entry.ID)
	assert.NoError(t, err)

	_, err = ms.Read(context.Background(), entry.ID)
	assert.Error(t, err)
}

func TestMemoryDeleteNotFound(t *testing.T) {
	ms := NewMemoryService(newTestLogger())

	err := ms.Delete(context.Background(), "nonexistent-id")
	assert.Error(t, err)
}

func TestMemorySearch(t *testing.T) {
	ms := NewMemoryService(newTestLogger())

	ms.Write(context.Background(), MemoryWriteRequest{
		Content: "The login page has a bug with 2FA",
		Type:    "event",
		Tags:    []string{"bug", "auth"},
	})
	ms.Write(context.Background(), MemoryWriteRequest{
		Content: "Deployment successful to production",
		Type:    "event",
		Tags:    []string{"deployment"},
	})
	ms.Write(context.Background(), MemoryWriteRequest{
		Content: "Login flow tests passed with 100% rate",
		Type:    "fact",
		Tags:    []string{"testing", "auth"},
	})

	// Search by keyword
	results, err := ms.Search(context.Background(), MemorySearchRequest{
		Query: "login",
	})
	require.NoError(t, err)
	assert.Len(t, results, 2) // Two entries contain "login"

	// Search by type
	results, err = ms.Search(context.Background(), MemorySearchRequest{
		Query: "login",
		Type:  "event",
	})
	require.NoError(t, err)
	assert.Len(t, results, 1)

	// Search by tag
	results, err = ms.Search(context.Background(), MemorySearchRequest{
		Query: "login",
		Tags:  []string{"auth"},
	})
	require.NoError(t, err)
	assert.Len(t, results, 2)
}

func TestMemorySearchNoResults(t *testing.T) {
	ms := NewMemoryService(newTestLogger())

	ms.Write(context.Background(), MemoryWriteRequest{
		Content: "Something unrelated",
	})

	results, err := ms.Search(context.Background(), MemorySearchRequest{
		Query: "zzznonexistent",
	})
	require.NoError(t, err)
	assert.Len(t, results, 0)
}

func TestMemoryList(t *testing.T) {
	ms := NewMemoryService(newTestLogger())

	ms.Write(context.Background(), MemoryWriteRequest{
		Content: "Entry 1", Type: "fact", UserID: "user-1",
	})
	ms.Write(context.Background(), MemoryWriteRequest{
		Content: "Entry 2", Type: "event", UserID: "user-1",
	})
	ms.Write(context.Background(), MemoryWriteRequest{
		Content: "Entry 3", Type: "fact", UserID: "user-2",
	})

	// List all
	entries, err := ms.List(context.Background(), MemorySearchRequest{})
	require.NoError(t, err)
	assert.Len(t, entries, 3)

	// List by user
	entries, err = ms.List(context.Background(), MemorySearchRequest{UserID: "user-1"})
	require.NoError(t, err)
	assert.Len(t, entries, 2)

	// List by type
	entries, err = ms.List(context.Background(), MemorySearchRequest{Type: "fact"})
	require.NoError(t, err)
	assert.Len(t, entries, 2)
}

func TestMemoryGetStats(t *testing.T) {
	ms := NewMemoryService(newTestLogger())

	ms.Write(context.Background(), MemoryWriteRequest{
		Content: "A", Type: "fact", UserID: "user-1",
	})
	ms.Write(context.Background(), MemoryWriteRequest{
		Content: "B", Type: "event", UserID: "user-1",
	})
	ms.Write(context.Background(), MemoryWriteRequest{
		Content: "C", Type: "fact", UserID: "user-2",
	})

	stats := ms.GetStats(context.Background())
	assert.Equal(t, 3, stats.TotalEntries)
	assert.Equal(t, 2, stats.ByType["fact"])
	assert.Equal(t, 1, stats.ByType["event"])
	assert.Equal(t, 2, stats.ByUser["user-1"])
	assert.Equal(t, 1, stats.ByUser["user-2"])
}

func TestMemoryExportToMarkdown(t *testing.T) {
	ms := NewMemoryService(newTestLogger())

	entry, _ := ms.Write(context.Background(), MemoryWriteRequest{
		Content:    "# Test Content\nThis is a test.",
		Type:       "fact",
		UserID:     "user-1",
		Importance: 8,
		Tags:       []string{"test", "markdown"},
	})

	markdown := ms.ExportToMarkdown(entry)

	assert.Contains(t, markdown, "---")
	assert.Contains(t, markdown, "id: "+entry.ID)
	assert.Contains(t, markdown, "type: fact")
	assert.Contains(t, markdown, "user_id: user-1")
	assert.Contains(t, markdown, "importance: 8")
	assert.Contains(t, markdown, "tags: [test, markdown]")
	assert.Contains(t, markdown, "# Test Content")
}
