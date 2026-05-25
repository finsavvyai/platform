package sdln

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
)

// LLMService handles Large Language Model operations
type LLMService struct {
	*BaseService
}

// NewLLMService creates a new LLM service
func NewLLMService(client *Client) *LLMService {
	return &LLMService{
		BaseService: NewBaseService(client, "llm", "api/v1/llm"),
	}
}

// ChatCompletionRequest represents a chat completion request
type ChatCompletionRequest struct {
	Model            string                 `json:"model"`
	Messages         []ChatMessage          `json:"messages"`
	MaxTokens        *int                   `json:"max_tokens,omitempty"`
	Temperature      *float64               `json:"temperature,omitempty"`
	TopP             *float64               `json:"top_p,omitempty"`
	FrequencyPenalty *float64               `json:"frequency_penalty,omitempty"`
	PresencePenalty  *float64               `json:"presence_penalty,omitempty"`
	StopSequences    []string               `json:"stop,omitempty"`
	Stream           bool                   `json:"stream,omitempty"`
	Functions        []ChatFunction         `json:"functions,omitempty"`
	FunctionCall     *ChatFunctionCall      `json:"function_call,omitempty"`
	ResponseFormat   *ChatResponseFormat    `json:"response_format,omitempty"`
	Seed             *int                   `json:"seed,omitempty"`
	TenantID         string                 `json:"tenant_id"`
	User             string                 `json:"user,omitempty"`
	Metadata         map[string]interface{} `json:"metadata,omitempty"`
}

// ChatMessage represents a chat message
type ChatMessage struct {
	Role         string        `json:"role"` // system, user, assistant, function
	Content      string        `json:"content"`
	Name         *string       `json:"name,omitempty"`
	FunctionCall *FunctionCall `json:"function_call,omitempty"`
}

// ChatFunction represents a function definition
type ChatFunction struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description,omitempty"`
	Parameters  map[string]interface{} `json:"parameters"`
}

// ChatFunctionCall represents a function call
type ChatFunctionCall struct {
	Name      string `json:"name"`
	Arguments string `json:"arguments"`
}

// FunctionCall represents a function call result
type FunctionCall struct {
	ID       string `json:"id"`
	Function struct {
		Name      string `json:"name"`
		Arguments string `json:"arguments"`
	} `json:"function"`
}

// ChatResponseFormat represents response format options
type ChatResponseFormat struct {
	Type string `json:"type"` // text, json_object
}

// ChatCompletionResponse represents a chat completion response
type ChatCompletionResponse struct {
	ID                string                 `json:"id"`
	Object            string                 `json:"object"`
	Created           Timestamp                   `json:"created"`
	Model             string                 `json:"model"`
	Choices           []ChatCompletionChoice `json:"choices"`
	Usage             ChatCompletionUsage    `json:"usage"`
	SystemFingerprint *string                `json:"system_fingerprint,omitempty"`
}

// ChatCompletionChoice represents a choice in a completion
type ChatCompletionChoice struct {
	Index        int           `json:"index"`
	Message      ChatMessage   `json:"message"`
	FinishReason string        `json:"finish_reason"` // stop, length, function_call, content_filter
	Logprobs     *ChatLogprobs `json:"logprobs,omitempty"`
}

// ChatCompletionUsage represents token usage
type ChatCompletionUsage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

// ChatLogprobs represents log probabilities
type ChatLogprobs struct {
	TokenLogprobs []float64            `json:"token_logprobs"`
	TopLogprobs   []map[string]float64 `json:"top_logprobs"`
	TextOffset    []int                `json:"text_offset"`
}

// CompletionRequest represents a text completion request
type CompletionRequest struct {
	Model            string                 `json:"model"`
	Prompt           interface{}            `json:"prompt"` // string, string[], or array of prompt objects
	MaxTokens        *int                   `json:"max_tokens,omitempty"`
	Temperature      *float64               `json:"temperature,omitempty"`
	TopP             *float64               `json:"top_p,omitempty"`
	FrequencyPenalty *float64               `json:"frequency_penalty,omitempty"`
	PresencePenalty  *float64               `json:"presence_penalty,omitempty"`
	StopSequences    []string               `json:"stop,omitempty"`
	Stream           bool                   `json:"stream,omitempty"`
	Logprobs         *int                   `json:"logprobs,omitempty"`
	Echo             bool                   `json:"echo,omitempty"`
	Seed             *int                   `json:"seed,omitempty"`
	BestOf           *int                   `json:"best_of,omitempty"`
	LogitBias        map[string]float64     `json:"logit_bias,omitempty"`
	TenantID         string                 `json:"tenant_id"`
	User             string                 `json:"user,omitempty"`
	Metadata         map[string]interface{} `json:"metadata,omitempty"`
}

