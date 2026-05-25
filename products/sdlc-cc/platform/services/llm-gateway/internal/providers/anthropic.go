package providers

import (
	"context"
	"fmt"
	"time"

	"github.com/SDLC/llm-gateway/pkg/models"
	"github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"
)

// AnthropicProvider implements the Provider interface for Anthropic Claude (anthropic-sdk-go).
type AnthropicProvider struct {
	*BaseProvider
	client anthropic.Client
}

// NewAnthropicProvider creates a new Anthropic provider.
func NewAnthropicProvider(config models.ProviderConfig) *AnthropicProvider {
	opts := []option.RequestOption{option.WithAPIKey(config.APIKey)}
	if config.BaseURL != "" {
		opts = append(opts, option.WithBaseURL(config.BaseURL))
	}
	client := anthropic.NewClient(opts...)
	return &AnthropicProvider{
		BaseProvider: NewBaseProvider("anthropic", config),
		client:       client,
	}
}

// Complete generates a text completion using Anthropic.
func (p *AnthropicProvider) Complete(ctx context.Context, req *models.CompletionRequest) (*models.CompletionResponse, error) {
	startTime := time.Now()
	messages, system := buildMessageParams(req.Messages)
	params := anthropic.MessageNewParams{
		Model:       anthropic.Model(req.Model),
		MaxTokens:   int64(req.MaxTokens),
		Messages:    messages,
		Temperature: anthropic.Float(req.Temperature),
		TopP:        anthropic.Float(req.TopP),
	}
	if system != "" {
		params.System = []anthropic.TextBlockParam{{Text: system}}
	}
	if len(req.Stop) > 0 {
		params.StopSequences = req.Stop
	}

	msg, err := p.client.Messages.New(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("Anthropic completion failed: %w", err)
	}

	content := extractTextContent(msg.Content)
	promptTokens, completionTokens := getUsage(msg)
	totalTokens := promptTokens + completionTokens
	promptCost, _ := p.GetModelCost(req.Model, promptTokens, 0)
	completionCost, _ := p.GetModelCost(req.Model, 0, completionTokens)

	return &models.CompletionResponse{
		ID:      msg.ID,
		Object:  "chat.completion",
		Created: time.Now().Unix(),
		Model:   string(msg.Model),
		Choices: []models.Choice{{
			Index:        0,
			Message:      models.Message{Role: "assistant", Content: content},
			FinishReason: mapStopReason(msg.StopReason),
		}},
		Usage: models.TokenUsage{
			PromptTokens:     promptTokens,
			CompletionTokens: completionTokens,
			TotalTokens:      totalTokens,
		},
		Provider:       p.GetName(),
		ProcessingTime: time.Since(startTime),
		Cost:           promptCost + completionCost,
		Metadata:       req.Metadata,
	}, nil
}

// CompleteStream generates a streaming completion using Anthropic.
func (p *AnthropicProvider) CompleteStream(ctx context.Context, req *models.CompletionRequest) (<-chan StreamChunk, error) {
	messages, system := buildMessageParams(req.Messages)
	params := anthropic.MessageNewParams{
		Model:     anthropic.Model(req.Model),
		MaxTokens: int64(req.MaxTokens),
		Messages:  messages,
	}
	if system != "" {
		params.System = []anthropic.TextBlockParam{{Text: system}}
	}
	if len(req.Stop) > 0 {
		params.StopSequences = req.Stop
	}

	stream := p.client.Messages.NewStreaming(ctx, params)
	chunkChan := make(chan StreamChunk, 10)
	go func() {
		defer close(chunkChan)
		for stream.Next() {
			event := stream.Current()
			switch e := event.AsAny().(type) {
			case anthropic.ContentBlockDeltaEvent:
				if delta, ok := e.Delta.AsAny().(anthropic.TextDelta); ok {
					chunkChan <- StreamChunk{
						Choices: []StreamChoice{{Index: 0, Delta: Delta{Content: delta.Text}}},
					}
				}
			case anthropic.MessageStopEvent:
				chunkChan <- StreamChunk{
					Choices: []StreamChoice{{Index: 0, FinishReason: "stop"}},
					Done:    true,
				}
				return
			}
		}
		if err := stream.Err(); err != nil {
			chunkChan <- StreamChunk{Error: err, Done: true}
		}
	}()
	return chunkChan, nil
}

func buildMessageParams(messages []models.Message) ([]anthropic.MessageParam, string) {
	var system string
	var params []anthropic.MessageParam
	for _, msg := range messages {
		if msg.Role == "system" {
			system = msg.Content
			continue
		}
		if msg.Role == "assistant" {
			params = append(params, anthropic.NewAssistantMessage(anthropic.NewTextBlock(msg.Content)))
			continue
		}
		params = append(params, anthropic.NewUserMessage(anthropic.NewTextBlock(msg.Content)))
	}
	return params, system
}

func extractTextContent(blocks []anthropic.ContentBlockUnion) string {
	var s string
	for _, b := range blocks {
		if t, ok := b.AsAny().(anthropic.TextBlock); ok {
			s += t.Text
		}
	}
	return s
}

func getUsage(msg *anthropic.Message) (prompt, completion int) {
	return int(msg.Usage.InputTokens), int(msg.Usage.OutputTokens)
}

func mapStopReason(r anthropic.StopReason) string {
	switch r {
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
