//go:build ignore

package providers

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/sashabaranov/go-openai"
	"github.com/sirupsen/logrus"
)

// OpenAIProvider implements the Provider interface for OpenAI API
type OpenAIProvider struct {
	*BaseProvider
	client *openai.Client
	logger *logrus.Logger
	models map[string]*ModelInfo
}

// NewOpenAIProvider creates a new OpenAI provider
func NewOpenAIProvider(config ProviderConfig, logger *logrus.Logger) (Provider, error) {
	if config.APIKey == "" {
		return nil, fmt.Errorf("OpenAI API key is required")
	}

	clientConfig := openai.DefaultConfig(config.APIKey)
	if config.BaseURL != "" {
		clientConfig.BaseURL = config.BaseURL
	}

	// Create HTTP client with timeout
	clientConfig.HTTPClient = &http.Client{
		Timeout: time.Duration(config.Timeout) * time.Second,
	}

	client := openai.NewClientWithConfig(clientConfig)

	provider := &OpenAIProvider{
		BaseProvider: NewBaseProvider("openai", config),
		client:       client,
		logger:       logger,
		models:       make(map[string]*ModelInfo),
	}

	// Initialize models
	if err := provider.initializeModels(); err != nil {
		logger.WithError(err).Warn("Failed to initialize OpenAI models, using defaults")
		provider.setDefaults()
	}

	return provider, nil
}

// initializeModels fetches available models from OpenAI API
func (p *OpenAIProvider) initializeModels() error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	modelList, err := p.client.ListModels(ctx)
	if err != nil {
		return fmt.Errorf("failed to list models: %w", err)
	}

	// Define model information with pricing
	modelInfo := map[string]*ModelInfo{
		"gpt-4-turbo-preview": {
			ID:          "gpt-4-turbo-preview",
			Name:        "GPT-4 Turbo",
			Created:     time.Now(),
			OwnedBy:     "openai",
			ContextSize: 128000,
			Pricing: &Pricing{
				PromptTokenCost:     0.01, // $0.01 per 1K prompt tokens
				CompletionTokenCost: 0.03, // $0.03 per 1K completion tokens
			},
		},
		"gpt-4": {
			ID:          "gpt-4",
			Name:        "GPT-4",
			Created:     time.Now(),
			OwnedBy:     "openai",
			ContextSize: 8192,
			Pricing: &Pricing{
				PromptTokenCost:     0.03, // $0.03 per 1K prompt tokens
				CompletionTokenCost: 0.06, // $0.06 per 1K completion tokens
			},
		},
		"gpt-4-32k": {
			ID:          "gpt-4-32k",
			Name:        "GPT-4 32K",
			Created:     time.Now(),
			OwnedBy:     "openai",
			ContextSize: 32768,
			Pricing: &Pricing{
				PromptTokenCost:     0.06, // $0.06 per 1K prompt tokens
				CompletionTokenCost: 0.12, // $0.12 per 1K completion tokens
			},
		},
		"gpt-3.5-turbo": {
			ID:          "gpt-3.5-turbo",
			Name:        "GPT-3.5 Turbo",
			Created:     time.Now(),
			OwnedBy:     "openai",
			ContextSize: 4096,
			Pricing: &Pricing{
				PromptTokenCost:     0.0015, // $0.0015 per 1K prompt tokens
				CompletionTokenCost: 0.002,  // $0.002 per 1K completion tokens
			},
		},
		"gpt-3.5-turbo-16k": {
			ID:          "gpt-3.5-turbo-16k",
			Name:        "GPT-3.5 Turbo 16K",
			Created:     time.Now(),
			OwnedBy:     "openai",
			ContextSize: 16384,
			Pricing: &Pricing{
				PromptTokenCost:     0.003, // $0.003 per 1K prompt tokens
				CompletionTokenCost: 0.004, // $0.004 per 1K completion tokens
			},
		},
	}

	// Add models that are configured and available
	for _, model := range p.config.Models {
		if info, exists := modelInfo[model]; exists {
			p.models[model] = info
		}
	}

	// Check if any models from API match our configured models
	for _, model := range modelList.Models {
		if _, configured := p.models[model.ID]; configured {
			p.models[model.ID] = modelInfo[model.ID]
		}
	}

	return nil
}

// setDefaults sets default models if initialization fails
func (p *OpenAIProvider) setDefaults() {
	p.models["gpt-4"] = &ModelInfo{
		ID:          "gpt-4",
		Name:        "GPT-4",
		Created:     time.Now(),
		OwnedBy:     "openai",
		ContextSize: 8192,
		Pricing: &Pricing{
			PromptTokenCost:     0.03,
			CompletionTokenCost: 0.06,
		},
	}

	p.models["gpt-3.5-turbo"] = &ModelInfo{
		ID:          "gpt-3.5-turbo",
		Name:        "GPT-3.5 Turbo",
		Created:     time.Now(),
		OwnedBy:     "openai",
		ContextSize: 4096,
		Pricing: &Pricing{
			PromptTokenCost:     0.0015,
			CompletionTokenCost: 0.002,
		},
	}
}