// CompletionResponse represents a completion response
type CompletionResponse struct {
	ID                string             `json:"id"`
	Object            string             `json:"object"`
	Created           Timestamp               `json:"created"`
	Model             string             `json:"model"`
	Choices           []CompletionChoice `json:"choices"`
	Usage             CompletionUsage    `json:"usage"`
	SystemFingerprint *string            `json:"system_fingerprint,omitempty"`
}

// CompletionChoice represents a choice in a completion
type CompletionChoice struct {
	Text         string              `json:"text"`
	Index        int                 `json:"index"`
	Logprobs     *CompletionLogprobs `json:"logprobs,omitempty"`
	FinishReason string              `json:"finish_reason"`
}

// CompletionUsage represents token usage for completions
type CompletionUsage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

// CompletionLogprobs represents log probabilities for completions
type CompletionLogprobs struct {
	Tokens        []string             `json:"tokens"`
	TokenLogprobs []float64            `json:"token_logprobs"`
	TopLogprobs   []map[string]float64 `json:"top_logprobs"`
	TextOffset    []int                `json:"text_offset"`
}

// EmbeddingRequest represents an embedding request
type EmbeddingRequest struct {
	Model      string                 `json:"model"`
	Input      interface{}            `json:"input"` // string, string[], or array of token arrays
	User       string                 `json:"user,omitempty"`
	Dimensions *int                   `json:"dimensions,omitempty"`
	TenantID   string                 `json:"tenant_id"`
	Metadata   map[string]interface{} `json:"metadata,omitempty"`
}

// EmbeddingResponse represents an embedding response
type EmbeddingResponse struct {
	Object string         `json:"object"`
	Data   []Embedding    `json:"data"`
	Model  string         `json:"model"`
	Usage  EmbeddingUsage `json:"usage"`
}

// Embedding represents a single embedding
type Embedding struct {
	Object    string    `json:"object"`
	Index     int       `json:"index"`
	Embedding []float64 `json:"embedding"`
}

// EmbeddingUsage represents token usage for embeddings
type EmbeddingUsage struct {
	PromptTokens int `json:"prompt_tokens"`
	TotalTokens  int `json:"total_tokens"`
}

// ModerationRequest represents a moderation request
type ModerationRequest struct {
	Input    interface{}            `json:"input"` // string, string[]
	Model    *string                `json:"model,omitempty"`
	TenantID string                 `json:"tenant_id"`
	Metadata map[string]interface{} `json:"metadata,omitempty"`
}

// ModerationResponse represents a moderation response
type ModerationResponse struct {
	ID      string             `json:"id"`
	Model   string             `json:"model"`
	Results []ModerationResult `json:"results"`
}

// ModerationResult represents a moderation result
type ModerationResult struct {
	Categories     ModerationCategories     `json:"categories"`
	CategoryScores ModerationCategoryScores `json:"category_scores"`
	Flagged        bool                     `json:"flagged"`
}

// ModerationCategories represents moderation categories
type ModerationCategories struct {
	Hate                  bool `json:"hate"`
	HateThreatening       bool `json:"hate/threatening"`
	Harassment            bool `json:"harassment"`
	HarassmentThreatening bool `json:"harassment/threatening"`
	SelfHarm              bool `json:"self-harm"`
	SelfHarmIntent        bool `json:"self-harm/intent"`
	SelfHarmInstructions  bool `json:"self-harm/instructions"`
	Sexual                bool `json:"sexual"`
	SexualMinors          bool `json:"sexual/minors"`
	Violence              bool `json:"violence"`
	ViolenceGraphic       bool `json:"violence/graphic"`
}

