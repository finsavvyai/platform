package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/sashabaranov/go-openai"
	"github.com/sirupsen/logrus"
)

// OpenAIProvider implements AIProvider for OpenAI
type OpenAIProvider struct {
	client      *openai.Client
	logger      *logrus.Logger
	model       string
	lastHealthy time.Time
	healthMutex sync.RWMutex
}

// NewOpenAIProvider creates a new OpenAI provider
func NewOpenAIProvider(apiKey string, model string) *OpenAIProvider {
	if model == "" {
		model = openai.GPT4
	}

	logger := logrus.New()
	logger.SetLevel(logrus.InfoLevel)

	return &OpenAIProvider{
		client:      openai.NewClient(apiKey),
		logger:      logger,
		model:       model,
		lastHealthy: time.Now(),
	}
}

// Name returns the provider name
func (p *OpenAIProvider) Name() string {
	return "openai"
}

// ConvertNLToSQL converts natural language to SQL using OpenAI
func (p *OpenAIProvider) ConvertNLToSQL(ctx context.Context, prompt string, schema string) (string, error) {
	resp, err := p.client.CreateChatCompletion(
		ctx,
		openai.ChatCompletionRequest{
			Model: p.model,
			Messages: []openai.ChatCompletionMessage{
				{
					Role:    openai.ChatMessageRoleSystem,
					Content: "You are an expert SQL developer. Convert natural language to SQL queries. Return ONLY the SQL query without any markdown formatting, code blocks, or explanations.",
				},
				{
					Role:    openai.ChatMessageRoleUser,
					Content: prompt,
				},
			},
			MaxTokens:   1500,
			Temperature: 0.1, // Low temperature for consistent SQL output
		},
	)

	if err != nil {
		p.logger.WithError(err).Error("OpenAI API call failed")
		p.markUnhealthy()
		return "", fmt.Errorf("OpenAI API error: %w", err)
	}

	if len(resp.Choices) == 0 {
		return "", fmt.Errorf("no response from OpenAI")
	}

	p.markHealthy()
	return strings.TrimSpace(resp.Choices[0].Message.Content), nil
}

// IsHealthy checks if the provider is currently healthy
func (p *OpenAIProvider) IsHealthy(ctx context.Context) bool {
	p.healthMutex.RLock()
	defer p.healthMutex.RUnlock()

	// If last healthy check was within 1 minute, assume still healthy
	return time.Since(p.lastHealthy) < time.Minute
}

func (p *OpenAIProvider) markHealthy() {
	p.healthMutex.Lock()
	defer p.healthMutex.Unlock()
	p.lastHealthy = time.Now()
}

func (p *OpenAIProvider) markUnhealthy() {
	p.healthMutex.Lock()
	defer p.healthMutex.Unlock()
	p.lastHealthy = time.Time{} // Zero time indicates unhealthy
}

// ClaudeProvider implements AIProvider for Anthropic Claude
type ClaudeProvider struct {
	apiKey      string
	httpClient  *http.Client
	logger      *logrus.Logger
	model       string
	lastHealthy time.Time
	healthMutex sync.RWMutex
}

// claudeRequest represents a Claude API request
type claudeAPIRequest struct {
	Model     string               `json:"model"`
	MaxTokens int                  `json:"max_tokens"`
	Messages  []claudeAPIMessage   `json:"messages"`
}

type claudeAPIMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type claudeAPIResponse struct {
	Content []claudeAPIContent `json:"content"`
	Error   *claudeAPIError    `json:"error,omitempty"`
}

type claudeAPIContent struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

type claudeAPIError struct {
	Type    string `json:"type"`
	Message string `json:"message"`
}

// NewClaudeProvider creates a new Claude provider
func NewClaudeProvider(apiKey string, model string) *ClaudeProvider {
	if model == "" {
		model = "claude-3-5-sonnet-20241022"
	}

	logger := logrus.New()
	logger.SetLevel(logrus.InfoLevel)

	return &ClaudeProvider{
		apiKey: apiKey,
		httpClient: &http.Client{
			Timeout: 60 * time.Second,
		},
		logger:      logger,
		model:       model,
		lastHealthy: time.Now(),
	}
}

// Name returns the provider name
func (p *ClaudeProvider) Name() string {
	return "claude"
}

