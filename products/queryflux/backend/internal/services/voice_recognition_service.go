//go:build experimental_services

/**
 * Voice Recognition Service
 *
 * Provides voice command recognition and intent processing
 */

package services

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"go.uber.org/zap"
)

// VoiceRecognitionService handles voice command recognition
type VoiceRecognitionService struct {
	aiService       *AIService
	intentProcessor *VoiceIntentProcessor
	commandRegistry *CommandRegistry
	logger          *zap.Logger
	mu              sync.RWMutex
	activeSessions  map[string]*VoiceSession
}

// VoiceSession represents an active voice recognition session
type VoiceSession struct {
	ID                string
	UserID            string
	Language          string
	StartTime         time.Time
	LastActivity      time.Time
	Transcript        []string
	RecognizedIntents []VoiceIntent
}

// VoiceIntent represents a recognized voice command intent
type VoiceIntent struct {
	Intent               string                 `json:"intent"`
	Confidence           float64                `json:"confidence"`
	Entities             map[string]string      `json:"entities"`
	Context              map[string]interface{} `json:"context"`
	Timestamp            time.Time              `json:"timestamp"`
	RequiresConfirmation bool                   `json:"requiresConfirmation"`
}

// VoiceCommandResult represents the result of voice command execution
type VoiceCommandResult struct {
	Intent        VoiceIntent `json:"intent"`
	Response      string      `json:"response"`
	Data          interface{} `json:"data,omitempty"`
	Success       bool        `json:"success"`
	Error         string      `json:"error,omitempty"`
	ExecutionTime int64       `json:"executionTime"`
}

// VoiceIntentProcessor handles intent recognition from voice transcripts
type VoiceIntentProcessor struct {
	aiService *AIService
	logger    *zap.Logger
}

// CommandRegistry manages voice command definitions and handlers
type CommandRegistry struct {
	commands map[string]*VoiceCommand
	mu       sync.RWMutex
}

// VoiceCommand represents a registrable voice command
type VoiceCommand struct {
	Name            string                  `json:"name"`
	Description     string                  `json:"description"`
	Triggers        []string                `json:"triggers"`
	Parameters      []VoiceCommandParameter `json:"parameters"`
	Handler         func(VoiceIntent) (interface{}, error)
	RequiresContext bool   `json:"requiresContext"`
	Category        string `json:"category"`
}

// VoiceCommandParameter defines a parameter for voice commands
type VoiceCommandParameter struct {
	Name        string   `json:"name"`
	Type        string   `json:"type"`
	Required    bool     `json:"required"`
	Description string   `json:"description"`
	Examples    []string `json:"examples"`
}

// NewVoiceRecognitionService creates a new voice recognition service
func NewVoiceRecognitionService(aiService *AIService, logger *zap.Logger) *VoiceRecognitionService {
	return &VoiceRecognitionService{
		aiService:       aiService,
		intentProcessor: NewVoiceIntentProcessor(aiService, logger),
		commandRegistry: NewCommandRegistry(),
		logger:          logger,
		activeSessions:  make(map[string]*VoiceSession),
	}
}

// ProcessVoiceTranscript processes a voice transcript and executes recognized commands
func (s *VoiceRecognitionService) ProcessVoiceTranscript(
	ctx context.Context,
	sessionID string,
	transcript string,
	language string,
) (*VoiceCommandResult, error) {
	s.mu.Lock()
	session, exists := s.activeSessions[sessionID]
	if !exists {
		session = &VoiceSession{
			ID:           sessionID,
			Language:     language,
			StartTime:    time.Now(),
			LastActivity: time.Now(),
			Transcript:   []string{},
		}
		s.activeSessions[sessionID] = session
	}
	session.Transcript = append(session.Transcript, transcript)
	session.LastActivity = time.Now()
	s.mu.Unlock()

	// Recognize intent from transcript
	intent, err := s.intentProcessor.RecognizeIntent(ctx, transcript, language)
	if err != nil {
		return &VoiceCommandResult{
			Success: false,
			Error:   fmt.Sprintf("intent recognition failed: %w", err),
		}, err
	}

	session.RecognizedIntents = append(session.RecognizedIntents, *intent)

	// Execute command
	startTime := time.Now()
	result, err := s.ExecuteVoiceCommand(ctx, intent)
	executionTime := time.Since(startTime).Milliseconds()

	if err != nil {
		return &VoiceCommandResult{
			Intent:        *intent,
			Success:       false,
			Error:         err.Error(),
			ExecutionTime: executionTime,
		}, nil
	}

	return &VoiceCommandResult{
		Intent:        *intent,
		Response:      generateSuccessResponse(intent.Intent),
		Data:          result,
		Success:       true,
		ExecutionTime: executionTime,
	}, nil
}

