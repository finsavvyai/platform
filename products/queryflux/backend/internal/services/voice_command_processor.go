//go:build experimental_services

/**
 * Voice Command Processor Service
 *
 * Advanced command processing with context awareness and validation
 */

package services

import (
	"context"
	"fmt"
	"regexp"
	"strings"
	"sync"
	"time"

	"go.uber.org/zap"
)

// VoiceCommandProcessor handles advanced voice command processing
type VoiceCommandProcessor struct {
	voiceService      *VoiceRecognitionService
	queryService      *QueryExecutionService
	connectionService *ConnectionManagementService
	validator         *CommandValidator
	contextManager    *CommandContextManager
	history           *CommandHistory
	logger            *zap.Logger
	mu                sync.RWMutex
}

// CommandValidator validates voice commands before execution
type CommandValidator struct {
	validationRules map[string][]ValidationRule
	logger          *zap.Logger
}

// ValidationRule represents a command validation rule
type ValidationRule struct {
	Name        string
	Description string
	Validate    func(*VoiceIntent) error
	Severity    string // "error", "warning", "info"
}

// CommandContextManager manages context for voice commands
type CommandContextManager struct {
	contexts map[string]*CommandContext
	mu       sync.RWMutex
}

// CommandContext represents the context for a command session
type CommandContext struct {
	SessionID         string
	UserID            string
	CurrentConnection string
	LastCommands      []VoiceIntent
	Variables         map[string]interface{}
	Preferences       map[string]string
	CreatedAt         time.Time
	UpdatedAt         time.Time
}

// CommandHistory tracks command execution history
type CommandHistory struct {
	entries []CommandHistoryEntry
	mu      sync.RWMutex
	maxSize int
}

// CommandHistoryEntry represents a command history entry
type CommandHistoryEntry struct {
	Intent        VoiceIntent
	Result        VoiceCommandResult
	Timestamp     time.Time
	ExecutionTime int64
	UserID        string
	SessionID     string
}

// ProcessedCommand represents a fully processed command ready for execution
type ProcessedCommand struct {
	Intent               VoiceIntent
	Validated            bool
	ValidationErrors     []string
	Context              *CommandContext
	RequiresConfirmation bool
	EstimatedCost        float64
	EstimatedTime        int64
}

// NewVoiceCommandProcessor creates a new command processor
func NewVoiceCommandProcessor(
	voiceService *VoiceRecognitionService,
	queryService *QueryExecutionService,
	connectionService *ConnectionManagementService,
	logger *zap.Logger,
) *VoiceCommandProcessor {
	return &VoiceCommandProcessor{
		voiceService:      voiceService,
		queryService:      queryService,
		connectionService: connectionService,
		validator:         NewCommandValidator(logger),
		contextManager:    NewCommandContextManager(),
		history:           NewCommandHistory(1000),
		logger:            logger,
	}
}

// ProcessCommand processes a voice command with validation and context
func (p *VoiceCommandProcessor) ProcessCommand(
	ctx context.Context,
	sessionID string,
	intent *VoiceIntent,
) (*ProcessedCommand, error) {
	p.logger.Info("processing voice command",
		zap.String("intent", intent.Intent),
		zap.String("session_id", sessionID),
		zap.Float64("confidence", intent.Confidence),
	)

	// 1. Validate command
	validationErrors := p.validator.ValidateCommand(intent)

	// 2. Load context
	commandContext, err := p.contextManager.GetContext(sessionID)
	if err != nil {
		// Create new context if doesn't exist
		commandContext = &CommandContext{
			SessionID:   sessionID,
			Variables:   make(map[string]interface{}),
			Preferences: make(map[string]string),
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
		}
		p.contextManager.SetContext(commandContext)
	}

	// 3. Enhance intent with context
	intent = p.enhanceIntentWithContext(intent, commandContext)

	// 4. Estimate execution cost and time
	estimatedCost := p.estimateCost(intent)
	estimatedTime := p.estimateExecutionTime(intent)

	// 5. Determine if confirmation is required
	requiresConfirmation := p.requiresConfirmation(intent, commandContext)

	processed := &ProcessedCommand{
		Intent:               *intent,
		Validated:            len(validationErrors) == 0,
		ValidationErrors:     validationErrors,
		Context:              commandContext,
		RequiresConfirmation: requiresConfirmation,
		EstimatedCost:        estimatedCost,
		EstimatedTime:        estimatedTime,
	}

	return processed, nil
}

