package api

import (
	"fmt"

	"github.com/aegis-aml/aegis/internal/security"
)

// prepareAISummaryInput validates type, sanitizes free text, redacts
// PII via existing pii_mask helpers, then formats the prompt template.
// Returning early keeps invalid payloads out of the LLM call entirely
// and out of the audit log (we only audit calls that reached the LLM).
func prepareAISummaryInput(req AISummaryRequest) (summarizeInput, error) {
	if req.Text == "" {
		return summarizeInput{}, fmt.Errorf("text is required")
	}
	if !validSummaryType(req.Type) {
		return summarizeInput{}, fmt.Errorf("type must be alert, adverse_media, or case")
	}
	cleaned := security.SanitizeName(req.Text)
	cleaned = security.MaskAML(cleaned)
	cleaned = security.MaxLength(cleaned, maxAITextChars)
	if cleaned == "" {
		return summarizeInput{}, fmt.Errorf("text empty after sanitization")
	}
	prompt := fmt.Sprintf(aiSummaryPrompts[req.Type], cleaned)
	return summarizeInput{cleaned: cleaned, prompt: prompt}, nil
}