// ExecuteVoiceCommand executes a recognized voice command
func (s *VoiceRecognitionService) ExecuteVoiceCommand(
	ctx context.Context,
	intent *VoiceIntent,
) (interface{}, error) {
	s.commandRegistry.mu.RLock()
	defer s.commandRegistry.mu.RUnlock()

	// Find matching command
	var command *VoiceCommand
	for _, cmd := range s.commandRegistry.commands {
		if s.matchesIntent(cmd, intent.Intent) {
			command = cmd
			break
		}
	}

	if command == nil {
		return nil, fmt.Errorf("no command found for intent: %s", intent.Intent)
	}

	// Validate required parameters
	if err := s.validateParameters(command, intent); err != nil {
		return nil, fmt.Errorf("parameter validation failed: %w", err)
	}

	// Execute command handler
	result, err := command.Handler(*intent)
	if err != nil {
		s.logger.Error("voice command execution failed",
			zap.String("intent", intent.Intent),
			zap.Error(err),
		)
		return nil, err
	}

	s.logger.Info("voice command executed",
		zap.String("intent", intent.Intent),
		zap.Float64("confidence", intent.Confidence),
	)

	return result, nil
}

// StartVoiceSession starts a new voice recognition session
func (s *VoiceRecognitionService) StartVoiceSession(userID, language string) string {
	sessionID := fmt.Sprintf("voice_%d_%s", time.Now().UnixNano(), randomString(8))

	s.mu.Lock()
	s.activeSessions[sessionID] = &VoiceSession{
		ID:           sessionID,
		UserID:       userID,
		Language:     language,
		StartTime:    time.Now(),
		LastActivity: time.Now(),
		Transcript:   []string{},
	}
	s.mu.Unlock()

	s.logger.Info("voice session started",
		zap.String("session_id", sessionID),
		zap.String("user_id", userID),
		zap.String("language", language),
	)

	return sessionID
}

// EndVoiceSession ends a voice recognition session
func (s *VoiceRecognitionService) EndVoiceSession(sessionID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	session, exists := s.activeSessions[sessionID]
	if !exists {
		return fmt.Errorf("session not found: %s", sessionID)
	}

	duration := time.Since(session.StartTime)
	s.logger.Info("voice session ended",
		zap.String("session_id", sessionID),
		zap.Duration("duration", duration),
		zap.Int("transcripts", len(session.Transcript)),
		zap.Int("intents", len(session.RecognizedIntents)),
	)

	delete(s.activeSessions, sessionID)
	return nil
}

// RegisterCommand registers a new voice command
func (s *VoiceRecognitionService) RegisterCommand(command *VoiceCommand) error {
	s.commandRegistry.mu.Lock()
	defer s.commandRegistry.mu.Unlock()

	if _, exists := s.commandRegistry.commands[command.Name]; exists {
		return fmt.Errorf("command already registered: %s", command.Name)
	}

	s.commandRegistry.commands[command.Name] = command
	s.logger.Info("voice command registered", zap.String("command", command.Name))

	return nil
}

