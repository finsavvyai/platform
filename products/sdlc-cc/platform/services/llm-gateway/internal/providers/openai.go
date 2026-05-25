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
		Temperature: float32(req.Temperature),
		TopP:        float32(req.TopP),
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
			FinishReason: string(choice.FinishReason),
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
