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

	"github.com/queryflux/backend/internal/application/ports"
	"github.com/queryflux/backend/internal/domain"

	"go.uber.org/zap"
)

// AIService implements the core AI service operations
type AIService struct {
	repository          ports.AIRepository
	rateLimiter        ports.RateLimiter
	tokenTracker       ports.TokenTracker
	promptManager      ports.PromptTemplateManager
	cacheManager       ports.CacheManager
	healthChecker      ports.AIHealthChecker
	monitoringService  ports.MonitoringService
	auditLogger        ports.AuditLogger
	encryptionService ports.EncryptionService
	logger             *zap.Logger

	// Service clients
	openAIClient  ports.ExternalAIAPIClient
	claudeClient ports.ExternalAIAPIClient

	// Configuration
	config map[domain.AIService]*domain.AIConfig
}

// NewAIService creates a new AI service instance
func NewAIService(
	repository ports.AIRepository,
	rateLimiter ports.RateLimiter,
	tokenTracker ports.TokenTracker,
	promptManager ports.PromptTemplateManager,
	cacheManager ports.CacheManager,
	healthChecker ports.AIHealthChecker,
	monitoringService ports.MonitoringService,
	auditLogger ports.AuditLogger,
	encryptionService ports.EncryptionService,
	logger *zap.Logger,
) *AIService {

	service := &AIService{
		repository:          repository,
		rateLimiter:        rateLimiter,
		tokenTracker:       tokenTracker,
		promptManager:      promptManager,
		cacheManager:       cacheManager,
		healthChecker:      healthChecker,
		monitoringService:  monitoringService,
		auditLogger:        auditLogger,
		encryptionService: encryptionService,
		logger:             logger,
		config:            make(map[domain.AIService]*domain.AIConfig),
	}

	// Initialize service clients
	service.initializeClients()

	// Load AI configurations
	if err := service.loadConfigurations(); err != nil {
		logger.Error("Failed to load AI configurations", zap.Error(err))
	}

	return service
}

// initializeClients initializes the external AI API clients
func (s *AIService) initializeClients() {
	// Initialize OpenAI client
	s.openAIClient = &OpenAIClient{
		baseURL:   "https://api.openai.com/v1",
		timeout:   30 * time.Second,
		userAgent: "QueryFlux/1.0",
	}

	// Initialize Claude client
	s.claudeClient = &ClaudeClient{
		baseURL:   "https://api.anthropic.com",
		timeout:   30 * time.Second,
		userAgent: "QueryFlux/1.0",
	}
}

// loadConfigurations loads AI service configurations from the repository
func (s *AIService) loadConfigurations() error {
	ctx := context.Background()

	configs, err := s.repository.ListAIConfigs(ctx)
	if err != nil {
		return fmt.Errorf("failed to load AI configurations: %w", err)
	}

	for _, config := range configs {
		s.config[config.Service] = config

		// Configure API keys for clients
		if config.Service == domain.AIServiceOpenAI {
			apiKey, err := s.encryptionService.DecryptAPIKey(ctx, config.APIKey)
			if err != nil {
				s.logger.Error("Failed to decrypt OpenAI API key", zap.Error(err))
				continue
			}
			s.openAIClient.SetAPIKey(apiKey)
			s.openAIClient.SetBaseURL(config.BaseURL)
			s.openAIClient.SetTimeout(config.Timeout)
		} else if config.Service == domain.AIServiceClaude {
			apiKey, err := s.encryptionService.DecryptAPIKey(ctx, config.APIKey)
			if err != nil {
				s.logger.Error("Failed to decrypt Claude API key", zap.Error(err))
				continue
			}
			s.claudeClient.SetAPIKey(apiKey)
			s.claudeClient.SetBaseURL(config.BaseURL)
			s.claudeClient.SetTimeout(config.Timeout)
		}
	}

	s.logger.Info("Loaded AI configurations", zap.Int("count", len(configs)))
	return nil
}

