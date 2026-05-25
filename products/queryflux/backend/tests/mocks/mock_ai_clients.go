package mocks

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/queryflux/backend/internal/domain"
)

// MockOpenAIClient implements a mock OpenAI client for testing
type MockOpenAIClient struct {
	responses      map[string]*interface{}
	errors         map[string]error
	validateKey    bool
	calls          []MockAPICall
	rateLimitCount int
}

type MockAPICall struct {
	Endpoint  string
	Payload   interface{}
	Headers   map[string]string
	Timestamp time.Time
}

func NewMockOpenAIClient() *MockOpenAIClient {
	return &MockOpenAIClient{
		responses:      make(map[string]*interface{}),
		errors:         make(map[string]error),
		calls:          []MockAPICall{},
		rateLimitCount: 0,
	}
}

func (m *MockOpenAIClient) MakeRequest(ctx context.Context, endpoint string, payload interface{}, headers map[string]string) (*interface{}, error) {
	// Record the call
	m.calls = append(m.calls, MockAPICall{
		Endpoint:  endpoint,
		Payload:   payload,
		Headers:   headers,
		Timestamp: time.Now(),
	})

	// Simulate rate limiting
	if m.rateLimitCount > 5 {
		return nil, fmt.Errorf("rate limit exceeded")
	}
	m.rateLimitCount++

	// Check for predefined errors
	if err, exists := m.errors[endpoint]; exists {
		return nil, err
	}

	// Return predefined response
	if response, exists := m.responses[endpoint]; exists {
		return response, nil
	}

	// Generate default response based on payload
	return m.generateDefaultResponse(payload), nil
}

func (m *MockOpenAIClient) StreamRequest(ctx context.Context, endpoint string, payload interface{}, headers map[string]string) (<-chan []byte, error) {
	ch := make(chan []byte, 10)

	// Send some mock streaming data
	go func() {
		defer close(ch)
		data := []string{
			`{"id": "chatcmpl-123", "object": "chat.completion.chunk", "created": 1694268190, "model": "gpt-4-0613", "choices": [{"index": 0, "delta": {"role": "assistant"}, "finish_reason": null}]}`,
			`{"id": "chatcmpl-123", "object": "chat.completion.chunk", "created": 1694268190, "model": "gpt-4-0613", "choices": [{"index": 0, "delta": {"content": "SELECT"}, "finish_reason": null}]}`,
			`{"id": "chatcmpl-123", "object": "chat.completion.chunk", "created": 1694268190, "model": "gpt-4-0613", "choices": [{"index": 0, "delta": {"content": " *"}, "finish_reason": null}]}`,
			`{"id": "chatcmpl-123", "object": "chat.completion.chunk", "created": 1694268190, "model": "gpt-4-0613", "choices": [{"index": 0, "delta": {"content": " FROM"}, "finish_reason": null}]}`,
			`{"id": "chatcmpl-123", "object": "chat.completion.chunk", "created": 1694268190, "model": "gpt-4-0613", "choices": [{"index": 0, "delta": {"content": " users"}, "finish_reason": null}]}`,
			`{"id": "chatcmpl-123", "object": "chat.completion.chunk", "created": 1694268190, "model": "gpt-4-0613", "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}]}`,
		}

		for _, d := range data {
			select {
			case ch <- []byte(d):
			case <-ctx.Done():
				return
			}
		}
	}()

	return ch, nil
}

func (m *MockOpenAIClient) SetAPIKey(apiKey string) {
	m.validateKey = apiKey != ""
}

func (m *MockOpenAIClient) SetBaseURL(baseURL string) {
	// Mock implementation
}

func (m *MockOpenAIClient) SetTimeout(timeout time.Duration) {
	// Mock implementation
}

func (m *MockOpenAIClient) ValidateAPIKey(ctx context.Context) error {
	if !m.validateKey {
		return fmt.Errorf("invalid API key")
	}
	return nil
}

func (m *MockOpenAIClient) ValidateConfiguration() error {
	return nil
}

func (m *MockOpenAIClient) GetRateLimitInfo(ctx context.Context) (map[string]interface{}, error) {
	return map[string]interface{}{
		"limit_requests":     5000,
		"remaining_requests": 4950,
		"limit_tokens":       150000,
		"remaining_tokens":   148000,
		"reset_time":         time.Now().Add(time.Hour),
	}, nil
}

func (m *MockOpenAIClient) ResetRateLimit(ctx context.Context) error {
	m.rateLimitCount = 0
	return nil
}

// Helper methods for setting up mock responses
func (m *MockOpenAIClient) SetResponse(endpoint string, response interface{}) {
	resp := response
	m.responses[endpoint] = &resp
}

func (m *MockOpenAIClient) SetError(endpoint string, err error) {
	m.errors[endpoint] = err
}

func (m *MockOpenAIClient) GetCalls() []MockAPICall {
	return m.calls
}

func (m *MockOpenAIClient) ResetCalls() {
	m.calls = []MockAPICall{}
	m.rateLimitCount = 0
}

