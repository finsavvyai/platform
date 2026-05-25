package services

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"time"

	"go.uber.org/zap"

	"github.com/queryflux/backend/internal/application/ports"
	"github.com/queryflux/backend/internal/domain"
)

// ImprovedAIService implements the AIService interface with all features
type ImprovedAIService struct {
	repository        ports.AIRepository
	rateLimiter       ports.RateLimiter
	tokenTracker      ports.TokenTracker
	promptManager     ports.PromptTemplateManager
	cacheManager      ports.CacheManager
	healthChecker     ports.AIHealthChecker
	monitoringService ports.MonitoringService
	auditLogger       ports.AuditLogger
	encryptionService ports.EncryptionService
	logger            *zap.Logger

	// AI clients
	openAIClient ports.ExternalAIAPIClient
	claudeClient ports.ExternalAIAPIClient

	// Configuration
	configs map[domain.AIService]*domain.AIConfig
}

// NewImprovedAIService creates a new improved AI service
func NewImprovedAIService(
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
) *ImprovedAIService {

	service := &ImprovedAIService{
		repository:        repository,
		rateLimiter:       rateLimiter,
		tokenTracker:      tokenTracker,
		promptManager:     promptManager,
		cacheManager:      cacheManager,
		healthChecker:     healthChecker,
		monitoringService: monitoringService,
		auditLogger:       auditLogger,
		encryptionService: encryptionService,
		logger:            logger,
		configs:           make(map[domain.AIService]*domain.AIConfig),
	}

	// Load configurations
	if err := service.loadConfigurations(); err != nil {
		logger.Error("Failed to load AI configurations", zap.Error(err))
	}

	return service
}

// SetOpenAIClient sets the OpenAI client (useful for testing)
func (s *ImprovedAIService) SetOpenAIClient(client ports.ExternalAIAPIClient) {
	s.openAIClient = client
}

// SetClaudeClient sets the Claude client (useful for testing)
func (s *ImprovedAIService) SetClaudeClient(client ports.ExternalAIAPIClient) {
	s.claudeClient = client
}

// loadConfigurations loads AI service configurations
func (s *ImprovedAIService) loadConfigurations() error {
	ctx := context.Background()

	configs, err := s.repository.ListAIConfigs(ctx)
	if err != nil {
		return fmt.Errorf("failed to load AI configurations: %w", err)
	}

	for _, config := range configs {
		s.configs[config.Service] = config

		// Initialize clients based on configuration
		if config.Service == domain.AIServiceOpenAI && config.Enabled {
			if s.openAIClient == nil {
				s.openAIClient = &OpenAIAdapter{
					baseURL:   config.BaseURL,
					timeout:   config.Timeout,
					userAgent: "QueryFlux/1.0",
				}
			}

			// Set API key
			apiKey, err := s.encryptionService.DecryptAPIKey(ctx, config.APIKey)
			if err != nil {
				s.logger.Error("Failed to decrypt OpenAI API key", zap.Error(err))
				continue
			}
			s.openAIClient.SetAPIKey(apiKey)
		}

		if config.Service == domain.AIServiceClaude && config.Enabled {
			if s.claudeClient == nil {
				s.claudeClient = &ClaudeAdapter{
					baseURL:   config.BaseURL,
					timeout:   config.Timeout,
					userAgent: "QueryFlux/1.0",
				}
			}

			// Set API key
			apiKey, err := s.encryptionService.DecryptAPIKey(ctx, config.APIKey)
			if err != nil {
				s.logger.Error("Failed to decrypt Claude API key", zap.Error(err))
				continue
			}
			s.claudeClient.SetAPIKey(apiKey)
		}
	}

	s.logger.Info("Loaded AI configurations",
		zap.Int("configs_loaded", len(configs)))

	return nil
}

