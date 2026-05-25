package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// AIClient handles communication with the AI/ML service
type AIClient struct {
	baseURL    string
	httpClient *http.Client
	timeout    time.Duration
}

// NewAIClient creates a new AI service client
func NewAIClient(baseURL string) *AIClient {
	return &AIClient{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		timeout: 30 * time.Second,
	}
}

// TransactionAnalysisRequest represents a request for transaction text analysis
type TransactionAnalysisRequest struct {
	Text      string  `json:"text"`
	ModelName *string `json:"model_name,omitempty"`
}

// TransactionAnalysisResponse represents the response from text analysis
type TransactionAnalysisResponse struct {
	Text           string  `json:"text"`
	Sentiment      string  `json:"sentiment"`
	Confidence     float64 `json:"confidence"`
	ModelUsed      string  `json:"model_used"`
	ProcessingTime float64 `json:"processing_time"`
}

// FraudAnalysisRequest represents a request for fraud pattern analysis
type FraudAnalysisRequest struct {
	TransactionData map[string]interface{} `json:"transaction_data"`
	UseConsensus    bool                   `json:"use_consensus"`
	PreferLocal     bool                   `json:"prefer_local"`
}

// FraudAnalysisResponse represents the response from fraud analysis
type FraudAnalysisResponse struct {
	RiskLevel      string  `json:"risk_level"`
	Confidence     float64 `json:"confidence"`
	Explanation    string  `json:"explanation,omitempty"`
	Analysis       string  `json:"analysis,omitempty"`
	Provider       string  `json:"provider"`
	ProcessingTime float64 `json:"processing_time"`
	Cost           float64 `json:"cost,omitempty"`
	Consensus      bool    `json:"consensus,omitempty"`
	ProviderCount  int     `json:"provider_count,omitempty"`
}

// EmbeddingRequest represents a request for text embeddings
type EmbeddingRequest struct {
	Texts     []string `json:"texts"`
	ModelName *string  `json:"model_name,omitempty"`
}

// EmbeddingResponse represents the response from embedding generation
type EmbeddingResponse struct {
	Embeddings [][]float64 `json:"embeddings"`
	Shape      []int       `json:"shape"`
	ModelUsed  string      `json:"model_used"`
}

// AnomalyDetectionRequest represents a request for anomaly detection
type AnomalyDetectionRequest struct {
	Features  []float64 `json:"features"`
	Threshold float64   `json:"threshold"`
}

// AnomalyDetectionResponse represents the response from anomaly detection
type AnomalyDetectionResponse struct {
	AnomalyDetected      bool      `json:"anomaly_detected"`
	AnomalyScores        []int     `json:"anomaly_scores"`
	AnomalyProbabilities []float64 `json:"anomaly_probabilities"`
	Threshold            float64   `json:"threshold"`
	FeatureCount         int       `json:"feature_count"`
}

// TextGenerationRequest represents a request for text generation
type TextGenerationRequest struct {
	Prompt      string  `json:"prompt"`
	MaxTokens   int     `json:"max_tokens"`
	Temperature float64 `json:"temperature"`
	Provider    *string `json:"provider,omitempty"`
}

// TextGenerationResponse represents the response from text generation
type TextGenerationResponse struct {
	Text         string  `json:"text"`
	Provider     string  `json:"provider"`
	Model        string  `json:"model"`
	TokensUsed   int     `json:"tokens_used,omitempty"`
	Cost         float64 `json:"cost"`
	ResponseTime float64 `json:"response_time"`
}

// APIResponse represents the standard API response wrapper
type APIResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data"`
	Error   string      `json:"error,omitempty"`
}

// AnalyzeTransactionText analyzes transaction text for fraud indicators
func (c *AIClient) AnalyzeTransactionText(ctx context.Context, req *TransactionAnalysisRequest) (*TransactionAnalysisResponse, error) {
	var response TransactionAnalysisResponse
	err := c.makeRequest(ctx, "POST", "/api/v1/analyze/text", req, &response)
	return &response, err
}

