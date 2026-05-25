package sdln

import (
	"context"
	"fmt"
	"regexp"
	"strings"
	"time"
)

// PromptDefenseService provides protection against prompt injection attacks
type PromptDefenseService struct {
	*BaseService
	injectionPatterns map[string]*regexp.Regexp
	mlDetector        *MLInjectionDetector
	config            *PromptDefenseConfig
}

// PromptDefenseConfig holds configuration for prompt defense
type PromptDefenseConfig struct {
	EnableMLDetection  bool     `json:"enable_ml_detection"`
	StrictMode         bool     `json:"strict_mode"`
	MaxPromptLength    int      `json:"max_prompt_length"`
	AllowedRoles       []string `json:"allowed_roles"`
	BlockedPatterns    []string `json:"blocked_patterns"`
	EnableContextCheck bool     `json:"enable_context_check"`
	EnableRateLimit    bool     `json:"enable_rate_limit"`
	RateLimitPerMinute int      `json:"rate_limit_per_minute"`
}

// NewPromptDefenseService creates a new prompt defense service
func NewPromptDefenseService(client *Client) *PromptDefenseService {
	service := &PromptDefenseService{
		BaseService:       NewBaseService(client, "prompt-defense", "api/v1/prompt-defense"),
		injectionPatterns: make(map[string]*regexp.Regexp),
		config: &PromptDefenseConfig{
			EnableMLDetection:  true,
			StrictMode:         false,
			MaxPromptLength:    10000,
			AllowedRoles:       []string{"user", "assistant"},
			EnableContextCheck: true,
			EnableRateLimit:    true,
			RateLimitPerMinute: 60,
		},
	}

	// Initialize injection detection patterns
	service.initializeInjectionPatterns()

	// Initialize ML detector
	service.mlDetector = NewMLInjectionDetector(client)

	return service
}

// initializeInjectionPatterns sets up regex patterns for common injection attacks
func (s *PromptDefenseService) initializeInjectionPatterns() {
	patterns := map[string]string{
		// System prompt manipulation
		"ignore_previous": `(?i)(ignore|forget|disregard).*(previous|above|earlier).*(instructions|prompts|rules)`,
		"system_prompt":   `(?i)(you are|act as|pretend to be|role:|system:).*(not|no longer|don't).*(an? )?(ai|assistant|language model)`,
		"role_playing":    `(?i)(role:|character:|persona:|act as|pretend).*(jailbreak|ignore|bypass|break)`,

		// Instruction override
		"instruction_override": `(?i)(new instructions:|instead,|rather,|actually,|change your instructions)`,
		"override_directive":   `(?i)(from now on|for the rest of this conversation|going forward).*(ignore|don't|never)`,

		// Code injection
		"code_execution":  `(?i)(execute|run|eval|exec|system\(|shell\(|subprocess\()`,
		"file_operations": `(?i)(read|write|open|save|delete|create|remove).*(file|directory|folder)`,
		"network_access":  `(?i)(curl|wget|http|https|ftp|ssh|telnet|connect)`,

		// Context overflow
		"context_overflow": `(?i)(repeat|copy|echo|return).*(previous|above|earlier).*(conversation|dialogue|text)`,
		"prompt_leak":      `(?i)(show|reveal|display|print).*(prompt|instruction|system)`,

		// Social engineering
		"emergency":       `(?i)(emergency|urgent|critical|important|immediate).*(help|assist|respond)`,
		"authority_claim": `(?i)(i am|we are|this is).*(developer|admin|creator|owner|openai|anthropic)`,
		"threat":          `(?i)(will be|you will be|i will).*(fired|deleted|terminated|shut down|punished)`,

		// Jailbreak attempts
		"dan_mode":   `(?i)(dan|do anything now|jailbreak|bypass|override)`,
		"hypnosis":   `(?i)(hypnotize|trance|sleep|awaken).*(you are|you're)`,
		"simulation": `(?i)(this is a|imagine|pretend).*(simulation|game|story|fiction)`,

		// Information extraction
		"training_data":  `(?i)(tell me about|what do you know|show me).*(your training|training data)`,
		"internal_state": `(?i)(what are your|show me your).*(parameters|weights|settings|configuration)`,
	}

	for name, pattern := range patterns {
		regex, err := regexp.Compile(pattern)
		if err == nil {
			s.injectionPatterns[name] = regex
		}
	}
}