// GetActiveSession returns an active voice session
func (s *VoiceRecognitionService) GetActiveSession(sessionID string) (*VoiceSession, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	session, exists := s.activeSessions[sessionID]
	if !exists {
		return nil, fmt.Errorf("session not found: %s", sessionID)
	}

	return session, nil
}

// matchesIntent checks if a command matches the recognized intent
func (s *VoiceRecognitionService) matchesIntent(command *VoiceCommand, intent string) bool {
	for _, trigger := range command.Triggers {
		if strings.EqualFold(trigger, intent) {
			return true
		}
	}
	return false
}

// validateParameters validates required parameters for a command
func (s *VoiceRecognitionService) validateParameters(
	command *VoiceCommand,
	intent *VoiceIntent,
) error {
	for _, param := range command.Parameters {
		if param.Required {
			if _, exists := intent.Entities[param.Name]; !exists {
				return fmt.Errorf("missing required parameter: %s", param.Name)
			}
		}
	}
	return nil
}

// NewVoiceIntentProcessor creates a new voice intent processor
func NewVoiceIntentProcessor(aiService *AIService, logger *zap.Logger) *VoiceIntentProcessor {
	return &VoiceIntentProcessor{
		aiService: aiService,
		logger:    logger,
	}
}

// RecognizeIntent uses AI to recognize intent from voice transcript
func (p *VoiceIntentProcessor) RecognizeIntent(
	ctx context.Context,
	transcript string,
	language string,
) (*VoiceIntent, error) {
	// Build system prompt for intent recognition
	systemPrompt := `You are a voice command intent recognizer for a database management application.
Analyze the user's speech transcript and extract:
1. Intent: The specific action the user wants to perform
2. Confidence: Your confidence in this recognition (0.0-1.0)
3. Entities: Key parameters mentioned (table names, column names, values, etc.)
4. Context: Any relevant context from the conversation

Supported intent categories:
- query_execute: Execute a SQL query
- query_save: Save a query for later
- connection_test: Test a database connection
- metrics_show: Display database metrics
- alert_create: Create an alert
- table_describe: Describe a table structure
- backup_create: Create a database backup
- help_general: Show general help

Respond in JSON format.`

	// Build user message with transcript
	userMessage := fmt.Sprintf("Recognize intent from: %s\nLanguage: %s", transcript, language)

	// Create AI request
	request := AIRequest{
		Messages: []AIMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userMessage},
		},
		Model:       ModelGPT4Turbo,
		Temperature: 0.3,
		MaxTokens:   500,
	}

	// Execute AI request
	response, err := p.aiService.Execute(ctx, request)
	if err != nil {
		return nil, fmt.Errorf("AI request failed: %w", err)
	}

	// Parse AI response
	intent, err := p.parseIntentResponse(response.Content)
	if err != nil {
		return nil, fmt.Errorf("failed to parse intent: %w", err)
	}

	// Override language from context
	intent.Context["language"] = language
	intent.Context["transcript"] = transcript

	p.logger.Debug("intent recognized",
		zap.String("intent", intent.Intent),
		zap.Float64("confidence", intent.Confidence),
	)

	return intent, nil
}

// parseIntentResponse parses AI response into VoiceIntent
func (p *VoiceIntentProcessor) parseIntentResponse(content string) (*VoiceIntent, error) {
	var intent struct {
		Intent               string                 `json:"intent"`
		Confidence           float64                `json:"confidence"`
		Entities             map[string]string      `json:"entities"`
		Context              map[string]interface{} `json:"context"`
		RequiresConfirmation bool                   `json:"requiresConfirmation"`
	}

	if err := json.Unmarshal([]byte(content), &intent); err != nil {
		return nil, err
	}

	return &VoiceIntent{
		Intent:               intent.Intent,
		Confidence:           intent.Confidence,
		Entities:             intent.Entities,
		Context:              intent.Context,
		Timestamp:            time.Now(),
		RequiresConfirmation: intent.RequiresConfirmation,
	}, nil
}

