package services

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/queryflux/backend/internal/domain"
)

func (s *aiService) explainQueryClaude(ctx context.Context, sql string) (*QueryExplanation, error) {
	prompt := fmt.Sprintf(`You are a SQL expert. Explain the following SQL query in a clear, human-readable way.

Query: %s

Respond in JSON format:
{
  "explanation": "...",
  "operations": [{"type": "scan", "description": "...", "cost": 100.0}],
  "complexity": "medium"
}`, sql)

	response, err := s.callClaude(ctx, prompt)
	if err != nil {
		return nil, err
	}

	var explanation QueryExplanation
	if err := json.Unmarshal([]byte(response), &explanation); err != nil {
		return &QueryExplanation{
			Query:       sql,
			Explanation: response,
			Operations:  []QueryOperation{},
			Complexity:  "unknown",
		}, nil
	}

	explanation.Query = sql
	return &explanation, nil
}

func (s *aiService) generateQueryClaude(ctx context.Context, requirements string, schema *domain.DatabaseSchema) (string, error) {
	schemaInfo := s.formatSchema(schema)

	prompt := fmt.Sprintf(`You are a SQL expert. Generate a SQL query based on the following requirements.

Database Schema:
%s

Requirements: %s

Return only the SQL query without any explanation or formatting.`, schemaInfo, requirements)

	response, err := s.callClaude(ctx, prompt)
	if err != nil {
		return "", err
	}

	return strings.TrimSpace(response), nil
}

func (s *aiService) analyzePerformanceClaude(ctx context.Context, sql string, executionPlan string) (*PerformanceAnalysis, error) {
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

	response, err := s.callClaude(ctx, prompt)
	if err != nil {
		return nil, err
	}

	var analysis PerformanceAnalysis
	if err := json.Unmarshal([]byte(response), &analysis); err != nil {
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