// AnalyzeFraudPatterns analyzes transaction data for fraud patterns
func (c *AIClient) AnalyzeFraudPatterns(ctx context.Context, req *FraudAnalysisRequest) (*FraudAnalysisResponse, error) {
	var response FraudAnalysisResponse
	err := c.makeRequest(ctx, "POST", "/api/v1/analyze/fraud", req, &response)
	return &response, err
}

// GenerateEmbeddings generates embeddings for text data
func (c *AIClient) GenerateEmbeddings(ctx context.Context, req *EmbeddingRequest) (*EmbeddingResponse, error) {
	var response EmbeddingResponse
	err := c.makeRequest(ctx, "POST", "/api/v1/embeddings", req, &response)
	return &response, err
}

// DetectAnomalies detects anomalies in feature data
func (c *AIClient) DetectAnomalies(ctx context.Context, req *AnomalyDetectionRequest) (*AnomalyDetectionResponse, error) {
	var response AnomalyDetectionResponse
	err := c.makeRequest(ctx, "POST", "/api/v1/anomaly/detect", req, &response)
	return &response, err
}

// GenerateText generates text using LLM providers
func (c *AIClient) GenerateText(ctx context.Context, req *TextGenerationRequest) (*TextGenerationResponse, error) {
	var response TextGenerationResponse
	err := c.makeRequest(ctx, "POST", "/api/v1/generate/text", req, &response)
	return &response, err
}

// GetModelStats retrieves statistics about loaded models
func (c *AIClient) GetModelStats(ctx context.Context) (map[string]interface{}, error) {
	var response map[string]interface{}
	err := c.makeRequest(ctx, "GET", "/api/v1/models/stats", nil, &response)
	return response, err
}

// GetProviderStats retrieves statistics about LLM providers
func (c *AIClient) GetProviderStats(ctx context.Context) (map[string]interface{}, error) {
	var response map[string]interface{}
	err := c.makeRequest(ctx, "GET", "/api/v1/providers/stats", nil, &response)
	return response, err
}

// LoadModel loads a specific model
func (c *AIClient) LoadModel(ctx context.Context, modelName string, task *string) error {
	url := fmt.Sprintf("/api/v1/models/load?model_name=%s", modelName)
	if task != nil {
		url += fmt.Sprintf("&task=%s", *task)
	}

	var response map[string]interface{}
	return c.makeRequest(ctx, "POST", url, nil, &response)
}

// InitializeProviders initializes LLM providers
func (c *AIClient) InitializeProviders(ctx context.Context) error {
	var response map[string]interface{}
	return c.makeRequest(ctx, "POST", "/api/v1/providers/initialize", nil, &response)
}

// GetCostAnalytics retrieves detailed cost analytics
func (c *AIClient) GetCostAnalytics(ctx context.Context) (map[string]interface{}, error) {
	var response map[string]interface{}
	err := c.makeRequest(ctx, "GET", "/api/v1/cost/analytics", nil, &response)
	return response, err
}

// GetCostOptimization retrieves cost optimization recommendations
func (c *AIClient) GetCostOptimization(ctx context.Context) (map[string]interface{}, error) {
	var response map[string]interface{}
	err := c.makeRequest(ctx, "GET", "/api/v1/cost/optimization", nil, &response)
	return response, err
}

// SetCostLimits sets cost limits for a provider
func (c *AIClient) SetCostLimits(ctx context.Context, provider string, dailyLimit, monthlyLimit float64) error {
	url := fmt.Sprintf("/api/v1/cost/limits?provider=%s&daily_limit=%f&monthly_limit=%f",
		provider, dailyLimit, monthlyLimit)
	var response map[string]interface{}
	return c.makeRequest(ctx, "POST", url, nil, &response)
}

// GetProviderStatus retrieves detailed status for a specific provider
func (c *AIClient) GetProviderStatus(ctx context.Context, providerName string) (map[string]interface{}, error) {
	var response map[string]interface{}
	url := fmt.Sprintf("/api/v1/providers/%s/status", providerName)
	err := c.makeRequest(ctx, "GET", url, nil, &response)
	return response, err
}

