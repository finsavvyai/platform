//go:build ignore

package providers

import (
	"context"
	"fmt"
	"time"

	"github.com/SDLC/llm-gateway/pkg/models"
	"github.com/anthropics/anthropic-go"
	"github.com/anthropics/anthropic-go/options"
)

// AnthropicProvider implements the Provider interface for Anthropic
type AnthropicProvider struct {
	*BaseProvider
	client *anthropic.Client
}

// NewAnthropicProvider creates a new Anthropic provider
func NewAnthropicProvider(config models.ProviderConfig) *AnthropicProvider {
	opts := []options.RequestOption{
		options.WithAPIKey(config.APIKey),
	}

	if config.BaseURL != "" {
		opts = append(opts, options.WithBaseURL(config.BaseURL))
	}

	client := anthropic.NewClient(opts...)

	return &AnthropicProvider{
		BaseProvider: NewBaseProvider("anthropic", config),
		client:       client,
	}
}

// Complete generates a text completion using Anthropic
func (p *AnthropicProvider) Complete(ctx context.Context, req *models.CompletionRequest) (*models.CompletionResponse, error) {
	startTime := time.Now()

	// Convert our request format to Anthropic's format
	messages := convertToAnthropicMessages(req.Messages)
	systemMessage := extractSystemMessage(req.Messages)

	// Create the completion request
	anthropicReq := &anthropic.Message{
		Model:         anthropic.Model(req.Model),
		Messages:      messages,
		MaxTokens:     req.MaxTokens,
		Temperature:   &req.Temperature,
		TopP:          &req.TopP,
		StopSequences: req.Stop,
	}

	if systemMessage != "" {
		anthropicReq.System = &systemMessage
	}

	// Make the API call
	resp, err := p.client.CreateMessage(ctx, anthropicReq)
	if err != nil {
		return nil, fmt.Errorf("Anthropic completion failed: %w", err)
	}

	// Convert Anthropic response to our format
	choices := []models.Choice{
		{
			Index: 0,
			Message: models.Message{
				Role:    "assistant",
				Content: resp.Content[0].Text,
			},
			FinishReason: mapFinishReason(resp.StopReason),
		},
	}

	// Calculate cost
	promptCost, _ := p.GetModelCost(req.Model, resp.Usage.InputTokens, 0)
	completionCost, _ := p.GetModelCost(req.Model, 0, resp.Usage.OutputTokens)
	totalCost := promptCost + completionCost

	return &models.CompletionResponse{
		ID:      resp.ID,
		Object:  "chat.completion",
		Created: time.Now().Unix(),
		Model:   string(resp.Model),
		Choices: choices,
		Usage: models.TokenUsage{
			PromptTokens:     resp.Usage.InputTokens,
			CompletionTokens: resp.Usage.OutputTokens,
			TotalTokens:      resp.Usage.InputTokens + resp.Usage.OutputTokens,
		},
		Provider:       p.GetName(),
		ProcessingTime: time.Since(startTime),
		Cost:           totalCost,
		Metadata:       req.Metadata,
	}, nil
}

// CompleteStream generates a streaming text completion using Anthropic
func (p *AnthropicProvider) CompleteStream(ctx context.Context, req *models.CompletionRequest) (<-chan StreamChunk, error) {
	// Convert our request format to Anthropic's format
	messages := convertToAnthropicMessages(req.Messages)
	systemMessage := extractSystemMessage(req.Messages)

	// Create the streaming request
	anthropicReq := &anthropic.Message{
		Model:         anthropic.Model(req.Model),
		Messages:      messages,
		MaxTokens:     req.MaxTokens,
		Temperature:   &req.Temperature,
		TopP:          &req.TopP,
		StopSequences: req.Stop,
		Stream:        true,
	}

	if systemMessage != "" {
		anthropicReq.System = &systemMessage
	}

	// Create the streaming API call
	stream, err := p.client.CreateMessageStream(ctx, anthropicReq)
	if err != nil {
		return nil, fmt.Errorf("Anthropic stream creation failed: %w", err)
	}

	// Create channel for streaming responses
	chunkChan := make(chan StreamChunk, 10)

	// Start goroutine to handle streaming
	go func() {
		defer close(chunkChan)

		for {
			event, err := stream.Recv()
			if err != nil {
				chunkChan <- StreamChunk{
					Error: fmt.Errorf("stream error: %w", err),
					Done:  true,
				}
				return
			}

			switch event.Type {
			case anthropic.EventMessageStart:
				// Start of message
				chunkChan <- StreamChunk{
					ID:      event.Message.ID,
					Object:  "chat.completion.chunk",
					Created: time.Now().Unix(),
					Model:   string(event.Message.Model),
				}

			case anthropic.EventContentBlockStart:
				// Content block started
				if event.ContentBlock != nil && event.ContentBlock.Type == "text" {
					chunkChan <- StreamChunk{
						Choices: []StreamChoice{
							{
								Index: 0,
								Delta: Delta{Content: event.ContentBlock.Text},
							},
						},
					}
				}

			case anthropic.EventContentBlockDelta:
				// Content delta
				if event.Delta != nil && event.Delta.Type == "text_delta" {
					chunkChan <- StreamChunk{
						Choices: []StreamChoice{
							{
								Index: 0,
								Delta: Delta{Content: event.Delta.Text},
							},
						},
					}
				}

			case anthropic.EventMessageStop:
				// End of message
				chunkChan <- StreamChunk{
					Choices: []StreamChoice{
						{
							Index:        0,
							FinishReason: mapFinishReason(event.StopReason),
						},
					},
					Done: true,
				}
				return
			}
		}
	}()

	return chunkChan, nil
}