// GenerateResponse generates a response from an AI service
func (s *AIService) GenerateResponse(ctx context.Context, request *domain.AIRequest) (*domain.AIResponse, error) {
	startTime := time.Now()

	// Check rate limiting
	allowed, retryAfter := s.rateLimiter.Allow(ctx, request.UserID, request.Service)
	if !allowed {
		return nil, fmt.Errorf("rate limit exceeded, retry after %v", retryAfter)
	}

	// Get AI configuration
	config, ok := s.config[request.Service]
	if !ok || !config.Enabled {
		return nil, fmt.Errorf("AI service %s is not configured or enabled", request.Service)
	}

	// Check cache first
	cacheKey := s.generateCacheKey("ai_response", request.ID, request.Prompt)
	if cached, err := s.cacheManager.Get(ctx, cacheKey); err == nil {
		if response, ok := cached.(*domain.AIResponse); ok {
			s.logger.Debug("Returning cached AI response", zap.String("request_id", request.ID))
			return response, nil
		}
	}

	// Log request
	if err := s.auditLogger.LogRequest(ctx, request); err != nil {
		s.logger.Error("Failed to log AI request", zap.Error(err))
	}

	// Create AI request for the specific service
	aiRequest := s.createAIRequest(request, config)

	// Make request to appropriate AI service
	var response *domain.AIResponse
	var err error

	switch request.Service {
	case domain.AIServiceOpenAI:
		response, err = s.generateOpenAIResponse(ctx, aiRequest)
	case domain.AIServiceClaude:
		response, err = s.generateClaudeResponse(ctx, aiRequest)
	default:
		return nil, fmt.Errorf("unsupported AI service: %s", request.Service)
	}

	if err != nil {
		// Log error
		s.logger.Error("AI request failed",
			zap.String("service", string(request.Service)),
			zap.String("request_id", request.ID),
			zap.Error(err))

		s.monitoringService.RecordError(ctx, request.Service, "generate_response", err.Error())
		s.auditLogger.LogError(ctx, request.ID, err)

		return nil, fmt.Errorf("AI request failed: %w", err)
	}

	// Set response metadata
	response.RequestID = request.ID
	response.Service = request.Service
	response.ProcessedAt = time.Now()
	response.Duration = time.Since(startTime)

	// Cache response
	if err := s.cacheManager.Set(ctx, cacheKey, response, 5*time.Minute); err != nil {
		s.logger.Error("Failed to cache AI response", zap.Error(err))
	}

	// Log response
	if err := s.auditLogger.LogResponse(ctx, response); err != nil {
		s.logger.Error("Failed to log AI response", zap.Error(err))
	}

	// Track token usage
	s.trackTokenUsage(ctx, request.UserID, request.Service, "generate_response", response.TokensUsed, 0.0)

	// Record metrics
	s.monitoringService.RecordRequest(ctx, request.Service, "generate_response", response.Duration, response.TokensUsed, true)

	return response, nil
}

// ConvertNLToSQL converts natural language to SQL
func (s *AIService) ConvertNLToSQL(ctx context.Context, request *domain.NLToSQLRequest) (*domain.NLToSQLResponse, error) {
	startTime := time.Now()

	// Check rate limiting
	allowed, retryAfter := s.rateLimiter.Allow(ctx, request.UserID, domain.AIServiceOpenAI) // Default to OpenAI
	if !allowed {
		return nil, fmt.Errorf("rate limit exceeded, retry after %v", retryAfter)
	}

	// Check cache first
	cacheKey := s.generateCacheKey("nl_to_sql", request.ID, request.NLQuery, string(request.DatabaseType))
	if cached, err := s.cacheManager.Get(ctx, cacheKey); err == nil {
		if response, ok := cached.(*domain.NLToSQLResponse); ok {
			s.logger.Debug("Returning cached NL to SQL response", zap.String("request_id", request.ID))
			return response, nil
		}
	}

	// Load prompt template
	template, err := s.promptManager.LoadTemplate(ctx, domain.AIServiceOpenAI, "nl_to_sql")
	if err != nil {
		s.logger.Error("Failed to load NL to SQL template", zap.Error(err))
		return nil, fmt.Errorf("failed to load prompt template: %w", err)
	}

	// Prepare prompt variables
	schemaJSON, err := json.Marshal(request.Schema)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal schema: %w", err)
	}

	variables := map[string]interface{}{
		"nl_query":       request.NLQuery,
		"schema":         string(schemaJSON),
		"database_type": request.DatabaseType,
		"context":        request.Context,
	}

	// Add examples if provided
	if len(request.Examples) > 0 {
		examplesJSON, err := json.Marshal(request.Examples)
		if err == nil {
			variables["examples"] = string(examplesJSON)
		}
	}

	// Render prompt
	prompt, err := s.promptManager.RenderTemplate(ctx, template, variables)
	if err != nil {
		return nil, fmt.Errorf("failed to render prompt: %w", err)
	}

	// Create AI request
	aiRequest := &domain.AIRequest{
		ID:         request.ID,
		Service:    domain.AIServiceOpenAI, // Default to OpenAI
		Model:      "gpt-4",
		Prompt:     prompt,
		MaxTokens:  1000,
		Temperature: 0.3,
		UserID:     request.UserID,
		CreatedAt:  time.Now(),
	}

	// Generate response
	response, err := s.GenerateResponse(ctx, aiRequest)
	if err != nil {
		return nil, fmt.Errorf("failed to generate AI response: %w", err)
	}

	// Parse AI response into SQL
	sqlQuery, explanation := s.parseNLToSQLResponse(response.Content)

	// Create response
	nlToSQLResponse := &domain.NLToSQLResponse{
		ID:          request.ID,
		RequestID:   request.ID,
		SQLQuery:    sqlQuery,
		Explanation: explanation,
		Confidence:  0.8, // Default confidence
		TokensUsed:  response.TokensUsed,
		CreatedAt:   time.Now(),
	}

	// Cache response
	if err := s.cacheManager.Set(ctx, cacheKey, nlToSQLResponse, 5*time.Minute); err != nil {
		s.logger.Error("Failed to cache NL to SQL response", zap.Error(err))
	}

	// Track token usage
	s.trackTokenUsage(ctx, request.UserID, domain.AIServiceOpenAI, "nl_to_sql", response.TokensUsed, 0.0)

	// Record metrics
	s.monitoringService.RecordRequest(ctx, domain.AIServiceOpenAI, "nl_to_sql", time.Since(startTime), response.TokensUsed, true)

	return nlToSQLResponse, nil
}

