//go:build ignore

package providers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/anthropics/anthropic-go"
	"github.com/sirupsen/logrus"
)

// AnthropicProvider implements the Provider interface for Anthropic's Claude API
type AnthropicProvider struct {
	*BaseProvider
	client *anthropic.Client
	logger *logrus.Logger
	models map[string]*ModelInfo
}

// NewAnthropicProvider creates a new Anthropic provider
func NewAnthropicProvider(config ProviderConfig, logger *logrus.Logger) (Provider, error) {
	if config.APIKey == "" {
		return nil, fmt.Errorf("Anthropic API key is required")
	}

	// Create Anthropic client
	client := anthropic.NewClient(config.APIKey)

	if config.BaseURL != "" {
		client = client.WithBaseURL(config.BaseURL)
	}

	provider := &AnthropicProvider{
		BaseProvider: NewBaseProvider("anthropic", config),
		client:       client,
		logger:       logger,
		models:       make(map[string]*ModelInfo),
	}

	// Initialize models
	if err := provider.initializeModels(); err != nil {
		logger.WithError(err).Warn("Failed to initialize Anthropic models, using defaults")
		provider.setDefaults()
	}

	return provider, nil
}

// initializeModels sets up available Anthropic models
func (p *AnthropicProvider) initializeModels() error {
	// Define Claude models with their information
	modelInfo := map[string]*ModelInfo{
		"claude-3-opus-20240229": {
			ID:          "claude-3-opus-20240229",
			Name:        "Claude 3 Opus",
			Created:     time.Now(),
			OwnedBy:     "anthropic",
			ContextSize: 200000,
			Pricing: &Pricing{
				PromptTokenCost:     0.015, // $0.015 per 1K prompt tokens
				CompletionTokenCost: 0.075, // $0.075 per 1K completion tokens
			},
		},
		"claude-3-sonnet-20240229": {
			ID:          "claude-3-sonnet-20240229",
			Name:        "Claude 3 Sonnet",
			Created:     time.Now(),
			OwnedBy:     "anthropic",
			ContextSize: 200000,
			Pricing: &Pricing{
				PromptTokenCost:     0.003, // $0.003 per 1K prompt tokens
				CompletionTokenCost: 0.015, // $0.015 per 1K completion tokens
			},
		},
		"claude-3-haiku-20240307": {
			ID:          "claude-3-haiku-20240307",
			Name:        "Claude 3 Haiku",
			Created:     time.Now(),
			OwnedBy:     "anthropic",
			ContextSize: 200000,
			Pricing: &Pricing{
				PromptTokenCost:     0.00025, // $0.00025 per 1K prompt tokens
				CompletionTokenCost: 0.00125, // $0.00125 per 1K completion tokens
			},
		},
		"claude-2.1": {
			ID:          "claude-2.1",
			Name:        "Claude 2.1",
			Created:     time.Now(),
			OwnedBy:     "anthropic",
			ContextSize: 100000,
			Pricing: &Pricing{
				PromptTokenCost:     0.008, // $0.008 per 1K prompt tokens
				CompletionTokenCost: 0.024, // $0.024 per 1K completion tokens
			},
		},
		"claude-2.0": {
			ID:          "claude-2.0",
			Name:        "Claude 2.0",
			Created:     time.Now(),
			OwnedBy:     "anthropic",
			ContextSize: 100000,
			Pricing: &Pricing{
				PromptTokenCost:     0.008, // $0.008 per 1K prompt tokens
				CompletionTokenCost: 0.024, // $0.024 per 1K completion tokens
			},
		},
	}

	// Add models that are configured
	for _, model := range p.config.Models {
		if info, exists := modelInfo[model]; exists {
			p.models[model] = info
		}
	}

	return nil
}

// setDefaults sets default models if initialization fails
func (p *AnthropicProvider) setDefaults() {
	p.models["claude-3-sonnet-20240229"] = &ModelInfo{
		ID:          "claude-3-sonnet-20240229",
		Name:        "Claude 3 Sonnet",
		Created:     time.Now(),
		OwnedBy:     "anthropic",
		ContextSize: 200000,
		Pricing: &Pricing{
			PromptTokenCost:     0.003,
			CompletionTokenCost: 0.015,
		},
	}

	p.models["claude-3-haiku-20240307"] = &ModelInfo{
		ID:          "claude-3-haiku-20240307",
		Name:        "Claude 3 Haiku",
		Created:     time.Now(),
		OwnedBy:     "anthropic",
		ContextSize: 200000,
		Pricing: &Pricing{
			PromptTokenCost:     0.00025,
			CompletionTokenCost: 0.00125,
		},
	}
}

// Complete generates text completion using Anthropic's Claude API
func (p *AnthropicProvider) Complete(ctx context.Context, req *CompletionRequest) (*CompletionResponse, error) {
	// Convert messages to Anthropic format
	messages, systemMessage := p.convertMessages(req.Messages)

	// Create request
	anthropicReq := &anthropic.Message{
		Model:         anthropic.Model(req.Model),
		Messages:      messages,
		MaxTokens:     req.MaxTokens,
		Temperature:   &req.Temperature,
		TopP:          &req.TopP,
		Stream:        req.Stream,
		StopSequences: req.Stop,
	}

	// Add system message if present
	if systemMessage != "" {
		anthropicReq.System = &systemMessage
	}

	// Make the API call with retry logic
	var resp *anthropic.Message
	var err error

	for attempt := 0; attempt <= p.config.RetryCount; attempt++ {
		if attempt > 0 {
			p.logger.WithField("attempt", attempt).Warn("Retrying Anthropic completion")
			time.Sleep(time.Duration(p.config.RetryDelay) * time.Second * time.Duration(attempt))
		}

		resp, err = p.client.CreateMessage(ctx, *anthropicReq)
		if err == nil {
			break
		}

		// Check if error is retryable
		if !p.isRetryableError(err) {
			break
		}
	}

	if err != nil {
		return nil, fmt.Errorf("Anthropic completion failed: %w", err)
	}

	// Convert response
	return p.convertResponse(resp), nil
}

