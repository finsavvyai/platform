//go:build ignore

package providers

import (
	"context"
	"fmt"
	"time"

	"github.com/SDLC/llm-gateway/pkg/models"
	"github.com/sashabaranov/go-openai"
)

// OpenAIProvider implements the Provider interface for OpenAI
type OpenAIProvider struct {
	*BaseProvider
	client *openai.Client
}

// NewOpenAIProvider creates a new OpenAI provider
func NewOpenAIProvider(config models.ProviderConfig) *OpenAIProvider {
	clientConfig := openai.DefaultConfig(config.APIKey)

	if config.BaseURL != "" {
		clientConfig.BaseURL = config.BaseURL
	}

	client := openai.NewClientWithConfig(clientConfig)

	return &OpenAIProvider{
		BaseProvider: NewBaseProvider("openai", config),
		client:       client,
	}
}

// Complete generates a text completion using OpenAI
func (p *OpenAIProvider) Complete(ctx context.Context, req *models.CompletionRequest) (*models.CompletionResponse, error) {
	startTime := time.Now()

	// Convert our request format to OpenAI's format
	openaiReq := openai.ChatCompletionRequest{
		Model:       req.Model,
		Messages:    convertMessages(req.Messages),
		MaxTokens:   req.MaxTokens,
		Temperature: req.Temperature,
		TopP:        req.TopP,
		Stream:      false,
		Stop:        req.Stop,
	}

	// Make the API call
	resp, err := p.client.CreateChatCompletion(ctx, openaiReq)
	if err != nil {
		return nil, fmt.Errorf("OpenAI completion failed: %w", err)
	}

	// Convert OpenAI response to our format
	choices := make([]models.Choice, len(resp.Choices))
	for i, choice := range resp.Choices {
		choices[i] = models.Choice{
			Index:        choice.Index,
			Message:      models.Message{Role: choice.Message.Role, Content: choice.Message.Content},
			FinishReason: choice.FinishReason,
		}
	}

	// Calculate cost
	promptCost, _ := p.GetModelCost(req.Model, resp.Usage.PromptTokens, 0)
	completionCost, _ := p.GetModelCost(req.Model, 0, resp.Usage.CompletionTokens)
	totalCost := promptCost + completionCost

	return &models.CompletionResponse{
		ID:      resp.ID,
		Object:  resp.Object,
		Created: resp.Created,
		Model:   resp.Model,
		Choices: choices,
		Usage: models.TokenUsage{
			PromptTokens:     resp.Usage.PromptTokens,
			CompletionTokens: resp.Usage.CompletionTokens,
			TotalTokens:      resp.Usage.TotalTokens,
		},
		Provider:       p.GetName(),
		ProcessingTime: time.Since(startTime),
		Cost:           totalCost,
		Metadata:       req.Metadata,
	}, nil
}

// CompleteStream generates a streaming text completion using OpenAI
func (p *OpenAIProvider) CompleteStream(ctx context.Context, req *models.CompletionRequest) (<-chan StreamChunk, error) {
	// Convert our request format to OpenAI's format
	openaiReq := openai.ChatCompletionRequest{
		Model:       req.Model,
		Messages:    convertMessages(req.Messages),
		MaxTokens:   req.MaxTokens,
		Temperature: req.Temperature,
		TopP:        req.TopP,
		Stream:      true,
		Stop:        req.Stop,
	}

	// Create the streaming API call
	stream, err := p.client.CreateChatCompletionStream(ctx, openaiReq)
	if err != nil {
		return nil, fmt.Errorf("OpenAI stream creation failed: %w", err)
	}

	// Create channel for streaming responses
	chunkChan := make(chan StreamChunk, 10)

	// Start goroutine to handle streaming
	go func() {
		defer close(chunkChan)
		defer stream.Close()

		for {
			response, err := stream.Recv()
			if err != nil {
				chunkChan <- StreamChunk{
					Error: fmt.Errorf("stream error: %w", err),
					Done:  true,
				}
				return
			}

			// Handle end of stream
			if len(response.Choices) == 0 {
				chunkChan <- StreamChunk{Done: true}
				return
			}

			// Convert OpenAI stream response to our format
			choices := make([]StreamChoice, len(response.Choices))
			for i, choice := range response.Choices {
				choices[i] = StreamChoice{
					Index:        choice.Index,
					Delta:        Delta{Role: choice.Delta.Role, Content: choice.Delta.Content},
					FinishReason: choice.FinishReason,
				}
			}

			chunkChan <- StreamChunk{
				ID:      response.ID,
				Object:  response.Object,
				Created: response.Created,
				Model:   response.Model,
				Choices: choices,
				Done:    len(response.Choices) > 0 && response.Choices[0].FinishReason != "",
			}
		}
	}()

	return chunkChan, nil
}

// GetTokenCount estimates the token count for OpenAI models
func (p *OpenAIProvider) GetTokenCount(text string) (int, error) {
	// OpenAI uses tiktoken for tokenization
	// For estimation, we can use a rough heuristic: ~4 characters per token
	// In production, you would want to use the actual tiktoken library
	estimatedTokens := len(text) / 4
	if estimatedTokens < 1 {
		estimatedTokens = 1
	}
	return estimatedTokens, nil
}

// GetModelInfo returns information about available OpenAI models
func (p *OpenAIProvider) GetModelInfo() ([]models.ModelInfo, error) {
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
				ID:           "gpt-4",
				Name:         "GPT-4",
				Provider:     p.GetName(),
				MaxTokens:    8192,
				InputCost:    0.03 * p.config.CostMultiplier,
				OutputCost:   0.06 * p.config.CostMultiplier,
				Capabilities: []string{"chat", "completion", "function-calling"},
				IsAvailable:  p.enabled,
			},
			{
				ID:           "gpt-3.5-turbo",
				Name:         "GPT-3.5 Turbo",
				Provider:     p.GetName(),
				MaxTokens:    4096,
				InputCost:    0.0015 * p.config.CostMultiplier,
				OutputCost:   0.002 * p.config.CostMultiplier,
				Capabilities: []string{"chat", "completion"},
				IsAvailable:  p.enabled,
			},
		}
	}

	return models, nil
}

// Health checks the health of the OpenAI provider
func (p *OpenAIProvider) Health(ctx context.Context) (*models.HealthStatus, error) {
	startTime := time.Now()

	// Simple health check - try to list models
	_, err := p.client.ListModels(ctx)

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
func (p *OpenAIProvider) GetModelCost(model string, promptTokens int, completionTokens int) (float64, error) {
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

	// Default costs if model not found
	if inputCost == 0 && outputCost == 0 {
		inputCost = 0.0015
		outputCost = 0.002
	}

	// Calculate total cost (costs are per 1K tokens)
	promptCost := (float64(promptTokens) / 1000.0) * inputCost
	completionCost := (float64(completionTokens) / 1000.0) * outputCost

	return promptCost + completionCost, nil
}

// convertMessages converts our message format to OpenAI's format
func convertMessages(messages []models.Message) []openai.ChatCompletionMessage {
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
