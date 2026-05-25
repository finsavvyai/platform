//go:build experimental_services

/**
 * AI Service Infrastructure
 *
 * Multi-provider AI service with failover, rate limiting, and cost tracking
 */

package services

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/queryflux/backend/internal/infrastructure/cache"
	"go.uber.org/zap"
)

// AIProvider represents supported AI providers
type AIProvider string

const (
	AIProviderOpenAI AIProvider = "openai"
	AIProviderClaude AIProvider = "claude"
	AIProviderOllama AIProvider = "ollama"
	AIProviderLocal  AIProvider = "local"
)

// AIModel represents supported AI models
type AIModel string

const (
	// OpenAI models
	ModelGPT4       AIModel = "gpt-4"
	ModelGPT4Turbo  AIModel = "gpt-4-turbo"
	ModelGPT35Turbo AIModel = "gpt-3.5-turbo"

	// Claude models
	ModelClaude3Opus   AIModel = "claude-3-opus"
	ModelClaude3Sonnet AIModel = "claude-3-sonnet"
	ModelClaude3Haiku  AIModel = "claude-3-haiku"

	// Local models
	ModelLlama2    AIModel = "llama-2"
	ModelMistral   AIModel = "mistral"
	ModelCodeLlama AIModel = "codellama"
)

// AIMessage represents a message in a conversation
type AIMessage struct {
	Role      string    `json:"role"`
	Content   string    `json:"content"`
	Timestamp time.Time `json:"timestamp,omitempty"`
}

// AIRequest represents an AI request
type AIRequest struct {
	Messages     []AIMessage `json:"messages"`
	Model        AIModel     `json:"model"`
	Temperature  float64     `json:"temperature,omitempty"`
	MaxTokens    int         `json:"maxTokens,omitempty"`
	Stream       bool        `json:"stream,omitempty"`
	Metadata     interface{} `json:"metadata,omitempty"`
	SystemPrompt string      `json:"systemPrompt,omitempty"`
}

// AIResponse represents an AI response
type AIResponse struct {
	Content    string     `json:"content"`
	Model      AIModel    `json:"model"`
	Provider   AIProvider `json:"provider"`
	TokensUsed int        `json:"tokensUsed"`
	Cost       float64    `json:"cost"`
	Latency    int64      `json:"latency"`
	Cached     bool       `json:"cached,omitempty"`
}

// AIStreamChunk represents a chunk of a streaming response
type AIStreamChunk struct {
	Content    string `json:"content"`
	Done       bool   `json:"done"`
	TokensUsed int    `json:"tokensUsed,omitempty"`
}

// AIProviderConfig represents provider configuration
type AIProviderConfig struct {
	Provider     AIProvider   `json:"provider"`
	APIKey       string       `json:"apiKey"`
	BaseURL      string       `json:"baseURL,omitempty"`
	Models       []AIModel    `json:"models"`
	MaxTokens    int          `json:"maxTokens"`
	CostPerToken CostPerToken `json:"costPerToken"`
	RateLimit    RateLimit    `json:"rateLimit"`
}

type CostPerToken struct {
	Input  float64 `json:"input"`
	Output float64 `json:"output"`
}

type RateLimit struct {
	RequestsPerMinute int `json:"requestsPerMinute"`
	TokensPerMinute   int `json:"tokensPerMinute"`
}

// AIProvider interface defines the contract for AI providers
type AIProvider interface {
	GetProvider() AIProvider
	GetConfig() AIProviderConfig

	// Execute a non-streaming request
	Execute(ctx context.Context, request AIRequest) (AIResponse, error)

	// Execute a streaming request
	ExecuteStream(ctx context.Context, request AIRequest, callback func(AIStreamChunk)) (AIResponse, error)

	// Check if provider is available
	IsAvailable(ctx context.Context) (bool, error)

	// Get current rate limit status
	GetRateLimitStatus(ctx context.Context) (RateLimitStatus, error)

	// Estimate cost for a request
	EstimateCost(request AIRequest) float64

	// Validate request
	ValidateRequest(request AIRequest) error
}

type RateLimitStatus struct {
	RequestsRemaining int       `json:"requestsRemaining"`
	TokensRemaining   int       `json:"tokensRemaining"`
	ResetAt           time.Time `json:"resetAt"`
}

// ContextManager manages conversation contexts
type ContextManager struct {
	contexts map[string]*ConversationContext
	mu       sync.RWMutex
}

