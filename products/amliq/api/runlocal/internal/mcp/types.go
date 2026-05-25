package mcp

import "encoding/json"

// JsonRpcRequest is a JSON-RPC 2.0 request.
type JsonRpcRequest struct {
	Jsonrpc string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
}

// JsonRpcResponse is a JSON-RPC 2.0 response.
type JsonRpcResponse struct {
	Jsonrpc string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id"`
	Result  any             `json:"result,omitempty"`
	Error   *RpcError       `json:"error,omitempty"`
}

// RpcError holds JSON-RPC error details.
type RpcError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

// InitializeResult is returned for the "initialize" method.
type InitializeResult struct {
	ProtocolVersion string       `json:"protocolVersion"`
	ServerInfo      ServerInfo   `json:"serverInfo"`
	Capabilities    Capabilities `json:"capabilities"`
}

// ServerInfo identifies the MCP server.
type ServerInfo struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}

// Capabilities declares what the server supports.
type Capabilities struct {
	Tools *ToolsCap `json:"tools,omitempty"`
}

// ToolsCap indicates tools are supported.
type ToolsCap struct {
	ListChanged bool `json:"listChanged"`
}

// Tool describes an MCP tool definition.
type Tool struct {
	Name        string         `json:"name"`
	Description string         `json:"description"`
	InputSchema map[string]any `json:"inputSchema"`
}

// ToolsListResult is returned for "tools/list".
type ToolsListResult struct {
	Tools []Tool `json:"tools"`
}

// ToolCallParams are the params for "tools/call".
type ToolCallParams struct {
	Name      string         `json:"name"`
	Arguments map[string]any `json:"arguments"`
}

// ToolCallResult is the result of a tool invocation.
type ToolCallResult struct {
	Content []ContentBlock `json:"content"`
	IsError bool           `json:"isError,omitempty"`
}

// ContentBlock is a single content item in tool output.
type ContentBlock struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

// NewTextResult creates a successful text result.
func NewTextResult(text string) ToolCallResult {
	return ToolCallResult{
		Content: []ContentBlock{{Type: "text", Text: text}},
	}
}

// NewErrorResult creates an error text result.
func NewErrorResult(msg string) ToolCallResult {
	return ToolCallResult{
		Content: []ContentBlock{{Type: "text", Text: msg}},
		IsError: true,
	}
}
