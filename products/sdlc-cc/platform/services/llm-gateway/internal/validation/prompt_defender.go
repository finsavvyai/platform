package validation

import (
	"regexp"
	"strings"

	"github.com/SDLC/llm-gateway/pkg/models"
)

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
		for _, pattern := range d.bannedPatterns {
			if pattern.MatchString(msg.Content) {
				detectedPatterns = append(detectedPatterns, pattern.String())
			}
		}
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
		for _, pattern := range d.injectionPatterns {
			sanitizedMsg.Content = pattern.ReplaceAllStringFunc(sanitizedMsg.Content, func(match string) string {
				return strings.Repeat("*", len(match))
			})
		}
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
