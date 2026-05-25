package ingestion

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync/atomic"
	"time"
)

// MCPClient is a minimal outbound MCP-over-HTTP client for pulling
// data from upstream MCP servers (Moody's, D&B, FATF when they ship
// public endpoints). Streamable-HTTP transport: POST a JSON-RPC
// payload to the server's endpoint, get JSON back. We don't use SSE
// here because all tool calls we make are request/response.
//
// Auth: per-server bearer token from the config, sent as
// Authorization: Bearer. Some upstreams use api-key headers — set
// extra headers via WithHeader as needed.
type MCPClient struct {
	endpoint string
	bearer   string
	headers  http.Header
	http     *http.Client
	idCtr    atomic.Int64
}

// NewMCPClient builds a client; pass an explicit *http.Client so tests
// + production can swap timeouts, transports, and proxy settings.
// The default 30s timeout balances slow upstreams (Moody's CDN can
// be sluggish) against not blocking pipeline workers indefinitely.
func NewMCPClient(endpoint, bearer string, hc *http.Client) *MCPClient {
	if hc == nil {
		hc = &http.Client{Timeout: 30 * time.Second}
	}
	return &MCPClient{
		endpoint: endpoint,
		bearer:   bearer,
		headers:  make(http.Header),
		http:     hc,
	}
}

// WithHeader adds a request header (e.g. "X-API-Key") that some MCP
// servers require alongside or instead of bearer. Returns the client
// for chaining.
func (c *MCPClient) WithHeader(k, v string) *MCPClient {
	c.headers.Set(k, v)
	return c
}

// CallTool issues an MCP tools/call and returns the raw result map.
// The caller knows the tool's output shape and unmarshals from there;
// keeping this generic means a single client serves Moody's, D&B,
// and any future MCP source without per-source RPC plumbing.
func (c *MCPClient) CallTool(ctx context.Context, name string, args interface{}) (map[string]interface{}, error) {
	id := c.idCtr.Add(1)
	body, err := json.Marshal(map[string]interface{}{
		"jsonrpc": "2.0",
		"id":      id,
		"method":  "tools/call",
		"params":  map[string]interface{}{"name": name, "arguments": args},
	})
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	if c.bearer != "" {
		req.Header.Set("Authorization", "Bearer "+c.bearer)
	}
	for k, vs := range c.headers {
		for _, v := range vs {
			req.Header.Add(k, v)
		}
	}

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("mcp call %s: %w", name, err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("mcp call %s: status %d: %s", name, resp.StatusCode, string(raw))
	}

	var rpc struct {
		Result map[string]interface{} `json:"result"`
		Error  *struct {
			Code    int    `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(raw, &rpc); err != nil {
		return nil, fmt.Errorf("mcp call %s: bad response: %w", name, err)
	}
	if rpc.Error != nil {
		return nil, fmt.Errorf("mcp call %s: %d %s", name, rpc.Error.Code, rpc.Error.Message)
	}
	return rpc.Result, nil
}

// ToolText pulls the first text content block from a tools/call
// result. MCP servers return tool output as a content[] array of
// {type, text} blocks; for our purposes (Moody's screening, D&B
// hierarchy) the first text block holds the JSON payload we want.
func ToolText(result map[string]interface{}) string {
	content, ok := result["content"].([]interface{})
	if !ok || len(content) == 0 {
		return ""
	}
	first, ok := content[0].(map[string]interface{})
	if !ok {
		return ""
	}
	text, _ := first["text"].(string)
	return text
}
