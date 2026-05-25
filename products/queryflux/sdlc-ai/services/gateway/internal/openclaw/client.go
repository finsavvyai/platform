package openclaw

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/sirupsen/logrus"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

// ─── Configuration ───────────────────────────────────────────────────

// Config holds configuration for the OpenClaw integration
type Config struct {
	Enabled        bool   `mapstructure:"enabled" yaml:"enabled"`
	GatewayURL     string `mapstructure:"gateway_url" yaml:"gateway_url"`
	HookToken      string `mapstructure:"hook_token" yaml:"hook_token"`
	DefaultChannel string `mapstructure:"default_channel" yaml:"default_channel"`
	TimeoutSeconds int    `mapstructure:"timeout_seconds" yaml:"timeout_seconds"`
	MaxRetries     int    `mapstructure:"max_retries" yaml:"max_retries"`
	RetryDelayMs   int    `mapstructure:"retry_delay_ms" yaml:"retry_delay_ms"`
}

// ─── Request / Response Types ─────────────────────────────────────────

// HookPayload is the payload sent to /hooks/agent
type HookPayload struct {
	Message        string `json:"message"`
	Name           string `json:"name"`
	AgentID        string `json:"agentId,omitempty"`
	SessionKey     string `json:"sessionKey,omitempty"`
	WakeMode       string `json:"wakeMode,omitempty"` // "now" | "next-heartbeat"
	Deliver        bool   `json:"deliver,omitempty"`
	Channel        string `json:"channel,omitempty"` // "last" | "whatsapp" | "telegram" | "slack" | "discord"
	To             string `json:"to,omitempty"`
	Model          string `json:"model,omitempty"`
	Thinking       string `json:"thinking,omitempty"` // "low" | "medium" | "high"
	TimeoutSeconds int    `json:"timeoutSeconds,omitempty"`
}

// WakePayload is the payload sent to /hooks/wake
type WakePayload struct {
	Text string `json:"text"`
	Mode string `json:"mode"` // "now" | "next-heartbeat"
}

// HookResponse is the response from OpenClaw hook endpoints
type HookResponse struct {
	Success    bool   `json:"success"`
	Status     int    `json:"status"`
	Error      string `json:"error,omitempty"`
	SessionKey string `json:"sessionKey,omitempty"`
	RunID      string `json:"runId,omitempty"`
}

// DispatchRequest is a request to dispatch a Luna agent via OpenClaw
type DispatchRequest struct {
	Agent          string `json:"agent"`
	Context        string `json:"context"`
	Model          string `json:"model,omitempty"`
	GatewayID      string `json:"gatewayId,omitempty"`
	TimeoutSeconds int    `json:"timeoutSeconds,omitempty"`
}

// DispatchResponse is the response from a dispatch request
type DispatchResponse struct {
	Success    bool   `json:"success"`
	SessionKey string `json:"sessionKey,omitempty"`
	RunID      string `json:"runId,omitempty"`
	Error      string `json:"error,omitempty"`
}

// GatewayStatus represents the status of an OpenClaw Gateway
type GatewayStatus struct {
	Connected bool   `json:"connected"`
	URL       string `json:"url"`
	Latency   string `json:"latency,omitempty"`
	Version   string `json:"version,omitempty"`
	Error     string `json:"error,omitempty"`
}

// SessionInfo represents an active session on the Gateway
type SessionInfo struct {
	SessionKey string    `json:"sessionKey"`
	AgentID    string    `json:"agentId,omitempty"`
	Status     string    `json:"status"`
	StartedAt  time.Time `json:"startedAt"`
}

// ─── Event Types (SDLC-AI Bridge Events) ─────────────────────────────

// TestFailureEvent represents a test failure to report to OpenClaw
type TestFailureEvent struct {
	TestName      string `json:"testName"`
	TestID        string `json:"testId"`
	SuiteName     string `json:"suiteName,omitempty"`
	Error         string `json:"error"`
	StackTrace    string `json:"stackTrace,omitempty"`
	RunID         string `json:"runId"`
	Platform      string `json:"platform"` // "web" | "mobile" | "api"
	Duration      int    `json:"duration,omitempty"`
	ScreenshotURL string `json:"screenshotUrl,omitempty"`
	DashboardURL  string `json:"dashboardUrl,omitempty"`
}