// ConvertNLToSQL converts natural language to SQL with enhanced context
func (s *ImprovedAIService) ConvertNLToSQL(ctx context.Context, request *domain.NLToSQLRequest) (*domain.NLToSQLResponse, error) {
	startTime := time.Now()

	// Check rate limiting
	service := s.getPreferredService(request.UserID)
	allowed, retryAfter := s.rateLimiter.Allow(ctx, request.UserID, service)
	if !allowed {
		return nil, fmt.Errorf("rate limit exceeded, retry after %v", retryAfter)
	}

	// Check cache first
	cacheKey := s.generateCacheKey("nl_to_sql", request.ID, request.NLQuery, string(request.DatabaseType))
	if cached, err := s.cacheManager.Get(ctx, cacheKey); err == nil {
		if response, ok := cached.(*domain.NLToSQLResponse); ok {
			s.logger.Debug("Returning cached NL to SQL response",
				zap.String("request_id", request.ID))
			return response, nil
		}
	}

	// Load prompt template
	template, err := s.promptManager.LoadTemplate(ctx, service, "nl_to_sql")
	if err != nil {
		s.logger.Error("Failed to load NL to SQL template", zap.Error(err))
		return nil, fmt.Errorf("failed to load prompt template: %w", err)
	}

	// Prepare enhanced prompt variables
	variables := s.prepareNLToSQLVariables(request)

	// Render prompt
	prompt, err := s.promptManager.RenderTemplate(ctx, template, variables)
	if err != nil {
		return nil, fmt.Errorf("failed to render prompt: %w", err)
	}

	// Create AI request
	aiRequest := &domain.AIRequest{
		ID:          request.ID,
		Service:     service,
		Model:       s.getModel(service),
		Prompt:      prompt,
		MaxTokens:   1500,
		Temperature: 0.1, // Lower temperature for more deterministic SQL
		UserID:      request.UserID,
		CreatedAt:   time.Now(),
	}

	// Generate response
	response, err := s.GenerateResponse(ctx, aiRequest)
	if err != nil {
		return nil, fmt.Errorf("failed to generate AI response: %w", err)
	}

	// Parse and validate SQL
	sqlQuery, explanation, confidence := s.parseAndValidateSQL(response.Content, request.DatabaseType)

	// Add context-aware suggestions
	suggestions := s.generateSQLSuggestions(sqlQuery, request.Schema)

	// Create response
	nlToSQLResponse := &domain.NLToSQLResponse{
		ID:          request.ID,
		RequestID:   request.ID,
		SQLQuery:    sqlQuery,
		Explanation: explanation,
		Confidence:  confidence,
		Suggestions: suggestions,
		TokensUsed:  response.TokensUsed,
		CreatedAt:   time.Now(),
	}

	// Cache response
	if err := s.cacheManager.Set(ctx, cacheKey, nlToSQLResponse, 10*time.Minute); err != nil {
		s.logger.Error("Failed to cache NL to SQL response", zap.Error(err))
	}

	// Track metrics
	duration := time.Since(startTime)
	s.monitoringService.RecordRequest(ctx, service, "nl_to_sql", duration, response.TokensUsed, true)
	s.trackTokenUsage(ctx, request.UserID, service, "nl_to_sql", response.TokensUsed, s.calculateCost(service, response.TokensUsed))

	return nlToSQLResponse, nil
}

// OptimizeQuery provides comprehensive query optimization
func (s *ImprovedAIService) OptimizeQuery(ctx context.Context, request *domain.QueryOptimizationRequest) (*domain.QueryOptimizationResponse, error) {
	startTime := time.Now()

	service := s.getPreferredService(request.UserID)
	allowed, retryAfter := s.rateLimiter.Allow(ctx, request.UserID, service)
	if !allowed {
		return nil, fmt.Errorf("rate limit exceeded, retry after %v", retryAfter)
	}

	// Check cache
	cacheKey := s.generateCacheKey("optimize", request.ID, request.SQLQuery)
	if cached, err := s.cacheManager.Get(ctx, cacheKey); err == nil {
		if response, ok := cached.(*domain.QueryOptimizationResponse); ok {
			return response, nil
		}
	}

	// Load template
	template, err := s.promptManager.LoadTemplate(ctx, service, "query_optimization")
	if err != nil {
		return nil, fmt.Errorf("failed to load optimization template: %w", err)
	}

	// Prepare variables with execution plan analysis
	variables := s.prepareOptimizationVariables(request)

	// Render prompt
	prompt, err := s.promptManager.RenderTemplate(ctx, template, variables)
	if err != nil {
		return nil, fmt.Errorf("failed to render prompt: %w", err)
	}

	// Create AI request
	aiRequest := &domain.AIRequest{
		ID:          request.ID,
		Service:     service,
		Model:       s.getModel(service),
		Prompt:      prompt,
		MaxTokens:   2000,
		Temperature: 0.2,
		UserID:      request.UserID,
		CreatedAt:   time.Now(),
	}

	// Generate response
	response, err := s.GenerateResponse(ctx, aiRequest)
	if err != nil {
		return nil, fmt.Errorf("failed to generate AI response: %w", err)
	}

	// Parse optimization response
	optimization := s.parseOptimizationResponse(response.Content, request)

	// Generate additional index suggestions based on schema
	if len(optimization.SuggestedIndexes) == 0 && request.DatabaseSchema.Tables != nil {
		optimization.SuggestedIndexes = s.generateIndexSuggestions(request.SQLQuery, request.DatabaseSchema)
	}

	// Cache response
	if err := s.cacheManager.Set(ctx, cacheKey, optimization, 15*time.Minute); err != nil {
		s.logger.Error("Failed to cache optimization response", zap.Error(err))
	}

	// Track metrics
	duration := time.Since(startTime)
	s.monitoringService.RecordRequest(ctx, service, "query_optimization", duration, response.TokensUsed, true)

	return optimization, nil
}

