package services

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/queryflux/backend/internal/domain"
	"github.com/sashabaranov/go-openai"
)

func (s *aiService) convertNLToSQLOpenAI(ctx context.Context, naturalLanguage string, schema *domain.DatabaseSchema) (string, error) {
	schemaInfo := s.formatSchema(schema)

	prompt := fmt.Sprintf(`You are a SQL expert. Convert the following natural language request to SQL.

Database Schema:
%s

Natural Language Request: %s

Return only the SQL query without any explanation or formatting.`, schemaInfo, naturalLanguage)

	resp, err := s.openaiClient.CreateChatCompletion(
		ctx,
		openai.ChatCompletionRequest{
			Model: openai.GPT4,
			Messages: []openai.ChatCompletionMessage{
				{
					Role:    openai.ChatMessageRoleSystem,
					Content: "You are a SQL expert. Convert natural language to SQL queries.",
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

func (s *aiService) optimizeQueryOpenAI(ctx context.Context, sql string) (*QueryOptimization, error) {
	prompt := fmt.Sprintf(`You are a SQL performance expert. Analyze and optimize the following SQL query.

Query: %s

Respond in JSON format:
{
  "optimized_query": "...",
  "suggestions": [{"type": "index", "description": "...", "impact": "high"}],
  "estimated_improvement": 25.0
}`, sql)

	resp, err := s.openaiClient.CreateChatCompletion(
		ctx,
		openai.ChatCompletionRequest{
			Model: openai.GPT4,
			Messages: []openai.ChatCompletionMessage{
				{
					Role:    openai.ChatMessageRoleSystem,
					Content: "You are a SQL performance optimization expert.",
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

	var optimization QueryOptimization
	if err := json.Unmarshal([]byte(resp.Choices[0].Message.Content), &optimization); err != nil {
		return &QueryOptimization{
			OriginalQuery:  sql,
			OptimizedQuery: resp.Choices[0].Message.Content,
			Suggestions: []OptimizationSuggestion{
				{
					Type:        "general",
					Description: "AI-generated optimization suggestions",
					Impact:      "medium",
				},
			},
			EstimatedImprovement: 10.0,
		}, nil
	}

	optimization.OriginalQuery = sql
	return &optimization, nil
}

func (s *aiService) explainQueryOpenAI(ctx context.Context, sql string) (*QueryExplanation, error) {
	prompt := fmt.Sprintf(`You are a SQL expert. Explain the following SQL query in a clear, human-readable way.

Query: %s

Respond in JSON format:
{
  "explanation": "...",
  "operations": [{"type": "scan", "description": "...", "cost": 100.0}],
  "complexity": "medium"
}`, sql)

	resp, err := s.openaiClient.CreateChatCompletion(
		ctx,
		openai.ChatCompletionRequest{
			Model: openai.GPT4,
			Messages: []openai.ChatCompletionMessage{
				{
					Role:    openai.ChatMessageRoleSystem,
					Content: "You are a SQL explanation expert.",
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
		return nil, fmt.Errorf("failed to call OpenAI API: %w", err)
	}

	if len(resp.Choices) == 0 {
		return nil, fmt.Errorf("no response from OpenAI")
	}

	var explanation QueryExplanation
	if err := json.Unmarshal([]byte(resp.Choices[0].Message.Content), &explanation); err != nil {
		return &QueryExplanation{
			Query:       sql,
			Explanation: resp.Choices[0].Message.Content,
			Operations:  []QueryOperation{},
			Complexity:  "unknown",
		}, nil
	}

	explanation.Query = sql
	return &explanation, nil
}