// OptimizeQuery optimizes a SQL query using AI
func (s *AIService) OptimizeQuery(ctx context.Context, request *domain.QueryOptimizationRequest) (*domain.QueryOptimizationResponse, error) {
	startTime := time.Now()

	// Check rate limiting
	allowed, retryAfter := s.rateLimiter.Allow(ctx, request.UserID, domain.AIServiceOpenAI)
	if !allowed {
		return nil, fmt.Errorf("rate limit exceeded, retry after %v", retryAfter)
	}

	// Check cache first
	cacheKey := s.generateCacheKey("query_optimization", request.ID, request.SQLQuery)
	if cached, err := s.cacheManager.Get(ctx, cacheKey); err == nil {
		if response, ok := cached.(*domain.QueryOptimizationResponse); ok {
			s.logger.Debug("Returning cached query optimization response", zap.String("request_id", request.ID))
			return response, nil
		}
	}

	// Load prompt template
	template, err := s.promptManager.LoadTemplate(ctx, domain.AIServiceOpenAI, "query_optimization")
	if err != nil {
		s.logger.Error("Failed to load query optimization template", zap.Error(err))
		return nil, fmt.Errorf("failed to load prompt template: %w", err)
	}

	// Prepare prompt variables
	variables := map[string]interface{}{
		"sql_query":         request.SQLQuery,
		"database_type":     request.DatabaseType,
		"performance_metrics": request.PerformanceMetrics,
	}

	// Add execution plan if provided
	if request.ExecutionPlan != nil {
		planJSON, err := json.Marshal(request.ExecutionPlan)
		if err == nil {
			variables["execution_plan"] = string(planJSON)
		}
	}

	// Render prompt
	prompt, err := s.promptManager.RenderTemplate(ctx, template, variables)
	if err != nil {
		return nil, fmt.Errorf("failed to render prompt: %w", err)
	}

	// Create AI request
	aiRequest := &domain.AIRequest{
		ID:         request.ID,
		Service:    domain.AIServiceOpenAI,
		Model:      "gpt-4",
		Prompt:     prompt,
		MaxTokens:  1500,
		Temperature: 0.2,
		UserID:     request.UserID,
		CreatedAt:  time.Now(),
	}

	// Generate response
	response, err := s.GenerateResponse(ctx, aiRequest)
	if err != nil {
		return nil, fmt.Errorf("failed to generate AI response: %w", err)
	}

	// Parse AI response into optimization
	optimizedQuery, improvements := s.parseQueryOptimizationResponse(response.Content)

	// Create response
	optimizationResponse := &domain.QueryOptimizationResponse{
		ID:             request.ID,
		RequestID:      request.ID,
		OptimizedQuery: optimizedQuery,
		Explanation:    "Query optimized based on AI analysis",
		Improvements:   improvements,
		EstimatedGain:  0.25, // Default gain estimation
		Confidence:     0.7,
		TokensUsed:     response.TokensUsed,
		CreatedAt:      time.Now(),
	}

	// Cache response
	if err := s.cacheManager.Set(ctx, cacheKey, optimizationResponse, 5*time.Minute); err != nil {
		s.logger.Error("Failed to cache query optimization response", zap.Error(err))
	}

	// Track token usage
	s.trackTokenUsage(ctx, request.UserID, domain.AIServiceOpenAI, "query_optimization", response.TokensUsed, 0.0)

	// Record metrics
	s.monitoringService.RecordRequest(ctx, domain.AIServiceOpenAI, "query_optimization", time.Since(startTime), response.TokensUsed, true)

	return optimizationResponse, nil
}

