// Package clawpipe provides an intelligent AI pipeline SDK.
// Booster -> Pack -> Cache -> Route -> Call -> Learn.
package clawpipe

// Config holds the ClawPipe client configuration.
type Config struct {
	APIKey        string
	ProjectID     string
	GatewayURL    string
	CacheTTLMs    int64
	CacheMax      int
	EnableBooster bool
	EnablePacker  bool
	EnableCache   bool
}

// PromptOptions controls per-request behaviour.
type PromptOptions struct {
	System      string  `json:"system,omitempty"`
	MaxTokens   int     `json:"maxTokens,omitempty"`
	Temperature float64 `json:"temperature,omitempty"`
	Model       string  `json:"model,omitempty"`
	Provider    string  `json:"provider,omitempty"`
	TaskType    string  `json:"taskType,omitempty"`
}

// PipelineMeta contains metadata about how a prompt was processed.
type PipelineMeta struct {
	Boosted          bool    `json:"boosted"`
	Cached           bool    `json:"cached"`
	Packed           bool    `json:"packed"`
	ContextSavings   string  `json:"contextSavings"`
	Route            string  `json:"route"`
	Model            string  `json:"model"`
	LatencyMs        int64   `json:"latencyMs"`
	TokensIn         int     `json:"tokensIn"`
	TokensOut        int     `json:"tokensOut"`
	EstimatedCostUsd float64 `json:"estimatedCostUsd"`
}

// Result is returned by ClawPipe.Prompt.
type Result struct {
	Text string       `json:"text"`
	Meta PipelineMeta `json:"meta"`
}

// RouteDecision describes the selected provider and model.
type RouteDecision struct {
	Provider string  `json:"provider"`
	Model    string  `json:"model"`
	Score    float64 `json:"score"`
	Reason   string  `json:"reason"`
}

// GatewayResponse is the JSON payload from the ClawPipe gateway.
type GatewayResponse struct {
	Text      string `json:"text"`
	TokensIn  int    `json:"tokensIn"`
	TokensOut int    `json:"tokensOut"`
	LatencyMs int64  `json:"latencyMs"`
}

// TelemetrySnapshot holds aggregate telemetry stats.
type TelemetrySnapshot struct {
	TotalRequests      int            `json:"totalRequests"`
	TotalTokensIn      int            `json:"totalTokensIn"`
	TotalTokensOut     int            `json:"totalTokensOut"`
	TotalCostUsd       float64        `json:"totalCostUsd"`
	TotalSavedByCache  int            `json:"totalSavedByCache"`
	TotalSavedByBoost  int            `json:"totalSavedByBooster"`
	AvgLatencyMs       int64          `json:"avgLatencyMs"`
	CacheHitRate       string         `json:"cacheHitRate"`
	TopModels          []ModelCallSum `json:"topModels"`
}

// ModelCallSum summarises calls per model.
type ModelCallSum struct {
	Model string  `json:"model"`
	Calls int     `json:"calls"`
	Cost  float64 `json:"cost"`
}