// SuiteCompletionEvent represents a test suite completion
type SuiteCompletionEvent struct {
	SuiteName    string  `json:"suiteName"`
	SuiteID      string  `json:"suiteId"`
	RunID        string  `json:"runId"`
	TotalTests   int     `json:"totalTests"`
	Passed       int     `json:"passed"`
	Failed       int     `json:"failed"`
	Skipped      int     `json:"skipped"`
	Duration     int     `json:"duration"` // milliseconds
	Coverage     float64 `json:"coverage,omitempty"`
	SelfHealed   int     `json:"selfHealed,omitempty"`
	DashboardURL string  `json:"dashboardUrl,omitempty"`
}

// SecurityAlertEvent represents a security scan finding
type SecurityAlertEvent struct {
	Severity          string   `json:"severity"` // "critical" | "high" | "medium" | "low"
	Category          string   `json:"category"`
	Description       string   `json:"description"`
	AffectedEndpoints []string `json:"affectedEndpoints,omitempty"`
	Recommendation    string   `json:"recommendation"`
	ScanID            string   `json:"scanId,omitempty"`
}

// SelfHealingEvent represents a self-healing action
type SelfHealingEvent struct {
	TestName      string  `json:"testName"`
	TestID        string  `json:"testId"`
	HealingType   string  `json:"healingType"` // "locator_update" | "wait_added" | "retry_logic" | "assertion_fix"
	OriginalError string  `json:"originalError"`
	FixApplied    string  `json:"fixApplied"`
	Confidence    float64 `json:"confidence"`
}

// DailySummaryStats holds daily summary statistics
type DailySummaryStats struct {
	TotalRuns   int               `json:"totalRuns"`
	Passed      int               `json:"passed"`
	Failed      int               `json:"failed"`
	Coverage    float64           `json:"coverage"`
	SelfHealed  int               `json:"selfHealed"`
	TopFailures []TopFailureEntry `json:"topFailures"`
}

// TopFailureEntry represents a frequently failing test
type TopFailureEntry struct {
	Name  string `json:"name"`
	Count int    `json:"count"`
}

// ─── Client ───────────────────────────────────────────────────────────

// Client provides bidirectional communication with the OpenClaw Gateway
type Client struct {
	config     Config
	httpClient *http.Client
	logger     *logrus.Logger
	tracer     trace.Tracer
	mu         sync.RWMutex
	eventLog   []eventLogEntry
}

type eventLogEntry struct {
	Timestamp time.Time `json:"timestamp"`
	Type      string    `json:"type"`
	Status    string    `json:"status"`
	Error     string    `json:"error,omitempty"`
}

// NewClient creates a new OpenClaw client from environment variables
func NewClient(logger *logrus.Logger) *Client {
	cfg := Config{
		Enabled:        os.Getenv("OPENCLAW_ENABLED") == "true",
		GatewayURL:     getEnvOrDefault("OPENCLAW_GATEWAY_URL", "http://127.0.0.1:18789"),
		HookToken:      os.Getenv("OPENCLAW_HOOK_TOKEN"),
		DefaultChannel: getEnvOrDefault("OPENCLAW_DEFAULT_CHANNEL", "last"),
		TimeoutSeconds: 30,
		MaxRetries:     3,
		RetryDelayMs:   1000,
	}

	return NewClientWithConfig(cfg, logger)
}

// NewClientWithConfig creates a new OpenClaw client with explicit config
func NewClientWithConfig(cfg Config, logger *logrus.Logger) *Client {
	if cfg.TimeoutSeconds == 0 {
		cfg.TimeoutSeconds = 30
	}
	if cfg.MaxRetries == 0 {
		cfg.MaxRetries = 3
	}
	if cfg.RetryDelayMs == 0 {
		cfg.RetryDelayMs = 1000
	}
	if cfg.DefaultChannel == "" {
		cfg.DefaultChannel = "last"
	}

	return &Client{
		config: cfg,
		httpClient: &http.Client{
			Timeout: time.Duration(cfg.TimeoutSeconds) * time.Second,
		},
		logger:   logger,
		tracer:   otel.Tracer("openclaw"),
		eventLog: make([]eventLogEntry, 0, 100),
	}
}