// ModerationCategoryScores represents moderation category scores
type ModerationCategoryScores struct {
	Hate                  float64 `json:"hate"`
	HateThreatening       float64 `json:"hate/threatening"`
	Harassment            float64 `json:"harassment"`
	HarassmentThreatening float64 `json:"harassment/threatening"`
	SelfHarm              float64 `json:"self-harm"`
	SelfHarmIntent        float64 `json:"self-harm/intent"`
	SelfHarmInstructions  float64 `json:"self-harm/instructions"`
	Sexual                float64 `json:"sexual"`
	SexualMinors          float64 `json:"sexual/minors"`
	Violence              float64 `json:"violence"`
	ViolenceGraphic       float64 `json:"violence/graphic"`
}

// Model represents an available model
type Model struct {
	ID      string `json:"id"`
	Object  string `json:"object"`
	Created Timestamp   `json:"created"`
	OwnedBy string `json:"owned_by"`
}

// FineTuningRequest represents a fine-tuning job request
type FineTuningRequest struct {
	Model          string                 `json:"model"`
	TrainingFile   string                 `json:"training_file"`
	ValidationFile *string                `json:"validation_file,omitempty"`
	NumberOfEpochs *int                   `json:"n_epochs,omitempty"`
	BatchSize      *int                   `json:"batch_size,omitempty"`
	LearningRate   *float64               `json:"learning_rate_multiplier,omitempty"`
	TenantID       string                 `json:"tenant_id"`
	Suffix         *string                `json:"suffix,omitempty"`
	Metadata       map[string]interface{} `json:"metadata,omitempty"`
}

// FineTuningJob represents a fine-tuning job
type FineTuningJob struct {
	ID             string                `json:"id"`
	Object         string                `json:"object"`
	Model          string                `json:"model"`
	JobStatus      string                `json:"status"` // created, running, succeeded, failed, cancelled
	TrainingFile   string                `json:"training_file"`
	ValidationFile *string               `json:"validation_file,omitempty"`
	TrainedTokens  *int                  `json:"trained_tokens,omitempty"`
	Error          *FineTuningError      `json:"error,omitempty"`
	Hyperparams    FineTuningHyperparams `json:"hyperparameters"`
	CreatedAt      Timestamp                  `json:"created_at"`
	FinishedAt     *Timestamp                 `json:"finished_at,omitempty"`
	TenantID       string                `json:"tenant_id"`
	User           string                `json:"user,omitempty"`
}

// FineTuningError represents a fine-tuning error
type FineTuningError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Param   string `json:"param,omitempty"`
}

// FineTuningHyperparams represents hyperparameters for fine-tuning
type FineTuningHyperparams struct {
	BatchSize      *int     `json:"batch_size,omitempty"`
	LearningRate   *float64 `json:"learning_rate_multiplier,omitempty"`
	NumberOfEpochs *int     `json:"n_epochs,omitempty"`
	WeightDecay    *float64 `json:"weight_decay,omitempty"`
}

// StreamingChatCompletionChunk represents a streaming chat completion chunk
type StreamingChatCompletionChunk struct {
	ID                string                          `json:"id"`
	Object            string                          `json:"object"`
	Created           Timestamp                            `json:"created"`
	Model             string                          `json:"model"`
	Choices           []StreamingChatCompletionChoice `json:"choices"`
	SystemFingerprint *string                         `json:"system_fingerprint,omitempty"`
}

// StreamingChatCompletionChoice represents a streaming choice
type StreamingChatCompletionChoice struct {
	Index        int                 `json:"index"`
	Delta        ChatCompletionDelta `json:"delta"`
	FinishReason *string             `json:"finish_reason,omitempty"`
	Logprobs     *ChatLogprobs       `json:"logprobs,omitempty"`
}

// ChatCompletionDelta represents the delta in a streaming completion
type ChatCompletionDelta struct {
	Role         string        `json:"role,omitempty"`
	Content      string        `json:"content,omitempty"`
	FunctionCall *FunctionCall `json:"function_call,omitempty"`
}

// CreateChatCompletion creates a chat completion
func (s *LLMService) CreateChatCompletion(ctx context.Context, req *ChatCompletionRequest) (*ChatCompletionResponse, error) {
	var response ChatCompletionResponse
	err := s.doPost(ctx, "/chat/completions", req, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to create chat completion: %w", err)
	}
	return &response, nil
}

