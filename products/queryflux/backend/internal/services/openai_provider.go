//go:build experimental_services

/**
 * OpenAI Provider Implementation
 */

package services

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"go.uber.org/zap"
)

// OpenAIProvider implements AIProvider for OpenAI
type OpenAIProvider struct {
	config AIProviderConfig
	logger *zap.Logger
	client *http.Client
}

// OpenAI API request/response structures
type openAIRequest struct {
	Model       string          `json:"model"`
	Messages    []openAIMessage `json:"messages"`
	Temperature float64         `json:"temperature,omitempty"`
	MaxTokens   int             `json:"max_tokens,omitempty"`
	Stream      bool            `json:"stream,omitempty"`
}

type openAIMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type openAIResponse struct {
	ID      string         `json:"id"`
	Object  string         `json:"object"`
	Created int64          `json:"created"`
	Model   string         `json:"model"`
	Choices []openAIChoice `json:"choices"`
	Usage   openAIUsage    `json:"usage"`
}

type openAIChoice struct {
	Index        int           `json:"index"`
	Message      openAIMessage `json:"message"`
	FinishReason string        `json:"finish_reason"`
}

type openAIUsage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

// NewOpenAIProvider creates a new OpenAI provider
func NewOpenAIProvider(config AIProviderConfig, logger *zap.Logger) *OpenAIProvider {
	return &OpenAIProvider{
		config: config,
		logger: logger,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (p *OpenAIProvider) GetProvider() AIProvider {
	return AIProviderOpenAI
}

func (p *OpenAIProvider) GetConfig() AIProviderConfig {
	return p.config
}

func (p *OpenAIProvider) Execute(ctx context.Context, request AIRequest) (AIResponse, error) {
	// Map our AIRequest to OpenAI request
	openAIReq := openAIRequest{
		Model:       string(request.Model),
		Messages:    mapMessages(request.Messages),
		Temperature: request.Temperature,
		MaxTokens:   request.MaxTokens,
		Stream:      false,
	}

	// Marshal request
	reqBody, err := json.Marshal(openAIReq)
	if err != nil {
		return AIResponse{}, fmt.Errorf("failed to marshal request: %w", err)
	}

	// Create HTTP request
	baseURL := p.config.BaseURL
	if baseURL == "" {
		baseURL = "https://api.openai.com/v1"
	}

	req, err := http.NewRequestWithContext(ctx, "POST", baseURL+"/chat/completions", bytes.NewReader(reqBody))
	if err != nil {
		return AIResponse{}, fmt.Errorf("failed to create request: %w", err)
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+p.config.APIKey)

	// Execute request
	resp, err := p.client.Do(req)
	if err != nil {
		return AIResponse{}, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return AIResponse{}, fmt.Errorf("API error: %s", string(body))
	}

	// Parse response
	var openAIResp openAIResponse
	if err := json.NewDecoder(resp.Body).Decode(&openAIResp); err != nil {
		return AIResponse{}, fmt.Errorf("failed to decode response: %w", err)
	}

	if len(openAIResp.Choices) == 0 {
		return AIResponse{}, fmt.Errorf("no choices in response")
	}

	// Calculate cost
	inputCost := float64(openAIResp.Usage.PromptTokens) * p.config.CostPerToken.Input
	outputCost := float64(openAIResp.Usage.CompletionTokens) * p.config.CostPerToken.Output
	totalCost := inputCost + outputCost

	// Map response
	response := AIResponse{
		Content:    openAIResp.Choices[0].Message.Content,
		Model:      AIModel(openAIResp.Model),
		Provider:   AIProviderOpenAI,
		TokensUsed: openAIResp.Usage.TotalTokens,
		Cost:       totalCost,
	}

	p.logger.Debug("OpenAI request completed",
		zap.String("model", openAIResp.Model),
		zap.Int("tokens", openAIResp.Usage.TotalTokens),
		zap.Float64("cost", totalCost),
	)

	return response, nil
}

func (p *OpenAIProvider) ExecuteStream(
	ctx context.Context,
	request AIRequest,
	callback func(AIStreamChunk),
) (AIResponse, error) {
	// Map our AIRequest to OpenAI request
	openAIReq := openAIRequest{
		Model:       string(request.Model),
		Messages:    mapMessages(request.Messages),
		Temperature: request.Temperature,
		MaxTokens:   request.MaxTokens,
		Stream:      true,
	}

	// Marshal request
	reqBody, err := json.Marshal(openAIReq)
	if err != nil {
		return AIResponse{}, fmt.Errorf("failed to marshal request: %w", err)
	}

	// Create HTTP request
	baseURL := p.config.BaseURL
	if baseURL == "" {
		baseURL = "https://api.openai.com/v1"
	}

	req, err := http.NewRequestWithContext(ctx, "POST", baseURL+"/chat/completions", bytes.NewReader(reqBody))
	if err != nil {
		return AIResponse{}, fmt.Errorf("failed to create request: %w", err)
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+p.config.APIKey)

	// Execute request
	resp, err := p.client.Do(req)
	if err != nil {
		return AIResponse{}, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return AIResponse{}, fmt.Errorf("API error: %s", string(body))
	}

	// Read streaming response
	reader := bufio.NewReader(resp.Body)
	var fullContent strings.Builder
	var totalTokens int

	for {
		line, err := reader.ReadBytes('\n')
		if err != nil {
			if err == io.EOF {
				break
			}
			return AIResponse{}, fmt.Errorf("failed to read stream: %w", err)
		}

		// SSE format: "data: {json}"
		lineStr := string(line)
		if !strings.HasPrefix(lineStr, "data: ") {
			continue
		}

		data := strings.TrimPrefix(lineStr, "data: ")
		if data == "[DONE]" {
			break
		}

		// Parse JSON chunk
		var chunk struct {
			Choices []struct {
				Delta struct {
					Content string `json:"content"`
				} `json:"content"`
				FinishReason *string `json:"finish_reason"`
			} `json:"delta"`
			Usage *openAIUsage `json:"usage,omitempty"`
		}

		if err := json.Unmarshal([]byte(data), &chunk); err != nil {
			continue // Skip invalid JSON
		}

		if len(chunk.Choices) > 0 {
			content := chunk.Choices[0].Delta.Content
			fullContent.WriteString(content)

			callback(AIStreamChunk{
				Content: content,
				Done:    chunk.Choices[0].FinishReason != nil,
			})

			if chunk.Usage != nil {
				totalTokens = chunk.Usage.TotalTokens
			}
		}
	}

	// Calculate final cost
	inputCost := float64(totalTokens) * p.config.CostPerToken.Input
	outputCost := 0.0 // Approximation
	totalCost := inputCost + outputCost

	response := AIResponse{
		Content:    fullContent.String(),
		Model:      request.Model,
		Provider:   AIProviderOpenAI,
		TokensUsed: totalTokens,
		Cost:       totalCost,
	}

	return response, nil
}

func (p *OpenAIProvider) IsAvailable(ctx context.Context) (bool, error) {
	// Simple health check - make a minimal API call
	baseURL := p.config.BaseURL
	if baseURL == "" {
		baseURL = "https://api.openai.com/v1"
	}

	req, err := http.NewRequestWithContext(ctx, "GET", baseURL+"/models", nil)
	if err != nil {
		return false, err
	}

	req.Header.Set("Authorization", "Bearer "+p.config.APIKey)

	resp, err := p.client.Do(req)
	if err != nil {
		return false, nil
	}
	defer resp.Body.Close()

	return resp.StatusCode == http.StatusOK, nil
}

func (p *OpenAIProvider) GetRateLimitStatus(ctx context.Context) (RateLimitStatus, error) {
	// OpenAI rate limits are complex and would require parsing headers
	// For now, return default status
	return RateLimitStatus{
		RequestsRemaining: p.config.RateLimit.RequestsPerMinute,
		TokensRemaining:   p.config.RateLimit.TokensPerMinute,
		ResetAt:           time.Now().Add(time.Minute),
	}, nil
}

func (p *OpenAIProvider) EstimateCost(request AIRequest) float64 {
	// Estimate tokens (rough approximation: 4 chars per token)
	estimatedTokens := 0
	for _, msg := range request.Messages {
		estimatedTokens += len(msg.Content) / 4
	}

	inputCost := float64(estimatedTokens) * p.config.CostPerToken.Input
	outputCost := float64(request.MaxTokens) * p.config.CostPerToken.Output

	return inputCost + outputCost
}

func (p *OpenAIProvider) ValidateRequest(request AIRequest) error {
	// Basic validation
	if len(request.Messages) == 0 {
		return fmt.Errorf("request must contain at least one message")
	}

	if request.Temperature < 0 || request.Temperature > 2 {
		return fmt.Errorf("temperature must be between 0 and 2")
	}

	if request.MaxTokens < 1 || request.MaxTokens > p.config.MaxTokens {
		return fmt.Errorf("maxTokens must be between 1 and %d", p.config.MaxTokens)
	}

	// Check if model is supported
	modelSupported := false
	for _, model := range p.config.Models {
		if model == request.Model {
			modelSupported = true
			break
		}
	}

	if !modelSupported {
		return fmt.Errorf("model %s is not supported by this provider", request.Model)
	}

	return nil
}

// Helper function to map messages
func mapMessages(messages []AIMessage) []openAIMessage {
	result := make([]openAIMessage, len(messages))
	for i, msg := range messages {
		result[i] = openAIMessage{
			Role:    msg.Role,
			Content: msg.Content,
		}
	}
	return result
}