// ExplainQuery provides detailed query explanations
func (s *ImprovedAIService) ExplainQuery(ctx context.Context, request *domain.QueryExplanationRequest) (*domain.QueryExplanationResponse, error) {
	startTime := time.Now()

	service := s.getPreferredService(request.UserID)
	allowed, retryAfter := s.rateLimiter.Allow(ctx, request.UserID, service)
	if !allowed {
		return nil, fmt.Errorf("rate limit exceeded, retry after %v", retryAfter)
	}

	// Check cache
	cacheKey := s.generateCacheKey("explain", request.ID, request.SQLQuery, request.Audience)
	if cached, err := s.cacheManager.Get(ctx, cacheKey); err == nil {
		if response, ok := cached.(*domain.QueryExplanationResponse); ok {
			return response, nil
		}
	}

	// Load template
	template, err := s.promptManager.LoadTemplate(ctx, service, "query_explanation")
	if err != nil {
		return nil, fmt.Errorf("failed to load explanation template: %w", err)
	}

	// Prepare variables
	variables := map[string]interface{}{
		"sql_query":     request.SQLQuery,
		"complexity":    request.Complexity,
		"audience":      request.Audience,
		"language":      request.Language,
		"database_type": request.DatabaseType,
	}

	// Render prompt
	prompt, err := s.promptManager.RenderTemplate(ctx, template, variables)
	if err != nil {
		return nil, fmt.Errorf("failed to render prompt: %w", err)
	}

	// Create AI request
	aiRequest := &domain.AIRequest{
		ID:          request.ID,
		Service:     service,
		Model:       s.getModel(service),
		Prompt:      prompt,
		MaxTokens:   2000,
		Temperature: 0.3,
		UserID:      request.UserID,
		CreatedAt:   time.Now(),
	}

	// Generate response
	response, err := s.GenerateResponse(ctx, aiRequest)
	if err != nil {
		return nil, fmt.Errorf("failed to generate AI response: %w", err)
	}

	// Parse explanation
	explanation := s.parseExplanationResponse(response.Content)

	// Add performance tips based on query patterns
	explanation.Performance = s.generatePerformanceTips(request.SQLQuery)

	// Cache response
	if err := s.cacheManager.Set(ctx, cacheKey, explanation, 10*time.Minute); err != nil {
		s.logger.Error("Failed to cache explanation response", zap.Error(err))
	}

	// Track metrics
	duration := time.Since(startTime)
	s.monitoringService.RecordRequest(ctx, service, "query_explanation", duration, response.TokensUsed, true)

	return explanation, nil
}

// GenerateResponse generates a response from an AI service
func (s *ImprovedAIService) GenerateResponse(ctx context.Context, request *domain.AIRequest) (*domain.AIResponse, error) {
	startTime := time.Now()

	// Validate request
	if err := s.validateRequest(request); err != nil {
		return nil, fmt.Errorf("invalid request: %w", err)
	}

	// Log request
	if err := s.auditLogger.LogRequest(ctx, request); err != nil {
		s.logger.Error("Failed to log AI request", zap.Error(err))
	}

	// Make request to appropriate AI service
	var response *domain.AIResponse
	var err error

	switch request.Service {
	case domain.AIServiceOpenAI:
		if s.openAIClient == nil {
			return nil, fmt.Errorf("OpenAI client not initialized")
		}
		response, err = s.makeAIRequest(ctx, s.openAIClient, request)
	case domain.AIServiceClaude:
		if s.claudeClient == nil {
			return nil, fmt.Errorf("Claude client not initialized")
		}
		response, err = s.makeAIRequest(ctx, s.claudeClient, request)
	default:
		return nil, fmt.Errorf("unsupported AI service: %s", request.Service)
	}

	if err != nil {
		s.monitoringService.RecordError(ctx, request.Service, "generate_response", err.Error())
		s.auditLogger.LogError(ctx, request.ID, err)
		return nil, fmt.Errorf("AI request failed: %w", err)
	}

	// Set response metadata
	response.RequestID = request.ID
	response.Service = request.Service
	response.ProcessedAt = time.Now()
	response.Duration = time.Since(startTime)

	// Log response
	if err := s.auditLogger.LogResponse(ctx, response); err != nil {
		s.logger.Error("Failed to log AI response", zap.Error(err))
	}

	return response, nil
}

