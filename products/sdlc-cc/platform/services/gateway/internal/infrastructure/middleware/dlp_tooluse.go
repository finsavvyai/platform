// Helpers for Claude Team C1: tool_use payload-aware audit
// categorization. The DLP detector already finds PII inside
// `tool_use` content blocks because it scans the raw JSON body, but
// security teams want those detections tagged separately so they
// can filter "PII the model received" from "PII the model emitted
// inside a function call".
//
// The helpers in this file scan the request body for tool_use
// markers and report whether any byte ranges of the body live
// inside a tool_use input object. emitAudit consumes the result.
package middleware

import (
	"bytes"
)

// hasToolUseBlock returns true when body contains an Anthropic
// content block of type `tool_use`. It does NOT parse JSON — that
// would slow the DLP hot path. Instead it does a substring probe
// that costs O(n) and is only used to decide an audit tag.
//
// False positives are acceptable here: tagging an audit row
// `target_type=tool_use` when the body merely *mentions* the string
// `"tool_use"` is preferable to missing actual tool calls. The
// classifier exists for filtering, not enforcement.
func hasToolUseBlock(body []byte) bool {
	// Look for `"type":"tool_use"` allowing optional whitespace
	// around the colon, since both encoders are common in the wild.
	patterns := [][]byte{
		[]byte(`"type":"tool_use"`),
		[]byte(`"type": "tool_use"`),
		[]byte(`"type" :"tool_use"`),
		[]byte(`"type" : "tool_use"`),
	}
	for _, p := range patterns {
		if bytes.Contains(body, p) {
			return true
		}
	}
	return false
}

// auditTarget returns the audit row's target_type for a DLP
// detection. The default is "endpoint"; bodies that contain a
// tool_use block report "tool_use" so admins can split filter
// queries by surface.
func auditTarget(body []byte) string {
	if hasToolUseBlock(body) {
		return "tool_use"
	}
	return "endpoint"
}