func (m *MockOpenAIClient) generateDefaultResponse(payload interface{}) *interface{} {
	// Try to extract prompt from payload
	payloadMap, ok := payload.(map[string]interface{})
	if !ok {
		return toPtr(map[string]interface{}{
			"id": "chatcmpl-default",
			"choices": []map[string]interface{}{
				{
					"message": map[string]interface{}{
						"role":    "assistant",
						"content": "Default response",
					},
				},
			},
			"usage": map[string]interface{}{
				"total_tokens": 100,
			},
		})
	}

	// Check if this is an NL to SQL request
	if messages, ok := payloadMap["messages"].([]interface{}); ok && len(messages) > 0 {
		if message, ok := messages[0].(map[string]interface{}); ok {
			if content, ok := message["content"].(string); ok {
				if strings.Contains(strings.ToLower(content), "show") && strings.Contains(strings.ToLower(content), "users") {
					return toPtr(map[string]interface{}{
						"id": "chatcmpl-nl2sql",
						"choices": []map[string]interface{}{
							{
								"message": map[string]interface{}{
									"role":    "assistant",
									"content": "```sql\nSELECT * FROM users;\n```\n\nExplanation: This query selects all columns from the users table.",
								},
							},
						},
						"usage": map[string]interface{}{
							"total_tokens": 150,
						},
					})
				}
			}
		}
	}

	// Default response
	return toPtr(map[string]interface{}{
		"id": "chatcmpl-default",
		"choices": []map[string]interface{}{
			{
				"message": map[string]interface{}{
					"role":    "assistant",
					"content": "Mock AI response for testing",
				},
			},
		},
		"usage": map[string]interface{}{
			"total_tokens": 50,
		},
	})
}

// MockClaudeClient implements a mock Claude client for testing
type MockClaudeClient struct {
	responses      map[string]*interface{}
	errors         map[string]error
	validateKey    bool
	calls          []MockAPICall
	rateLimitCount int
}

func NewMockClaudeClient() *MockClaudeClient {
	return &MockClaudeClient{
		responses:      make(map[string]*interface{}),
		errors:         make(map[string]error),
		calls:          []MockAPICall{},
		rateLimitCount: 0,
	}
}

func (m *MockClaudeClient) MakeRequest(ctx context.Context, endpoint string, payload interface{}, headers map[string]string) (*interface{}, error) {
	// Record the call
	m.calls = append(m.calls, MockAPICall{
		Endpoint:  endpoint,
		Payload:   payload,
		Headers:   headers,
		Timestamp: time.Now(),
	})

	// Simulate rate limiting
	if m.rateLimitCount > 3 {
		return nil, fmt.Errorf("rate limit exceeded")
	}
	m.rateLimitCount++

	// Check for predefined errors
	if err, exists := m.errors[endpoint]; exists {
		return nil, err
	}

	// Return predefined response
	if response, exists := m.responses[endpoint]; exists {
		return response, nil
	}

	// Generate default response
	return m.generateDefaultResponse(payload), nil
}

func (m *MockClaudeClient) StreamRequest(ctx context.Context, endpoint string, payload interface{}, headers map[string]string) (<-chan []byte, error) {
	ch := make(chan []byte, 10)

	// Send some mock streaming data
	go func() {
		defer close(ch)
		data := []string{
			`{"type": "message_start", "message": {"id": "msg_123", "type": "message", "role": "assistant", "content": []}}`,
			`{"type": "content_block_start", "index": 0, "content_block": {"type": "text", "text": ""}}`,
			`{"type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": "Claude"}}`,
			`{"type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": " response"}}`,
			`{"type": "content_block_stop", "index": 0}`,
			`{"type": "message_delta", "delta": {"stop_reason": "end_turn", "stop_sequence": null}}`,
			`{"type": "message_stop"}`,
		}

		for _, d := range data {
			select {
			case ch <- []byte(d):
			case <-ctx.Done():
				return
			}
		}
	}()

	return ch, nil
}

func (m *MockClaudeClient) SetAPIKey(apiKey string) {
	m.validateKey = apiKey != ""
}

func (m *MockClaudeClient) SetBaseURL(baseURL string) {
	// Mock implementation
}

func (m *MockClaudeClient) SetTimeout(timeout time.Duration) {
	// Mock implementation
}

func (m *MockClaudeClient) ValidateAPIKey(ctx context.Context) error {
	if !m.validateKey {
		return fmt.Errorf("invalid API key")
	}
	return nil
}

func (m *MockClaudeClient) ValidateConfiguration() error {
	return nil
}

func (m *MockClaudeClient) GetRateLimitInfo(ctx context.Context) (map[string]interface{}, error) {
	return map[string]interface{}{
		"limit_requests":     1000,
		"remaining_requests": 950,
		"limit_tokens":       100000,
		"remaining_tokens":   98000,
		"reset_time":         time.Now().Add(time.Hour),
	}, nil
}

func (m *MockClaudeClient) ResetRateLimit(ctx context.Context) error {
	m.rateLimitCount = 0
	return nil
}

// Helper methods for setting up mock responses
func (m *MockClaudeClient) SetResponse(endpoint string, response interface{}) {
	resp := response
	m.responses[endpoint] = &resp
}