// convertMessages converts our message format to Anthropic's format
func (p *AnthropicProvider) convertMessages(messages []Message) ([]anthropic.MessageItem, string) {
	var anthropicMessages []anthropic.MessageItem
	var systemMessage string

	for _, msg := range messages {
		if msg.Role == "system" {
			systemMessage = msg.Content
			continue
		}

		role := anthropic.RoleUser
		if msg.Role == "assistant" {
			role = anthropic.RoleAssistant
		}

		anthropicMessages = append(anthropicMessages, anthropic.MessageItem{
			Role:    role,
			Content: msg.Content,
		})
	}

	return anthropicMessages, systemMessage
}

// convertResponse converts Anthropic response to our format
func (p *AnthropicProvider) convertResponse(resp *anthropic.Message) *CompletionResponse {
	choices := make([]Choice, 1)

	// Convert the first response
	content := ""
	if len(resp.Content) > 0 {
		if text, ok := resp.Content[0].(anthropic.TextContent); ok {
			content = text.Text
		}
	}

	choices[0] = Choice{
		Index:        0,
		Message:      Message{Role: "assistant", Content: content},
		FinishReason: string(resp.StopReason),
	}

	// Calculate usage (Anthropic doesn't provide exact token counts in response)
	promptTokens := p.estimateTokens(p.getConversationAsString(resp))
	completionTokens := p.estimateTokens(content)

	return &CompletionResponse{
		ID:      resp.ID,
		Object:  "chat.completion",
		Created: time.Now(),
		Model:   string(resp.Model),
		Choices: choices,
		Usage: &Usage{
			PromptTokens:     promptTokens,
			CompletionTokens: completionTokens,
			TotalTokens:      promptTokens + completionTokens,
		},
	}
}

// getConversationAsString reconstructs the conversation for token estimation
func (p *AnthropicProvider) getConversationAsString(resp *anthropic.Message) string {
	var conversation strings.Builder

	for _, msg := range resp.Messages {
		conversation.WriteString(fmt.Sprintf("%s: %s\n", msg.Role, msg.Content))
	}

	return conversation.String()
}

// estimateTokens provides a rough token estimation for text
func (p *AnthropicProvider) estimateTokens(text string) int {
	// Claude uses a similar tokenization to GPT (roughly 4 characters per token for English)
	// This is a simplified estimation
	return len(text) / 4
}

// GetTokenCount returns the number of tokens in the text
func (p *AnthropicProvider) GetTokenCount(text string) (int, error) {
	return p.estimateTokens(text), nil
}

// GetModelInfo returns information about available models
func (p *AnthropicProvider) GetModelInfo() []*ModelInfo {
	models := make([]*ModelInfo, 0, len(p.models))
	for _, model := range p.models {
		models = append(models, model)
	}
	return models
}

// Health checks if the Anthropic provider is healthy
func (p *AnthropicProvider) Health(ctx context.Context) error {
	// Create a simple test request
	testReq := &anthropic.Message{
		Model:     anthropic.ModelClaude3Haiku,
		MaxTokens: 1,
		Messages: []anthropic.MessageItem{
			{Role: anthropic.RoleUser, Content: "test"},
		},
	}

	_, err := p.client.CreateMessage(ctx, *testReq)
	return err
}

// Close closes the provider and cleans up resources
func (p *AnthropicProvider) Close() error {
	// Anthropic client doesn't need explicit cleanup
	return nil
}

// isRetryableError checks if an error is retryable
func (p *AnthropicProvider) isRetryableError(err error) bool {
	if err == nil {
		return false
	}

	// Check for specific Anthropic error codes that are retryable
	errStr := err.Error()
	retryableErrors := []string{
		"timeout",
		"connection",
		"temporary failure",
		"rate limit",
		"overloaded",
		"503",
		"502",
		"500",
	}

	for _, retryableErr := range retryableErrors {
		if contains(errStr, retryableErr) {
			return true
		}
	}

	return false
}

// Custom HTTP client for direct API calls if needed
type anthropicHTTPClient struct {
	apiKey  string
	baseURL string
	client  *http.Client
	logger  *logrus.Logger
}

// newAnthropicHTTPClient creates a custom HTTP client for Anthropic API
func newAnthropicHTTPClient(apiKey, baseURL string, timeout time.Duration, logger *logrus.Logger) *anthropicHTTPClient {
	return &anthropicHTTPClient{
		apiKey:  apiKey,
		baseURL: baseURL,
		client: &http.Client{
			Timeout: timeout,
		},
		logger: logger,
	}
}

// makeRequest makes a direct HTTP request to the Anthropic API
func (c *anthropicHTTPClient) makeRequest(ctx context.Context, method, endpoint string, body interface{}) (*http.Response, error) {
	var reqBody io.Reader
	if body != nil {
		jsonBody, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request body: %w", err)
		}
		reqBody = bytes.NewBuffer(jsonBody)
	}

	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+endpoint, reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", c.apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")
	req.Header.Set("User-Agent", "sdlc-llm-gateway/1.0")

	return c.client.Do(req)
}