// ExplainQuery explains a SQL query using AI
func (s *AIService) ExplainQuery(ctx context.Context, request *domain.QueryExplanationRequest) (*domain.QueryExplanationResponse, error) {
	startTime := time.Now()

	// Check rate limiting
	allowed, retryAfter := s.rateLimiter.Allow(ctx, request.UserID, domain.AIServiceOpenAI)
	if !allowed {
		return nil, fmt.Errorf("rate limit exceeded, retry after %v", retryAfter)
	}

	// Check cache first
	cacheKey := s.generateCacheKey("query_explanation", request.ID, request.SQLQuery)
	if cached, err := s.cacheManager.Get(ctx, cacheKey); err == nil {
		if response, ok := cached.(*domain.QueryExplanationResponse); ok {
			s.logger.Debug("Returning cached query explanation response", zap.String("request_id", request.ID))
			return response, nil
		}
	}

	// Load prompt template
	template, err := s.promptManager.LoadTemplate(ctx, domain.AIServiceOpenAI, "query_explanation")
	if err != nil {
		s.logger.Error("Failed to load query explanation template", zap.Error(err))
		return nil, fmt.Errorf("failed to load prompt template: %w", err)
	}

	// Prepare prompt variables
	variables := map[string]interface{}{
		"sql_query":   request.SQLQuery,
		"complexity":  request.Complexity,
		"audience":    request.Audience,
		"language":    request.Language,
		"database_type": request.DatabaseType,
	}

	// Render prompt
	prompt, err := s.promptManager.RenderTemplate(ctx, template, variables)
	if err != nil {
		return nil, fmt.Errorf("failed to render prompt: %w", err)
	}

	// Create AI request
	aiRequest := &domain.AIRequest{
		ID:         request.ID,
		Service:    domain.AIServiceOpenAI,
		Model:      "gpt-4",
		Prompt:     prompt,
		MaxTokens:  2000,
		Temperature: 0.3,
		UserID:     request.UserID,
		CreatedAt:  time.Now(),
	}

	// Generate response
	response, err := s.GenerateResponse(ctx, aiRequest)
	if err != nil {
		return nil, fmt.Errorf("failed to generate AI response: %w", err)
	}

	// Parse AI response into explanation
	explanation, steps := s.parseQueryExplanationResponse(response.Content)

	// Create response
	explanationResponse := &domain.QueryExplanationResponse{
		ID:          request.ID,
		RequestID:   request.ID,
		Explanation: explanation,
		Steps:       steps,
		Complexity:  request.Complexity,
		TokensUsed:  response.TokensUsed,
		CreatedAt:   time.Now(),
	}

	// Cache response
	if err := s.cacheManager.Set(ctx, cacheKey, explanationResponse, 5*time.Minute); err != nil {
		s.logger.Error("Failed to cache query explanation response", zap.Error(err))
	}

	// Track token usage
	s.trackTokenUsage(ctx, request.UserID, domain.AIServiceOpenAI, "query_explanation", response.TokensUsed, 0.0)

	// Record metrics
	s.monitoringService.RecordRequest(ctx, domain.AIServiceOpenAI, "query_explanation", time.Since(startTime), response.TokensUsed, true)

	return explanationResponse, nil
}

// Helper methods