type ConversationContext struct {
	ID           string                 `json:"id"`
	UserID       string                 `json:"userId"`
	Messages     []AIMessage            `json:"messages"`
	SystemPrompt string                 `json:"systemPrompt,omitempty"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
	CreatedAt    time.Time              `json:"createdAt"`
	UpdatedAt    time.Time              `json:"updatedAt"`
}

func NewContextManager() *ContextManager {
	return &ContextManager{
		contexts: make(map[string]*ConversationContext),
	}
}

func (cm *ContextManager) CreateContext(userID string, systemPrompt string) *ConversationContext {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	context := &ConversationContext{
		ID:           cm.generateID(),
		UserID:       userID,
		Messages:     []AIMessage{},
		SystemPrompt: systemPrompt,
		Metadata:     make(map[string]interface{}),
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	cm.contexts[context.ID] = context
	return context
}

func (cm *ContextManager) GetContext(contextID string) (*ConversationContext, error) {
	cm.mu.RLock()
	defer cm.mu.RUnlock()

	context, exists := cm.contexts[contextID]
	if !exists {
		return nil, fmt.Errorf("context not found: %s", contextID)
	}

	return context, nil
}

func (cm *ContextManager) AddMessage(contextID string, message AIMessage) error {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	context, exists := cm.contexts[contextID]
	if !exists {
		return fmt.Errorf("context not found: %s", contextID)
	}

	context.Messages = append(context.Messages, message)
	context.UpdatedAt = time.Now()

	// Trim context if too large (estimate: 4 chars per token)
	cm.trimContext(context, 8000)

	return nil
}

func (cm *ContextManager) GetMessages(contextID string) ([]AIMessage, error) {
	context, err := cm.GetContext(contextID)
	if err != nil {
		return nil, err
	}

	messages := []AIMessage{}
	if context.SystemPrompt != "" {
		messages = append(messages, AIMessage{
			Role:    "system",
			Content: context.SystemPrompt,
		})
	}
	messages = append(messages, context.Messages...)

	return messages, nil
}

func (cm *ContextManager) trimContext(context *ConversationContext, maxTokens int) {
	estimateTokens := func(text string) int {
		return len(text) / 4
	}

	totalTokens := 0
	if context.SystemPrompt != "" {
		totalTokens = estimateTokens(context.SystemPrompt)
	}

	keepMessages := []AIMessage{}

	// Keep messages from most recent to oldest
	for i := len(context.Messages) - 1; i >= 0; i-- {
		messageTokens := estimateTokens(context.Messages[i].Content)
		if totalTokens+messageTokens > maxTokens {
			break
		}

		keepMessages = append([]AIMessage{context.Messages[i]}, keepMessages...)
		totalTokens += messageTokens
	}

	// Reverse back to correct order
	context.Messages = reverseMessages(keepMessages)
}

func reverseMessages(messages []AIMessage) []AIMessage {
	result := make([]AIMessage, len(messages))
	for i, msg := range messages {
		result[len(messages)-1-i] = msg
	}
	return result
}

func (cm *ContextManager) generateID() string {
	return fmt.Sprintf("ctx_%d_%s", time.Now().UnixNano(), randomString(8))
}

// AICacheManager manages response caching
type AICacheManager struct {
	cache      *cache.RedisCache
	defaultTTL time.Duration
	logger     *zap.Logger
}

type CacheEntry struct {
	Response  AIResponse `json:"response"`
	CreatedAt time.Time  `json:"createdAt"`
	ExpiresAt time.Time  `json:"expiresAt"`
	HitCount  int        `json:"hitCount"`
}

func NewAICacheManager(cache *cache.RedisCache, logger *zap.Logger) *AICacheManager {
	return &AICacheManager{
		cache:      cache,
		defaultTTL: 1 * time.Hour,
		logger:     logger,
	}
}

func (acm *AICacheManager) generateKey(request AIRequest) string {
	data, _ := json.Marshal(map[string]interface{}{
		"messages":    request.Messages,
		"model":       request.Model,
		"temperature": request.Temperature,
		"maxTokens":   request.MaxTokens,
	})

	hash := sha256.Sum256(data)
	return hex.EncodeToString(hash[:])
}

func (acm *AICacheManager) Get(ctx context.Context, request AIRequest) (*AIResponse, error) {
	if acm.cache == nil {
		return nil, nil // Cache not configured
	}

	key := acm.generateKey(request)
	data, err := acm.cache.Get(ctx, "ai_cache:"+key)
	if err != nil {
		return nil, nil // Cache miss
	}

	var entry CacheEntry
	if err := json.Unmarshal(data, &entry); err != nil {
		acm.logger.Error("Failed to unmarshal cache entry", zap.Error(err))
		return nil, nil
	}

	if time.Now().After(entry.ExpiresAt) {
		// Entry expired
		acm.cache.Delete(ctx, "ai_cache:"+key)
		return nil, nil
	}

	entry.HitCount++
	response := entry.Response
	response.Cached = true

	acm.logger.Debug("AI cache hit", zap.String("key", key), zap.Int("hits", entry.HitCount))

	return &response, nil
}

func (acm *AICacheManager) Set(ctx context.Context, request AIRequest, response AIResponse, ttl *time.Duration) error {
	if acm.cache == nil {
		return nil // Cache not configured
	}

	key := acm.generateKey(request)
	now := time.Now()

	entry := CacheEntry{
		Response:  response,
		CreatedAt: now,
		ExpiresAt: now.Add(acm.defaultTTL),
		HitCount:  0,
	}

	if ttl != nil {
		entry.ExpiresAt = now.Add(*ttl)
	}

	data, err := json.Marshal(entry)
	if err != nil {
		return fmt.Errorf("failed to marshal cache entry: %w", err)
	}

	cacheTTL := acm.defaultTTL
	if ttl != nil {
		cacheTTL = *ttl
	}

	if err := acm.cache.Set(ctx, "ai_cache:"+key, data, cacheTTL); err != nil {
		return fmt.Errorf("failed to cache response: %w", err)
	}

	acm.logger.Debug("AI response cached", zap.String("key", key))

	return nil
}

// CostTracker tracks AI usage costs
type CostTracker struct {
	tracking map[string]*CostTracking
	mu       sync.RWMutex
	logger   *zap.Logger
}

type CostTracking struct {
	Provider     AIProvider `json:"provider"`
	Model        AIModel    `json:"model"`
	Requests     int        `json:"requests"`
	InputTokens  int        `json:"inputTokens"`
	OutputTokens int        `json:"outputTokens"`
	TotalCost    float64    `json:"totalCost"`
	PeriodStart  time.Time  `json:"periodStart"`
	PeriodEnd    time.Time  `json:"periodEnd"`
}

func NewCostTracker(logger *zap.Logger) *CostTracker {
	return &CostTracker{
		tracking: make(map[string]*CostTracking),
		logger:   logger,
	}
}

func (ct *CostTracker) Track(provider AIProvider, model AIModel, inputTokens, outputTokens int, cost float64) {
	ct.mu.Lock()
	defer ct.mu.Unlock()

	// Use YYYY-MM as key for monthly tracking
	key := fmt.Sprintf("%s_%s_%s", provider, model, time.Now().Format("2006-01"))

	tracking, exists := ct.tracking[key]
	if !exists {
		tracking = &CostTracking{
			Provider:     provider,
			Model:        model,
			Requests:     0,
			InputTokens:  0,
			OutputTokens: 0,
			TotalCost:    0,
			PeriodStart:  time.Now(),
			PeriodEnd:    time.Now(),
		}
		ct.tracking[key] = tracking
	}

	tracking.Requests++
	tracking.InputTokens += inputTokens
	tracking.OutputTokens += outputTokens
	tracking.TotalCost += cost
}

func (ct *CostTracker) GetStats(provider *AIProvider, model *AIModel) []*CostTracking {
	ct.mu.RLock()
	defer ct.mu.RUnlock()

	stats := make([]*CostTracking, 0, len(ct.tracking))

	for _, tracking := range ct.tracking {
		if provider != nil && tracking.Provider != *provider {
			continue
		}
		if model != nil && tracking.Model != *model {
			continue
		}
		stats = append(stats, tracking)
	}

	return stats
}

// RateLimiter manages rate limiting for AI providers
type RateLimiter struct {
	requests map[string][]time.Time
	tokens   map[string][]time.Time
	mu       sync.RWMutex
}

func NewRateLimiter() *RateLimiter {
	return &RateLimiter{
		requests: make(map[string][]time.Time),
		tokens:   make(map[string][]time.Time),
	}
}

func (rl *RateLimiter) Check(provider string, config AIProviderConfig) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	minuteAgo := now.Add(-time.Minute)

	// Check request rate
	requestTimes := rl.requests[provider]
	recentRequests := filterTimes(requestTimes, minuteAgo)

	if len(recentRequests) >= config.RateLimit.RequestsPerMinute {
		return false
	}

	// Check token rate
	tokenTimes := rl.tokens[provider]
	recentTokens := filterTimes(tokenTimes, minuteAgo)

	if len(recentTokens) >= config.RateLimit.TokensPerMinute {
		return false
	}

	return true
}

func (rl *RateLimiter) RecordRequest(provider string, tokens int) {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()

	requestTimes := rl.requests[provider]
	for i := 0; i < 1; i++ { // Record 1 request
		requestTimes = append(requestTimes, now)
	}
	rl.requests[provider] = requestTimes

	tokenTimes := rl.tokens[provider]
	for i := 0; i < tokens; i++ {
		tokenTimes = append(tokenTimes, now)
	}
	rl.tokens[provider] = tokenTimes
}

func filterTimes(times []time.Time, after time.Time) []time.Time {
	result := []time.Time{}
	for _, t := range times {
		if t.After(after) {
			result = append(result, t)
		}
	}
	return result
}

// AIService orchestrates AI providers
type AIService struct {
	providers      map[AIProvider]AIProvider
	contextManager *ContextManager
	cacheManager   *AICacheManager
	costTracker    *CostTracker
	rateLimiter    *RateLimiter
	logger         *zap.Logger
	mu             sync.RWMutex
}

func NewAIService(logger *zap.Logger, cache *cache.RedisCache) *AIService {
	return &AIService{
		providers:      make(map[AIProvider]AIProvider),
		contextManager: NewContextManager(),
		cacheManager:   NewAICacheManager(cache, logger),
		costTracker:    NewCostTracker(logger),
		rateLimiter:    NewRateLimiter(),
		logger:         logger,
	}
}

func (s *AIService) RegisterProvider(provider AIProvider) {
	s.mu.Lock()
	defer s.mu.Unlock()
	// Provider registration would happen here
	// s.providers[provider.GetProvider()] = provider
}

func (s *AIService) Execute(ctx context.Context, request AIRequest) (AIResponse, error) {
	// Check cache
	cached, err := s.cacheManager.Get(ctx, request)
	if err == nil && cached != nil {
		s.logger.Debug("AI cache hit")
		return *cached, nil
	}

	// Select provider
	provider, err := s.selectProvider(ctx, request)
	if err != nil {
		return AIResponse{}, fmt.Errorf("no AI provider available: %w", err)
	}

	// Check rate limit
	if !s.rateLimiter.Check(string(provider.GetProvider()), provider.GetConfig()) {
		return AIResponse{}, fmt.Errorf("rate limit exceeded for provider %s", provider.GetProvider())
	}

	// Execute request
	startTime := time.Now()
	response, err := provider.Execute(ctx, request)
	if err != nil {
		return AIResponse{}, fmt.Errorf("provider execution failed: %w", err)
	}
	latency := time.Since(startTime).Milliseconds()

	response.Latency = latency

	// Record usage
	s.rateLimiter.RecordRequest(string(provider.GetProvider()), response.TokensUsed)
	s.costTracker.Track(
		response.Provider,
		response.Model,
		response.TokensUsed,
		0, // Would need to separate input/output
		response.Cost,
	)

	// Cache response
	if cacheErr := s.cacheManager.Set(ctx, request, response, nil); cacheErr != nil {
		s.logger.Warn("Failed to cache AI response", zap.Error(cacheErr))
	}

	return response, nil
}

func (s *AIService) selectProvider(ctx context.Context, request AIRequest) (AIProvider, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	// Find available providers
	var availableProviders []AIProvider
	for _, provider := range s.providers {
		if available, err := provider.IsAvailable(ctx); err == nil && available {
			availableProviders = append(availableProviders, provider)
		}
	}

	if len(availableProviders) == 0 {
		return nil, fmt.Errorf("no available AI providers")
	}

	// Select cheapest provider
	// (Simple strategy - could be more sophisticated)
	cheapestProvider := availableProviders[0]
	cheapestCost := cheapestProvider.EstimateCost(request)

	for _, provider := range availableProviders[1:] {
		cost := provider.EstimateCost(request)
		if cost < cheapestCost {
			cheapestProvider = provider
			cheapestCost = cost
		}
	}

	return cheapestProvider, nil
}

func randomString(n int) string {
	const letters = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, n)
	for i := range b {
		b[i] = letters[time.Now().UnixNano()%int64(len(letters))]
	}
	return string(b)
}