// ExecuteCommand executes a processed command
func (p *VoiceCommandProcessor) ExecuteCommand(
	ctx context.Context,
	processed *ProcessedCommand,
) (*VoiceCommandResult, error) {
	startTime := time.Now()

	// Execute the command
	result, err := p.voiceService.ExecuteVoiceCommand(ctx, &processed.Intent)
	if err != nil {
		return nil, fmt.Errorf("command execution failed: %w", err)
	}

	executionTime := time.Since(startTime).Milliseconds()

	// Add to history
	historyEntry := CommandHistoryEntry{
		Intent:        processed.Intent,
		Result:        *result,
		Timestamp:     time.Now(),
		ExecutionTime: executionTime,
		SessionID:     processed.Context.SessionID,
	}

	p.history.Add(historyEntry)

	// Update context
	p.updateContextAfterCommand(processed.Context, &processed.Intent, result)

	p.logger.Info("command executed",
		zap.String("intent", processed.Intent.Intent),
		zap.Int64("execution_time", executionTime),
		zap.Bool("success", result.Success),
	)

	return result, nil
}

// SuggestCommands suggests commands based on context and history
func (p *VoiceCommandProcessor) SuggestCommands(
	ctx context.Context,
	sessionID string,
) ([]VoiceCommand, error) {
	context, err := p.contextManager.GetContext(sessionID)
	if err != nil {
		return nil, err
	}

	// Get recent commands from history
	recentCommands := p.history.GetBySession(sessionID, 10)

	// Generate suggestions based on context
	suggestions := p.generateSuggestions(context, recentCommands)

	return suggestions, nil
}

// enhanceIntentWithContext enhances intent with context information
func (p *VoiceCommandProcessor) enhanceIntentWithContext(
	intent *VoiceIntent,
	context *CommandContext,
) *VoiceIntent {
	// Add context to intent
	if intent.Context == nil {
		intent.Context = make(map[string]interface{})
	}

	// Add current connection if available
	if context.CurrentConnection != "" {
		intent.Context["current_connection"] = context.CurrentConnection
	}

	// Add variables
	intent.Context["variables"] = context.Variables

	// Add preferences
	intent.Context["preferences"] = context.Preferences

	// Add recent commands for context awareness
	intent.Context["recent_commands"] = context.LastCommands

	return intent
}

// estimateCost estimates the cost of executing a command
func (p *VoiceCommandProcessor) estimateCost(intent *VoiceIntent) float64 {
	// Simple cost estimation based on intent type
	costs := map[string]float64{
		"query_execute":   0.001,
		"query_save":      0.0001,
		"connection_test": 0.0005,
		"metrics_show":    0.0002,
		"alert_create":    0.0003,
		"table_describe":  0.0002,
		"backup_create":   0.01,
	}

	if cost, exists := costs[intent.Intent]; exists {
		return cost
	}
	return 0.0
}

// estimateExecutionTime estimates execution time in milliseconds
func (p *VoiceCommandProcessor) estimateExecutionTime(intent *VoiceIntent) int64 {
	// Simple estimation based on intent type
	times := map[string]int64{
		"query_execute":   500,
		"query_save":      100,
		"connection_test": 1000,
		"metrics_show":    200,
		"alert_create":    150,
		"table_describe":  300,
		"backup_create":   5000,
	}

	if time, exists := times[intent.Intent]; exists {
		return time
	}
	return 500
}

// requiresConfirmation determines if a command requires confirmation
func (p *VoiceCommandProcessor) requiresConfirmation(
	intent *VoiceIntent,
	context *CommandContext,
) bool {
	// High-risk operations always require confirmation
	highRiskOperations := []string{
		"backup_delete",
		"query_delete",
		"connection_delete",
		"alert_delete",
	}

	for _, op := range highRiskOperations {
		if strings.EqualFold(intent.Intent, op) {
			return true
		}
	}

	// Commands with low confidence require confirmation
	if intent.Confidence < 0.7 {
		return true
	}

	// Destructive operations require confirmation
	if isDestructiveOperation(intent) {
		return true
	}

	return false
}