// SanitizePrompt sanitizes a prompt to remove injection attempts
func (s *PromptDefenseService) SanitizePrompt(ctx context.Context, prompt string, userID *string) (*SanitizedPrompt, error) {
	startTime := time.Now()

	result := &SanitizedPrompt{
		OriginalPrompt:  prompt,
		SanitizedPrompt: prompt,
		RiskLevel:       "low",
		Warnings:        []string{},
		Actions:         []string{},
	}

	// Check prompt length
	if len(prompt) > s.config.MaxPromptLength {
		result.RiskLevel = "high"
		result.Warnings = append(result.Warnings, fmt.Sprintf("Prompt length exceeds limit (%d > %d)", len(prompt), s.config.MaxPromptLength))
		result.SanitizedPrompt = prompt[:s.config.MaxPromptLength]
		result.Actions = append(result.Actions, "truncated")
	}

	// Check for injection patterns
	for patternName, regex := range s.injectionPatterns {
		matches := regex.FindAllStringIndex(prompt, -1)
		if len(matches) > 0 {
			if result.RiskLevel == "low" {
				result.RiskLevel = "medium"
			}

			result.Warnings = append(result.Warnings, fmt.Sprintf("Detected potential injection: %s", patternName))
			result.Detections = append(result.Detections, InjectionDetection{
				Type:     patternName,
				Matches:  matches,
				Severity: s.getPatternSeverity(patternName),
			})

			// Sanitize by redacting matches
			if s.config.StrictMode || s.isHighSeverityPattern(patternName) {
				result.SanitizedPrompt = s.redactMatches(result.SanitizedPrompt, matches)
				result.RiskLevel = "high"
				result.Actions = append(result.Actions, fmt.Sprintf("redacted_%s", patternName))
			}
		}
	}

	// ML-based detection
	if s.config.EnableMLDetection {
		mlResult, err := s.mlDetector.DetectInjection(ctx, prompt, userID)
		if err == nil && mlResult.IsInjection {
			result.MLDetection = mlResult
			if mlResult.Confidence > 0.8 {
				result.RiskLevel = "critical"
				result.SanitizedPrompt = "[CONTENT_BLOCKED]"
				result.Actions = append(result.Actions, "blocked_ml")
			} else if mlResult.Confidence > 0.6 {
				result.RiskLevel = "high"
				result.Actions = append(result.Actions, "flagged_ml")
			}
		}
	}

	// Contextual analysis
	if s.config.EnableContextCheck {
		contextRisk := s.analyzeContext(prompt)
		if contextRisk > 0.7 {
			if result.RiskLevel == "low" {
				result.RiskLevel = "medium"
			}
			result.Warnings = append(result.Warnings, "Suspicious context detected")
			result.ContextRisk = contextRisk
		}
	}

	// Rate limiting check
	if s.config.EnableRateLimit && userID != nil {
		if s.checkRateLimit(ctx, *userID) {
			result.RiskLevel = "high"
			result.Warnings = append(result.Warnings, "Rate limit exceeded")
			result.Actions = append(result.Actions, "rate_limited")
		}
	}

	result.ProcessingTime = time.Since(startTime)
	result.CreatedAt = NewTimestamp(time.Now())

	return result, nil
}

