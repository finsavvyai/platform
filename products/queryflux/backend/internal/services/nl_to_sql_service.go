package services

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/queryflux/backend/internal/domain"
	"github.com/sirupsen/logrus"
)

// NLToSQLService provides enhanced natural language to SQL conversion
// with confidence scoring, validation, caching, and provider fallback
type NLToSQLService struct {
	aiProviders   []AIProvider
	cache         *NLToSQLCache
	validator     *SQLValidator
	logger        *logrus.Logger
	schemaService SchemaService
}

// AIProvider interface for pluggable AI backends
type AIProvider interface {
	Name() string
	ConvertNLToSQL(ctx context.Context, prompt string, schema string) (string, error)
	IsHealthy(ctx context.Context) bool
}

// SchemaService interface for fetching database schema
type SchemaService interface {
	GetSchema(ctx context.Context, connectionID string) (*domain.DatabaseSchema, error)
}

// NLToSQLCache provides response caching to reduce API costs
type NLToSQLCache struct {
	cache map[string]*CachedResponse
	mutex sync.RWMutex
	ttl   time.Duration
}

// CachedResponse holds a cached NL→SQL result
type CachedResponse struct {
	SQL        string
	Confidence float64
	CreatedAt  time.Time
}

// NLToSQLRequest represents an enhanced NL→SQL request
type NLToSQLRequest struct {
	NaturalLanguage string `json:"natural_language"`
	ConnectionID    string `json:"connection_id"`
	DatabaseType    string `json:"database_type"` // postgresql, mysql, mongodb, etc.
	Context         string `json:"context,omitempty"`
	QueryHistory    []string `json:"query_history,omitempty"`
}

// NLToSQLResult represents an enhanced NL→SQL response
type NLToSQLResult struct {
	SQL             string   `json:"sql"`
	Confidence      float64  `json:"confidence"`       // 0.0 - 1.0
	ConfidenceLevel string   `json:"confidence_level"` // "high", "medium", "low"
	Explanation     string   `json:"explanation"`
	Warnings        []string `json:"warnings,omitempty"`
	Provider        string   `json:"provider"`
	Cached          bool     `json:"cached"`
	ValidationErrors []string `json:"validation_errors,omitempty"`
}

// SQLValidator validates generated SQL queries
type SQLValidator struct {
	dangerousPatterns []*regexp.Regexp
	logger            *logrus.Logger
}

// NewNLToSQLService creates a new enhanced NL→SQL service
func NewNLToSQLService(providers []AIProvider, schemaService SchemaService) *NLToSQLService {
	logger := logrus.New()
	logger.SetLevel(logrus.InfoLevel)

	return &NLToSQLService{
		aiProviders:   providers,
		cache:         NewNLToSQLCache(15 * time.Minute),
		validator:     NewSQLValidator(),
		logger:        logger,
		schemaService: schemaService,
	}
}

// NewNLToSQLCache creates a new cache with the specified TTL
func NewNLToSQLCache(ttl time.Duration) *NLToSQLCache {
	return &NLToSQLCache{
		cache: make(map[string]*CachedResponse),
		ttl:   ttl,
	}
}

// NewSQLValidator creates a new SQL validator
func NewSQLValidator() *SQLValidator {
	patterns := []*regexp.Regexp{
		regexp.MustCompile(`(?i)\bDROP\s+(TABLE|DATABASE|INDEX)\b`),
		regexp.MustCompile(`(?i)\bTRUNCATE\s+TABLE\b`),
		regexp.MustCompile(`(?i)\bDELETE\s+FROM\s+\w+\s*$`), // DELETE without WHERE
		regexp.MustCompile(`(?i)\bUPDATE\s+\w+\s+SET\s+.+\s*$`), // UPDATE without WHERE
		regexp.MustCompile(`(?i);\s*(DROP|DELETE|TRUNCATE|ALTER)`), // SQL injection patterns
		regexp.MustCompile(`(?i)--\s*$`), // Comment at end (potential injection)
		regexp.MustCompile(`(?i)\/\*.*\*\/`), // Block comments
	}

	return &SQLValidator{
		dangerousPatterns: patterns,
		logger:            logrus.New(),
	}
}