// isDestructiveOperation checks if an operation is destructive
func isDestructiveOperation(intent *VoiceIntent) bool {
	destructiveKeywords := []string{
		"delete", "drop", "truncate", "alter", "destroy",
	}

	transcript := strings.ToLower(intent.Context["transcript"].(string))
	for _, keyword := range destructiveKeywords {
		if strings.Contains(transcript, keyword) {
			return true
		}
	}

	return false
}

// updateContextAfterCommand updates context after command execution
func (p *VoiceCommandProcessor) updateContextAfterCommand(
	context *CommandContext,
	intent *VoiceIntent,
	result *VoiceCommandResult,
) {
	context.UpdatedAt = time.Now()

	// Add intent to last commands
	context.LastCommands = append(context.LastCommands, *intent)

	// Keep only last 10 commands
	if len(context.LastCommands) > 10 {
		context.LastCommands = context.LastCommands[len(context.LastCommands)-10:]
	}

	// Update context based on result
	if result.Data != nil {
		if dataMap, ok := result.Data.(map[string]interface{}); ok {
			if connection, ok := dataMap["connection"].(string); ok {
				context.CurrentConnection = connection
			}
		}
	}
}

// generateSuggestions generates command suggestions based on context
func (p *VoiceCommandProcessor) generateSuggestions(
	context *CommandContext,
	recentCommands []CommandHistoryEntry,
) []VoiceCommand {
	suggestions := []VoiceCommand{}

	// Suggest follow-up commands based on recent activity
	if len(recentCommands) > 0 {
		lastIntent := recentCommands[len(recentCommands)-1].Intent

		switch lastIntent.Intent {
		case "query_execute":
			suggestions = append(suggestions, VoiceCommand{
				Name:        "save_query",
				Description: "Save the last executed query",
				Triggers:    []string{"query_save", "save_query"},
				Category:    "query",
			})
		case "connection_test":
			suggestions = append(suggestions, VoiceCommand{
				Name:        "show_metrics",
				Description: "Show database metrics",
				Triggers:    []string{"metrics_show", "show_stats"},
				Category:    "monitoring",
			})
		}
	}

	// Suggest commands based on current connection
	if context.CurrentConnection != "" {
		suggestions = append(suggestions, VoiceCommand{
			Name:        "describe_table",
			Description: fmt.Sprintf("Describe a table in %s", context.CurrentConnection),
			Triggers:    []string{"table_describe", "show_table_schema"},
			Category:    "schema",
		})
	}

	return suggestions
}

// NewCommandValidator creates a new command validator
func NewCommandValidator(logger *zap.Logger) *CommandValidator {
	validator := &CommandValidator{
		validationRules: make(map[string][]ValidationRule),
		logger:          logger,
	}

	validator.registerDefaultRules()

	return validator
}

// ValidateCommand validates a command intent
func (v *CommandValidator) ValidateCommand(intent *VoiceIntent) []string {
	errors := []string{}

	rules, exists := v.validationRules[intent.Intent]
	if !exists {
		return errors // No rules defined for this intent
	}

	for _, rule := range rules {
		if err := rule.Validate(intent); err != nil {
			errors = append(errors, fmt.Sprintf("[%s] %s: %s", rule.Severity, rule.Name, err.Error()))
		}
	}

	return errors
}

