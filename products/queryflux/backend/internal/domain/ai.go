package domain

import (
	"time"
)

// AIService represents different AI service providers
type AIService string

const (
	AIServiceOpenAI AIService = "openai"
	AIServiceClaude AIService = "claude"
)

// AIRequest represents a request to an AI service
type AIRequest struct {
	ID          string                 `json:"id"`
	Service     AIService              `json:"service"`
	Model       string                 `json:"model"`
	Prompt      string                 `json:"prompt"`
	Messages    []AIMessage            `json:"messages,omitempty"`
	Context     map[string]interface{} `json:"context,omitempty"`
	MaxTokens   int                    `json:"max_tokens,omitempty"`
	Temperature float64                `json:"temperature,omitempty"`
	UserID      string                 `json:"user_id"`
	CreatedAt   time.Time              `json:"created_at"`
}

// AIMessage represents a message in AI conversation
type AIMessage struct {
	Role      string    `json:"role"` // system, user, assistant
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"created_at,omitempty"`
}

// AIResponse represents a response from an AI service
type AIResponse struct {
	ID          string                 `json:"id"`
	RequestID   string                 `json:"request_id"`
	Service     AIService              `json:"service"`
	Content     string                 `json:"content"`
	TokensUsed  int                    `json:"tokens_used"`
	Model       string                 `json:"model"`
	Context     map[string]interface{} `json:"context,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
	ProcessedAt time.Time              `json:"processed_at"`
	Duration    time.Duration          `json:"duration"`
	Error       *AIError               `json:"error,omitempty"`
}

// AIError represents an error from an AI service
type AIError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Details string `json:"details,omitempty"`
}

// NLToSQLRequest represents a natural language to SQL conversion request
type NLToSQLRequest struct {
	ID           string            `json:"id"`
	NLQuery      string            `json:"nl_query"`
	Schema       DatabaseSchema    `json:"schema"`
	DatabaseType string            `json:"database_type"`
	Context      map[string]string `json:"context,omitempty"`
	Examples     []SQLExample      `json:"examples,omitempty"`
	UserID       string            `json:"user_id"`
	CreatedAt    time.Time         `json:"created_at"`
}

// DatabaseSchema represents database schema information
type DatabaseSchema struct {
	Tables  []TableSchema `json:"tables"`
	Views   []ViewSchema  `json:"views,omitempty"`
	Indexes []IndexSchema `json:"indexes,omitempty"`
}

// TableSchema represents a table schema
type TableSchema struct {
	Name        string         `json:"name"`
	Columns     []ColumnSchema `json:"columns"`
	PrimaryKey  []string       `json:"primary_key,omitempty"`
	ForeignKeys []ForeignKey   `json:"foreign_keys,omitempty"`
	Indexes     []IndexSchema  `json:"indexes,omitempty"`
	RowCount    int64          `json:"row_count,omitempty"`
}

// ColumnSchema represents a column schema
type ColumnSchema struct {
	Name     string  `json:"name"`
	Type     string  `json:"type"`
	Nullable bool    `json:"nullable"`
	Default  *string `json:"default,omitempty"`
	Comment  string  `json:"comment,omitempty"`
}

// ForeignKey represents a foreign key relationship
type ForeignKey struct {
	Column           string `json:"column"`
	ReferencesTable  string `json:"references_table"`
	ReferencesColumn string `json:"references_column"`
}

// ViewSchema represents a view schema
type ViewSchema struct {
	Name    string         `json:"name"`
	Query   string         `json:"query"`
	Columns []ColumnSchema `json:"columns"`
}

// IndexSchema represents an index schema
type IndexSchema struct {
	Name    string   `json:"name"`
	Table   string   `json:"table"`
	Columns []string `json:"columns"`
	Unique  bool     `json:"unique"`
	Primary bool     `json:"primary"`
	Type    string   `json:"type,omitempty"`
}

// SQLExample represents an example query for context
type SQLExample struct {
	NLQuery     string `json:"nl_query"`
	SQLQuery    string `json:"sql_query"`
	Description string `json:"description,omitempty"`
}

// NLToSQLResponse represents the response from natural language to SQL conversion
type NLToSQLResponse struct {
	ID          string    `json:"id"`
	RequestID   string    `json:"request_id"`
	SQLQuery    string    `json:"sql_query"`
	Explanation string    `json:"explanation"`
	Confidence  float64   `json:"confidence"`
	Suggestions []string  `json:"suggestions,omitempty"`
	Warnings    []string  `json:"warnings,omitempty"`
	TokensUsed  int       `json:"tokens_used"`
	CreatedAt   time.Time `json:"created_at"`
}