// ConvertNLToSQL converts natural language to SQL with enhanced features
func (s *NLToSQLService) ConvertNLToSQL(ctx context.Context, req *NLToSQLRequest) (*NLToSQLResult, error) {
	// 1. Check cache first
	cacheKey := s.generateCacheKey(req)
	if cached := s.cache.Get(cacheKey); cached != nil {
		s.logger.Info("Cache hit for NL→SQL request")
		return &NLToSQLResult{
			SQL:             cached.SQL,
			Confidence:      cached.Confidence,
			ConfidenceLevel: s.getConfidenceLevel(cached.Confidence),
			Cached:          true,
			Provider:        "cache",
		}, nil
	}

	// 2. Fetch schema for context
	var schemaText string
	if s.schemaService != nil && req.ConnectionID != "" {
		schema, err := s.schemaService.GetSchema(ctx, req.ConnectionID)
		if err != nil {
			s.logger.WithError(err).Warn("Failed to fetch schema, proceeding without")
		} else {
			schemaText = s.formatSchemaForPrompt(schema)
		}
	}

	// 3. Build enhanced prompt
	prompt := s.buildEnhancedPrompt(req, schemaText)

	// 4. Try providers with fallback chain
	var sql string
	var usedProvider string
	var lastErr error

	for _, provider := range s.aiProviders {
		if !provider.IsHealthy(ctx) {
			s.logger.Warnf("Provider %s is unhealthy, skipping", provider.Name())
			continue
		}

		sql, lastErr = provider.ConvertNLToSQL(ctx, prompt, schemaText)
		if lastErr == nil && sql != "" {
			usedProvider = provider.Name()
			break
		}
		s.logger.WithError(lastErr).Warnf("Provider %s failed, trying next", provider.Name())
	}

	if sql == "" {
		return nil, fmt.Errorf("all AI providers failed: %w", lastErr)
	}

	// 5. Clean and validate SQL
	sql = s.cleanSQL(sql)
	validationErrors, warnings := s.validator.Validate(sql, req.DatabaseType)

	// 6. Calculate confidence score
	confidence := s.calculateConfidence(sql, req, schemaText, validationErrors)

	// 7. Generate explanation
	explanation := s.generateExplanation(sql)

	// 8. Cache successful result
	result := &NLToSQLResult{
		SQL:              sql,
		Confidence:       confidence,
		ConfidenceLevel:  s.getConfidenceLevel(confidence),
		Explanation:      explanation,
		Warnings:         warnings,
		Provider:         usedProvider,
		ValidationErrors: validationErrors,
		Cached:           false,
	}

	if len(validationErrors) == 0 {
		s.cache.Set(cacheKey, &CachedResponse{
			SQL:        sql,
			Confidence: confidence,
			CreatedAt:  time.Now(),
		})
	}

	return result, nil
}

// buildEnhancedPrompt creates a context-aware prompt
func (s *NLToSQLService) buildEnhancedPrompt(req *NLToSQLRequest, schemaText string) string {
	var builder strings.Builder

	builder.WriteString("You are an expert SQL developer. Convert the following natural language request to a valid SQL query.\n\n")

	// Add database type context
	if req.DatabaseType != "" {
		builder.WriteString(fmt.Sprintf("Target Database: %s\n", strings.ToUpper(req.DatabaseType)))
		builder.WriteString("Use syntax specific to this database type.\n\n")
	}

	// Add schema context
	if schemaText != "" {
		builder.WriteString("DATABASE SCHEMA:\n")
		builder.WriteString(schemaText)
		builder.WriteString("\n")
	}

	// Add query history for context
	if len(req.QueryHistory) > 0 {
		builder.WriteString("RECENT QUERIES (for context):\n")
		for i, q := range req.QueryHistory {
			if i >= 3 { // Limit to last 3 queries
				break
			}
			builder.WriteString(fmt.Sprintf("- %s\n", q))
		}
		builder.WriteString("\n")
	}

	// Add additional context
	if req.Context != "" {
		builder.WriteString(fmt.Sprintf("ADDITIONAL CONTEXT: %s\n\n", req.Context))
	}

	// Add the actual request
	builder.WriteString(fmt.Sprintf("USER REQUEST: %s\n\n", req.NaturalLanguage))

	// Instructions for output format
	builder.WriteString("INSTRUCTIONS:\n")
	builder.WriteString("1. Return ONLY the SQL query, no explanations or markdown formatting\n")
	builder.WriteString("2. Use proper table and column names from the schema if provided\n")
	builder.WriteString("3. Include appropriate JOINs if the query spans multiple tables\n")
	builder.WriteString("4. Add LIMIT clause for SELECT queries if not specified (default to 100)\n")
	builder.WriteString("5. Use parameterized placeholders ($1, $2 for PostgreSQL, ? for MySQL) for user-provided values\n")

	return builder.String()
}

