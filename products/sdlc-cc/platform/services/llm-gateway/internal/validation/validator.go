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

// compilePatterns compiles regex patterns for use by prompt defender and response sanitizer
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
