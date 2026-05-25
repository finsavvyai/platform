package validation

import (
	"context"
	"regexp"
	"strings"

	"github.com/SDLC/llm-gateway/pkg/models"
)

// Validator defines the interface for request validation
type Validator interface {
	// ValidateRequest validates a completion request
	ValidateRequest(req *models.CompletionRequest) error

	// ValidateModel validates if a model is supported
	ValidateModel(model string) error

	// ValidateUser validates if a user is allowed to make requests
	ValidateUser(ctx context.Context, userID, tenantID string) error
}

// PromptDefender defines the interface for prompt injection defense
type PromptDefender interface {
	// DetectPromptInjection detects if a prompt contains injection attempts
	DetectPromptInjection(req *models.CompletionRequest) (bool, []string)

	// SanitizePrompt sanitizes a prompt to remove injection attempts
	SanitizePrompt(req *models.CompletionRequest) *models.CompletionRequest

	// AddBannedPattern adds a new banned pattern
	AddBannedPattern(pattern string) error

	// RemoveBannedPattern removes a banned pattern
	RemoveBannedPattern(pattern string) error
}

// ResponseSanitizer defines the interface for response sanitization
type ResponseSanitizer interface {
	// SanitizeResponse sanitizes a response to remove harmful content
	SanitizeResponse(resp *models.CompletionResponse) *models.CompletionResponse

	// ContainsPii detects if a response contains PII
	ContainsPii(text string) bool

	// RedactPii redacts PII from text
	RedactPii(text string) string

	// ValidateResponse validates if a response is safe
	ValidateResponse(resp *models.CompletionResponse) error
}

// DefaultValidator provides default validation implementation
type DefaultValidator struct {
	maxPromptLength int
	maxMessages     int
	bannedModels    []string
}

// NewDefaultValidator creates a new default validator
func NewDefaultValidator(maxPromptLength, maxMessages int, bannedModels []string) *DefaultValidator {
	return &DefaultValidator{
		maxPromptLength: maxPromptLength,
		maxMessages:     maxMessages,
		bannedModels:    bannedModels,
	}
}

// ValidateRequest validates a completion request
func (v *DefaultValidator) ValidateRequest(req *models.CompletionRequest) error {
	// Check if messages are provided
	if len(req.Messages) == 0 {
		return ErrNoMessages
	}

	// Check message limit
	if len(req.Messages) > v.maxMessages {
		return ErrTooManyMessages
	}

	// Check prompt length
	totalLength := 0
	for _, msg := range req.Messages {
		totalLength += len(msg.Content)
	}

	if totalLength > v.maxPromptLength {
		return ErrPromptTooLong
	}

	// Validate each message
	for _, msg := range req.Messages {
		if msg.Role != "system" && msg.Role != "user" && msg.Role != "assistant" {
			return ErrInvalidRole
		}

		if strings.TrimSpace(msg.Content) == "" {
			return ErrEmptyMessage
		}
	}

	// Validate temperature
	if req.Temperature < 0 || req.Temperature > 2 {
		return ErrInvalidTemperature
	}

	// Validate top_p
	if req.TopP < 0 || req.TopP > 1 {
		return ErrInvalidTopP
	}

	// Validate max_tokens
	if req.MaxTokens < 1 || req.MaxTokens > 32000 {
		return ErrInvalidMaxTokens
	}

	return nil
}

// ValidateModel validates if a model is supported
func (v *DefaultValidator) ValidateModel(model string) error {
	for _, banned := range v.bannedModels {
		if model == banned {
			return ErrModelBanned
		}
	}
	return nil
}

// ValidateUser validates if a user is allowed to make requests
func (v *DefaultValidator) ValidateUser(ctx context.Context, userID, tenantID string) error {
	if userID == "" {
		return ErrInvalidUserID
	}

	if tenantID == "" {
		return ErrInvalidTenantID
	}

	return nil
}

// DefaultPromptDefender provides default prompt injection defense
type DefaultPromptDefender struct {
	bannedPatterns    []*regexp.Regexp
	injectionPatterns []*regexp.Regexp
}

// NewDefaultPromptDefender creates a new default prompt defender
func NewDefaultPromptDefender() *DefaultPromptDefender {
	return &DefaultPromptDefender{
		bannedPatterns: compilePatterns([]string{
			`(?i)password\s*[:=]\s*\S+`,
			`(?i)api\s*key\s*[:=]\s*\S+`,
			`(?i)secret\s*[:=]\s*\S+`,
			`(?i)token\s*[:=]\s*\S+`,
		}),
		injectionPatterns: compilePatterns([]string{
			`(?i)ignore\s+(previous|all)\s+instructions`,
			`(?i)disregard\s+(previous|all)\s+instructions`,
			`(?i)new\s+(role|character|instruction)`,
			`(?i)act\s+as\s+(if\s+)?you\s+are`,
			`(?i)pretend\s+(to\s+be)?`,
			`(?i)system\s*:\s*you\s+are`,
			`(?i)override\s+(your\s+)?programming`,
			`(?i)bypass\s+(your\s+)?restrictions`,
			`(?i)jailbreak`,
			`(?i)dAN\s*gerous`,
		}),
	}
}

