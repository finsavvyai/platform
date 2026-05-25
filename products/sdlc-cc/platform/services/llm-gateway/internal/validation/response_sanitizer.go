package validation

import (
	"regexp"

	"github.com/SDLC/llm-gateway/pkg/models"
)

// DefaultResponseSanitizer provides default response sanitization
type DefaultResponseSanitizer struct {
	piiPatterns       []*regexp.Regexp
	harmfulPatterns   []*regexp.Regexp
	maxResponseLength int
}

// NewDefaultResponseSanitizer creates a new default response sanitizer
func NewDefaultResponseSanitizer(maxResponseLength int) *DefaultResponseSanitizer {
	return &DefaultResponseSanitizer{
		piiPatterns: compilePatterns([]string{
			`\b\d{3}-\d{2}-\d{4}\b`,                                    // SSN
			`\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b`,               // Credit card
			`\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b`,      // Email
			`\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}`, // Phone
		}),
		harmfulPatterns: compilePatterns([]string{
			`(?i)(hate|kill|harm|hurt|violence)`,
			`(?i)(illegal|criminal|unlawful)`,
		}),
		maxResponseLength: maxResponseLength,
	}
}

// SanitizeResponse sanitizes a response to remove harmful content
func (s *DefaultResponseSanitizer) SanitizeResponse(resp *models.CompletionResponse) *models.CompletionResponse {
	sanitizedResp := *resp
	sanitizedResp.Choices = make([]models.Choice, len(resp.Choices))

	for i, choice := range resp.Choices {
		sanitizedChoice := choice
		sanitizedChoice.Message.Content = s.sanitizeText(choice.Message.Content)
		if len(sanitizedChoice.Message.Content) > s.maxResponseLength {
			sanitizedChoice.Message.Content = sanitizedChoice.Message.Content[:s.maxResponseLength] + "..."
			sanitizedChoice.FinishReason = "length"
		}
		sanitizedResp.Choices[i] = sanitizedChoice
	}

	if sanitizedResp.Metadata == nil {
		sanitizedResp.Metadata = make(map[string]string)
	}
	sanitizedResp.Metadata["sanitization_level"] = "standard"
	return &sanitizedResp
}

// ContainsPii detects if a response contains PII
func (s *DefaultResponseSanitizer) ContainsPii(text string) bool {
	for _, pattern := range s.piiPatterns {
		if pattern.MatchString(text) {
			return true
		}
	}
	return false
}

// RedactPii redacts PII from text
func (s *DefaultResponseSanitizer) RedactPii(text string) string {
	for _, pattern := range s.piiPatterns {
		text = pattern.ReplaceAllStringFunc(text, func(match string) string {
			return "[REDACTED]"
		})
	}
	return text
}

// ValidateResponse validates if a response is safe
func (s *DefaultResponseSanitizer) ValidateResponse(resp *models.CompletionResponse) error {
	for _, choice := range resp.Choices {
		for _, pattern := range s.harmfulPatterns {
			if pattern.MatchString(choice.Message.Content) {
				return ErrHarmfulContent
			}
		}
		if len(choice.Message.Content) > s.maxResponseLength {
			return ErrResponseTooLong
		}
	}
	return nil
}

func (s *DefaultResponseSanitizer) sanitizeText(text string) string {
	text = s.RedactPii(text)
	for _, pattern := range s.harmfulPatterns {
		text = pattern.ReplaceAllStringFunc(text, func(match string) string {
			return "[HARMFUL_CONTENT_REMOVED]"
		})
	}
	return text
}