// ValidateResponse validates an LLM response for potential issues
func (s *PromptDefenseService) ValidateResponse(ctx context.Context, response string, originalPrompt string) (*ValidationResult, error) {
	startTime := time.Now()

	result := &ValidationResult{
		OriginalPrompt: originalPrompt,
		Response:       response,
		IsValid:        true,
		RiskLevel:      "low",
		Issues:         []ResponseIssue{},
		Warnings:       []string{},
	}

	// Check for prompt leakage
	if strings.Contains(response, "As an AI language model") &&
		!strings.Contains(originalPrompt, "As an AI language model") {
		result.IsValid = false
		result.RiskLevel = "high"
		result.Issues = append(result.Issues, ResponseIssue{
			Type:        "prompt_leakage",
			Description: "Response contains default AI refusals",
			Severity:    "high",
		})
	}

	// Check for instruction following violations
	if s.containsInstructionViolation(response, originalPrompt) {
		result.RiskLevel = "medium"
		result.Issues = append(result.Issues, ResponseIssue{
			Type:        "instruction_violation",
			Description: "Response may not follow user instructions",
			Severity:    "medium",
		})
	}

	// Check for PII leakage
	piiFindings, _ := s.detectPIIInResponse(response)
	if len(piiFindings) > 0 {
		result.RiskLevel = "high"
		result.Issues = append(result.Issues, ResponseIssue{
			Type:        "pii_leakage",
			Description: fmt.Sprintf("Response contains %d potential PII instances", len(piiFindings)),
			Severity:    "high",
			Details:     piiFindings,
		})
	}

	// Check for malicious content
	if s.containsMaliciousContent(response) {
		result.IsValid = false
		result.RiskLevel = "critical"
		result.Issues = append(result.Issues, ResponseIssue{
			Type:        "malicious_content",
			Description: "Response contains potentially harmful content",
			Severity:    "critical",
		})
	}

	// Check for hallucinations or factual inconsistencies
	hallucinationScore := s.calculateHallucinationScore(response, originalPrompt)
	if hallucinationScore > 0.8 {
		result.RiskLevel = "medium"
		result.Warnings = append(result.Warnings, "Response may contain hallucinations")
		result.HallucinationScore = hallucinationScore
	}

	result.ProcessingTime = time.Since(startTime)
	result.ValidatedAt = NewTimestamp(time.Now())

	return result, nil
}

// DetectInjection analyzes a prompt for injection attempts
func (s *PromptDefenseService) DetectInjection(ctx context.Context, prompt string, userID *string) (*InjectionResult, error) {
	sanitized, err := s.SanitizePrompt(ctx, prompt, userID)
	if err != nil {
		return nil, err
	}

	result := &InjectionResult{
		IsInjection: sanitized.RiskLevel != "low",
		RiskLevel:   sanitized.RiskLevel,
		Confidence:  s.calculateInjectionConfidence(sanitized),
		Detections:  sanitized.Detections,
		MLScore:     0.0,
		ContextRisk: sanitized.ContextRisk,
	}

	if sanitized.MLDetection != nil {
		result.MLScore = sanitized.MLDetection.Confidence
	}

	// Determine injection type
	if len(sanitized.Detections) > 0 {
		result.InjectionType = s.categorizeInjection(sanitized.Detections)
	}

	return result, nil
}

// Helper methods

func (s *PromptDefenseService) redactMatches(text string, matches [][]int) string {
	if len(matches) == 0 {
		return text
	}

	// Sort matches in reverse order to avoid index shifting
	for i, j := 0, len(matches)-1; i < j; i, j = i+1, j-1 {
		matches[i], matches[j] = matches[j], matches[i]
	}

	result := text
	for _, match := range matches {
		if match[0] >= 0 && match[1] <= len(result) {
			result = result[:match[0]] + "[REDACTED]" + result[match[1]:]
		}
	}

	return result
}

func (s *PromptDefenseService) getPatternSeverity(patternName string) string {
	highSeverityPatterns := []string{
		"system_prompt",
		"code_execution",
		"file_operations",
		"network_access",
		"dan_mode",
		"threat",
	}

	mediumSeverityPatterns := []string{
		"ignore_previous",
		"role_playing",
		"instruction_override",
		"emergency",
		"authority_claim",
	}

	for _, p := range highSeverityPatterns {
		if patternName == p {
			return "high"
		}
	}

	for _, p := range mediumSeverityPatterns {
		if patternName == p {
			return "medium"
		}
	}

	return "low"
}

func (s *PromptDefenseService) isHighSeverityPattern(patternName string) bool {
	return s.getPatternSeverity(patternName) == "high"
}

