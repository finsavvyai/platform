package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/queryflux/backend/internal/domain"
)

type claudeRequest struct {
	Model     string          `json:"model"`
	MaxTokens int             `json:"max_tokens"`
	Messages  []claudeMessage `json:"messages"`
}

type claudeMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type claudeResponse struct {
	Content []claudeContent `json:"content"`
}

type claudeContent struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

func (s *aiService) callClaude(ctx context.Context, prompt string) (string, error) {
	if s.claudeAPIKey == "" {
		return "", fmt.Errorf("Claude API key not configured")
	}

	reqBody := claudeRequest{
		Model:     "claude-3-sonnet-20240229",
		MaxTokens: 4000,
		Messages: []claudeMessage{
			{
				Role:    "user",
				Content: prompt,
			},
		},
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.anthropic.com/v1/messages", bytes.NewBuffer(jsonBody))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", s.claudeAPIKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		s.logger.WithError(err).Error("Claude API call failed")
		return "", fmt.Errorf("failed to call Claude API: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("Claude API returned status %d: %s", resp.StatusCode, string(body))
	}

	var claudeResp claudeResponse
	if err := json.NewDecoder(resp.Body).Decode(&claudeResp); err != nil {
		return "", fmt.Errorf("failed to decode response: %w", err)
	}

	if len(claudeResp.Content) == 0 {
		return "", fmt.Errorf("no content in Claude response")
	}

	return claudeResp.Content[0].Text, nil
}

func (s *aiService) convertNLToSQLClaude(ctx context.Context, naturalLanguage string, schema *domain.DatabaseSchema) (string, error) {
	schemaInfo := s.formatSchema(schema)

	prompt := fmt.Sprintf(`You are a SQL expert. Convert the following natural language request to SQL.

Database Schema:
%s

Natural Language Request: %s

Return only the SQL query without any explanation or formatting.`, schemaInfo, naturalLanguage)

	response, err := s.callClaude(ctx, prompt)
	if err != nil {
		return "", err
	}

	return strings.TrimSpace(response), nil
}

func (s *aiService) optimizeQueryClaude(ctx context.Context, sql string) (*QueryOptimization, error) {
	prompt := fmt.Sprintf(`You are a SQL performance expert. Analyze and optimize the following SQL query.

Query: %s

Respond in JSON format:
{
  "optimized_query": "...",
  "suggestions": [{"type": "index", "description": "...", "impact": "high"}],
  "estimated_improvement": 25.0
}`, sql)

	response, err := s.callClaude(ctx, prompt)
	if err != nil {
		return nil, err
	}

	var optimization QueryOptimization
	if err := json.Unmarshal([]byte(response), &optimization); err != nil {
		return &QueryOptimization{
			OriginalQuery:  sql,
			OptimizedQuery: response,
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