func (s *AIService) createAIRequest(request *domain.AIRequest, config *domain.AIConfig) *domain.AIRequest {
	// Clone the request to avoid modifying the original
	aiRequest := &domain.AIRequest{
		ID:          request.ID,
		Service:     request.Service,
		Model:       request.Model,
		Prompt:      request.Prompt,
		Messages:    request.Messages,
		Context:     request.Context,
		MaxTokens:   request.MaxTokens,
		Temperature: request.Temperature,
		UserID:      request.UserID,
		CreatedAt:   request.CreatedAt,
	}

	// Apply configuration defaults
	if aiRequest.MaxTokens == 0 {
		aiRequest.MaxTokens = config.MaxTokens
	}
	if aiRequest.Temperature == 0 {
		aiRequest.Temperature = config.Temperature
	}
	if aiRequest.Model == "" {
		aiRequest.Model = config.Model
	}

	return aiRequest
}

func (s *AIService) generateOpenAIResponse(ctx context.Context, request *domain.AIRequest) (*domain.AIResponse, error) {
	payload := map[string]interface{}{
		"model":       request.Model,
		"messages":    []map[string]string{{"role": "user", "content": request.Prompt}},
		"max_tokens":  request.MaxTokens,
		"temperature": request.Temperature,
	}

	response, err := s.openAIClient.MakeRequest(ctx, "/chat/completions", payload, nil)
	if err != nil {
		return nil, err
	}

	// Parse OpenAI response
	data, ok := (*response).(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid response format")
	}

	choices, ok := data["choices"].([]interface{})
	if !ok || len(choices) == 0 {
		return nil, fmt.Errorf("no choices in response")
	}

	choice, ok := choices[0].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid choice format")
	}

	message, ok := choice["message"].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid message format")
	}

	content, ok := message["content"].(string)
	if !ok {
		return nil, fmt.Errorf("invalid content format")
	}

	usage, ok := data["usage"].(map[string]interface{})
	var tokensUsed int
	if ok {
		if totalTokens, ok := usage["total_tokens"].(float64); ok {
			tokensUsed = int(totalTokens)
		}
	}

	return &domain.AIResponse{
		ID:         fmt.Sprintf("openai-%d", time.Now().Unix()),
		Content:    content,
		TokensUsed: tokensUsed,
		Model:      request.Model,
	}, nil
}

func (s *AIService) generateClaudeResponse(ctx context.Context, request *domain.AIRequest) (*domain.AIResponse, error) {
	payload := map[string]interface{}{
		"model":      request.Model,
		"max_tokens": request.MaxTokens,
		"temperature": request.Temperature,
		"messages":   []map[string]string{{"role": "user", "content": request.Prompt}},
	}

	response, err := s.claudeClient.MakeRequest(ctx, "/v1/messages", payload, nil)
	if err != nil {
		return nil, err
	}

	// Parse Claude response
	data, ok := (*response).(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid response format")
	}

	content := []map[string]interface{}{}
	if c, ok := data["content"].([]interface{}); ok {
		for _, item := range c {
			if itemMap, ok := item.(map[string]interface{}); ok {
				if itemMap["type"] == "text" {
					content = append(content, itemMap)
				}
			}
		}
	}

	var responseText string
	if len(content) > 0 {
		if text, ok := content[0]["text"].(string); ok {
			responseText = text
		}
	}

	usage, ok := data["usage"].(map[string]interface{})
	var tokensUsed int
	if ok {
		if inputTokens, ok := usage["input_tokens"].(float64); ok {
			tokensUsed += int(inputTokens)
		}
		if outputTokens, ok := usage["output_tokens"].(float64); ok {
			tokensUsed += int(outputTokens)
		}
	}

	return &domain.AIResponse{
		ID:         fmt.Sprintf("claude-%d", time.Now().Unix()),
		Content:    responseText,
		TokensUsed: tokensUsed,
		Model:      request.Model,
	}, nil
}

func (s *AIService) parseNLToSQLResponse(content string) (string, string) {
	// Simple parsing - in production, this would be more sophisticated
	lines := strings.Split(content, "\n")
	var sqlQuery, explanation string

	for _, line := range lines {
		if strings.HasPrefix(line, "```sql") {
			// Extract SQL from code block
			parts := strings.Split(line, "```sql")
			if len(parts) > 1 {
				sqlQuery = strings.TrimSpace(parts[1])
			}
		} else if strings.HasPrefix(line, "Explanation:") {
			explanation = strings.TrimSpace(strings.TrimPrefix(line, "Explanation:"))
		}
	}

	// If no SQL found, try to extract from JSON
	if sqlQuery == "" {
		if strings.Contains(content, "\"sql\":") {
			// Try to parse JSON
			var result map[string]interface{}
			if err := json.Unmarshal([]byte(content), &result); err == nil {
				if sql, ok := result["sql"].(string); ok {
					sqlQuery = sql
				}
				if expl, ok := result["explanation"].(string); ok {
					explanation = expl
				}
			}
		}
	}

	// Default values
	if sqlQuery == "" {
		sqlQuery = content // Fallback to using the entire content
	}
	if explanation == "" {
		explanation = "Generated SQL query based on natural language input"
	}

	return sqlQuery, explanation
}