// ConvertNLToSQL converts natural language to SQL using Claude
func (p *ClaudeProvider) ConvertNLToSQL(ctx context.Context, prompt string, schema string) (string, error) {
	reqBody := claudeAPIRequest{
		Model:     p.model,
		MaxTokens: 4000,
		Messages: []claudeAPIMessage{
			{
				Role:    "user",
				Content: prompt + "\n\nIMPORTANT: Return ONLY the SQL query without any markdown formatting, code blocks, or explanations.",
			},
		},
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.anthropic.com/v1/messages", bytes.NewBuffer(jsonBody))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", p.apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	resp, err := p.httpClient.Do(req)
	if err != nil {
		p.logger.WithError(err).Error("Claude API call failed")
		p.markUnhealthy()
		return "", fmt.Errorf("Claude API error: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		p.markUnhealthy()
		return "", fmt.Errorf("Claude API returned status %d: %s", resp.StatusCode, string(body))
	}

	var claudeResp claudeAPIResponse
	if err := json.NewDecoder(resp.Body).Decode(&claudeResp); err != nil {
		return "", fmt.Errorf("failed to decode response: %w", err)
	}

	if claudeResp.Error != nil {
		p.markUnhealthy()
		return "", fmt.Errorf("Claude API error: %s", claudeResp.Error.Message)
	}

	if len(claudeResp.Content) == 0 {
		return "", fmt.Errorf("no content in Claude response")
	}

	p.markHealthy()
	return strings.TrimSpace(claudeResp.Content[0].Text), nil
}

// IsHealthy checks if the provider is currently healthy
func (p *ClaudeProvider) IsHealthy(ctx context.Context) bool {
	p.healthMutex.RLock()
	defer p.healthMutex.RUnlock()

	// If last healthy check was within 1 minute, assume still healthy
	return time.Since(p.lastHealthy) < time.Minute
}

func (p *ClaudeProvider) markHealthy() {
	p.healthMutex.Lock()
	defer p.healthMutex.Unlock()
	p.lastHealthy = time.Now()
}

func (p *ClaudeProvider) markUnhealthy() {
	p.healthMutex.Lock()
	defer p.healthMutex.Unlock()
	p.lastHealthy = time.Time{} // Zero time indicates unhealthy
}

// OllamaProvider implements AIProvider for local Ollama models
type OllamaProvider struct {
	baseURL     string
	httpClient  *http.Client
	logger      *logrus.Logger
	model       string
	lastHealthy time.Time
	healthMutex sync.RWMutex
}

type ollamaRequest struct {
	Model  string `json:"model"`
	Prompt string `json:"prompt"`
	Stream bool   `json:"stream"`
}

type ollamaResponse struct {
	Response string `json:"response"`
	Done     bool   `json:"done"`
}

// NewOllamaProvider creates a new Ollama provider for local LLM inference
func NewOllamaProvider(baseURL string, model string) *OllamaProvider {
	if baseURL == "" {
		baseURL = "http://localhost:11434"
	}
	if model == "" {
		model = "codellama"
	}

	logger := logrus.New()
	logger.SetLevel(logrus.InfoLevel)

	return &OllamaProvider{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 120 * time.Second, // Longer timeout for local inference
		},
		logger:      logger,
		model:       model,
		lastHealthy: time.Now(),
	}
}

// Name returns the provider name
func (p *OllamaProvider) Name() string {
	return "ollama"
}

// ConvertNLToSQL converts natural language to SQL using Ollama
func (p *OllamaProvider) ConvertNLToSQL(ctx context.Context, prompt string, schema string) (string, error) {
	reqBody := ollamaRequest{
		Model:  p.model,
		Prompt: prompt + "\n\nReturn ONLY the SQL query without any explanations:",
		Stream: false,
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", p.baseURL+"/api/generate", bytes.NewBuffer(jsonBody))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := p.httpClient.Do(req)
	if err != nil {
		p.logger.WithError(err).Error("Ollama API call failed")
		p.markUnhealthy()
		return "", fmt.Errorf("Ollama API error: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		p.markUnhealthy()
		return "", fmt.Errorf("Ollama API returned status %d: %s", resp.StatusCode, string(body))
	}

	var ollamaResp ollamaResponse
	if err := json.NewDecoder(resp.Body).Decode(&ollamaResp); err != nil {
		return "", fmt.Errorf("failed to decode response: %w", err)
	}

	p.markHealthy()
	return strings.TrimSpace(ollamaResp.Response), nil
}

// IsHealthy checks if Ollama is running and responsive
func (p *OllamaProvider) IsHealthy(ctx context.Context) bool {
	// For Ollama, actually ping the server
	req, err := http.NewRequestWithContext(ctx, "GET", p.baseURL+"/api/tags", nil)
	if err != nil {
		return false
	}

	resp, err := p.httpClient.Do(req)
	if err != nil {
		p.markUnhealthy()
		return false
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		p.markHealthy()
		return true
	}

	p.markUnhealthy()
	return false
}

func (p *OllamaProvider) markHealthy() {
	p.healthMutex.Lock()
	defer p.healthMutex.Unlock()
	p.lastHealthy = time.Now()
}

func (p *OllamaProvider) markUnhealthy() {
	p.healthMutex.Lock()
	defer p.healthMutex.Unlock()
	p.lastHealthy = time.Time{}
}

// CreateProviderChain creates a fallback chain of AI providers based on configuration
func CreateProviderChain(openAIKey, claudeKey, ollamaURL, ollamaModel string) []AIProvider {
	providers := []AIProvider{}

	// Primary: OpenAI (most reliable)
	if openAIKey != "" {
		providers = append(providers, NewOpenAIProvider(openAIKey, openai.GPT4))
	}

	// Secondary: Claude (alternative cloud provider)
	if claudeKey != "" {
		providers = append(providers, NewClaudeProvider(claudeKey, ""))
	}

	// Tertiary: Ollama (local fallback, no API costs)
	if ollamaURL != "" || ollamaModel != "" {
		providers = append(providers, NewOllamaProvider(ollamaURL, ollamaModel))
	}

	return providers
}
