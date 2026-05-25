package mcp

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

// MCPServer provides tool definitions and handlers for AI agents (Claude,
// Cursor, Windsurf). Tools enable agents to interact with PipeWarden's
// security scanning and policy enforcement.
type MCPServer struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
}

// NewMCPServer creates a new MCP server instance.
func NewMCPServer(baseURL, apiKey string) *MCPServer {
	return &MCPServer{
		baseURL:    baseURL,
		apiKey:     apiKey,
		httpClient: &http.Client{},
	}
}

// Tool represents an MCP tool definition.
type Tool struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	InputSchema json.RawMessage `json:"inputSchema"`
}

// Tools returns the list of available MCP tools.
func (s *MCPServer) Tools(ctx context.Context) ([]Tool, error) {
	return toolRegistry, nil
}

// CallTool dispatches a tool invocation. Handler implementations live in
// server_handlers.go to keep this file focused on plumbing.
func (s *MCPServer) CallTool(ctx context.Context, name string, input json.RawMessage) (interface{}, error) {
	switch name {
	case "pipewarden_scan":
		return s.handleScan(ctx, input)
	case "pipewarden_findings":
		return s.handleFindings(ctx, input)
	case "pipewarden_connections":
		return s.handleConnections(ctx, input)
	case "pipewarden_dlp_scan":
		return s.handleDLPScan(ctx, input)
	case "pipewarden_policy_check":
		return s.handlePolicyCheck(ctx, input)
	case "pipewarden_compliance":
		return s.handleCompliance(ctx, input)
	default:
		return nil, fmt.Errorf("unknown tool: %s", name)
	}
}

// apiCall is the shared HTTP client used by all tool handlers. Emits Bearer
// auth and returns the decoded JSON body. Non-2xx responses become errors.
func (s *MCPServer) apiCall(ctx context.Context, method, endpoint string, body interface{}) (interface{}, error) {
	var reader io.Reader
	if body != nil {
		reqBody, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request: %w", err)
		}
		reader = bytes.NewReader(reqBody)
	}

	req, err := http.NewRequestWithContext(ctx, method, s.baseURL+endpoint, reader)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", s.apiKey))
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("api call failed: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("api returned status %d", resp.StatusCode)
	}

	var result interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return result, nil
}