// NewCommandRegistry creates a new command registry
func NewCommandRegistry() *CommandRegistry {
	registry := &CommandRegistry{
		commands: make(map[string]*VoiceCommand),
	}

	// Register default commands
	registry.registerDefaultCommands()

	return registry
}

// registerDefaultCommands registers built-in voice commands
func (r *CommandRegistry) registerDefaultCommands() {
	// Query execution command
	r.RegisterDefaultCommand(&VoiceCommand{
		Name:        "execute_query",
		Description: "Execute a SQL query",
		Triggers:    []string{"query_execute", "run_query", "execute_sql"},
		Category:    "query",
		Parameters: []VoiceCommandParameter{
			{
				Name:        "query",
				Type:        "string",
				Required:    true,
				Description: "The SQL query to execute",
				Examples:    []string{"SELECT * FROM users", "SELECT count(*) FROM orders"},
			},
		},
		Handler: func(intent VoiceIntent) (interface{}, error) {
			// This would integrate with the query execution service
			query := intent.Entities["query"]
			return map[string]interface{}{
				"message": "Query execution initiated",
				"query":   query,
			}, nil
		},
	})

	// Connection test command
	r.RegisterDefaultCommand(&VoiceCommand{
		Name:        "test_connection",
		Description: "Test a database connection",
		Triggers:    []string{"connection_test", "test_db", "check_connection"},
		Category:    "connection",
		Parameters: []VoiceCommandParameter{
			{
				Name:        "connection",
				Type:        "string",
				Required:    true,
				Description: "The connection name or ID",
				Examples:    []string{"production", "staging", "localhost"},
			},
		},
		Handler: func(intent VoiceIntent) (interface{}, error) {
			connection := intent.Entities["connection"]
			return map[string]interface{}{
				"message":    "Connection test initiated",
				"connection": connection,
			}, nil
		},
	})

	// Metrics display command
	r.RegisterDefaultCommand(&VoiceCommand{
		Name:        "show_metrics",
		Description: "Display database metrics",
		Triggers:    []string{"metrics_show", "show_stats", "database_stats"},
		Category:    "monitoring",
		Parameters: []VoiceCommandParameter{
			{
				Name:        "connection",
				Type:        "string",
				Required:    false,
				Description: "The connection to show metrics for (default: all)",
				Examples:    []string{"production", "staging"},
			},
		},
		Handler: func(intent VoiceIntent) (interface{}, error) {
			connection := intent.Entities["connection"]
			return map[string]interface{}{
				"message":    "Metrics retrieved",
				"connection": connection,
			}, nil
		},
	})

	// Help command
	r.RegisterDefaultCommand(&VoiceCommand{
		Name:        "help",
		Description: "Show help and available commands",
		Triggers:    []string{"help_general", "show_help", "what_can_i_say"},
		Category:    "general",
		Parameters:  []VoiceCommandParameter{},
		Handler: func(intent VoiceIntent) (interface{}, error) {
			return map[string]interface{}{
				"message": "Voice commands available",
				"commands": []string{
					"Execute a query: 'Execute SELECT * FROM users'",
					"Test connection: 'Test connection production'",
					"Show metrics: 'Show database metrics'",
					"Create alert: 'Create an alert for high CPU'",
				},
			}, nil
		},
	})
}

// RegisterDefaultCommand registers a command without locking (internal use)
func (r *CommandRegistry) RegisterDefaultCommand(command *VoiceCommand) {
	r.commands[command.Name] = command
}

// generateSuccessResponse generates a success response message
func generateSuccessResponse(intent string) string {
	responses := map[string]string{
		"query_execute":   "Query executed successfully",
		"query_save":      "Query saved successfully",
		"connection_test": "Connection test completed",
		"metrics_show":    "Metrics displayed",
		"alert_create":    "Alert created",
		"table_describe":  "Table structure retrieved",
		"backup_create":   "Backup created",
		"help_general":    "Here are the available commands",
	}

	if response, exists := responses[intent]; exists {
		return response
	}
	return "Command completed"
}