func (m *MockClaudeClient) SetError(endpoint string, err error) {
	m.errors[endpoint] = err
}

func (m *MockClaudeClient) GetCalls() []MockAPICall {
	return m.calls
}

func (m *MockClaudeClient) ResetCalls() {
	m.calls = []MockAPICall{}
	m.rateLimitCount = 0
}

func (m *MockClaudeClient) generateDefaultResponse(payload interface{}) *interface{} {
	return toPtr(map[string]interface{}{
		"id":   "msg_default",
		"type": "message",
		"role": "assistant",
		"content": []map[string]interface{}{
			{
				"type": "text",
				"text": "Mock Claude response for testing",
			},
		},
		"usage": map[string]interface{}{
			"input_tokens":  50,
			"output_tokens": 30,
		},
	})
}

// MockAIClientFactory creates mock AI clients for testing
type MockAIClientFactory struct {
	openAIClient *MockOpenAIClient
	claudeClient *MockClaudeClient
}

func NewMockAIClientFactory() *MockAIClientFactory {
	return &MockAIClientFactory{
		openAIClient: NewMockOpenAIClient(),
		claudeClient: NewMockClaudeClient(),
	}
}

func (f *MockAIClientFactory) GetOpenAIClient() *MockOpenAIClient {
	return f.openAIClient
}

func (f *MockAIClientFactory) GetClaudeClient() *MockClaudeClient {
	return f.claudeClient
}

// CreateMockAIServiceConfig creates a mock AI service configuration
func CreateMockAIServiceConfig(service domain.AIService, enabled bool) *domain.AIConfig {
	return &domain.AIConfig{
		Service:     service,
		Model:       getDefaultModel(service),
		BaseURL:     getDefaultBaseURL(service),
		MaxTokens:   2000,
		Temperature: 0.7,
		Timeout:     30 * time.Second,
		RateLimit:   10,
		Enabled:     enabled,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
}

func getDefaultModel(service domain.AIService) string {
	switch service {
	case domain.AIServiceOpenAI:
		return "gpt-4"
	case domain.AIServiceClaude:
		return "claude-3-sonnet-20240229"
	default:
		return "gpt-4"
	}
}

func getDefaultBaseURL(service domain.AIService) string {
	switch service {
	case domain.AIServiceOpenAI:
		return "https://api.openai.com/v1"
	case domain.AIServiceClaude:
		return "https://api.anthropic.com"
	default:
		return ""
	}
}

// Helper functions for creating mock responses

// CreateMockNLToSQLResponse creates a mock NL to SQL response
func CreateMockNLToSQLResponse(sql, explanation string, tokensUsed int) *interface{} {
	return toPtr(map[string]interface{}{
		"id": "chatcmpl-nl2sql",
		"choices": []interface{}{
			map[string]interface{}{
				"message": map[string]interface{}{
					"role":    "assistant",
					"content": fmt.Sprintf("```sql\n%s\n```\n\nExplanation: %s", sql, explanation),
				},
			},
		},
		"usage": map[string]interface{}{
			"total_tokens": float64(tokensUsed),
		},
	})
}

// CreateMockQueryOptimizationResponse creates a mock query optimization response
func CreateMockQueryOptimizationResponse(optimizedSQL string, improvements []string, tokensUsed int) *interface{} {
	impArray := make([]interface{}, len(improvements))
	for i, imp := range improvements {
		impArray[i] = map[string]interface{}{
			"type":        "optimization",
			"description": imp,
			"impact":      "medium",
		}
	}

	respObj := map[string]interface{}{
		"optimized_query": optimizedSQL,
		"explanation":     "Optimization explanation",
		"improvements":    impArray,
		"estimated_gain":  0.5,
		"confidence":      0.8,
	}
	contentBytes, _ := json.Marshal(respObj)

	return toPtr(map[string]interface{}{
		"id": "chatcmpl-optimize",
		"choices": []interface{}{
			map[string]interface{}{
				"message": map[string]interface{}{
					"role":    "assistant",
					"content": string(contentBytes),
				},
			},
		},
		"usage": map[string]interface{}{
			"total_tokens": float64(tokensUsed),
		},
	})
}

// CreateMockQueryExplanationResponse creates a mock query explanation response
func CreateMockQueryExplanationResponse(explanation string, steps []string, tokensUsed int) *interface{} {
	stepArray := make([]interface{}, len(steps))
	for i, step := range steps {
		stepArray[i] = map[string]interface{}{
			"order":       i + 1,
			"operation":   "process",
			"description": step,
		}
	}

	respObj := map[string]interface{}{
		"explanation": explanation,
		"steps":       stepArray,
		"complexity":  "moderate",
	}
	contentBytes, _ := json.Marshal(respObj)

	return toPtr(map[string]interface{}{
		"id": "chatcmpl-explain",
		"choices": []interface{}{
			map[string]interface{}{
				"message": map[string]interface{}{
					"role":    "assistant",
					"content": string(contentBytes),
				},
			},
		},
		"usage": map[string]interface{}{
			"total_tokens": float64(tokensUsed),
		},
	})
}

func toPtr(v interface{}) *interface{} {
	return &v
}