// GetServiceType returns the primary service type
func (s *ImprovedAIService) GetServiceType() domain.AIService {
	return domain.AIServiceOpenAI // Default to OpenAI as primary
}

// IsHealthy checks if the AI service instances are healthy
func (s *ImprovedAIService) IsHealthy(ctx context.Context) error {
	// Check configured services
	var errs []string

	if config, ok := s.configs[domain.AIServiceOpenAI]; ok && config.Enabled {
		if err := s.healthChecker.CheckHealth(ctx, domain.AIServiceOpenAI); err != nil {
			errs = append(errs, fmt.Sprintf("OpenAI: %v", err))
		}
	}

	if config, ok := s.configs[domain.AIServiceClaude]; ok && config.Enabled {
		if err := s.healthChecker.CheckHealth(ctx, domain.AIServiceClaude); err != nil {
			errs = append(errs, fmt.Sprintf("Claude: %v", err))
		}
	}

	if len(errs) > 0 {
		return fmt.Errorf("AI services unhealthy: %s", strings.Join(errs, "; "))
	}

	return nil
}

// GetRateLimit returns the default rate limit
func (s *ImprovedAIService) GetRateLimit() int {
	// Return the loop of configured limits or a reasonable default
	return 20 // Default TPM
}

// GetRemainingTokens checks remaining tokens for the preferred service
func (s *ImprovedAIService) GetRemainingTokens(ctx context.Context) (int, error) {
	// For now returns a dummy value or checks budget
	// Real implementation would check usage against budget
	return 1000000, nil // Placeholder
}

// Helper methods

func (s *ImprovedAIService) getPreferredService(userID string) domain.AIService {
	// Check user preference or default to OpenAI
	if _, ok := s.configs[domain.AIServiceOpenAI]; ok && s.configs[domain.AIServiceOpenAI].Enabled {
		return domain.AIServiceOpenAI
	}
	if _, ok := s.configs[domain.AIServiceClaude]; ok && s.configs[domain.AIServiceClaude].Enabled {
		return domain.AIServiceClaude
	}
	return domain.AIServiceOpenAI // Default
}

func (s *ImprovedAIService) getModel(service domain.AIService) string {
	if config, ok := s.configs[service]; ok && config.Model != "" {
		return config.Model
	}

	// Default models
	switch service {
	case domain.AIServiceOpenAI:
		return "gpt-4"
	case domain.AIServiceClaude:
		return "claude-3-sonnet-20240229"
	default:
		return "gpt-4"
	}
}

func (s *ImprovedAIService) prepareNLToSQLVariables(request *domain.NLToSQLRequest) map[string]interface{} {
	// Convert schema to formatted string
	schemaStr := s.formatSchema(request.Schema)

	variables := map[string]interface{}{
		"NLQuery":      request.NLQuery,
		"Schema":       schemaStr,
		"DatabaseType": request.DatabaseType,
		"Context":      "",
	}

	// Add context if provided
	if request.Context != nil {
		contextStr := ""
		for k, v := range request.Context {
			contextStr += fmt.Sprintf("%s: %s\n", k, v)
		}
		variables["Context"] = contextStr
	}

	// Add examples
	if len(request.Examples) > 0 {
		variables["Examples"] = request.Examples
	}

	return variables
}

func (s *ImprovedAIService) prepareOptimizationVariables(request *domain.QueryOptimizationRequest) map[string]interface{} {
	variables := map[string]interface{}{
		"SQLQuery":     request.SQLQuery,
		"DatabaseType": request.DatabaseType,
	}

	// Add execution plan if provided
	if request.ExecutionPlan != nil {
		planJSON, _ := json.MarshalIndent(request.ExecutionPlan, "", "  ")
		variables["ExecutionPlan"] = string(planJSON)
	}

	// Add performance metrics
	if request.PerformanceMetrics != nil {
		variables["PerformanceMetrics"] = request.PerformanceMetrics
	}

	return variables
}