// CreateChatCompletionStream creates a streaming chat completion
func (s *LLMService) CreateChatCompletionStream(ctx context.Context, req *ChatCompletionRequest) (<-chan *StreamingChatCompletionChunk, error) {
	req.Stream = true

	fullURL := s.serviceURL + "/chat/completions"

	jsonData, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", fullURL, bytes.NewReader(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "text/event-stream")
	httpReq.Header.Set("Cache-Control", "no-cache")

	// Add authentication
	if s.client.auth != nil {
		wrappedReq := newHTTPRequest(httpReq)
		if err := s.client.auth.Authenticate(ctx, *wrappedReq); err != nil {
			return nil, fmt.Errorf("authentication failed: %w", err)
		}
	}

	resp, err := s.client.do(ctx, httpReq)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		return nil, &APIError{
			Type:       getErrorTypeFromStatus(resp.StatusCode),
			Message:    string(body),
			StatusCode: resp.StatusCode,
			Timestamp:  time.Now().UTC(),
		}
	}

	ch := make(chan *StreamingChatCompletionChunk, 100)

	go func() {
		defer resp.Body.Close()
		defer close(ch)

		scanner := bufio.NewScanner(resp.Body)
		for scanner.Scan() {
			line := scanner.Text()
			if line == "" {
				continue
			}

			if strings.HasPrefix(line, "data: ") {
				data := strings.TrimPrefix(line, "data: ")
				if data == "[DONE]" {
					return
				}

				var chunk StreamingChatCompletionChunk
				if err := json.Unmarshal([]byte(data), &chunk); err != nil {
					continue
				}

				select {
				case ch <- &chunk:
				case <-ctx.Done():
					return
				}
			}
		}
	}()

	return ch, nil
}

// CreateCompletion creates a text completion
func (s *LLMService) CreateCompletion(ctx context.Context, req *CompletionRequest) (*CompletionResponse, error) {
	var response CompletionResponse
	err := s.doPost(ctx, "/completions", req, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to create completion: %w", err)
	}
	return &response, nil
}

// CreateEmbedding creates embeddings
func (s *LLMService) CreateEmbedding(ctx context.Context, req *EmbeddingRequest) (*EmbeddingResponse, error) {
	var response EmbeddingResponse
	err := s.doPost(ctx, "/embeddings", req, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to create embeddings: %w", err)
	}
	return &response, nil
}

// CreateModeration creates a moderation check
func (s *LLMService) CreateModeration(ctx context.Context, req *ModerationRequest) (*ModerationResponse, error) {
	var response ModerationResponse
	err := s.doPost(ctx, "/moderations", req, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to create moderation: %w", err)
	}
	return &response, nil
}

// ListModels retrieves available models
func (s *LLMService) ListModels(ctx context.Context) ([]Model, error) {
	var response struct {
		Object string  `json:"object"`
		Data   []Model `json:"data"`
	}

	err := s.doGet(ctx, "/models", &response)
	if err != nil {
		return nil, fmt.Errorf("failed to list models: %w", err)
	}
	return response.Data, nil
}

// GetModel retrieves a specific model
func (s *LLMService) GetModel(ctx context.Context, modelID string) (*Model, error) {
	var model Model
	err := s.doGet(ctx, fmt.Sprintf("/models/%s", modelID), &model)
	if err != nil {
		return nil, fmt.Errorf("failed to get model: %w", err)
	}
	return &model, nil
}

// CreateFineTuningJob creates a fine-tuning job
func (s *LLMService) CreateFineTuningJob(ctx context.Context, req *FineTuningRequest) (*FineTuningJob, error) {
	var job FineTuningJob
	err := s.doPost(ctx, "/fine-tuning/jobs", req, &job)
	if err != nil {
		return nil, fmt.Errorf("failed to create fine-tuning job: %w", err)
	}
	return &job, nil
}

// GetFineTuningJob retrieves a fine-tuning job
func (s *LLMService) GetFineTuningJob(ctx context.Context, jobID string) (*FineTuningJob, error) {
	var job FineTuningJob
	err := s.doGet(ctx, fmt.Sprintf("/fine-tuning/jobs/%s", jobID), &job)
	if err != nil {
		return nil, fmt.Errorf("failed to get fine-tuning job: %w", err)
	}
	return &job, nil
}

