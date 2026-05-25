package mcp

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"log"
)

const protocolVersion = "2024-11-05"

// Server handles MCP JSON-RPC messages over stdio.
type Server struct {
	reader  io.Reader
	writer  io.Writer
	version string
}

// NewServer creates an MCP server reading from r, writing to w.
func NewServer(r io.Reader, w io.Writer, version string) *Server {
	return &Server{reader: r, writer: w, version: version}
}

// Run reads JSON-RPC requests from stdin until EOF.
func (s *Server) Run() error {
	scanner := bufio.NewScanner(s.reader)
	scanner.Buffer(make([]byte, 0, 1024*1024), 1024*1024)
	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}
		var req JsonRpcRequest
		if err := json.Unmarshal(line, &req); err != nil {
			s.writeError(nil, -32700, "parse error")
			continue
		}
		s.handle(req)
	}
	return scanner.Err()
}

func (s *Server) handle(req JsonRpcRequest) {
	switch req.Method {
	case "initialize":
		s.writeResult(req.ID, InitializeResult{
			ProtocolVersion: protocolVersion,
			ServerInfo:      ServerInfo{Name: "pushci", Version: s.version},
			Capabilities:    Capabilities{Tools: &ToolsCap{}},
		})
	case "notifications/initialized":
		// Client acknowledgment, no response needed.
	case "tools/list":
		s.writeResult(req.ID, ToolsListResult{Tools: AllTools()})
	case "tools/call":
		s.handleToolCall(req)
	default:
		s.writeError(req.ID, -32601, "method not found: "+req.Method)
	}
}

func (s *Server) handleToolCall(req JsonRpcRequest) {
	var params ToolCallParams
	if err := json.Unmarshal(req.Params, &params); err != nil {
		s.writeError(req.ID, -32602, "invalid params")
		return
	}
	result := HandleToolCall(params)
	s.writeResult(req.ID, result)
}

func (s *Server) writeResult(id json.RawMessage, result any) {
	resp := JsonRpcResponse{Jsonrpc: "2.0", ID: id, Result: result}
	s.send(resp)
}

func (s *Server) writeError(id json.RawMessage, code int, msg string) {
	resp := JsonRpcResponse{
		Jsonrpc: "2.0", ID: id,
		Error: &RpcError{Code: code, Message: msg},
	}
	s.send(resp)
}

func (s *Server) send(resp JsonRpcResponse) {
	data, err := json.Marshal(resp)
	if err != nil {
		log.Printf("mcp: marshal error: %v", err)
		return
	}
	fmt.Fprintf(s.writer, "%s\n", data)
}