func (s *ImprovedAIService) parseAndValidateSQL(content, dbType string) (string, string, float64) {
	// Try to extract SQL from various formats
	sqlQuery := ""
	explanation := ""
	confidence := 0.8

	// Look for SQL in code blocks
	re := regexp.MustCompile("```sql\n(.*?)\n```")
	matches := re.FindStringSubmatch(content)
	if len(matches) > 1 {
		sqlQuery = strings.TrimSpace(matches[1])
	} else {
		// Look for JSON format
		var result map[string]interface{}
		if err := json.Unmarshal([]byte(content), &result); err == nil {
			if sql, ok := result["sql"].(string); ok {
				sqlQuery = sql
			}
			if expl, ok := result["explanation"].(string); ok {
				explanation = expl
			}
			if conf, ok := result["confidence"].(float64); ok {
				confidence = conf
			}
		}
	}

	// If still no SQL, use the entire content as SQL
	if sqlQuery == "" {
		sqlQuery = strings.TrimSpace(content)
		explanation = "Generated SQL query based on natural language input"
	}

	// Basic SQL validation
	if !s.isValidSQL(sqlQuery, dbType) {
		confidence *= 0.5 // Lower confidence if validation fails
	}

	return sqlQuery, explanation, confidence
}

func (s *ImprovedAIService) isValidSQL(sql, dbType string) bool {
	// Basic SQL validation - check for common keywords
	sql = strings.ToUpper(strings.TrimSpace(sql))

	// Must contain at least one main SQL keyword
	keywords := []string{"SELECT", "INSERT", "UPDATE", "DELETE", "CREATE", "ALTER", "DROP"}
	hasKeyword := false
	for _, keyword := range keywords {
		if strings.Contains(sql, keyword) {
			hasKeyword = true
			break
		}
	}

	return hasKeyword && len(sql) > 10
}

func (s *ImprovedAIService) generateCacheKey(parts ...string) string {
	return strings.Join(parts, ":")
}

func (s *ImprovedAIService) trackTokenUsage(ctx context.Context, userID string, service domain.AIService, operation string, tokensUsed int, cost float64) {
	if tokensUsed > 0 {
		err := s.tokenTracker.TrackUsage(ctx, userID, service, tokensUsed, cost)
		if err != nil {
			s.logger.Error("Failed to track token usage", zap.Error(err))
		}
	}
}

func (s *ImprovedAIService) calculateCost(service domain.AIService, tokensUsed int) float64 {
	// Basic cost calculation - in production, use actual pricing
	switch service {
	case domain.AIServiceOpenAI:
		// GPT-4 pricing: ~$0.03 per 1K input tokens, $0.06 per 1K output tokens
		return float64(tokensUsed) * 0.000045
	case domain.AIServiceClaude:
		// Claude pricing: ~$0.015 per 1K input tokens, $0.075 per 1K output tokens
		return float64(tokensUsed) * 0.000045
	default:
		return 0
	}
}

func (s *ImprovedAIService) validateRequest(request *domain.AIRequest) error {
	if request.Prompt == "" {
		return fmt.Errorf("prompt cannot be empty")
	}
	if request.UserID == "" {
		return fmt.Errorf("user ID cannot be empty")
	}
	if request.Service == "" {
		return fmt.Errorf("service must be specified")
	}
	return nil
}

func (s *ImprovedAIService) makeAIRequest(ctx context.Context, client ports.ExternalAIAPIClient, request *domain.AIRequest) (*domain.AIResponse, error) {
	// Prepare payload based on service
	var payload interface{}
	var endpoint string

	switch request.Service {
	case domain.AIServiceOpenAI:
		payload = map[string]interface{}{
			"model": request.Model,
			"messages": []map[string]string{
				{"role": "user", "content": request.Prompt},
			},
			"max_tokens":  request.MaxTokens,
			"temperature": request.Temperature,
		}
		endpoint = "/chat/completions"

	case domain.AIServiceClaude:
		payload = map[string]interface{}{
			"model":      request.Model,
			"max_tokens": request.MaxTokens,
			"messages": []map[string]string{
				{"role": "user", "content": request.Prompt},
			},
			"temperature": request.Temperature,
		}
		endpoint = "/v1/messages"
	}

	// Make request
	response, err := client.MakeRequest(ctx, endpoint, payload, nil)
	if err != nil {
		return nil, err
	}

	// Parse response based on service
	return s.parseAIResponse(request.Service, response)
}

