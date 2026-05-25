package clawpipe

// ModelForSeverity returns the optimal Claude model based on finding severity.
// Critical and high-severity findings warrant more capable models for comprehensive analysis.
// Medium and low-severity findings can use faster, cheaper models.
func ModelForSeverity(severity string) string {
	switch severity {
	case "critical":
		return "claude-opus"
	case "high":
		return "claude-sonnet"
	case "medium":
		return "claude-sonnet"
	case "low", "info":
		return "claude-haiku"
	default:
		return "claude-sonnet"
	}
}

// ModelForAnalysisType returns the optimal Claude model based on analysis type.
// Heuristic analysis doesn't need AI, quick scans use fast models, full analysis uses capable models.
func ModelForAnalysisType(analysisType string) string {
	switch analysisType {
	case "heuristic":
		// Heuristic analysis uses rule-based checking, not AI
		return ""
	case "quick":
		// Quick scan for fast feedback
		return "claude-haiku"
	case "full":
		// Comprehensive analysis
		return "claude-sonnet"
	case "deep":
		// In-depth analysis for critical pipelines
		return "claude-opus"
	default:
		return "claude-sonnet"
	}
}
