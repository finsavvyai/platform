package http

import (
	"github.com/finsavvyai/sdlc-core/dlp"
)

// ScrubJSON walks a parsed JSON value and runs MaskAML on every
// string leaf. Catches PII regardless of where it sits — text
// content, tool_use input args, tool_result content, system prompt,
// nested object values inside MCP tool calls.
//
// Why blanket-scrub: Cowork agents shape tool_use payloads with
// caller-defined keys (D&B might use "ein", Moody's might use
// "issuer_id"). We can't know each tool's schema; scrubbing every
// string is the safe default. False positives are rare because
// MaskAML uses check-digit validation (Luhn for PAN, mod-97 for
// IBAN, mod-10 for Israeli ID), so an arbitrary 16-digit invoice
// number won't get redacted.
//
// In-place mutation: callers pass parsed json; we rewrite leaves.
// Result is the same value (slices/maps are reference types in Go).
func ScrubJSON(v interface{}) interface{} {
	switch x := v.(type) {
	case string:
		return dlp.MaskAML(x)
	case []interface{}:
		for i, elem := range x {
			x[i] = ScrubJSON(elem)
		}
		return x
	case map[string]interface{}:
		for k, elem := range x {
			x[k] = ScrubJSON(elem)
		}
		return x
	default:
		// Numbers, bools, nil — pass through. JSON has no other
		// scalar types after json.Unmarshal.
		return v
	}
}

// ScrubMessagesPayload is the entry point the handler calls. It
// targets the high-value fields of an Anthropic Messages API
// request — system prompt, messages array (each with content
// that may be string or block array) — without rewriting other
// top-level fields like model, max_tokens, temperature.
//
// Returns the same payload pointer; safe to call before re-marshal
// + provider call.
func ScrubMessagesPayload(payload map[string]interface{}) map[string]interface{} {
	if sys, ok := payload["system"].(string); ok {
		payload["system"] = dlp.MaskAML(sys)
	}
	if sysBlocks, ok := payload["system"].([]interface{}); ok {
		payload["system"] = ScrubJSON(sysBlocks)
	}
	if msgs, ok := payload["messages"].([]interface{}); ok {
		payload["messages"] = ScrubJSON(msgs)
	}
	return payload
}