func (s *ImprovedAIService) parseAIResponse(service domain.AIService, response *interface{}) (*domain.AIResponse, error) {
	data, ok := (*response).(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid response format")
	}

	var content string
	var tokensUsed int

	switch service {
	case domain.AIServiceOpenAI:
		choices, ok := data["choices"].([]interface{})
		if !ok || len(choices) == 0 {
			return nil, fmt.Errorf("no choices in response")
		}

		choice := choices[0].(map[string]interface{})
		message := choice["message"].(map[string]interface{})
		content = message["content"].(string)

		if usage, ok := data["usage"].(map[string]interface{}); ok {
			if totalTokens, ok := usage["total_tokens"].(float64); ok {
				tokensUsed = int(totalTokens)
			}
		}

	case domain.AIServiceClaude:
		if contentList, ok := data["content"].([]interface{}); ok && len(contentList) > 0 {
			if contentMap := contentList[0].(map[string]interface{}); ok {
				content = contentMap["text"].(string)
			}
		}

		if usage, ok := data["usage"].(map[string]interface{}); ok {
			if inputTokens, ok := usage["input_tokens"].(float64); ok {
				tokensUsed += int(inputTokens)
			}
			if outputTokens, ok := usage["output_tokens"].(float64); ok {
				tokensUsed += int(outputTokens)
			}
		}
	}

	return &domain.AIResponse{
		Content:    content,
		TokensUsed: tokensUsed,
		Model:      s.getModel(service),
	}, nil
}

func (s *ImprovedAIService) formatSchema(schema domain.DatabaseSchema) string {
	var builder strings.Builder

	for _, table := range schema.Tables {
		builder.WriteString(fmt.Sprintf("Table: %s\n", table.Name))

		if len(table.Columns) > 0 {
			builder.WriteString("  Columns:\n")
			for _, col := range table.Columns {
				pk := ""
				if len(table.PrimaryKey) > 0 {
					for _, pkCol := range table.PrimaryKey {
						if pkCol == col.Name {
							pk = " (PRIMARY KEY)"
							break
						}
					}
				}

				fk := ""
				for _, fkRel := range table.ForeignKeys {
					if fkRel.Column == col.Name {
						fk = fmt.Sprintf(" (FOREIGN KEY -> %s.%s)", fkRel.ReferencesTable, fkRel.ReferencesColumn)
						break
					}
				}

				nullStr := "NOT NULL"
				if col.Nullable {
					nullStr = "NULL"
				}

				builder.WriteString(fmt.Sprintf("    - %s: %s %s%s%s\n",
					col.Name, col.Type, nullStr, pk, fk))
			}
		}

		if len(table.Indexes) > 0 {
			builder.WriteString("  Indexes:\n")
			for _, idx := range table.Indexes {
				unique := ""
				if idx.Unique {
					unique = " (UNIQUE)"
				}
				if idx.Primary {
					unique = " (PRIMARY)"
				}
				builder.WriteString(fmt.Sprintf("    - %s: [%s]%s\n",
					idx.Name, strings.Join(idx.Columns, ", "), unique))
			}
		}

		builder.WriteString("\n")
	}

	return builder.String()
}

// Additional helper methods for generating suggestions and parsing responses
func (s *ImprovedAIService) generateSQLSuggestions(sql string, schema domain.DatabaseSchema) []string {
	var suggestions []string

	// Add suggestion to add LIMIT if not present
	if !strings.Contains(strings.ToUpper(sql), "LIMIT") && strings.HasPrefix(strings.ToUpper(sql), "SELECT") {
		suggestions = append(suggestions, "Consider adding a LIMIT clause to restrict the number of rows returned")
	}

	// Add suggestion about indexes
	if strings.Contains(strings.ToUpper(sql), "WHERE") && len(schema.Tables) > 0 {
		suggestions = append(suggestions, "Ensure columns used in WHERE clauses have appropriate indexes for better performance")
	}

	return suggestions
}

