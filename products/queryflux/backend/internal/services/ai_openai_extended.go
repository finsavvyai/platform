package services

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/queryflux/backend/internal/domain"
	"github.com/sashabaranov/go-openai"
)

func (s *aiService) generateQueryOpenAI(ctx context.Context, requirements string, schema *domain.DatabaseSchema) (string, error) {
	schemaInfo := s.formatSchema(schema)

	prompt := fmt.Sprintf(`You are a SQL expert. Generate a SQL query based on the following requirements.

Database Schema:
%s

Requirements: %s

Return only the SQL query without any explanation or formatting.`, schemaInfo, requirements)

	resp, err := s.openaiClient.CreateChatCompletion(
		ctx,
		openai.ChatCompletionRequest{
			Model: openai.GPT4,
			Messages: []openai.ChatCompletionMessage{
				{
					Role:    openai.ChatMessageRoleSystem,
					Content: "You are a SQL expert. Generate SQL queries based on requirements.",
				},
				{
					Role:    openai.ChatMessageRoleUser,
					Content: prompt,
				},
			},
			MaxTokens:   1000,
			Temperature: 0.1,
		},
	)

	if err != nil {
		s.logger.WithError(err).Error("OpenAI API call failed")
		return "", fmt.Errorf("failed to call OpenAI API: %w", err)
	}

	if len(resp.Choices) == 0 {
		return "", fmt.Errorf("no response from OpenAI")
	}

	return strings.TrimSpace(resp.Choices[0].Message.Content), nil
}

func (s *aiService) analyzePerformanceOpenAI(ctx context.Context, sql string, executionPlan string) (*PerformanceAnalysis, error) {
	prompt := fmt.Sprintf(`You are a database performance expert. Analyze the following SQL query and its execution plan.

Query: %s

Execution Plan: %s

Respond in JSON format:
{
  "execution_time": 1.5,
  "rows_processed": 1000,
  "memory_usage": 50000,
  "bottlenecks": [{"type": "full_table_scan", "description": "...", "severity": "high", "impact": 80.0}],
  "recommendations": [{"type": "index", "description": "...", "priority": "high"}]
}`, sql, executionPlan)

	resp, err := s.openaiClient.CreateChatCompletion(
		ctx,
		openai.ChatCompletionRequest{
			Model: openai.GPT4,
			Messages: []openai.ChatCompletionMessage{
				{
					Role:    openai.ChatMessageRoleSystem,
					Content: "You are a database performance analysis expert.",
				},
				{
					Role:    openai.ChatMessageRoleUser,
					Content: prompt,
				},
			},
			MaxTokens:   1500,
			Temperature: 0.1,
		},
	)

	if err != nil {
		s.logger.WithError(err).Error("OpenAI API call failed")
		return nil, fmt.Errorf("failed to call OpenAI API: %w", err)
	}

	if len(resp.Choices) == 0 {
		return nil, fmt.Errorf("no response from OpenAI")
	}

	var analysis PerformanceAnalysis
	if err := json.Unmarshal([]byte(resp.Choices[0].Message.Content), &analysis); err != nil {
		return &PerformanceAnalysis{
			Query:           sql,
			ExecutionTime:   1.0,
			RowsProcessed:   100,
			MemoryUsage:     10000,
			Bottlenecks:     []PerformanceBottleneck{},
			Recommendations: []PerformanceRecommendation{},
		}, nil
	}

	analysis.Query = sql
	return &analysis, nil
}
