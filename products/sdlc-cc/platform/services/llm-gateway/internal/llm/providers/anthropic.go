package providers

import (
	"context"
	"fmt"
	"time"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"
	"github.com/sirupsen/logrus"
)

// AnthropicProvider implements the Provider interface for Anthropic Claude (anthropic-sdk-go).
type AnthropicProvider struct {
	*BaseProvider
	client anthropic.Client
	logger *logrus.Logger
	models map[string]*ModelInfo
}

// NewAnthropicProvider creates a new Anthropic provider.
func NewAnthropicProvider(config ProviderConfig, logger *logrus.Logger) (Provider, error) {
	if config.APIKey == "" {
		return nil, fmt.Errorf("Anthropic API key is required")
	}
	opts := []option.RequestOption{option.WithAPIKey(config.APIKey)}
	if config.BaseURL != "" {
		opts = append(opts, option.WithBaseURL(config.BaseURL))
	}
	client := anthropic.NewClient(opts...)
	p := &AnthropicProvider{
		BaseProvider: NewBaseProvider("anthropic", config),
		client:       client,
		logger:       logger,
		models:       make(map[string]*ModelInfo),
	}
	if err := p.initializeModels(); err != nil {
		logger.WithError(err).Warn("Failed to initialize Anthropic models, using defaults")
		p.setDefaults()
	}
	return p, nil
}

func (p *AnthropicProvider) initializeModels() error {
	for _, m := range []string{"claude-3-opus-20240229", "claude-3-sonnet-20240229", "claude-3-haiku-20240307"} {
		p.models[m] = &ModelInfo{ID: m, Name: m, OwnedBy: "anthropic", ContextSize: 200000, Created: time.Now()}
	}
	return nil
}

func (p *AnthropicProvider) setDefaults() {
	p.models["claude-3-sonnet-20240229"] = &ModelInfo{ID: "claude-3-sonnet-20240229", Name: "Claude 3 Sonnet", OwnedBy: "anthropic", ContextSize: 200000, Created: time.Now()}
	p.models["claude-3-haiku-20240307"] = &ModelInfo{ID: "claude-3-haiku-20240307", Name: "Claude 3 Haiku", OwnedBy: "anthropic", ContextSize: 200000, Created: time.Now()}
}

// Complete generates a text completion using Anthropic.
func (p *AnthropicProvider) Complete(ctx context.Context, req *CompletionRequest) (*CompletionResponse, error) {
	messages, system := p.convertMessages(req.Messages)
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
	msg, err := p.client.Messages.New(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("Anthropic completion failed: %w", err)
	}
	return p.convertResponse(msg), nil
}

func (p *AnthropicProvider) convertMessages(messages []Message) ([]anthropic.MessageParam, string) {
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

func (p *AnthropicProvider) convertResponse(msg *anthropic.Message) *CompletionResponse {
	content := extractTextContent(msg.Content)
	promptTokens := int(msg.Usage.InputTokens)
	completionTokens := int(msg.Usage.OutputTokens)
	total := promptTokens + completionTokens
	if total == 0 {
		total = len(content)/4 + len(content)/4
		promptTokens, completionTokens = total/2, total-total/2
	}
	return &CompletionResponse{
		ID:      msg.ID,
		Object:  "chat.completion",
		Created: time.Now(),
		Model:   string(msg.Model),
		Choices: []Choice{{Index: 0, Message: Message{Role: "assistant", Content: content}, FinishReason: mapStopReason(msg.StopReason)}},
		Usage:   &Usage{PromptTokens: promptTokens, CompletionTokens: completionTokens, TotalTokens: total},
	}
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

// GetTokenCount returns token count estimate.
func (p *AnthropicProvider) GetTokenCount(text string) (int, error) {
	n := len(text) / 4
	if n < 1 {
		n = 1
	}
	return n, nil
}

// GetModelInfo returns available models.
func (p *AnthropicProvider) GetModelInfo() []*ModelInfo {
	out := make([]*ModelInfo, 0, len(p.models))
	for _, m := range p.models {
		out = append(out, m)
	}
	return out
}

// Health checks the provider.
func (p *AnthropicProvider) Health(ctx context.Context) error {
	_, err := p.client.Messages.New(ctx, anthropic.MessageNewParams{
		Model:     anthropic.ModelClaude_3_Haiku_20240307,
		MaxTokens: 1,
		Messages:  []anthropic.MessageParam{anthropic.NewUserMessage(anthropic.NewTextBlock("ping"))},
	})
	return err
}

// Close closes the provider.
func (p *AnthropicProvider) Close() error { return nil }