func (s *AIService) parseQueryOptimizationResponse(content string) (string, []domain.QueryImprovement) {
	// Simple parsing - in production, this would be more sophisticated
	var optimizedQuery string
	var improvements []domain.QueryImprovement

	lines := strings.Split(content, "\n")
	for _, line := range lines {
		if strings.HasPrefix(line, "```sql") {
			// Extract optimized SQL from code block
			parts := strings.Split(line, "```sql")
			if len(parts) > 1 {
				optimizedQuery = strings.TrimSpace(parts[1])
			}
		} else if strings.Contains(line, "improvement") || strings.Contains(line, "suggestion") {
			// Parse improvement
			improvements = append(improvements, domain.QueryImprovement{
				Type:        "general",
				Description: line,
				Impact:      "medium",
				Change:      "Optimized",
			})
		}
	}

	// Default values
	if optimizedQuery == "" {
		optimizedQuery = content // Fallback
	}

	if len(improvements) == 0 {
		improvements = []domain.QueryImprovement{
			{
				Type:        "general",
				Description: "Query optimized based on AI analysis",
				Impact:      "medium",
				Change:      "Optimized",
			},
		}
	}

	return optimizedQuery, improvements
}

func (s *AIService) parseQueryExplanationResponse(content string) (string, []domain.QueryStep) {
	// Simple parsing - in production, this would be more sophisticated
	var explanation string
	var steps []domain.QueryStep

	lines := strings.Split(content, "\n")
	for i, line := range lines {
		if strings.HasPrefix(line, "Explanation:") {
			explanation = strings.TrimSpace(strings.TrimPrefix(line, "Explanation:"))
		} else if strings.HasPrefix(line, "Step") {
			// Parse step
			steps = append(steps, domain.QueryStep{
				Order:       i + 1,
				Operation:   "Process",
				Description: line,
			})
		}
	}

	// Default values
	if explanation == "" {
		explanation = content // Fallback
	}

	if len(steps) == 0 {
		steps = []domain.QueryStep{
			{
				Order:       1,
				Operation:   "Execute",
				Description: "Execute the SQL query",
			},
		}
	}

	return explanation, steps
}

func (s *AIService) generateCacheKey(parts ...string) string {
	return strings.Join(parts, ":")
}

func (s *AIService) trackTokenUsage(ctx context.Context, userID string, service domain.AIService, operation string, tokensUsed int, cost float64) {
	if tokensUsed > 0 {
		err := s.tokenTracker.TrackUsage(ctx, userID, service, tokensUsed, cost)
		if err != nil {
			s.logger.Error("Failed to track token usage", zap.Error(err))
		}
	}
}

// OpenAIClient implements the ExternalAIAPIClient interface for OpenAI
type OpenAIClient struct {
	baseURL   string
	timeout   time.Duration
	apiKey    string
	userAgent string
}

func (c *OpenAIClient) MakeRequest(ctx context.Context, endpoint string, payload interface{}, headers map[string]string) (*interface{}, error) {
	if c.apiKey == "" {
		return nil, fmt.Errorf("API key is required")
	}

	// Prepare request headers
	reqHeaders := map[string]string{
		"Authorization": "Bearer " + c.apiKey,
		"Content-Type":  "application/json",
		"User-Agent":    c.userAgent,
	}

	// Add custom headers
	for k, v := range headers {
		reqHeaders[k] = v
	}

	// Marshal payload
	jsonData, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal payload: %w", err)
	}

	// Create request
	url := c.baseURL + endpoint
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Add headers
	for k, v := range reqHeaders {
		req.Header.Set(k, v)
	}

	// Make request with timeout
	client := &http.Client{Timeout: c.timeout}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	// Read response
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	// Check status code
	if resp.StatusCode >= 400 {
		var apiErr struct {
			Error struct {
				Message string `json:"message"`
				Type    string `json:"type"`
				Code    string `json:"code"`
			} `json:"error"`
		}
		json.Unmarshal(respBody, &apiErr)
		if apiErr.Error.Message != "" {
			return nil, fmt.Errorf("API error (%d): %s", resp.StatusCode, apiErr.Error.Message)
		}
		return nil, fmt.Errorf("API error (%d): %s", resp.StatusCode, string(respBody))
	}

	// Parse response
	var result interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return &result, nil
}