// QueryOptimizationRequest represents a query optimization request
type QueryOptimizationRequest struct {
	ID                 string                   `json:"id"`
	SQLQuery           string                   `json:"sql_query"`
	DatabaseSchema     DatabaseSchema           `json:"schema"`
	DatabaseType       string                   `json:"database_type"`
	ExecutionPlan      interface{}              `json:"execution_plan,omitempty"`
	PerformanceMetrics *QueryPerformanceMetrics `json:"performance_metrics,omitempty"`
	UserID             string                   `json:"user_id"`
	CreatedAt          time.Time                `json:"created_at"`
}

// QueryPerformanceMetrics represents query performance metrics
type QueryPerformanceMetrics struct {
	ExecutionTime time.Duration `json:"execution_time"`
	RowsReturned  int64         `json:"rows_returned"`
	RowsScanned   int64         `json:"rows_scanned"`
	BytesScanned  int64         `json:"bytes_scanned"`
	CPUUsage      float64       `json:"cpu_usage"`
	MemoryUsage   int64         `json:"memory_usage"`
}

// QueryOptimizationResponse represents a query optimization response
type QueryOptimizationResponse struct {
	ID               string             `json:"id"`
	RequestID        string             `json:"request_id"`
	OptimizedQuery   string             `json:"optimized_query"`
	Explanation      string             `json:"explanation"`
	Improvements     []QueryImprovement `json:"improvements"`
	SuggestedIndexes []IndexSuggestion  `json:"suggested_indexes,omitempty"`
	EstimatedGain    float64            `json:"estimated_gain"`
	Confidence       float64            `json:"confidence"`
	TokensUsed       int                `json:"tokens_used"`
	CreatedAt        time.Time          `json:"created_at"`
}

// QueryImprovement represents a specific query improvement
type QueryImprovement struct {
	Type        string `json:"type"` // index, join, where, order_by, etc.
	Description string `json:"description"`
	Impact      string `json:"impact"` // high, medium, low
	Change      string `json:"change"` // before and after
}

// IndexSuggestion represents a suggested index
type IndexSuggestion struct {
	Table         string   `json:"table"`
	Columns       []string `json:"columns"`
	Type          string   `json:"type"` // btree, hash, gin, gist
	Reason        string   `json:"reason"`
	Impact        string   `json:"impact"` // high, medium, low
	EstimatedGain float64  `json:"estimated_gain"`
}

// QueryExplanationRequest represents a query explanation request
type QueryExplanationRequest struct {
	ID           string    `json:"id"`
	SQLQuery     string    `json:"sql_query"`
	DatabaseType string    `json:"database_type"`
	Complexity   string    `json:"complexity,omitempty"` // simple, moderate, complex
	Audience     string    `json:"audience,omitempty"`   // beginner, intermediate, expert
	Language     string    `json:"language,omitempty"`   // english, spanish, etc.
	UserID       string    `json:"user_id"`
	CreatedAt    time.Time `json:"created_at"`
}

// QueryExplanationResponse represents a query explanation response
type QueryExplanationResponse struct {
	ID          string           `json:"id"`
	RequestID   string           `json:"request_id"`
	Explanation string           `json:"explanation"`
	Steps       []QueryStep      `json:"steps"`
	Complexity  string           `json:"complexity"`
	Performance []PerformanceTip `json:"performance_tips,omitempty"`
	Vocabulary  []VocabularyTerm `json:"vocabulary,omitempty"`
	TokensUsed  int              `json:"tokens_used"`
	CreatedAt   time.Time        `json:"created_at"`
}

// QueryStep represents a step in query execution
type QueryStep struct {
	Order         int     `json:"order"`
	Operation     string  `json:"operation"`
	Description   string  `json:"description"`
	Table         string  `json:"table,omitempty"`
	Condition     string  `json:"condition,omitempty"`
	EstimatedCost float64 `json:"estimated_cost,omitempty"`
}

// PerformanceTip represents a performance tip
type PerformanceTip struct {
	Type        string `json:"type"`
	Description string `json:"description"`
	Impact      string `json:"impact"`
}

// VocabularyTerm represents a technical term explanation
type VocabularyTerm struct {
	Term       string `json:"term"`
	Definition string `json:"definition"`
	Example    string `json:"example,omitempty"`
}

