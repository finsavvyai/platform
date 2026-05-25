package http

import (
	"strings"
	"testing"
)

func TestScrubJSON_Strings(t *testing.T) {
	got := ScrubJSON("card 4111-1111-1111-1111 was used")
	if strings.Contains(got.(string), "4111-1111-1111-1111") {
		t.Errorf("PAN leaked: %v", got)
	}
}

func TestScrubJSON_NestedMap(t *testing.T) {
	in := map[string]interface{}{
		"customer": "John Doe",
		"ein":      "12-3456789",
		"deep": map[string]interface{}{
			"pan":  "4111-1111-1111-1111",
			"iban": "DE89370400440532013000",
		},
	}
	out := ScrubJSON(in).(map[string]interface{})
	deep := out["deep"].(map[string]interface{})
	if strings.Contains(deep["pan"].(string), "4111-1111-1111-1111") {
		t.Errorf("nested PAN leaked: %v", deep["pan"])
	}
	if strings.Contains(deep["iban"].(string), "DE89370400440532013000") {
		t.Errorf("nested IBAN leaked: %v", deep["iban"])
	}
}

func TestScrubJSON_Array(t *testing.T) {
	in := []interface{}{
		"4111-1111-1111-1111",
		map[string]interface{}{"x": "DE89370400440532013000"},
	}
	out := ScrubJSON(in).([]interface{})
	if strings.Contains(out[0].(string), "4111-1111-1111-1111") {
		t.Error("array string PAN leaked")
	}
	if strings.Contains(
		out[1].(map[string]interface{})["x"].(string),
		"DE89370400440532013000",
	) {
		t.Error("array map IBAN leaked")
	}
}

func TestScrubJSON_PreservesNonStrings(t *testing.T) {
	in := map[string]interface{}{
		"max_tokens":  float64(1000),
		"temperature": 0.7,
		"stream":      true,
		"top_k":       nil,
	}
	out := ScrubJSON(in).(map[string]interface{})
	if out["max_tokens"] != float64(1000) || out["temperature"] != 0.7 ||
		out["stream"] != true || out["top_k"] != nil {
		t.Errorf("non-string values mutated: %v", out)
	}
}

// TestScrubMessagesPayload_ToolUse is the load-bearing case for the
// Cowork pitch. A Cowork agent calling D&B with an EIN in tool_use
// input would leak that EIN to Anthropic without this scrub.
func TestScrubMessagesPayload_ToolUse(t *testing.T) {
	payload := map[string]interface{}{
		"model":      "claude-sonnet-4",
		"max_tokens": float64(1024),
		"system":     "You are an analyst. Customer card 4111-1111-1111-1111 is the test.",
		"messages": []interface{}{
			map[string]interface{}{
				"role": "assistant",
				"content": []interface{}{
					map[string]interface{}{
						"type": "tool_use",
						"id":   "tool_call_1",
						"name": "lookup_company",
						"input": map[string]interface{}{
							"name":          "Acme Corp",
							"iban":          "DE89370400440532013000",
							"contact_card":  "5555-5555-5555-4444",
							"israeli_id":    "123456782",
						},
					},
				},
			},
		},
	}
	out := ScrubMessagesPayload(payload)

	system := out["system"].(string)
	if strings.Contains(system, "4111-1111-1111-1111") {
		t.Error("system PAN leaked")
	}

	msgs := out["messages"].([]interface{})
	content := msgs[0].(map[string]interface{})["content"].([]interface{})
	tu := content[0].(map[string]interface{})
	input := tu["input"].(map[string]interface{})
	if strings.Contains(input["iban"].(string), "DE89370400440532013000") {
		t.Errorf("tool_use IBAN leaked: %v", input["iban"])
	}
	if strings.Contains(input["contact_card"].(string), "5555-5555-5555-4444") {
		t.Errorf("tool_use PAN leaked: %v", input["contact_card"])
	}
	if strings.Contains(input["israeli_id"].(string), "123456782") {
		t.Errorf("tool_use Israeli ID leaked: %v", input["israeli_id"])
	}

	// Scrub leaves the tool name + id alone (those aren't PII)
	if tu["name"] != "lookup_company" || tu["id"] != "tool_call_1" {
		t.Errorf("structural fields mutated: %v", tu)
	}
}
