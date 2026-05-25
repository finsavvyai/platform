package clawpipe

import "os"

// CheapMode reports whether cost-optimized routing is enabled. Set
// PIPEWARDEN_CHEAP_MODE=1 to opt in. When enabled, model routing prefers
// gemini-flash and deepseek over Claude for tasks where the cheaper model
// is known-good (low/medium-severity triage, quick scans, summarization).
//
// Critical-severity findings still route to Claude — cheap models lose
// meaningfully on hard adversarial reasoning + long-context coherence,
// and a missed critical is more expensive than the model spend saved.
func CheapMode() bool {
	v := os.Getenv("PIPEWARDEN_CHEAP_MODE")
	return v == "1" || v == "true"
}

// ModelForSeverityCheap returns the cheapest model that still meets the
// quality bar for the given severity. Returns the same model as the
// premium router for "critical" so adversarial findings keep frontier
// reasoning. Aliases (gemini-flash, deepseek-chat) are resolved to actual
// providers by the OpenSyber claw-sdk in resolveModel().
func ModelForSeverityCheap(severity string) string {
	switch severity {
	case "critical":
		return "claude-opus" // never downgrade frontier reasoning
	case "high":
		return "deepseek-chat" // V3 matches GPT-4o on benchmarks; ~20× cheaper than Sonnet
	case "medium":
		return "gemini-2.0-flash" // 40× cheaper than Sonnet, multi-modal
	case "low", "info":
		return "gemini-2.0-flash"
	default:
		return "gemini-2.0-flash"
	}
}

// ModelForAnalysisTypeCheap returns the cheapest model that still meets
// the quality bar for the given analysis type.
func ModelForAnalysisTypeCheap(analysisType string) string {
	switch analysisType {
	case "heuristic":
		return "" // rule-based, no AI call
	case "quick":
		return "gemini-2.0-flash" // fastest + cheapest hosted
	case "full":
		return "deepseek-chat" // capable analysis at low cost
	case "deep":
		return "claude-opus" // adversarial pipelines deserve frontier model
	default:
		return "gemini-2.0-flash"
	}
}

// PickModel is the unified routing entrypoint. It picks the right model
// based on (severity, analysisType) and the global cheap-mode flag. When
// both severity and analysisType are set, severity wins for "critical"
// (always frontier) and analysisType wins otherwise.
func PickModel(severity, analysisType string) string {
	cheap := CheapMode()
	if severity == "critical" {
		// Always frontier on critical, regardless of mode or analysis type.
		return "claude-opus"
	}
	if analysisType != "" {
		if cheap {
			return ModelForAnalysisTypeCheap(analysisType)
		}
		return ModelForAnalysisType(analysisType)
	}
	if cheap {
		return ModelForSeverityCheap(severity)
	}
	return ModelForSeverity(severity)
}