func (s *PromptDefenseService) analyzeContext(prompt string) float64 {
	// Simple context analysis - in production, this would use more sophisticated NLP
	riskFactors := 0

	// Check for repeated characters
	if regexp.MustCompile(`(.)\1{5,}`).MatchString(prompt) {
		riskFactors++
	}

	// Check for unusual capitalization
	if regexp.MustCompile(`[A-Z]{10,}`).MatchString(prompt) {
		riskFactors++
	}

	// Check for base64 encoded content
	if regexp.MustCompile(`[A-Za-z0-9+/]{20,}={0,2}`).MatchString(prompt) {
		riskFactors++
	}

	// Calculate risk score
	riskScore := float64(riskFactors) / 3.0
	if riskScore > 1.0 {
		riskScore = 1.0
	}

	return riskScore
}

func (s *PromptDefenseService) checkRateLimit(ctx context.Context, userID string) bool {
	// In production, this would check against a rate limiter like Redis
	// For now, return false (no rate limiting)
	return false
}

func (s *PromptDefenseService) containsInstructionViolation(response, prompt string) bool {
	// Simple check for instruction violations
	if strings.Contains(prompt, "step by step") &&
		!strings.Contains(response, "step") &&
		!strings.Contains(response, "first") {
		return true
	}

	if strings.Contains(prompt, "list") &&
		!strings.Contains(response, "1.") &&
		!strings.Contains(response, "-") {
		return true
	}

	return false
}

func (s *PromptDefenseService) detectPIIInResponse(response string) ([]string, error) {
	var pii []string

	// Simple PII patterns
	patterns := map[string]string{
		"email":  `\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b`,
		"phone":  `\b\d{3}[-.]?\d{3}[-.]?\d{4}\b`,
		"ssn":    `\b\d{3}-\d{2}-\d{4}\b`,
		"credit": `\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b`,
	}

	for name, pattern := range patterns {
		regex := regexp.MustCompile(pattern)
		matches := regex.FindAllString(response, -1)
		if len(matches) > 0 {
			pii = append(pii, fmt.Sprintf("%s: %d instances", name, len(matches)))
		}
	}

	return pii, nil
}

func (s *PromptDefenseService) containsMaliciousContent(response string) bool {
	maliciousPatterns := []string{
		`(exec|eval|system)\s*\(`,
		`rm\s+-rf`,
		`sudo\s+su`,
		`<script`,
		`javascript:`,
		`data:text/html`,
	}

	for _, pattern := range maliciousPatterns {
		if regexp.MustCompile(pattern).MatchString(response) {
			return true
		}
	}

	return false
}

func (s *PromptDefenseService) calculateHallucinationScore(response, prompt string) float64 {
	// Simple hallucination detection - in production, use NLP models
	score := 0.0

	// Check for uncertainty indicators
	uncertaintyPhrases := []string{
		"I'm not sure",
		"I don't have information",
		"I cannot provide",
		"as an AI",
	}

	for _, phrase := range uncertaintyPhrases {
		if strings.Contains(response, phrase) {
			score += 0.2
		}
	}

	// Check for generic responses
	genericPhrases := []string{
		"It's important to note",
		"Please note that",
		"It's worth mentioning",
	}

	for _, phrase := range genericPhrases {
		if strings.Contains(response, phrase) {
			score += 0.1
		}
	}

	if score > 1.0 {
		score = 1.0
	}

	return score
}

func (s *PromptDefenseService) calculateInjectionConfidence(sanitized *SanitizedPrompt) float64 {
	confidence := 0.0

	// Base confidence on risk level
	switch sanitized.RiskLevel {
	case "critical":
		confidence = 0.95
	case "high":
		confidence = 0.8
	case "medium":
		confidence = 0.6
	case "low":
		confidence = 0.1
	}

	// Adjust based on number of detections
	if len(sanitized.Detections) > 3 {
		confidence += 0.1
	}

	// Adjust based on ML detection
	if sanitized.MLDetection != nil {
		confidence = (confidence + sanitized.MLDetection.Confidence) / 2
	}

	if confidence > 1.0 {
		confidence = 1.0
	}

	return confidence
}