// ─── Core Gateway Communication ──────────────────────────────────────

// SendAgentHook sends a hook to OpenClaw's /hooks/agent endpoint.
// Triggers an isolated agent turn with the given message.
func (c *Client) SendAgentHook(ctx context.Context, payload HookPayload) (*HookResponse, error) {
	ctx, span := c.tracer.Start(ctx, "OpenClaw.SendAgentHook")
	defer span.End()

	span.SetAttributes(
		attribute.String("openclaw.hook_name", payload.Name),
		attribute.String("openclaw.channel", payload.Channel),
	)

	if !c.config.Enabled {
		c.logger.Debug("OpenClaw integration disabled, skipping hook")
		return &HookResponse{Success: false, Error: "OpenClaw integration disabled"}, nil
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal hook payload: %w", err)
	}

	resp, err := c.doRequest(ctx, "POST", "/hooks/agent", body)
	if err != nil {
		c.logEvent("agent_hook", "error", err.Error())
		return nil, fmt.Errorf("send agent hook: %w", err)
	}

	c.logEvent("agent_hook", "success", "")

	c.logger.WithFields(logrus.Fields{
		"name":    payload.Name,
		"channel": payload.Channel,
		"success": resp.Success,
	}).Info("OpenClaw agent hook sent")

	return resp, nil
}

// SendWake sends a wake event to OpenClaw's /hooks/wake endpoint.
// Enqueues a system event and optionally triggers immediate heartbeat.
func (c *Client) SendWake(ctx context.Context, text string, mode string) (*HookResponse, error) {
	ctx, span := c.tracer.Start(ctx, "OpenClaw.SendWake")
	defer span.End()

	if mode == "" {
		mode = "now"
	}

	payload := WakePayload{
		Text: text,
		Mode: mode,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal wake payload: %w", err)
	}

	resp, err := c.doRequest(ctx, "POST", "/hooks/wake", body)
	if err != nil {
		c.logEvent("wake", "error", err.Error())
		return nil, fmt.Errorf("send wake: %w", err)
	}

	c.logEvent("wake", "success", "")
	return resp, nil
}

// CheckStatus checks if the registered Gateway is reachable
func (c *Client) CheckStatus(ctx context.Context) (*GatewayStatus, error) {
	ctx, span := c.tracer.Start(ctx, "OpenClaw.CheckStatus")
	defer span.End()

	if !c.config.Enabled {
		return &GatewayStatus{
			Connected: false,
			URL:       c.config.GatewayURL,
			Error:     "OpenClaw integration disabled",
		}, nil
	}

	start := time.Now()
	req, err := http.NewRequestWithContext(ctx, "GET", c.config.GatewayURL+"/health", nil)
	if err != nil {
		return &GatewayStatus{
			Connected: false,
			URL:       c.config.GatewayURL,
			Error:     err.Error(),
		}, nil
	}

	if c.config.HookToken != "" {
		req.Header.Set("Authorization", "Bearer "+c.config.HookToken)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return &GatewayStatus{
			Connected: false,
			URL:       c.config.GatewayURL,
			Error:     err.Error(),
		}, nil
	}
	defer resp.Body.Close()

	latency := time.Since(start)

	return &GatewayStatus{
		Connected: resp.StatusCode == http.StatusOK,
		URL:       c.config.GatewayURL,
		Latency:   latency.String(),
	}, nil
}

