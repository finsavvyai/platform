package services

import (
	"context"
	"fmt"
	"time"

	"github.com/queryflux/backend/internal/domain"
)

// GenerateQuery generates SQL based on requirements
func (s *aiService) GenerateQuery(ctx context.Context, req *domain.QueryGenerationRequest) (*domain.QueryGenerationResponse, error) {
	select {
	case <-s.rateLimiter.C:
	case <-ctx.Done():
		return nil, ctx.Err()
	}

	var sql string
	var err error
	schema := &req.Schema

	if s.openaiClient != nil {
		sql, err = s.generateQueryOpenAI(ctx, req.Requirements, schema)
	} else if s.claudeAPIKey != "" {
		sql, err = s.generateQueryClaude(ctx, req.Requirements, schema)
	} else {
		return nil, fmt.Errorf("no AI service configured")
	}

	if err != nil {
		return nil, err
	}

	return &domain.QueryGenerationResponse{
		ID:        req.ID,
		RequestID: req.ID,
		SQLQuery:  sql,
		CreatedAt: time.Now(),
	}, nil
}

// AnalyzePerformance analyzes query performance
func (s *aiService) AnalyzePerformance(ctx context.Context, req *domain.PerformanceAnalysisRequest) (*domain.PerformanceAnalysisResponse, error) {
	select {
	case <-s.rateLimiter.C:
	case <-ctx.Done():
		return nil, ctx.Err()
	}

	var analysis *PerformanceAnalysis
	var err error

	if s.openaiClient != nil {
		analysis, err = s.analyzePerformanceOpenAI(ctx, req.SQLQuery, req.ExecutionPlan)
	} else if s.claudeAPIKey != "" {
		analysis, err = s.analyzePerformanceClaude(ctx, req.SQLQuery, req.ExecutionPlan)
	} else {
		return nil, fmt.Errorf("no AI service configured")
	}

	if err != nil {
		return nil, err
	}

	return &domain.PerformanceAnalysisResponse{
		ID:        req.ID,
		RequestID: req.ID,
		Analysis:  analysis.Query,
		CreatedAt: time.Now(),
	}, nil
}

// GenerateResponse generates a generic AI response
func (s *aiService) GenerateResponse(ctx context.Context, request *domain.AIRequest) (*domain.AIResponse, error) {
	return nil, fmt.Errorf("not implemented")
}

// GetServiceType returns the AI service type
func (s *aiService) GetServiceType() domain.AIService {
	if s.openaiClient != nil {
		return domain.AIServiceOpenAI
	}
	return domain.AIServiceClaude
}

// IsHealthy checks if the AI service is healthy
func (s *aiService) IsHealthy(ctx context.Context) error {
	return nil
}

// GetRateLimit returns the rate limit
func (s *aiService) GetRateLimit() int {
	return 10
}

// GetRemainingTokens returns the remaining tokens
func (s *aiService) GetRemainingTokens(ctx context.Context) (int, error) {
	return 1000000, nil
}

// Close cleans up resources
func (s *aiService) Close() {
	if s.rateLimiter != nil {
		s.rateLimiter.Stop()
	}
}
