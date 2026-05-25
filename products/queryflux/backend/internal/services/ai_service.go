package services

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/queryflux/backend/internal/application/ports"
	"github.com/queryflux/backend/internal/domain"
	"github.com/sashabaranov/go-openai"
	"github.com/sirupsen/logrus"
)

// aiService implements the ports.AIService interface
type aiService struct {
	openaiClient      *openai.Client
	claudeAPIKey      string
	openHandsProvider *OpenHandsProvider
	httpClient        *http.Client
	logger            *logrus.Logger
	rateLimiter       *time.Ticker
	monitoringService ports.MonitoringService
}

// NewAIService creates a new AI service
func NewAIService(openAIAPIKey, claudeAPIKey, openHandsURL string, monitoringService ports.MonitoringService) (ports.AIService, error) {
	logger := logrus.New()
	logger.SetLevel(logrus.InfoLevel)

	var openaiClient *openai.Client
	if openAIAPIKey != "" {
		config := openai.DefaultConfig(openAIAPIKey)
		openaiClient = openai.NewClientWithConfig(config)
	}

	var openHandsProvider *OpenHandsProvider
	if openHandsURL != "" {
		openHandsProvider = NewOpenHandsProvider(openHandsURL, "")
	}

	rateLimiter := time.NewTicker(6 * time.Second)

	return &aiService{
		openaiClient:      openaiClient,
		claudeAPIKey:      claudeAPIKey,
		openHandsProvider: openHandsProvider,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		logger:            logger,
		rateLimiter:       rateLimiter,
		monitoringService: monitoringService,
	}, nil
}

// ConvertNLToSQL converts natural language to SQL
func (s *aiService) ConvertNLToSQL(ctx context.Context, req *domain.NLToSQLRequest) (*domain.NLToSQLResponse, error) {
	select {
	case <-s.rateLimiter.C:
	case <-ctx.Done():
		return nil, ctx.Err()
	}

	var sql string
	var err error
	schema := &req.Schema

	if s.openHandsProvider != nil {
		sql, err = s.openHandsProvider.ConvertNLToSQL(ctx, req.NLQuery, s.formatSchema(schema))
	} else if s.openaiClient != nil {
		sql, err = s.convertNLToSQLOpenAI(ctx, req.NLQuery, schema)
	} else if s.claudeAPIKey != "" {
		sql, err = s.convertNLToSQLClaude(ctx, req.NLQuery, schema)
	} else {
		sql = s.fallbackNLToSQL(req.NLQuery, schema)
	}

	if err != nil {
		s.logger.WithError(err).Warn("AI provider failed, using deterministic SQL fallback")
		sql = s.fallbackNLToSQL(req.NLQuery, schema)
	}

	return &domain.NLToSQLResponse{
		ID:        req.ID,
		RequestID: req.ID,
		SQLQuery:  sql,
		CreatedAt: time.Now(),
	}, nil
}

func (s *aiService) fallbackNLToSQL(prompt string, schema *domain.DatabaseSchema) string {
	table := "users"
	lowerPrompt := strings.ToLower(prompt)

	if schema != nil && len(schema.Tables) > 0 {
		table = schema.Tables[0].Name
		for _, candidate := range schema.Tables {
			if strings.Contains(lowerPrompt, strings.ToLower(candidate.Name)) {
				table = candidate.Name
				break
			}
		}
	}

	if strings.Contains(lowerPrompt, "count") || strings.Contains(lowerPrompt, "how many") {
		return fmt.Sprintf("SELECT COUNT(*) FROM %s;", table)
	}

	return fmt.Sprintf("SELECT * FROM %s LIMIT 100;", table)
}

// OptimizeQuery provides query optimization suggestions
func (s *aiService) OptimizeQuery(ctx context.Context, req *domain.QueryOptimizationRequest) (*domain.QueryOptimizationResponse, error) {
	select {
	case <-s.rateLimiter.C:
	case <-ctx.Done():
		return nil, ctx.Err()
	}

	var optimization *QueryOptimization
	var err error

	if s.openaiClient != nil {
		optimization, err = s.optimizeQueryOpenAI(ctx, req.SQLQuery)
	} else if s.claudeAPIKey != "" {
		optimization, err = s.optimizeQueryClaude(ctx, req.SQLQuery)
	} else {
		return nil, fmt.Errorf("no AI service configured")
	}

	if err != nil {
		return nil, err
	}

	return &domain.QueryOptimizationResponse{
		ID:             req.ID,
		RequestID:      req.ID,
		OptimizedQuery: optimization.OptimizedQuery,
		Explanation:    "AI-generated optimization",
		EstimatedGain:  optimization.EstimatedImprovement,
		CreatedAt:      time.Now(),
	}, nil
}

// ExplainQuery provides human-readable query explanations
func (s *aiService) ExplainQuery(ctx context.Context, req *domain.QueryExplanationRequest) (*domain.QueryExplanationResponse, error) {
	select {
	case <-s.rateLimiter.C:
	case <-ctx.Done():
		return nil, ctx.Err()
	}

	var explanation *QueryExplanation
	var err error

	if s.openaiClient != nil {
		explanation, err = s.explainQueryOpenAI(ctx, req.SQLQuery)
	} else if s.claudeAPIKey != "" {
		explanation, err = s.explainQueryClaude(ctx, req.SQLQuery)
	} else {
		return nil, fmt.Errorf("no AI service configured")
	}

	if err != nil {
		return nil, err
	}

	return &domain.QueryExplanationResponse{
		ID:          req.ID,
		RequestID:   req.ID,
		Explanation: explanation.Explanation,
		Complexity:  explanation.Complexity,
		CreatedAt:   time.Now(),
	}, nil
}