func (c *OpenAIClient) StreamRequest(ctx context.Context, endpoint string, payload interface{}, headers map[string]string) (<-chan []byte, error) {
	if c.apiKey == "" {
		return nil, fmt.Errorf("API key is required")
	}

	// Prepare request headers
	reqHeaders := map[string]string{
		"Authorization": "Bearer " + c.apiKey,
		"Content-Type":  "application/json",
		"User-Agent":    c.userAgent,
	}

	// Add streaming header
	reqHeaders["Accept"] = "text/event-stream"

	// Add custom headers
	for k, v := range headers {
		reqHeaders[k] = v
	}

	// Marshal payload
	jsonData, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal payload: %w", err)
	}

	// Create request
	url := c.baseURL + endpoint
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Add headers
	for k, v := range reqHeaders {
		req.Header.Set(k, v)
	}

	// Create channel for streaming responses
	ch := make(chan []byte, 100)

	// Start streaming in goroutine
	go func() {
		defer close(ch)

		client := &http.Client{Timeout: c.timeout}
		resp, err := client.Do(req)
		if err != nil {
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode >= 400 {
			return
		}

		// Read stream line by line
		scanner := bufio.NewScanner(resp.Body)
		for scanner.Scan() {
			line := scanner.Text()
			if strings.HasPrefix(line, "data: ") {
				data := strings.TrimPrefix(line, "data: ")
				if data != "[DONE]" {
					ch <- []byte(data)
				} else {
					break
				}
			}
		}
	}()

	return ch, nil
}

func (c *OpenAIClient) SetAPIKey(apiKey string) {
	c.apiKey = apiKey
}

func (c *OpenAIClient) SetBaseURL(baseURL string) {
	c.baseURL = baseURL
}

func (c *OpenAIClient) SetTimeout(timeout time.Duration) {
	c.timeout = timeout
}