// calculateConfidence scores the generated SQL
func (s *NLToSQLService) calculateConfidence(sql string, req *NLToSQLRequest, schemaText string, validationErrors []string) float64 {
	confidence := 1.0

	// Reduce confidence for validation errors
	confidence -= float64(len(validationErrors)) * 0.2

	// Reduce confidence if no schema was provided
	if schemaText == "" {
		confidence -= 0.15
	}

	// Check if SQL references tables/columns from schema
	if schemaText != "" && !s.sqlMatchesSchema(sql, schemaText) {
		confidence -= 0.25
	}

	// Reduce confidence for very short queries
	if len(sql) < 20 {
		confidence -= 0.1
	}

	// Reduce confidence for very complex queries
	if strings.Count(sql, "JOIN") > 3 || strings.Count(sql, "SELECT") > 2 {
		confidence -= 0.1
	}

	// Boost confidence for simple, common patterns
	simplePatterns := []string{
		`(?i)^SELECT\s+\*\s+FROM\s+\w+\s*(WHERE|LIMIT|$)`,
		`(?i)^SELECT\s+[\w,\s]+\s+FROM\s+\w+\s*(WHERE|LIMIT|$)`,
		`(?i)^SELECT\s+COUNT\(\*\)\s+FROM\s+\w+`,
	}
	for _, pattern := range simplePatterns {
		if matched, _ := regexp.MatchString(pattern, sql); matched {
			confidence += 0.05
			break
		}
	}

	// Clamp between 0 and 1
	if confidence < 0 {
		confidence = 0
	}
	if confidence > 1 {
		confidence = 1
	}

	return confidence
}

// getConfidenceLevel converts numeric confidence to a level
func (s *NLToSQLService) getConfidenceLevel(confidence float64) string {
	if confidence >= 0.8 {
		return "high"
	} else if confidence >= 0.5 {
		return "medium"
	}
	return "low"
}

// cleanSQL removes markdown formatting and extra whitespace
func (s *NLToSQLService) cleanSQL(sql string) string {
	// Remove markdown code blocks
	sql = regexp.MustCompile("```sql\\s*").ReplaceAllString(sql, "")
	sql = regexp.MustCompile("```\\s*").ReplaceAllString(sql, "")

	// Remove leading/trailing whitespace
	sql = strings.TrimSpace(sql)

	// Normalize whitespace
	sql = regexp.MustCompile(`\s+`).ReplaceAllString(sql, " ")

	return sql
}

// Validate checks SQL for dangerous patterns and syntax issues
func (v *SQLValidator) Validate(sql string, dbType string) (errors []string, warnings []string) {
	// Check for dangerous patterns
	for _, pattern := range v.dangerousPatterns {
		if pattern.MatchString(sql) {
			warnings = append(warnings, fmt.Sprintf("Query matches potentially dangerous pattern: %s", pattern.String()))
		}
	}

	// Check for common syntax issues
	if strings.Count(sql, "(") != strings.Count(sql, ")") {
		errors = append(errors, "Mismatched parentheses")
	}

	if strings.Count(sql, "'")%2 != 0 {
		errors = append(errors, "Mismatched single quotes")
	}

	// Database-specific validation
	switch dbType {
	case "postgresql":
		if strings.Contains(sql, "LIMIT") && strings.Contains(sql, "TOP") {
			errors = append(errors, "PostgreSQL uses LIMIT, not TOP")
		}
	case "mysql":
		if strings.Contains(sql, "::") {
			warnings = append(warnings, "PostgreSQL-style type casting (::) found in MySQL query")
		}
	case "sqlserver":
		if strings.Contains(sql, "LIMIT") {
			errors = append(errors, "SQL Server uses TOP, not LIMIT")
		}
	}

	return errors, warnings
}

// generateExplanation creates a human-readable explanation of the SQL
func (s *NLToSQLService) generateExplanation(sql string) string {
	sql = strings.ToUpper(sql)

	parts := []string{}

	if strings.HasPrefix(sql, "SELECT") {
		parts = append(parts, "Retrieves data")

		if strings.Contains(sql, "JOIN") {
			joinCount := strings.Count(sql, "JOIN")
			parts = append(parts, fmt.Sprintf("joining %d table(s)", joinCount))
		}

		if strings.Contains(sql, "WHERE") {
			parts = append(parts, "with filtering conditions")
		}

		if strings.Contains(sql, "GROUP BY") {
			parts = append(parts, "grouped by specified columns")
		}

		if strings.Contains(sql, "ORDER BY") {
			parts = append(parts, "sorted")
		}

		if strings.Contains(sql, "LIMIT") {
			parts = append(parts, "with limited results")
		}
	} else if strings.HasPrefix(sql, "INSERT") {
		parts = append(parts, "Inserts new record(s)")
	} else if strings.HasPrefix(sql, "UPDATE") {
		parts = append(parts, "Updates existing record(s)")
	} else if strings.HasPrefix(sql, "DELETE") {
		parts = append(parts, "Deletes record(s)")
	}

	if len(parts) == 0 {
		return "SQL query generated"
	}

	return strings.Join(parts, ", ")
}