// GetTokenCount estimates the token count for Anthropic models
func (p *AnthropicProvider) GetTokenCount(text string) (int, error) {
	// Anthropic uses their own tokenizer (Claude tokenizer)
	// For estimation, we can use a rough heuristic: ~4 characters per token
	// In production, you would want to use the actual tokenizer
	estimatedTokens := len(text) / 4
	if estimatedTokens < 1 {
		estimatedTokens = 1
	}
	return estimatedTokens, nil
}

// GetModelInfo returns information about available Anthropic models
func (p *AnthropicProvider) GetModelInfo() ([]models.ModelInfo, error) {
	models := []models.ModelInfo{}

	// Get model configs from provider config
	for _, modelConfig := range p.config.Models {
		model := models.ModelInfo{
			ID:           modelConfig.ID,
			Name:         modelConfig.Name,
			Provider:     p.GetName(),
			MaxTokens:    modelConfig.MaxTokens,
			InputCost:    modelConfig.InputCost * p.config.CostMultiplier,
			OutputCost:   modelConfig.OutputCost * p.config.CostMultiplier,
			Capabilities: modelConfig.Capabilities,
			IsAvailable:  modelConfig.Enabled && p.enabled,
		}
		models = append(models, model)
	}

	// Add default models if not configured
	if len(models) == 0 {
		models = []models.ModelInfo{
			{
				ID:           "claude-3-opus-20240229",
				Name:         "Claude 3 Opus",
				Provider:     p.GetName(),
				MaxTokens:    4096,
				InputCost:    0.015 * p.config.CostMultiplier,
				OutputCost:   0.075 * p.config.CostMultiplier,
				Capabilities: []string{"chat", "completion", "long-context"},
				IsAvailable:  p.enabled,
			},
			{
				ID:           "claude-3-sonnet-20240229",
				Name:         "Claude 3 Sonnet",
				Provider:     p.GetName(),
				MaxTokens:    4096,
				InputCost:    0.003 * p.config.CostMultiplier,
				OutputCost:   0.015 * p.config.CostMultiplier,
				Capabilities: []string{"chat", "completion"},
				IsAvailable:  p.enabled,
			},
			{
				ID:           "claude-3-haiku-20240307",
				Name:         "Claude 3 Haiku",
				Provider:     p.GetName(),
				MaxTokens:    4096,
				InputCost:    0.00025 * p.config.CostMultiplier,
				OutputCost:   0.00125 * p.config.CostMultiplier,
				Capabilities: []string{"chat", "completion", "fast"},
				IsAvailable:  p.enabled,
			},
		}
	}

	return models, nil
}

// Health checks the health of the Anthropic provider
func (p *AnthropicProvider) Health(ctx context.Context) (*models.HealthStatus, error) {
	startTime := time.Now()

	// Simple health check - try a minimal completion
	testReq := &anthropic.Message{
		Model:     anthropic.ModelClaude3Haiku,
		MaxTokens: 10,
		Messages: []anthropic.Message{
			{
				Role:    anthropic.RoleUser,
				Content: "Hi",
			},
		},
	}

	_, err := p.client.CreateMessage(ctx, testReq)

	status := &models.HealthStatus{
		Provider:    p.GetName(),
		LastChecked: time.Now(),
		Latency:     time.Since(startTime),
		Metadata:    make(map[string]string),
	}

	if err != nil {
		status.Status = "unhealthy"
		status.Error = err.Error()
	} else {
		status.Status = "healthy"
	}

	p.lastHealthCheck = time.Now()
	p.lastHealthStatus = status

	return status, nil
}

// GetModelCost calculates the cost for a given request
func (p *AnthropicProvider) GetModelCost(model string, promptTokens int, completionTokens int) (float64, error) {
	// Get model info to find pricing
	models, err := p.GetModelInfo()
	if err != nil {
		return 0, err
	}

	var inputCost, outputCost float64
	for _, m := range models {
		if m.ID == model {
			inputCost = m.InputCost
			outputCost = m.OutputCost
			break
		}
	}

	// Default costs if model not found (Claude 3 Sonnet pricing)
	if inputCost == 0 && outputCost == 0 {
		inputCost = 0.003
		outputCost = 0.015
	}

	// Calculate total cost (costs are per 1K tokens)
	promptCost := (float64(promptTokens) / 1000.0) * inputCost
	completionCost := (float64(completionTokens) / 1000.0) * outputCost

	return promptCost + completionCost, nil
}

// convertToAnthropicMessages converts our message format to Anthropic's format
func convertToAnthropicMessages(messages []models.Message) []anthropic.Message {
	anthropicMessages := []anthropic.Message{}

	for _, msg := range messages {
		if msg.Role == "system" {
			// System messages are handled separately in Anthropic
			continue
		}

		role := anthropic.RoleUser
		if msg.Role == "assistant" {
			role = anthropic.RoleAssistant
		}

		anthropicMessages = append(anthropicMessages, anthropic.Message{
			Role:    role,
			Content: msg.Content,
		})
	}

	return anthropicMessages
}

// extractSystemMessage extracts the system message from our message format
func extractSystemMessage(messages []models.Message) string {
	for _, msg := range messages {
		if msg.Role == "system" {
			return msg.Content
		}
	}
	return ""
}

// mapFinishReason maps Anthropic stop reasons to standard reasons
func mapFinishReason(reason anthropic.StopReason) string {
	switch reason {
	case anthropic.StopReasonEndTurn:
		return "stop"
	case anthropic.StopReasonMaxTokens:
		return "length"
	case anthropic.StopReasonStopSequence:
		return "stop"
	default:
		return "stop"
	}
}
