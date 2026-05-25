package mcp

import (
	"bufio"
	"encoding/json"
	"io"
	"log"

	"github.com/aegis-aml/aegis/internal/monitoring"
	"github.com/aegis-aml/aegis/internal/screening"
)

// Server handles MCP JSON-RPC requests over stdio.
type Server struct {
	tools     map[string]ToolHandler
	engine    *screening.Engine
	index     *screening.SearchIndex
	registrar monitoring.Registrar
}

// ToolHandler processes a single MCP tool call.
type ToolHandler func(params json.RawMessage) (interface{}, error)

// NewServer creates an MCP server wired to real screening. The
// returned server uses an in-memory monitoring registrar; replace via
// SetRegistrar before serving traffic in environments that need
// persistence.
func NewServer(engine *screening.Engine, idx *screening.SearchIndex) *Server {
	s := &Server{
		tools:     make(map[string]ToolHandler),
		engine:    engine,
		index:     idx,
		registrar: monitoring.NewMemRegistrar(),
	}
	registerScreenHandlers(s)
	registerRiskHandlers(s)
	return s
}

// SetRegistrar overrides the default in-memory monitoring registrar.
// Call before traffic begins; not safe for concurrent swap.
func (s *Server) SetRegistrar(r monitoring.Registrar) { s.registrar = r }

// Handle routes a JSON-RPC request to the appropriate handler.
func (s *Server) Handle(req JSONRPCRequest) JSONRPCResponse {
	switch req.Method {
	case "initialize":
		return s.handleInit(req)
	case "tools/list":
		return s.handleListTools(req)
	case "tools/call":
		return s.handleToolCall(req)
	default:
		return errorResp(req.ID, -32601, "method not found")
	}
}

func (s *Server) handleInit(req JSONRPCRequest) JSONRPCResponse {
	result := map[string]interface{}{
		"protocolVersion": "2024-11-05",
		"capabilities":    map[string]interface{}{"tools": map[string]bool{}},
		"serverInfo": map[string]string{
			"name": "amliq-screening", "version": "2.0.0",
		},
	}
	return successResp(req.ID, result)
}

// RunStdio reads JSON-RPC from reader and writes responses to writer.
func (s *Server) RunStdio(r io.Reader, w io.Writer) error {
	scanner := bufio.NewScanner(r)
	scanner.Buffer(make([]byte, 0, 1024*1024), 1024*1024)
	for scanner.Scan() {
		var msg JSONRPCRequest
		if err := json.Unmarshal(scanner.Bytes(), &msg); err != nil {
			resp := errorResp("", -32700, "parse error")
			writeResp(w, resp)
			continue
		}
		resp := s.Handle(msg)
		writeResp(w, resp)
	}
	if err := scanner.Err(); err != nil {
		log.Printf("mcp: stdin error: %v", err)
		return err
	}
	return nil
}

func writeResp(w io.Writer, resp JSONRPCResponse) {
	out, _ := json.Marshal(resp)
	w.Write(append(out, '\n'))
}
