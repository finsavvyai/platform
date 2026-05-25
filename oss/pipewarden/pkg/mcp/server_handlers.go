package mcp

import (
	"context"
	"encoding/json"
	"fmt"
)

func (s *MCPServer) handleScan(ctx context.Context, input json.RawMessage) (interface{}, error) {
	var req struct {
		ConnectionName string `json:"connection_name"`
		RunID          string `json:"run_id"`
		AnalysisType   string `json:"analysis_type"`
	}
	if err := json.Unmarshal(input, &req); err != nil {
		return nil, fmt.Errorf("invalid input: %w", err)
	}
	return s.apiCall(ctx, "POST", "/api/v1/analysis/run", req)
}

func (s *MCPServer) handleFindings(ctx context.Context, input json.RawMessage) (interface{}, error) {
	var params struct {
		ConnectionName string `json:"connection_name"`
		Severity       string `json:"severity"`
		Category       string `json:"category"`
		Status         string `json:"status"`
		Limit          int    `json:"limit"`
	}
	if err := json.Unmarshal(input, &params); err != nil {
		return nil, fmt.Errorf("invalid input: %w", err)
	}

	if params.Limit == 0 {
		params.Limit = 20
	}

	query := fmt.Sprintf("?limit=%d", params.Limit)
	if params.ConnectionName != "" {
		query += fmt.Sprintf("&connection_name=%s", params.ConnectionName)
	}
	if params.Severity != "" {
		query += fmt.Sprintf("&severity=%s", params.Severity)
	}
	if params.Category != "" {
		query += fmt.Sprintf("&category=%s", params.Category)
	}
	if params.Status != "" {
		query += fmt.Sprintf("&status=%s", params.Status)
	}

	return s.apiCall(ctx, "GET", "/api/v1/analysis/findings"+query, nil)
}

func (s *MCPServer) handleConnections(ctx context.Context, input json.RawMessage) (interface{}, error) {
	var req struct {
		Action         string `json:"action"`
		ConnectionName string `json:"connection_name"`
	}
	if err := json.Unmarshal(input, &req); err != nil {
		return nil, fmt.Errorf("invalid input: %w", err)
	}

	if req.Action == "test" {
		return s.apiCall(ctx, "POST", "/api/v1/connections/test", map[string]string{"name": req.ConnectionName})
	}

	return s.apiCall(ctx, "GET", "/api/v1/connections", nil)
}

func (s *MCPServer) handleDLPScan(ctx context.Context, input json.RawMessage) (interface{}, error) {
	var req struct {
		Content string `json:"content"`
		Redact  bool   `json:"redact"`
	}
	if err := json.Unmarshal(input, &req); err != nil {
		return nil, fmt.Errorf("invalid input: %w", err)
	}

	if !req.Redact {
		req.Redact = true
	}

	return s.apiCall(ctx, "POST", "/api/v1/dlp/scan", req)
}

func (s *MCPServer) handlePolicyCheck(ctx context.Context, input json.RawMessage) (interface{}, error) {
	var req struct {
		ConnectionName string   `json:"connection_name"`
		RunID          string   `json:"run_id"`
		Policies       []string `json:"policies"`
	}
	if err := json.Unmarshal(input, &req); err != nil {
		return nil, fmt.Errorf("invalid input: %w", err)
	}

	return s.apiCall(ctx, "POST", "/api/v1/policy/evaluate", req)
}

func (s *MCPServer) handleCompliance(ctx context.Context, input json.RawMessage) (interface{}, error) {
	var req struct {
		Framework      string `json:"framework"`
		ConnectionName string `json:"connection_name"`
		DateRange      string `json:"date_range"`
	}
	if err := json.Unmarshal(input, &req); err != nil {
		return nil, fmt.Errorf("invalid input: %w", err)
	}

	endpoint := fmt.Sprintf("/api/v1/compliance/%s", req.Framework)
	if req.ConnectionName != "" {
		endpoint += fmt.Sprintf("?connection=%s", req.ConnectionName)
	}

	return s.apiCall(ctx, "GET", endpoint, nil)
}