// ListFineTuningJobs retrieves fine-tuning jobs
func (s *LLMService) ListFineTuningJobs(ctx context.Context, tenantID string, opts *ListOptions) (*PaginatedResponse[FineTuningJob], error) {
	path := fmt.Sprintf("/tenants/%s/fine-tuning/jobs", tenantID)
	if opts != nil {
		path += s.buildQuery(map[string]interface{}{
			"page":      opts.Page,
			"page_size": opts.PageSize,
			"sort_by":   opts.SortBy,
			"sort_desc": opts.SortDesc,
		})
	}

	var response PaginatedResponse[FineTuningJob]
	err := s.doGet(ctx, path, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to list fine-tuning jobs: %w", err)
	}
	return &response, nil
}

// CancelFineTuningJob cancels a fine-tuning job
func (s *LLMService) CancelFineTuningJob(ctx context.Context, jobID string) (*FineTuningJob, error) {
	var job FineTuningJob
	err := s.doPost(ctx, fmt.Sprintf("/fine-tuning/jobs/%s/cancel", jobID), nil, &job)
	if err != nil {
		return nil, fmt.Errorf("failed to cancel fine-tuning job: %w", err)
	}
	return &job, nil
}

// GetUsage retrieves LLM usage statistics
func (s *LLMService) GetUsage(ctx context.Context, tenantID string, timeRange *TimestampRange) (*LLMUsage, error) {
	path := fmt.Sprintf("/tenants/%s/usage", tenantID)
	if timeRange != nil {
		path += s.buildQuery(map[string]interface{}{
			"from": timeRange.From,
			"to":   timeRange.To,
		})
	}

	var usage LLMUsage
	err := s.doGet(ctx, path, &usage)
	if err != nil {
		return nil, fmt.Errorf("failed to get LLM usage: %w", err)
	}
	return &usage, nil
}

// GetModelMetrics retrieves model performance metrics
func (s *LLMService) GetModelMetrics(ctx context.Context, tenantID string, timeRange *TimestampRange) (*ModelMetrics, error) {
	path := fmt.Sprintf("/tenants/%s/models/metrics", tenantID)
	if timeRange != nil {
		path += s.buildQuery(map[string]interface{}{
			"from": timeRange.From,
			"to":   timeRange.To,
		})
	}

	var metrics ModelMetrics
	err := s.doGet(ctx, path, &metrics)
	if err != nil {
		return nil, fmt.Errorf("failed to get model metrics: %w", err)
	}
	return &metrics, nil
}

// LLMUsage represents LLM usage statistics
type LLMUsage struct {
	TenantID         string       `json:"tenant_id"`
	TotalTokens      int64        `json:"total_tokens"`
	PromptTokens     int64        `json:"prompt_tokens"`
	CompletionTokens int64        `json:"completion_tokens"`
	TotalRequests    int64        `json:"total_requests"`
	ChatCompletions  int64        `json:"chat_completions"`
	TextCompletions  int64        `json:"text_completions"`
	Embeddings       int64        `json:"embeddings"`
	Moderations      int64        `json:"moderations"`
	FineTuningJobs   int64        `json:"fine_tuning_jobs"`
	TopModels        []ModelUsage `json:"top_models"`
	TopUsers         []UserUsage  `json:"top_users"`
	Cost             float64      `json:"cost"`
	TimeRange        TimeRange    `json:"time_range"`
}

// ModelUsage represents usage by model
type ModelUsage struct {
	Model      string        `json:"model"`
	Tokens     int64         `json:"tokens"`
	Requests   int64         `json:"requests"`
	Cost       float64       `json:"cost"`
	AvgLatency time.Duration `json:"avg_latency"`
}

// ModelMetrics represents model performance metrics
type ModelMetrics struct {
	TenantID       string                     `json:"tenant_id"`
	ModelMetrics   map[string]ModelMetricData `json:"model_metrics"`
	OverallLatency time.Duration              `json:"overall_latency"`
	ErrorRate      float64                    `json:"error_rate"`
	SuccessRate    float64                    `json:"success_rate"`
	TimeRange      TimeRange                  `json:"time_range"`
}

// ModelMetricData represents metrics for a specific model
type ModelMetricData struct {
	Model           string        `json:"model"`
	Requests        int64         `json:"requests"`
	AvgLatency      time.Duration `json:"avg_latency"`
	P95Latency      time.Duration `json:"p95_latency"`
	P99Latency      time.Duration `json:"p99_latency"`
	ErrorRate       float64       `json:"error_rate"`
	TokensPerSecond float64       `json:"tokens_per_second"`
	CostPerToken    float64       `json:"cost_per_token"`
}