func (c *OpenAIClient) ValidateAPIKey(ctx context.Context) error {
	if c.apiKey == "" {
		return fmt.Errorf("API key is required")
	}

	// Make a simple request to validate the API key
	req, err := http.NewRequestWithContext(ctx, "GET", c.baseURL+"/models", nil)
	if err != nil {
		return fmt.Errorf("failed to create validation request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("User-Agent", c.userAgent)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("API key validation request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == 401 {
		return fmt.Errorf("invalid API key")
	} else if resp.StatusCode >= 400 {
		return fmt.Errorf("API key validation failed with status %d", resp.StatusCode)
	}

	return nil
}

func (c *OpenAIClient) ValidateConfiguration() error {
	if c.baseURL == "" {
		return fmt.Errorf("base URL is required")
	}
	if c.apiKey == "" {
		return fmt.Errorf("API key is required")
	}
	if c.timeout <= 0 {
		return fmt.Errorf("timeout must be greater than 0")
	}
	if c.userAgent == "" {
		return fmt.Errorf("user agent is required")
	}
	return nil
}

func (c *OpenAIClient) GetRateLimitInfo(ctx context.Context) (map[string]interface{}, error) {
	// Implementation for OpenAI rate limit info
	return nil, nil
}

func (c *OpenAIClient) ResetRateLimit(ctx context.Context) error {
	// Implementation for OpenAI rate limit reset
	return nil
}

// ClaudeClient implements the ExternalAIAPIClient interface for Claude
type ClaudeClient struct {
	baseURL   string
	timeout   time.Duration
	apiKey    string
	userAgent string
}

func (c *ClaudeClient) MakeRequest(ctx context.Context, endpoint string, payload interface{}, headers map[string]string) (*interface{}, error) {
	if c.apiKey == "" {
		return nil, fmt.Errorf("API key is required")
	}

	// Prepare request headers
	reqHeaders := map[string]string{
		"x-api-key":      c.apiKey,
		"Content-Type":   "application/json",
		"anthropic-version": "2023-06-01",
		"User-Agent":     c.userAgent,
	}

	// Add custom headers
	for k, v := range headers {
		reqHeaders[k] = v
	}

	// Marshal payload
	jsonData, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal payload: %w", err)
	}

	// Create request
	url := c.baseURL + endpoint
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Add headers
	for k, v := range reqHeaders {
		req.Header.Set(k, v)
	}

	// Make request with timeout
	client := &http.Client{Timeout: c.timeout}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	// Read response
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	// Check status code
	if resp.StatusCode >= 400 {
		var apiErr struct {
			Error struct {
				Type    string `json:"type"`
				Message string `json:"message"`
			} `json:"error"`
		}
		json.Unmarshal(respBody, &apiErr)
		if apiErr.Error.Message != "" {
			return nil, fmt.Errorf("API error (%d): %s", resp.StatusCode, apiErr.Error.Message)
		}
		return nil, fmt.Errorf("API error (%d): %s", resp.StatusCode, string(respBody))
	}

	// Parse response
	var result interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return &result, nil
}

func (c *ClaudeClient) StreamRequest(ctx context.Context, endpoint string, payload interface{}, headers map[string]string) (<-chan []byte, error) {
	if c.apiKey == "" {
		return nil, fmt.Errorf("API key is required")
	}

	// Prepare request headers
	reqHeaders := map[string]string{
		"x-api-key":      c.apiKey,
		"Content-Type":   "application/json",
		"anthropic-version": "2023-06-01",
		"User-Agent":     c.userAgent,
	}

	// Add streaming header
	reqHeaders["Accept"] = "text/event-stream"

	// Add custom headers
	for k, v := range headers {
		reqHeaders[k] = v
	}

	// Marshal payload
	jsonData, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal payload: %w", err)
	}

	// Create request
	url := c.baseURL + endpoint
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Add headers
	for k, v := range reqHeaders {
		req.Header.Set(k, v)
	}

	// Create channel for streaming responses
	ch := make(chan []byte, 100)

	// Start streaming in goroutine
	go func() {
		defer close(ch)

		client := &http.Client{Timeout: c.timeout}
		resp, err := client.Do(req)
		if err != nil {
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode >= 400 {
			return
		}

		// Read stream line by line
		scanner := bufio.NewScanner(resp.Body)
		for scanner.Scan() {
			line := scanner.Text()
			if strings.HasPrefix(line, "data: ") {
				data := strings.TrimPrefix(line, "data: ")
				if data != "[DONE]" {
					ch <- []byte(data)
				} else {
					break
				}
			}
		}
	}()

	return ch, nil
}

func (c *ClaudeClient) SetAPIKey(apiKey string) {
	c.apiKey = apiKey
}

func (c *ClaudeClient) SetBaseURL(baseURL string) {
	c.baseURL = baseURL
}

func (c *ClaudeClient) SetTimeout(timeout time.Duration) {
	c.timeout = timeout
}

func (c *ClaudeClient) ValidateAPIKey(ctx context.Context) error {
	if c.apiKey == "" {
		return fmt.Errorf("API key is required")
	}

	// Make a simple request to validate the API key
	payload := map[string]interface{}{
		"model": "claude-3-haiku-20240307",
		"max_tokens": 10,
		"messages": []map[string]string{
			{"role": "user", "content": "Hi"},
		},
	}

	reqHeaders := map[string]string{
		"x-api-key":      c.apiKey,
		"Content-Type":   "application/json",
		"anthropic-version": "2023-06-01",
		"User-Agent":     c.userAgent,
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal validation payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/messages", bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create validation request: %w", err)
	}

	for k, v := range reqHeaders {
		req.Header.Set(k, v)
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("API key validation request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == 401 {
		return fmt.Errorf("invalid API key")
	} else if resp.StatusCode >= 400 {
		return fmt.Errorf("API key validation failed with status %d", resp.StatusCode)
	}

	return nil
}

func (c *ClaudeClient) ValidateConfiguration() error {
	if c.baseURL == "" {
		return fmt.Errorf("base URL is required")
	}
	if c.apiKey == "" {
		return fmt.Errorf("API key is required")
	}
	if c.timeout <= 0 {
		return fmt.Errorf("timeout must be greater than 0")
	}
	if c.userAgent == "" {
		return fmt.Errorf("user agent is required")
	}
	return nil
}

func (c *ClaudeClient) GetRateLimitInfo(ctx context.Context) (map[string]interface{}, error) {
	// Implementation for Claude rate limit info
	return nil, nil
}

func (c *ClaudeClient) ResetRateLimit(ctx context.Context) error {
	// Implementation for Claude rate limit reset
	return nil
}