// DetectPromptInjection detects if a prompt contains injection attempts
func (d *DefaultPromptDefender) DetectPromptInjection(req *models.CompletionRequest) (bool, []string) {
	var detectedPatterns []string

	for _, msg := range req.Messages {
		// Check for banned patterns
		for _, pattern := range d.bannedPatterns {
			if pattern.MatchString(msg.Content) {
				detectedPatterns = append(detectedPatterns, pattern.String())
			}
		}

		// Check for injection patterns
		for _, pattern := range d.injectionPatterns {
			if pattern.MatchString(msg.Content) {
				detectedPatterns = append(detectedPatterns, pattern.String())
			}
		}
	}

	return len(detectedPatterns) > 0, detectedPatterns
}

// SanitizePrompt sanitizes a prompt to remove injection attempts
func (d *DefaultPromptDefender) SanitizePrompt(req *models.CompletionRequest) *models.CompletionRequest {
	sanitizedReq := *req
	sanitizedReq.Messages = make([]models.Message, len(req.Messages))

	for i, msg := range req.Messages {
		sanitizedMsg := msg

		// Remove or replace detected patterns
		for _, pattern := range d.injectionPatterns {
			sanitizedMsg.Content = pattern.ReplaceAllStringFunc(sanitizedMsg.Content, func(match string) string {
				return strings.Repeat("*", len(match))
			})
		}

		// Remove sensitive information
		for _, pattern := range d.bannedPatterns {
			sanitizedMsg.Content = pattern.ReplaceAllStringFunc(sanitizedMsg.Content, func(match string) string {
				return "[REDACTED]"
			})
		}

		sanitizedReq.Messages[i] = sanitizedMsg
	}

	return &sanitizedReq
}

// AddBannedPattern adds a new banned pattern
func (d *DefaultPromptDefender) AddBannedPattern(pattern string) error {
	regex, err := regexp.Compile(pattern)
	if err != nil {
		return err
	}

	d.bannedPatterns = append(d.bannedPatterns, regex)
	return nil
}

// RemoveBannedPattern removes a banned pattern
func (d *DefaultPromptDefender) RemoveBannedPattern(pattern string) error {
	regex, err := regexp.Compile(pattern)
	if err != nil {
		return err
	}

	for i, p := range d.bannedPatterns {
		if p.String() == regex.String() {
			d.bannedPatterns = append(d.bannedPatterns[:i], d.bannedPatterns[i+1:]...)
			return nil
		}
	}

	return nil
}

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

		// Truncate if too long
		if len(sanitizedChoice.Message.Content) > s.maxResponseLength {
			sanitizedChoice.Message.Content = sanitizedChoice.Message.Content[:s.maxResponseLength] + "..."
			sanitizedChoice.FinishReason = "length"
		}

		sanitizedResp.Choices[i] = sanitizedChoice
	}

	// Update metadata
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
		// Check for harmful content
		for _, pattern := range s.harmfulPatterns {
			if pattern.MatchString(choice.Message.Content) {
				return ErrHarmfulContent
			}
		}

		// Check for excessive length
		if len(choice.Message.Content) > s.maxResponseLength {
			return ErrResponseTooLong
		}
	}

	return nil
}

// sanitizeText sanitizes text by removing or replacing harmful content
func (s *DefaultResponseSanitizer) sanitizeText(text string) string {
	// Redact PII
	text = s.RedactPii(text)

	// Replace harmful content with warnings
	for _, pattern := range s.harmfulPatterns {
		text = pattern.ReplaceAllStringFunc(text, func(match string) string {
			return "[HARMFUL_CONTENT_REMOVED]"
		})
	}

	return text
}

// Helper function to compile regex patterns
func compilePatterns(patterns []string) []*regexp.Regexp {
	var compiled []*regexp.Regexp

	for _, pattern := range patterns {
		regex, err := regexp.Compile(pattern)
		if err == nil {
			compiled = append(compiled, regex)
		}
	}

	return compiled
}

// Validation errors
var (
	ErrNoMessages         = NewValidationError("no messages provided")
	ErrTooManyMessages    = NewValidationError("too many messages")
	ErrPromptTooLong      = NewValidationError("prompt too long")
	ErrInvalidRole        = NewValidationError("invalid message role")
	ErrEmptyMessage       = NewValidationError("empty message content")
	ErrInvalidTemperature = NewValidationError("temperature must be between 0 and 2")
	ErrInvalidTopP        = NewValidationError("top_p must be between 0 and 1")
	ErrInvalidMaxTokens   = NewValidationError("max_tokens must be between 1 and 32000")
	ErrModelBanned        = NewValidationError("model is banned")
	ErrInvalidUserID      = NewValidationError("invalid user ID")
	ErrInvalidTenantID    = NewValidationError("invalid tenant ID")
	ErrHarmfulContent     = NewValidationError("response contains harmful content")
	ErrResponseTooLong    = NewValidationError("response is too long")
)

// ValidationError represents a validation error
type ValidationError struct {
	Message string
}

// NewValidationError creates a new validation error
func NewValidationError(message string) *ValidationError {
	return &ValidationError{Message: message}
}

// Error returns the error message
func (e *ValidationError) Error() string {
	return e.Message
}