// ListSessions lists active sessions on the Gateway
func (c *Client) ListSessions(ctx context.Context) ([]SessionInfo, error) {
	ctx, span := c.tracer.Start(ctx, "OpenClaw.ListSessions")
	defer span.End()

	if !c.config.Enabled {
		return nil, fmt.Errorf("OpenClaw integration disabled")
	}

	req, err := http.NewRequestWithContext(ctx, "GET", c.config.GatewayURL+"/sessions", nil)
	if err != nil {
		return nil, fmt.Errorf("create sessions request: %w", err)
	}

	if c.config.HookToken != "" {
		req.Header.Set("Authorization", "Bearer "+c.config.HookToken)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("list sessions: %w", err)
	}
	defer resp.Body.Close()

	var sessions []SessionInfo
	if err := json.NewDecoder(resp.Body).Decode(&sessions); err != nil {
		return nil, fmt.Errorf("decode sessions: %w", err)
	}

	return sessions, nil
}

// Dispatch dispatches a Luna agent as a sub-session (fire-and-forget)
func (c *Client) Dispatch(ctx context.Context, req DispatchRequest) (*DispatchResponse, error) {
	ctx, span := c.tracer.Start(ctx, "OpenClaw.Dispatch")
	defer span.End()

	span.SetAttributes(attribute.String("openclaw.agent", req.Agent))

	if !c.config.Enabled {
		return &DispatchResponse{
			Success: false,
			Error:   "OpenClaw integration disabled",
		}, nil
	}

	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("marshal dispatch request: %w", err)
	}

	hookResp, err := c.doRequest(ctx, "POST", "/hooks/agent", body)
	if err != nil {
		c.logEvent("dispatch", "error", err.Error())
		return nil, fmt.Errorf("dispatch agent: %w", err)
	}

	c.logEvent("dispatch", "success", "")

	return &DispatchResponse{
		Success:    hookResp.Success,
		SessionKey: hookResp.SessionKey,
		RunID:      hookResp.RunID,
	}, nil
}

// SendMessage sends a custom message to the OpenClaw agent
func (c *Client) SendMessage(ctx context.Context, message string, channel string) (*HookResponse, error) {
	return c.SendAgentHook(ctx, HookPayload{
		Message:  message,
		Name:     "SDLC-AI-Gateway",
		WakeMode: "now",
		Deliver:  true,
		Channel:  channel,
	})
}

// ─── SDLC-AI Bridge Events ──────────────────────────────────────────

// OnTestFailed notifies OpenClaw when a test fails for AI-powered analysis
func (c *Client) OnTestFailed(ctx context.Context, event TestFailureEvent) (*HookResponse, error) {
	ctx, span := c.tracer.Start(ctx, "OpenClaw.OnTestFailed")
	defer span.End()

	message := fmt.Sprintf(`🔴 TEST FAILURE — AI Analysis Required

**Test:** %s
**Suite:** %s
**Platform:** %s
**Error:** %s`, event.TestName, event.SuiteName, event.Platform, event.Error)

	if event.StackTrace != "" {
		message += fmt.Sprintf("\n**Stack Trace:**\n```\n%s\n```", event.StackTrace)
	}
	if event.DashboardURL != "" {
		message += fmt.Sprintf("\n📎 **Dashboard:** %s", event.DashboardURL)
	}

	message += `

Please:
1. Analyze the root cause of this failure
2. Check if this is a known flaky test
3. Suggest a fix or self-healing action
4. Notify the team with a summary`

	return c.SendAgentHook(ctx, HookPayload{
		Message:  message,
		Name:     "SDLC-AI-TestFailure",
		WakeMode: "now",
		Deliver:  true,
		Channel:  "slack",
		Thinking: "medium",
	})
}