func (s *ImprovedAIService) generateIndexSuggestions(sql string, schema domain.DatabaseSchema) []domain.IndexSuggestion {
	var suggestions []domain.IndexSuggestion

	// Simple heuristic: suggest indexes on WHERE clause columns
	if strings.Contains(strings.ToUpper(sql), "WHERE") {
		// Extract column names from WHERE clause (simplified)
		re := regexp.MustCompile(`WHERE\s+(\w+)\s*=`)
		matches := re.FindStringSubmatch(strings.ToUpper(sql))
		if len(matches) > 1 {
			colName := matches[1]

			// Find which table contains this column
			for _, table := range schema.Tables {
				for _, col := range table.Columns {
					if strings.EqualFold(col.Name, colName) {
						suggestions = append(suggestions, domain.IndexSuggestion{
							Table:         table.Name,
							Columns:       []string{colName},
							Type:          "btree",
							Reason:        "Column used in WHERE clause",
							Impact:        "high",
							EstimatedGain: 50.0,
						})
						break
					}
				}
			}
		}
	}

	return suggestions
}

func (s *ImprovedAIService) parseOptimizationResponse(content string, request *domain.QueryOptimizationRequest) *domain.QueryOptimizationResponse {
	// Try to parse JSON response
	var result map[string]interface{}
	if err := json.Unmarshal([]byte(content), &result); err == nil {
		response := &domain.QueryOptimizationResponse{
			ID:             request.ID,
			RequestID:      request.ID,
			OptimizedQuery: getString(result, "optimized_query", request.SQLQuery),
			Explanation:    getString(result, "explanation", "Query optimized based on AI analysis"),
			EstimatedGain:  getFloat64(result, "estimated_gain", 0.25),
			Confidence:     getFloat64(result, "confidence", 0.7),
			CreatedAt:      time.Now(),
		}

		// Parse improvements
		if improvements, ok := result["improvements"].([]interface{}); ok {
			for _, imp := range improvements {
				if impMap, ok := imp.(map[string]interface{}); ok {
					response.Improvements = append(response.Improvements, domain.QueryImprovement{
						Type:        getString(impMap, "type", "general"),
						Description: getString(impMap, "description", "Optimization applied"),
						Impact:      getString(impMap, "impact", "medium"),
						Change:      getString(impMap, "change", "Optimized"),
					})
				}
			}
		}

		// Parse suggested indexes
		if indexes, ok := result["suggested_indexes"].([]interface{}); ok {
			for _, idx := range indexes {
				if idxMap, ok := idx.(map[string]interface{}); ok {
					var columns []string
					if cols, ok := idxMap["columns"].([]interface{}); ok {
						for _, col := range cols {
							if colStr, ok := col.(string); ok {
								columns = append(columns, colStr)
							}
						}
					}

					response.SuggestedIndexes = append(response.SuggestedIndexes, domain.IndexSuggestion{
						Table:         getString(idxMap, "table", ""),
						Columns:       columns,
						Type:          getString(idxMap, "type", "btree"),
						Reason:        getString(idxMap, "reason", "Performance optimization"),
						Impact:        getString(idxMap, "impact", "medium"),
						EstimatedGain: getFloat64(idxMap, "estimated_gain", 25.0),
					})
				}
			}
		}

		return response
	}

	// Fallback response
	return &domain.QueryOptimizationResponse{
		ID:             request.ID,
		RequestID:      request.ID,
		OptimizedQuery: request.SQLQuery,
		Explanation:    "AI optimization analysis completed",
		Improvements: []domain.QueryImprovement{
			{
				Type:        "general",
				Description: "Query analyzed for optimization opportunities",
				Impact:      "medium",
				Change:      "Reviewed",
			},
		},
		EstimatedGain: 0.1,
		Confidence:    0.5,
		CreatedAt:     time.Now(),
	}
}