// registerDefaultRules registers default validation rules
func (v *CommandValidator) registerDefaultRules() {
	// Query execution rules
	v.validationRules["query_execute"] = []ValidationRule{
		{
			Name:        "query_not_empty",
			Description: "Query text must not be empty",
			Severity:    "error",
			Validate: func(intent *VoiceIntent) error {
				query := intent.Entities["query"]
				if query == "" || strings.TrimSpace(query) == "" {
					return fmt.Errorf("query text is empty")
				}
				return nil
			},
		},
		{
			Name:        "query_not_dangerous",
			Description: "Detect potentially dangerous queries",
			Severity:    "warning",
			Validate: func(intent *VoiceIntent) error {
				query := strings.ToLower(intent.Entities["query"])
				dangerousKeywords := []string{"drop", "delete", "truncate"}

				for _, keyword := range dangerousKeywords {
					if strings.Contains(query, keyword) {
						return fmt.Errorf("query contains dangerous keyword: %s", keyword)
					}
				}
				return nil
			},
		},
		{
			Name:        "query_syntax_check",
			Description: "Basic SQL syntax validation",
			Severity:    "error",
			Validate: func(intent *VoiceIntent) error {
				query := strings.TrimSpace(intent.Entities["query"])
				if !strings.HasPrefix(strings.ToUpper(query), "SELECT") &&
					!strings.HasPrefix(strings.ToUpper(query), "SHOW") &&
					!strings.HasPrefix(strings.ToUpper(query), "DESCRIBE") &&
					!strings.HasPrefix(strings.ToUpper(query), "EXPLAIN") {
					return fmt.Errorf("only SELECT queries are supported via voice")
				}
				return nil
			},
		},
	}

	// Connection test rules
	v.validationRules["connection_test"] = []ValidationRule{
		{
			Name:        "connection_specified",
			Description: "Connection name must be specified",
			Severity:    "error",
			Validate: func(intent *VoiceIntent) error {
				connection := intent.Entities["connection"]
				if connection == "" || strings.TrimSpace(connection) == "" {
					return fmt.Errorf("connection name not specified")
				}
				return nil
			},
		},
	}

	// Alert creation rules
	v.validationRules["alert_create"] = []ValidationRule{
		{
			Name:        "alert_name_specified",
			Description: "Alert name must be specified",
			Severity:    "error",
			Validate: func(intent *VoiceIntent) error {
				name := intent.Entities["name"]
				if name == "" || strings.TrimSpace(name) == "" {
					return fmt.Errorf("alert name not specified")
				}
				return nil
			},
		},
		{
			Name:        "alert_threshold_valid",
			Description: "Alert threshold must be a valid number",
			Severity:    "error",
			Validate: func(intent *VoiceIntent) error {
				threshold := intent.Entities["threshold"]
				if threshold != "" {
					// Extract number from threshold string
					re := regexp.MustCompile(`\d+`)
					match := re.FindString(threshold)
					if match == "" {
						return fmt.Errorf("invalid threshold value: %s", threshold)
					}
				}
				return nil
			},
		},
	}
}

// NewCommandContextManager creates a new context manager
func NewCommandContextManager() *CommandContextManager {
	return &CommandContextManager{
		contexts: make(map[string]*CommandContext),
	}
}

// GetContext retrieves a command context
func (m *CommandContextManager) GetContext(sessionID string) (*CommandContext, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	context, exists := m.contexts[sessionID]
	if !exists {
		return nil, fmt.Errorf("context not found for session: %s", sessionID)
	}

	return context, nil
}

// SetContext stores a command context
func (m *CommandContextManager) SetContext(context *CommandContext) {
	m.mu.Lock()
	defer m.mu.Unlock()

	context.UpdatedAt = time.Now()
	m.contexts[context.SessionID] = context
}

// DeleteContext removes a command context
func (m *CommandContextManager) DeleteContext(sessionID string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	delete(m.contexts, sessionID)
}

// NewCommandHistory creates a new command history
func NewCommandHistory(maxSize int) *CommandHistory {
	return &CommandHistory{
		entries: make([]CommandHistoryEntry, 0),
		maxSize: maxSize,
	}
}

// Add adds an entry to the history
func (h *CommandHistory) Add(entry CommandHistoryEntry) {
	h.mu.Lock()
	defer h.mu.Unlock()

	h.entries = append(h.entries, entry)

	// Trim to max size
	if len(h.entries) > h.maxSize {
		h.entries = h.entries[len(h.entries)-h.maxSize:]
	}
}

// GetBySession retrieves history entries for a session
func (h *CommandHistory) GetBySession(sessionID string, limit int) []CommandHistoryEntry {
	h.mu.RLock()
	defer h.mu.RUnlock()

	var sessionEntries []CommandHistoryEntry
	for i := len(h.entries) - 1; i >= 0; i-- {
		if h.entries[i].SessionID == sessionID {
			sessionEntries = append(sessionEntries, h.entries[i])
			if len(sessionEntries) >= limit {
				break
			}
		}
	}

	return sessionEntries
}

// GetByUser retrieves history entries for a user
func (h *CommandHistory) GetByUser(userID string, limit int) []CommandHistoryEntry {
	h.mu.RLock()
	defer h.mu.RUnlock()

	var userEntries []CommandHistoryEntry
	for i := len(h.entries) - 1; i >= 0; i-- {
		if h.entries[i].UserID == userID {
			userEntries = append(userEntries, h.entries[i])
			if len(userEntries) >= limit {
				break
			}
		}
	}

	return userEntries
}