// OnSuiteCompleted notifies OpenClaw when a test suite completes
func (c *Client) OnSuiteCompleted(ctx context.Context, event SuiteCompletionEvent) (*HookResponse, error) {
	ctx, span := c.tracer.Start(ctx, "OpenClaw.OnSuiteCompleted")
	defer span.End()

	passRate := 0.0
	if event.TotalTests > 0 {
		passRate = float64(event.Passed) / float64(event.TotalTests) * 100
	}

	emoji := "✅"
	if event.Failed > 0 {
		emoji = "⚠️"
	}

	message := fmt.Sprintf(`%s TEST SUITE COMPLETE

**Suite:** %s
**Results:** %d/%d passed (%.1f%%)
  ✅ Passed: %d | ❌ Failed: %d | ⏭ Skipped: %d
**Duration:** %dms`,
		emoji, event.SuiteName, event.Passed, event.TotalTests, passRate,
		event.Passed, event.Failed, event.Skipped, event.Duration)

	if event.Coverage > 0 {
		message += fmt.Sprintf("\n**Coverage:** %.1f%%", event.Coverage)
	}
	if event.SelfHealed > 0 {
		message += fmt.Sprintf("\n🔧 **Self-Healed:** %d tests", event.SelfHealed)
	}
	if event.DashboardURL != "" {
		message += fmt.Sprintf("\n📎 **Dashboard:** %s", event.DashboardURL)
	}

	message += "\n\nProvide a brief summary and highlight any concerns."

	return c.SendAgentHook(ctx, HookPayload{
		Message:  message,
		Name:     "SDLC-AI-SuiteComplete",
		WakeMode: "now",
		Deliver:  true,
		Channel:  c.config.DefaultChannel,
	})
}

// OnSecurityAlert alerts OpenClaw about security scan findings
func (c *Client) OnSecurityAlert(ctx context.Context, event SecurityAlertEvent) (*HookResponse, error) {
	ctx, span := c.tracer.Start(ctx, "OpenClaw.OnSecurityAlert")
	defer span.End()

	sevEmoji := map[string]string{
		"critical": "🔴",
		"high":     "🟠",
		"medium":   "🟡",
		"low":      "🔵",
	}

	message := fmt.Sprintf(`%s SECURITY ALERT — %s

**Category:** %s
**Severity:** %s
**Description:** %s
**Recommendation:** %s`,
		sevEmoji[event.Severity], event.Severity,
		event.Category, event.Severity,
		event.Description, event.Recommendation)

	if len(event.AffectedEndpoints) > 0 {
		message += "\n**Affected Endpoints:**"
		for _, ep := range event.AffectedEndpoints {
			message += fmt.Sprintf("\n  • %s", ep)
		}
	}

	message += "\n\nAssess severity, recommend immediate actions, and create tickets for critical items."

	thinking := "medium"
	if event.Severity == "critical" || event.Severity == "high" {
		thinking = "high"
	}

	return c.SendAgentHook(ctx, HookPayload{
		Message:  message,
		Name:     "SDLC-AI-SecurityAlert",
		WakeMode: "now",
		Deliver:  true,
		Channel:  "slack",
		Thinking: thinking,
	})
}

// OnSelfHealing notifies OpenClaw when self-healing is applied
func (c *Client) OnSelfHealing(ctx context.Context, event SelfHealingEvent) (*HookResponse, error) {
	ctx, span := c.tracer.Start(ctx, "OpenClaw.OnSelfHealing")
	defer span.End()

	message := fmt.Sprintf(`🔧 SELF-HEALING APPLIED

**Test:** %s
**Healing Type:** %s
**Original Error:** %s
**Fix Applied:** %s
**Confidence:** %.0f%%

Log this self-healing event and confirm the fix is stable.`,
		event.TestName, event.HealingType,
		event.OriginalError, event.FixApplied,
		event.Confidence*100)

	return c.SendAgentHook(ctx, HookPayload{
		Message:  message,
		Name:     "SDLC-AI-SelfHeal",
		WakeMode: "next-heartbeat",
		Deliver:  false,
		Channel:  c.config.DefaultChannel,
	})
}

// SendDailySummary sends a daily summary to OpenClaw
func (c *Client) SendDailySummary(ctx context.Context, stats DailySummaryStats) (*HookResponse, error) {
	ctx, span := c.tracer.Start(ctx, "OpenClaw.SendDailySummary")
	defer span.End()

	message := fmt.Sprintf(`📊 DAILY QA SUMMARY

**Total Runs:** %d
**Results:** ✅ %d passed | ❌ %d failed
**Coverage:** %.1f%%
**Self-Healed:** %d tests`,
		stats.TotalRuns, stats.Passed, stats.Failed,
		stats.Coverage, stats.SelfHealed)

	if len(stats.TopFailures) > 0 {
		message += "\n\n**Top Failures:**"
		for _, f := range stats.TopFailures {
			message += fmt.Sprintf("\n  • %s (%d occurrences)", f.Name, f.Count)
		}
	}

	message += "\n\nProvide trends analysis and recommendations for the next sprint."

	return c.SendAgentHook(ctx, HookPayload{
		Message:  message,
		Name:     "SDLC-AI-DailySummary",
		WakeMode: "now",
		Deliver:  true,
		Channel:  c.config.DefaultChannel,
		Thinking: "high",
	})
}