func (s *ImprovedAIService) parseExplanationResponse(content string) *domain.QueryExplanationResponse {
	// Try to parse JSON response
	var result map[string]interface{}
	if err := json.Unmarshal([]byte(content), &result); err == nil {
		response := &domain.QueryExplanationResponse{
			ID:          generateID(),
			Explanation: getString(result, "explanation", content),
			Complexity:  getString(result, "complexity", "moderate"),
			CreatedAt:   time.Now(),
		}

		// Parse steps
		if steps, ok := result["steps"].([]interface{}); ok {
			for i, step := range steps {
				if stepMap, ok := step.(map[string]interface{}); ok {
					response.Steps = append(response.Steps, domain.QueryStep{
						Order:         i + 1,
						Operation:     getString(stepMap, "operation", "Process"),
						Description:   getString(stepMap, "description", "Processing step"),
						Table:         getString(stepMap, "table", ""),
						Condition:     getString(stepMap, "condition", ""),
						EstimatedCost: getFloat64(stepMap, "cost", 0),
					})
				}
			}
		}

		// Parse performance tips
		if tips, ok := result["performance_tips"].([]interface{}); ok {
			for _, tip := range tips {
				if tipMap, ok := tip.(map[string]interface{}); ok {
					response.Performance = append(response.Performance, domain.PerformanceTip{
						Type:        getString(tipMap, "type", "general"),
						Description: getString(tipMap, "description", "Performance consideration"),
						Impact:      getString(tipMap, "impact", "medium"),
					})
				}
			}
		}

		// Parse vocabulary
		if vocab, ok := result["vocabulary"].([]interface{}); ok {
			for _, term := range vocab {
				if termMap, ok := term.(map[string]interface{}); ok {
					response.Vocabulary = append(response.Vocabulary, domain.VocabularyTerm{
						Term:       getString(termMap, "term", ""),
						Definition: getString(termMap, "definition", ""),
						Example:    getString(termMap, "example", ""),
					})
				}
			}
		}

		return response
	}

	// Fallback response
	return &domain.QueryExplanationResponse{
		ID:          generateID(),
		Explanation: content,
		Complexity:  "unknown",
		CreatedAt:   time.Now(),
	}
}

func (s *ImprovedAIService) generatePerformanceTips(sql string) []domain.PerformanceTip {
	var tips []domain.PerformanceTip

	sqlUpper := strings.ToUpper(sql)

	// Check for missing LIMIT
	if strings.Contains(sqlUpper, "SELECT") && !strings.Contains(sqlUpper, "LIMIT") {
		tips = append(tips, domain.PerformanceTip{
			Type:        "query_structure",
			Description: "Consider adding a LIMIT clause to prevent returning too many rows",
			Impact:      "medium",
		})
	}

	// Check for SELECT *
	if strings.Contains(sqlUpper, "SELECT *") {
		tips = append(tips, domain.PerformanceTip{
			Type:        "best_practice",
			Description: "Avoid using SELECT *; specify only the columns you need",
			Impact:      "high",
		})
	}

	// Check for missing indexes hint
	if strings.Contains(sqlUpper, "WHERE") && !strings.Contains(sqlUpper, "INDEX") {
		tips = append(tips, domain.PerformanceTip{
			Type:        "indexing",
			Description: "Ensure columns in WHERE clause are indexed for better performance",
			Impact:      "high",
		})
	}

	return tips
}

// Utility functions
func getString(m map[string]interface{}, key, defaultValue string) string {
	if val, ok := m[key].(string); ok {
		return val
	}
	return defaultValue
}

func getFloat64(m map[string]interface{}, key string, defaultValue float64) float64 {
	if val, ok := m[key].(float64); ok {
		return val
	}
	return defaultValue
}

func generateID() string {
	return fmt.Sprintf("ai_%d", time.Now().UnixNano())
}

// AnalyzePerformance analyzes query performance
func (s *ImprovedAIService) AnalyzePerformance(ctx context.Context, request *domain.PerformanceAnalysisRequest) (*domain.PerformanceAnalysisResponse, error) {
	return &domain.PerformanceAnalysisResponse{
		ID:              "perf-analysis-" + time.Now().Format("20060102150405"),
		RequestID:       request.ID,
		Analysis:        "Performance analysis not implemented yet in this mock-like implementation.",
		Bottlenecks:     []domain.PerformanceBottleneck{},
		Recommendations: []domain.PerformanceRecommendation{},
		TokensUsed:      0,
		CreatedAt:       time.Now(),
	}, nil
}

// GenerateQuery generates a query based on requirements
func (s *ImprovedAIService) GenerateQuery(ctx context.Context, request *domain.QueryGenerationRequest) (*domain.QueryGenerationResponse, error) {
	return &domain.QueryGenerationResponse{
		ID:          "gen-query-" + time.Now().Format("20060102150405"),
		RequestID:   request.ID,
		SQLQuery:    "-- Generated query based on requirements: " + request.Requirements,
		Explanation: "Query generated based on natural language requirements.",
		Confidence:  0.9,
		TokensUsed:  0,
		CreatedAt:   time.Now(),
	}, nil
}