// FraudExplanationRequest represents a request for fraud explanation
type FraudExplanationRequest struct {
	TransactionData        map[string]interface{}   `json:"transaction_data"`
	FraudScore             float64                  `json:"fraud_score"`
	RiskLevel              string                   `json:"risk_level"`
	Confidence             float64                  `json:"confidence"`
	Indicators             []map[string]interface{} `json:"indicators"`
	AIAnalysis             map[string]interface{}   `json:"ai_analysis,omitempty"`
	TextAnalysis           map[string]interface{}   `json:"text_analysis,omitempty"`
	AnomalyDetection       map[string]interface{}   `json:"anomaly_detection,omitempty"`
	Style                  string                   `json:"style"`
	IncludeRecommendations bool                     `json:"include_recommendations"`
}

// FraudExplanationResponse represents the response from fraud explanation
type FraudExplanationResponse struct {
	Summary             string                   `json:"summary"`
	AIInsights          string                   `json:"ai_insights"`
	PatternAnalysis     map[string]interface{}   `json:"pattern_analysis"`
	ConfidenceBreakdown map[string]interface{}   `json:"confidence_breakdown"`
	RiskFactors         []map[string]interface{} `json:"risk_factors"`
	Recommendations     []map[string]interface{} `json:"recommendations"`
	Style               string                   `json:"style"`
	ConfidenceLevel     string                   `json:"confidence_level"`
	ProcessingTime      float64                  `json:"processing_time"`
	Fallback            bool                     `json:"fallback,omitempty"`
}

// ExplainFraudDecision generates comprehensive fraud explanation
func (c *AIClient) ExplainFraudDecision(ctx context.Context, req *FraudExplanationRequest) (*FraudExplanationResponse, error) {
	var response FraudExplanationResponse
	err := c.makeRequest(ctx, "POST", "/api/v1/explain/fraud", req, &response)
	return &response, err
}

// GetFraudPatterns retrieves available fraud patterns
func (c *AIClient) GetFraudPatterns(ctx context.Context) (map[string]interface{}, error) {
	var response map[string]interface{}
	err := c.makeRequest(ctx, "GET", "/api/v1/explain/patterns", nil, &response)
	return response, err
}

// GetExplanationStyles retrieves available explanation styles
func (c *AIClient) GetExplanationStyles(ctx context.Context) (map[string]interface{}, error) {
	var response map[string]interface{}
	err := c.makeRequest(ctx, "GET", "/api/v1/explain/styles", nil, &response)
	return response, err
}

// HealthCheck checks if the AI service is healthy
func (c *AIClient) HealthCheck(ctx context.Context) (map[string]interface{}, error) {
	var response map[string]interface{}
	err := c.makeRequest(ctx, "GET", "/health", nil, &response)
	return response, err
}

// makeRequest makes an HTTP request to the AI service
func (c *AIClient) makeRequest(ctx context.Context, method, endpoint string, reqBody interface{}, respBody interface{}) error {
	url := c.baseURL + endpoint

	var body io.Reader
	if reqBody != nil {
		jsonData, err := json.Marshal(reqBody)
		if err != nil {
			return fmt.Errorf("failed to marshal request: %w", err)
		}
		body = bytes.NewBuffer(jsonData)
	}

	req, err := http.NewRequestWithContext(ctx, method, url, body)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	if reqBody != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	respData, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode >= 400 {
		var apiResp APIResponse
		if err := json.Unmarshal(respData, &apiResp); err == nil && apiResp.Error != "" {
			return fmt.Errorf("API error: %s", apiResp.Error)
		}
		return fmt.Errorf("HTTP error %d: %s", resp.StatusCode, string(respData))
	}

	// Parse the API response wrapper
	var apiResp APIResponse
	if err := json.Unmarshal(respData, &apiResp); err != nil {
		return fmt.Errorf("failed to parse API response: %w", err)
	}

	if !apiResp.Success {
		return fmt.Errorf("API request failed: %s", apiResp.Error)
	}

	// Marshal and unmarshal to convert the data to the expected type
	dataBytes, err := json.Marshal(apiResp.Data)
	if err != nil {
		return fmt.Errorf("failed to marshal response data: %w", err)
	}

	if err := json.Unmarshal(dataBytes, respBody); err != nil {
		return fmt.Errorf("failed to unmarshal response data: %w", err)
	}

	return nil
}