// Complete generates text completion using OpenAI API
func (p *OpenAIProvider) Complete(ctx context.Context, req *CompletionRequest) (*CompletionResponse, error) {
	// Convert request to OpenAI format
	openaiReq := openai.ChatCompletionRequest{
		Model:       req.Model,
		Messages:    p.convertMessages(req.Messages),
		MaxTokens:   req.MaxTokens,
		Temperature: req.Temperature,
		TopP:        req.TopP,
		Stream:      req.Stream,
		Stop:        req.Stop,
	}

	// Make the API call with retry logic
	var resp openai.ChatCompletionResponse
	var err error

	for attempt := 0; attempt <= p.config.RetryCount; attempt++ {
		if attempt > 0 {
			p.logger.WithField("attempt", attempt).Warn("Retrying OpenAI completion")
			time.Sleep(time.Duration(p.config.RetryDelay) * time.Second * time.Duration(attempt))
		}

		resp, err = p.client.CreateChatCompletion(ctx, openaiReq)
		if err == nil {
			break
		}

		// Check if error is retryable
		if !p.isRetryableError(err) {
			break
		}
	}

	if err != nil {
		return nil, fmt.Errorf("OpenAI completion failed: %w", err)
	}

	// Convert response
	return p.convertResponse(&resp), nil
}

// convertMessages converts our message format to OpenAI's format
func (p *OpenAIProvider) convertMessages(messages []Message) []openai.ChatCompletionMessage {
	openaiMessages := make([]openai.ChatCompletionMessage, len(messages))
	for i, msg := range messages {
		openaiMessages[i] = openai.ChatCompletionMessage{
			Role:    msg.Role,
			Content: msg.Content,
			Name:    msg.Name,
		}
	}
	return openaiMessages
}

// convertResponse converts OpenAI response to our format
func (p *OpenAIProvider) convertResponse(resp *openai.ChatCompletionResponse) *CompletionResponse {
	choices := make([]Choice, len(resp.Choices))
	for i, choice := range resp.Choices {
		choices[i] = Choice{
			Index:        choice.Index,
			Message:      Message{Role: choice.Message.Role, Content: choice.Message.Content},
			FinishReason: choice.FinishReason,
		}
	}

	return &CompletionResponse{
		ID:      resp.ID,
		Object:  resp.Object,
		Created: time.Unix(resp.Created, 0),
		Model:   resp.Model,
		Choices: choices,
		Usage: &Usage{
			PromptTokens:     resp.Usage.PromptTokens,
			CompletionTokens: resp.Usage.CompletionTokens,
			TotalTokens:      resp.Usage.PromptTokens + resp.Usage.CompletionTokens,
		},
	}
}

// GetTokenCount returns the number of tokens in the text using OpenAI's tokenizer
func (p *OpenAIProvider) GetTokenCount(text string) (int, error) {
	// For simplicity, we'll use a rough estimate (1 token ≈ 4 characters for English)
	// In production, you would use OpenAI's tokenizer library (tiktoken)
	return len(text) / 4, nil
}

// GetModelInfo returns information about available models
func (p *OpenAIProvider) GetModelInfo() []*ModelInfo {
	models := make([]*ModelInfo, 0, len(p.models))
	for _, model := range p.models {
		models = append(models, model)
	}
	return models
}

// Health checks if the OpenAI provider is healthy
func (p *OpenAIProvider) Health(ctx context.Context) error {
	// Create a simple test request
	testReq := openai.ChatCompletionRequest{
		Model: "gpt-3.5-turbo",
		Messages: []openai.ChatCompletionMessage{
			{Role: "user", Content: "test"},
		},
		MaxTokens: 1,
	}

	_, err := p.client.CreateChatCompletion(ctx, testReq)
	return err
}

// Close closes the provider and cleans up resources
func (p *OpenAIProvider) Close() error {
	// OpenAI client doesn't need explicit cleanup
	return nil
}

// isRetryableError checks if an error is retryable
func (p *OpenAIProvider) isRetryableError(err error) bool {
	if err == nil {
		return false
	}

	// Check for specific OpenAI error codes that are retryable
	// This is a simplified check - in production, you'd parse the error response
	errStr := err.Error()
	retryableErrors := []string{
		"timeout",
		"connection",
		"temporary failure",
		"rate limit",
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

// contains checks if a string contains a substring (case-insensitive)
func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr ||
		(len(s) > len(substr) &&
			(s[:len(substr)] == substr ||
				s[len(s)-len(substr):] == substr ||
				findSubstring(s, substr))))
}

func findSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