// AIUsage represents AI service usage tracking
type AIUsage struct {
	ID         string        `json:"id"`
	UserID     string        `json:"user_id"`
	Service    AIService     `json:"service"`
	Model      string        `json:"model"`
	Operation  string        `json:"operation"` // nl_to_sql, optimization, explanation
	TokensUsed int           `json:"tokens_used"`
	Cost       float64       `json:"cost"`
	Duration   time.Duration `json:"duration"`
	Success    bool          `json:"success"`
	ErrorCode  string        `json:"error_code,omitempty"`
	CreatedAt  time.Time     `json:"created_at"`
}

// AIConfig represents AI service configuration
type AIConfig struct {
	Service     AIService     `json:"service"`
	APIKey      string        `json:"api_key"`
	Model       string        `json:"model"`
	BaseURL     string        `json:"base_url,omitempty"`
	MaxTokens   int           `json:"max_tokens"`
	Temperature float64       `json:"temperature"`
	Timeout     time.Duration `json:"timeout"`
	RateLimit   int           `json:"rate_limit"` // requests per minute
	Enabled     bool          `json:"enabled"`
	CreatedAt   time.Time     `json:"created_at"`
	UpdatedAt   time.Time     `json:"updated_at"`
}

// AIPromptTemplate represents a reusable AI prompt template
type AIPromptTemplate struct {
	ID        string          `json:"id"`
	Name      string          `json:"name"`
	Service   AIService       `json:"service"`
	Operation string          `json:"operation"` // nl_to_sql, optimization, explanation
	Template  string          `json:"template"`
	Variables []string        `json:"variables"` // template variables
	Examples  []PromptExample `json:"examples,omitempty"`
	Enabled   bool            `json:"enabled"`
	CreatedAt time.Time       `json:"created_at"`
	UpdatedAt time.Time       `json:"updated_at"`
}

// QueryGenerationRequest represents a query generation request
type QueryGenerationRequest struct {
	ID           string         `json:"id"`
	Requirements string         `json:"requirements"`
	Schema       DatabaseSchema `json:"schema"`
	DatabaseType string         `json:"database_type"`
	UserID       string         `json:"user_id"`
	CreatedAt    time.Time      `json:"created_at"`
}

// QueryGenerationResponse represents a query generation response
type QueryGenerationResponse struct {
	ID          string    `json:"id"`
	RequestID   string    `json:"request_id"`
	SQLQuery    string    `json:"sql_query"`
	Explanation string    `json:"explanation,omitempty"`
	Confidence  float64   `json:"confidence"`
	TokensUsed  int       `json:"tokens_used"`
	CreatedAt   time.Time `json:"created_at"`
}

// PerformanceAnalysisRequest represents a performance analysis request
type PerformanceAnalysisRequest struct {
	ID             string         `json:"id"`
	SQLQuery       string         `json:"sql_query"`
	ExecutionPlan  string         `json:"execution_plan"`
	DatabaseSchema DatabaseSchema `json:"schema"`
	DatabaseType   string         `json:"database_type"`
	UserID         string         `json:"user_id"`
	CreatedAt      time.Time      `json:"created_at"`
}

// PerformanceAnalysisResponse represents a performance analysis response
type PerformanceAnalysisResponse struct {
	ID              string                      `json:"id"`
	RequestID       string                      `json:"request_id"`
	Analysis        string                      `json:"analysis"`
	Bottlenecks     []PerformanceBottleneck     `json:"bottlenecks"`
	Recommendations []PerformanceRecommendation `json:"recommendations"`
	TokensUsed      int                         `json:"tokens_used"`
	CreatedAt       time.Time                   `json:"created_at"`
}

// PerformanceBottleneck represents a performance bottleneck
type PerformanceBottleneck struct {
	Type        string  `json:"type"`
	Description string  `json:"description"`
	Severity    string  `json:"severity"` // critical, high, medium, low
	Impact      float64 `json:"impact"`   // 0.0 to 100.0
}

// PerformanceRecommendation represents a performance recommendation
type PerformanceRecommendation struct {
	Type        string `json:"type"`
	Description string `json:"description"`
	Priority    string `json:"priority"` // urgent, high, medium, low
}

// PromptExample represents an example for prompt templates
type PromptExample struct {
	Input   string `json:"input"`
	Output  string `json:"output"`
	Comment string `json:"comment,omitempty"`
}