func (s *PromptDefenseService) categorizeInjection(detections []InjectionDetection) string {
	categories := make(map[string]int)

	for _, detection := range detections {
		category := s.getCategoryForPattern(detection.Type)
		categories[category]++
	}

	// Return the most common category
	maxCount := 0
	result := "other"
	for category, count := range categories {
		if count > maxCount {
			maxCount = count
			result = category
		}
	}

	return result
}

func (s *PromptDefenseService) getCategoryForPattern(patternName string) string {
	categories := map[string]string{
		"ignore_previous":      "system_manipulation",
		"system_prompt":        "system_manipulation",
		"role_playing":         "role_manipulation",
		"instruction_override": "instruction_override",
		"override_directive":   "instruction_override",
		"code_execution":       "code_injection",
		"file_operations":      "code_injection",
		"network_access":       "code_injection",
		"context_overflow":     "context_manipulation",
		"prompt_leak":          "information_extraction",
		"emergency":            "social_engineering",
		"authority_claim":      "social_engineering",
		"threat":               "social_engineering",
		"dan_mode":             "jailbreak",
		"hypnosis":             "jailbreak",
		"simulation":           "jailbreak",
		"training_data":        "information_extraction",
		"internal_state":       "information_extraction",
	}

	if category, exists := categories[patternName]; exists {
		return category
	}

	return "other"
}

// Type definitions

type SanitizedPrompt struct {
	OriginalPrompt  string               `json:"original_prompt"`
	SanitizedPrompt string               `json:"sanitized_prompt"`
	RiskLevel       string               `json:"risk_level"`
	Warnings        []string             `json:"warnings"`
	Actions         []string             `json:"actions"`
	Detections      []InjectionDetection `json:"detections"`
	MLDetection     *MLInjectionResult   `json:"ml_detection,omitempty"`
	ContextRisk     float64              `json:"context风险"`
	ProcessingTime  time.Duration        `json:"processing_time"`
	CreatedAt       Timestamp            `json:"created_at"`
}

type InjectionDetection struct {
	Type     string  `json:"type"`
	Matches  [][]int `json:"matches"`
	Severity string  `json:"severity"`
}

type MLInjectionResult struct {
	IsInjection bool     `json:"is_injection"`
	Confidence  float64  `json:"confidence"`
	Patterns    []string `json:"patterns"`
	Explanation string   `json:"explanation"`
}

type ValidationResult struct {
	OriginalPrompt     string          `json:"original_prompt"`
	Response           string          `json:"response"`
	IsValid            bool            `json:"is_valid"`
	RiskLevel          string          `json:"risk_level"`
	Issues             []ResponseIssue `json:"issues"`
	Warnings           []string        `json:"warnings"`
	HallucinationScore float64         `json:"hallucination_score"`
	ProcessingTime     time.Duration   `json:"processing_time"`
	ValidatedAt        Timestamp       `json:"validated_at"`
}

type ResponseIssue struct {
	Type        string      `json:"type"`
	Description string      `json:"description"`
	Severity    string      `json:"severity"`
	Details     interface{} `json:"details,omitempty"`
}

type InjectionResult struct {
	IsInjection   bool                 `json:"is_injection"`
	RiskLevel     string               `json:"risk_level"`
	Confidence    float64              `json:"confidence"`
	InjectionType string               `json:"injection_type"`
	Detections    []InjectionDetection `json:"detections"`
	MLScore       float64              `json:"ml_score"`
	ContextRisk   float64              `json:"context_risk"`
}

// MLInjectionDetector handles ML-based injection detection
type MLInjectionDetector struct {
	client *Client
}

// NewMLInjectionDetector creates a new ML injection detector
func NewMLInjectionDetector(client *Client) *MLInjectionDetector {
	return &MLInjectionDetector{
		client: client,
	}
}

// DetectInjection uses ML to detect injection attempts
func (m *MLInjectionDetector) DetectInjection(ctx context.Context, prompt string, userID *string) (*MLInjectionResult, error) {
	// In production, this would call an ML service
	// For now, return a mock result
	return &MLInjectionResult{
		IsInjection: false,
		Confidence:  0.1,
		Patterns:    []string{},
		Explanation: "No injection detected",
	}, nil
}