// formatSchemaForPrompt formats schema for LLM context
func (s *NLToSQLService) formatSchemaForPrompt(schema *domain.DatabaseSchema) string {
	if schema == nil || len(schema.Tables) == 0 {
		return ""
	}

	var builder strings.Builder
	for _, table := range schema.Tables {
		builder.WriteString(fmt.Sprintf("Table: %s\n", table.Name))
		builder.WriteString("Columns: ")

		cols := []string{}
		for _, col := range table.Columns {
			colStr := fmt.Sprintf("%s (%s)", col.Name, col.Type)
			cols = append(cols, colStr)
		}
		builder.WriteString(strings.Join(cols, ", "))
		builder.WriteString("\n")

		// Add primary key info
		if len(table.PrimaryKey) > 0 {
			builder.WriteString(fmt.Sprintf("Primary Key: %s\n", strings.Join(table.PrimaryKey, ", ")))
		}

		// Add foreign key info (relationships)
		if len(table.ForeignKeys) > 0 {
			builder.WriteString("Foreign Keys: ")
			fks := []string{}
			for _, fk := range table.ForeignKeys {
				fks = append(fks, fmt.Sprintf("%s -> %s.%s", fk.Column, fk.ReferencesTable, fk.ReferencesColumn))
			}
			builder.WriteString(strings.Join(fks, ", "))
			builder.WriteString("\n")
		}

		builder.WriteString("\n")
	}

	return builder.String()
}

// sqlMatchesSchema checks if the SQL uses tables/columns from the schema
func (s *NLToSQLService) sqlMatchesSchema(sql string, schemaText string) bool {
	sqlLower := strings.ToLower(sql)

	// Extract table names from schema (simple heuristic)
	tablePattern := regexp.MustCompile(`(?i)Table:\s*(\w+)`)
	tables := tablePattern.FindAllStringSubmatch(schemaText, -1)

	for _, match := range tables {
		if len(match) > 1 {
			tableName := strings.ToLower(match[1])
			if strings.Contains(sqlLower, tableName) {
				return true
			}
		}
	}

	return false
}

// generateCacheKey creates a unique key for caching
func (s *NLToSQLService) generateCacheKey(req *NLToSQLRequest) string {
	data := fmt.Sprintf("%s:%s:%s", req.NaturalLanguage, req.ConnectionID, req.DatabaseType)
	hash := sha256.Sum256([]byte(data))
	return hex.EncodeToString(hash[:])
}

// Get retrieves a cached response
func (c *NLToSQLCache) Get(key string) *CachedResponse {
	c.mutex.RLock()
	defer c.mutex.RUnlock()

	resp, exists := c.cache[key]
	if !exists {
		return nil
	}

	// Check if expired
	if time.Since(resp.CreatedAt) > c.ttl {
		return nil
	}

	return resp
}

// Set stores a response in the cache
func (c *NLToSQLCache) Set(key string, resp *CachedResponse) {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	c.cache[key] = resp

	// Simple cleanup: remove expired entries periodically
	if len(c.cache) > 1000 {
		c.cleanup()
	}
}

// cleanup removes expired entries
func (c *NLToSQLCache) cleanup() {
	now := time.Now()
	for key, resp := range c.cache {
		if now.Sub(resp.CreatedAt) > c.ttl {
			delete(c.cache, key)
		}
	}
}

// ExportCacheStats returns cache statistics for monitoring
func (c *NLToSQLCache) ExportCacheStats() map[string]interface{} {
	c.mutex.RLock()
	defer c.mutex.RUnlock()

	validCount := 0
	now := time.Now()
	for _, resp := range c.cache {
		if now.Sub(resp.CreatedAt) <= c.ttl {
			validCount++
		}
	}

	return map[string]interface{}{
		"total_entries": len(c.cache),
		"valid_entries": validCount,
		"ttl_minutes":   c.ttl.Minutes(),
	}
}
