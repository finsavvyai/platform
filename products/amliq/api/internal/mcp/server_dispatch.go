package mcp

import "encoding/json"

func (s *Server) handleListTools(req JSONRPCRequest) JSONRPCResponse {
	defs := allToolDefs()
	return successResp(req.ID, map[string]interface{}{"tools": defs})
}

func (s *Server) handleToolCall(req JSONRPCRequest) JSONRPCResponse {
	var call struct {
		Name      string          `json:"name"`
		Arguments json.RawMessage `json:"arguments"`
	}
	if err := json.Unmarshal(req.Params, &call); err != nil {
		return errorResp(req.ID, -32602, "invalid params")
	}
	handler, ok := s.tools[call.Name]
	if !ok {
		return errorResp(req.ID, -32602, "unknown tool: "+call.Name)
	}
	result, err := handler(call.Arguments)
	if err != nil {
		return errorResp(req.ID, -32000, err.Error())
	}
	content := []map[string]interface{}{
		{"type": "text", "text": mustJSON(result)},
	}
	return successResp(req.ID, map[string]interface{}{
		"content": content,
	})
}

func successResp(id string, data interface{}) JSONRPCResponse {
	raw, _ := json.Marshal(data)
	return JSONRPCResponse{JSONRPC: "2.0", ID: id, Result: raw}
}

func errorResp(id string, code int, msg string) JSONRPCResponse {
	return JSONRPCResponse{
		JSONRPC: "2.0", ID: id,
		Error: &JSONRPCError{Code: code, Message: msg},
	}
}

func mustJSON(v interface{}) string {
	b, _ := json.Marshal(v)
	return string(b)
}