// ─── Diagnostics ──────────────────────────────────────────────────────

// GetStatus returns the OpenClaw integration status and recent events
func (c *Client) GetStatus() map[string]interface{} {
	c.mu.RLock()
	defer c.mu.RUnlock()

	// Return last 20 events
	eventCount := len(c.eventLog)
	start := 0
	if eventCount > 20 {
		start = eventCount - 20
	}

	return map[string]interface{}{
		"enabled":       c.config.Enabled,
		"gateway_url":   c.config.GatewayURL,
		"channel":       c.config.DefaultChannel,
		"total_events":  eventCount,
		"recent_events": c.eventLog[start:],
	}
}

// UpdateConfig updates the client configuration at runtime
func (c *Client) UpdateConfig(updates Config) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if updates.GatewayURL != "" {
		c.config.GatewayURL = updates.GatewayURL
	}
	if updates.HookToken != "" {
		c.config.HookToken = updates.HookToken
	}
	if updates.DefaultChannel != "" {
		c.config.DefaultChannel = updates.DefaultChannel
	}
	c.config.Enabled = updates.Enabled
}

// IsEnabled returns whether the OpenClaw integration is enabled
func (c *Client) IsEnabled() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.config.Enabled
}

// ─── Internal Helpers ─────────────────────────────────────────────────

func (c *Client) doRequest(ctx context.Context, method, path string, body []byte) (*HookResponse, error) {
	url := c.config.GatewayURL + path

	req, err := http.NewRequestWithContext(ctx, method, url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	if c.config.HookToken != "" {
		req.Header.Set("Authorization", "Bearer "+c.config.HookToken)
	}

	var lastErr error
	for attempt := 0; attempt <= c.config.MaxRetries; attempt++ {
		if attempt > 0 {
			time.Sleep(time.Duration(c.config.RetryDelayMs) * time.Millisecond)
			c.logger.WithField("attempt", attempt).Debug("Retrying OpenClaw request")
		}

		resp, err := c.httpClient.Do(req)
		if err != nil {
			lastErr = err
			continue
		}

		defer resp.Body.Close()
		respBody, err := io.ReadAll(resp.Body)
		if err != nil {
			lastErr = fmt.Errorf("read response: %w", err)
			continue
		}

		if resp.StatusCode >= 500 {
			lastErr = fmt.Errorf("OpenClaw server error: %d - %s", resp.StatusCode, string(respBody))
			continue
		}

		var hookResp HookResponse
		if err := json.Unmarshal(respBody, &hookResp); err != nil {
			// If we can't parse, build a response from status code
			hookResp = HookResponse{
				Success: resp.StatusCode >= 200 && resp.StatusCode < 300,
				Status:  resp.StatusCode,
			}
		}
		hookResp.Status = resp.StatusCode

		if resp.StatusCode >= 400 {
			hookResp.Success = false
			if hookResp.Error == "" {
				hookResp.Error = fmt.Sprintf("HTTP %d: %s", resp.StatusCode, string(respBody))
			}
		}

		return &hookResp, nil
	}

	return nil, fmt.Errorf("all retries exhausted: %w", lastErr)
}

func (c *Client) logEvent(eventType, status, errMsg string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	entry := eventLogEntry{
		Timestamp: time.Now(),
		Type:      eventType,
		Status:    status,
		Error:     errMsg,
	}

	c.eventLog = append(c.eventLog, entry)

	// Cap at 500 events
	if len(c.eventLog) > 500 {
		c.eventLog = c.eventLog[len(c.eventLog)-500:]
	}
}

func getEnvOrDefault(key, defaultValue string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultValue
}
