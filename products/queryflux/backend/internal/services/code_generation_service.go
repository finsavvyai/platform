//go:build experimental_services

/**
 * Code Generation Service
 *
 * Generates code from database schemas in multiple languages and frameworks
 */

package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"text/template"
	"time"

	"go.uber.org/zap"
)

// CodeGenerationService handles code generation from database schemas
type CodeGenerationService struct {
	aiService       *AIService
	schemaService   *SchemaIntrospectionService
	templateManager *TemplateManager
	validator       *GeneratedCodeValidator
	logger          *zap.Logger
}

// SchemaIntrospectionService handles database schema introspection
type SchemaIntrospectionService struct {
	queryService *QueryExecutionService
	logger       *zap.Logger
}

// TemplateManager manages code generation templates
type TemplateManager struct {
	templates map[string]*template.Template
	logger    *zap.Logger
}

// GeneratedCodeValidator validates generated code
type GeneratedCodeValidator struct {
	aiService *AIService
	logger    *zap.Logger
}

// DatabaseSchema represents a complete database schema
type DatabaseSchema struct {
	Tables         []TableSchema  `json:"tables"`
	Views          []ViewSchema   `json:"views,omitempty"`
	Enums          []EnumSchema   `json:"enums,omitempty"`
	Connection     ConnectionInfo `json:"connection"`
	IntrospectedAt time.Time      `json:"introspectedAt"`
}

// TableSchema represents a database table
type TableSchema struct {
	Name        string         `json:"name"`
	Schema      string         `json:"schema,omitempty"`
	Columns     []ColumnSchema `json:"columns"`
	PrimaryKeys []string       `json:"primaryKeys"`
	ForeignKeys []ForeignKey   `json:"foreignKeys,omitempty"`
	Indexes     []IndexSchema  `json:"indexes,omitempty"`
	Comment     string         `json:"comment,omitempty"`
}

// ColumnSchema represents a table column
type ColumnSchema struct {
	Name          string   `json:"name"`
	Type          string   `json:"type"`
	Nullable      bool     `json:"nullable"`
	DefaultValue  string   `json:"defaultValue,omitempty"`
	AutoIncrement bool     `json:"autoIncrement"`
	Comment       string   `json:"comment,omitempty"`
	EnumValues    []string `json:"enumValues,omitempty"`
}

// ForeignKey represents a foreign key relationship
type ForeignKey struct {
	Name             string `json:"name"`
	Column           string `json:"column"`
	ReferencedTable  string `json:"referencedTable"`
	ReferencedColumn string `json:"referencedColumn"`
	OnDelete         string `json:"onDelete,omitempty"`
	OnUpdate         string `json:"onUpdate,omitempty"`
}

// IndexSchema represents a table index
type IndexSchema struct {
	Name    string   `json:"name"`
	Columns []string `json:"columns"`
	Unique  bool     `json:"unique"`
	Type    string   `json:"type,omitempty"`
}

// ViewSchema represents a database view
type ViewSchema struct {
	Name       string         `json:"name"`
	Schema     string         `json:"schema,omitempty"`
	Definition string         `json:"definition"`
	Columns    []ColumnSchema `json:"columns"`
	Comment    string         `json:"comment,omitempty"`
}

// EnumSchema represents an enum type
type EnumSchema struct {
	Name   string   `json:"name"`
	Values []string `json:"values"`
}

// ConnectionInfo represents database connection information
type ConnectionInfo struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Type     string `json:"type"`
	Host     string `json:"host,omitempty"`
	Port     int    `json:"port,omitempty"`
	Database string `json:"database,omitempty"`
}

// CodeGenerationRequest represents a code generation request
type CodeGenerationRequest struct {
	Language     string                 `json:"language"`  // typescript, python, go, java, etc.
	Framework    string                 `json:"framework"` // prisma, sqlalchemy, gorm, etc.
	Template     string                 `json:"template"`  // rest_api, crud, orm_models, etc.
	Tables       []string               `json:"tables"`    // Specific tables to generate (empty = all)
	Schema       *DatabaseSchema        `json:"schema"`
	OutputFormat string                 `json:"outputFormat"` // single_file, multi_file, archive
	Options      map[string]interface{} `json:"options"`
}

// CodeGenerationResult represents the result of code generation
type CodeGenerationResult struct {
	Files       []GeneratedFile  `json:"files"`
	Validation  ValidationResult `json:"validation"`
	GeneratedAt time.Time        `json:"generatedAt"`
	Language    string           `json:"language"`
	Framework   string           `json:"framework"`
	TotalLines  int              `json:"totalLines"`
	TotalFiles  int              `json:"totalFiles"`
}

// GeneratedFile represents a generated file
type GeneratedFile struct {
	Path     string `json:"path"`
	Content  string `json:"content"`
	Language string `json:"language"`
	Size     int    `json:"size"`
}

// ValidationResult represents the validation result
type ValidationResult struct {
	Valid       bool     `json:"valid"`
	Errors      []string `json:"errors,omitempty"`
	Warnings    []string `json:"warnings,omitempty"`
	Suggestions []string `json:"suggestions,omitempty"`
}

// NewCodeGenerationService creates a new code generation service
func NewCodeGenerationService(
	aiService *AIService,
	queryService *QueryExecutionService,
	logger *zap.Logger,
) *CodeGenerationService {
	return &CodeGenerationService{
		aiService:       aiService,
		schemaService:   NewSchemaIntrospectionService(queryService, logger),
		templateManager: NewTemplateManager(logger),
		validator:       NewGeneratedCodeValidator(aiService, logger),
		logger:          logger,
	}
}

// IntrospectSchema introspects a database schema
func (s *CodeGenerationService) IntrospectSchema(
	ctx context.Context,
	connectionID string,
) (*DatabaseSchema, error) {
	s.logger.Info("introspecting database schema", zap.String("connection_id", connectionID))

	schema, err := s.schemaService.Introspect(ctx, connectionID)
	if err != nil {
		return nil, fmt.Errorf("schema introspection failed: %w", err)
	}

	s.logger.Info("schema introspection completed",
		zap.Int("tables", len(schema.Tables)),
		zap.Int("views", len(schema.Views)),
		zap.Int("enums", len(schema.Enums)),
	)

	return schema, nil
}

// GenerateCode generates code from a database schema
func (s *CodeGenerationService) GenerateCode(
	ctx context.Context,
	request *CodeGenerationRequest,
) (*CodeGenerationResult, error) {
	s.logger.Info("generating code",
		zap.String("language", request.Language),
		zap.String("framework", request.Framework),
		zap.String("template", request.Template),
	)

	startTime := time.Now()

	// Validate request
	if err := s.validateRequest(request); err != nil {
		return nil, fmt.Errorf("invalid request: %w", err)
	}

	// Generate code using templates
	files, err := s.templateManager.Generate(request)
	if err != nil {
		return nil, fmt.Errorf("code generation failed: %w", err)
	}

	// Validate generated code
	validation, err := s.validator.Validate(ctx, request, files)
	if err != nil {
		s.logger.Warn("code validation failed", zap.Error(err))
		// Continue anyway, just include validation results
	}

	// Calculate statistics
	totalLines := 0
	for _, file := range files {
		totalLines += len(strings.Split(file.Content, "\n"))
	}

	result := &CodeGenerationResult{
		Files:       files,
		Validation:  validation,
		GeneratedAt: time.Now(),
		Language:    request.Language,
		Framework:   request.Framework,
		TotalLines:  totalLines,
		TotalFiles:  len(files),
	}

	duration := time.Since(startTime).Milliseconds()
	s.logger.Info("code generation completed",
		zap.Int("files", len(files)),
		zap.Int("lines", totalLines),
		zap.Int64("duration_ms", duration),
	)

	return result, nil
}

// GenerateWithAI generates code using AI for custom requirements
func (s *CodeGenerationService) GenerateWithAI(
	ctx context.Context,
	prompt string,
	schema *DatabaseSchema,
) (*CodeGenerationResult, error) {
	s.logger.Info("generating code with AI")

	// Build system prompt
	systemPrompt := `You are an expert code generator. Generate clean, well-documented code based on the database schema provided.
Follow best practices for the requested language/framework.
Include proper error handling, type definitions, and documentation.
Respond with a JSON object containing "files" array with "path" and "content" fields.`

	// Build user message with schema and prompt
	schemaJSON, _ := json.Marshal(schema)
	userMessage := fmt.Sprintf("Prompt: %s\n\nSchema: %s", prompt, string(schemaJSON))

	// Create AI request
	request := AIRequest{
		Messages: []AIMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userMessage},
		},
		Model:       ModelGPT4,
		Temperature: 0.3,
		MaxTokens:   4000,
	}

	// Execute AI request
	response, err := s.aiService.Execute(ctx, request)
	if err != nil {
		return nil, fmt.Errorf("AI code generation failed: %w", err)
	}

	// Parse AI response
	var result struct {
		Files []struct {
			Path    string `json:"path"`
			Content string `json:"content"`
		} `json:"files"`
	}

	if err := json.Unmarshal([]byte(response.Content), &result); err != nil {
		return nil, fmt.Errorf("failed to parse AI response: %w", err)
	}

	// Convert to GeneratedFile
	files := make([]GeneratedFile, len(result.Files))
	totalLines := 0
	for i, file := range result.Files {
		files[i] = GeneratedFile{
			Path:    file.Path,
			Content: file.Content,
			Size:    len(file.Content),
		}
		totalLines += len(strings.Split(file.Content, "\n"))
	}

	return &CodeGenerationResult{
		Files:       files,
		Validation:  ValidationResult{Valid: true},
		GeneratedAt: time.Now(),
		TotalLines:  totalLines,
		TotalFiles:  len(files),
	}, nil
}

// validateRequest validates a code generation request
func (s *CodeGenerationService) validateRequest(request *CodeGenerationRequest) error {
	if request.Language == "" {
		return fmt.Errorf("language is required")
	}

	if request.Schema == nil {
		return fmt.Errorf("schema is required")
	}

	if len(request.Schema.Tables) == 0 {
		return fmt.Errorf("schema must contain at least one table")
	}

	return nil
}

// NewSchemaIntrospectionService creates a new schema introspection service
func NewSchemaIntrospectionService(
	queryService *QueryExecutionService,
	logger *zap.Logger,
) *SchemaIntrospectionService {
	return &SchemaIntrospectionService{
		queryService: queryService,
		logger:       logger,
	}
}

// Introspect introspects a database schema
func (s *SchemaIntrospectionService) Introspect(
	ctx context.Context,
	connectionID string,
) (*DatabaseSchema, error) {
	// Get table names
	tables, err := s.getTables(ctx, connectionID)
	if err != nil {
		return nil, err
	}

	// Introspect each table
	schema := &DatabaseSchema{
		Tables:         make([]TableSchema, 0),
		Views:          make([]ViewSchema, 0),
		Enums:          make([]EnumSchema, 0),
		IntrospectedAt: time.Now(),
	}

	for _, tableName := range tables {
		table, err := s.introspectTable(ctx, connectionID, tableName)
		if err != nil {
			s.logger.Warn("failed to introspect table",
				zap.String("table", tableName),
				zap.Error(err),
			)
			continue
		}
		schema.Tables = append(schema.Tables, *table)
	}

	return schema, nil
}

// getTables gets all table names from the database
func (s *SchemaIntrospectionService) getTables(
	ctx context.Context,
	connectionID string,
) ([]string, error) {
	// This would use the query service to execute a database-specific query
	// For PostgreSQL: SELECT tablename FROM pg_tables WHERE schemaname = 'public'
	// For MySQL: SHOW TABLES
	// For SQLite: SELECT name FROM sqlite_master WHERE type='table'

	// Placeholder implementation
	query := "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
	result, err := s.queryService.ExecuteQuery(ctx, connectionID, query)
	if err != nil {
		return nil, err
	}

	var tables []string
	for _, row := range result.Rows {
		if len(row) > 0 {
			tables = append(tables, fmt.Sprintf("%v", row[0]))
		}
	}

	return tables, nil
}

// introspectTable introspects a single table
func (s *SchemaIntrospectionService) introspectTable(
	ctx context.Context,
	connectionID string,
	tableName string,
) (*TableSchema, error) {
	// Get columns
	columns, err := s.getColumns(ctx, connectionID, tableName)
	if err != nil {
		return nil, err
	}

	// Get primary keys
	primaryKeys, err := s.getPrimaryKeys(ctx, connectionID, tableName)
	if err != nil {
		return nil, err
	}

	// Get foreign keys
	foreignKeys, err := s.getForeignKeys(ctx, connectionID, tableName)
	if err != nil {
		return nil, err
	}

	// Get indexes
	indexes, err := s.getIndexes(ctx, connectionID, tableName)
	if err != nil {
		return nil, err
	}

	return &TableSchema{
		Name:        tableName,
		Columns:     columns,
		PrimaryKeys: primaryKeys,
		ForeignKeys: foreignKeys,
		Indexes:     indexes,
	}, nil
}

// getColumns gets column information for a table
func (s *SchemaIntrospectionService) getColumns(
	ctx context.Context,
	connectionID string,
	tableName string,
) ([]ColumnSchema, error) {
	// PostgreSQL query to get column information
	query := `
		SELECT
			column_name,
			data_type,
			is_nullable,
			column_default,
			CASE
				WHEN column_default LIKE 'nextval%'
				THEN true
				ELSE false
			END as auto_increment
		FROM information_schema.columns
		WHERE table_name = $1
		ORDER BY ordinal_position
	`

	result, err := s.queryService.ExecuteQuery(ctx, connectionID, query, tableName)
	if err != nil {
		return nil, err
	}

	columns := make([]ColumnSchema, len(result.Rows))
	for i, row := range result.Rows {
		columns[i] = ColumnSchema{
			Name:          fmt.Sprintf("%v", row[0]),
			Type:          fmt.Sprintf("%v", row[1]),
			Nullable:      fmt.Sprintf("%v", row[2]) == "YES",
			DefaultValue:  fmt.Sprintf("%v", row[3]),
			AutoIncrement: fmt.Sprintf("%v", row[4]) == "true",
		}
	}

	return columns, nil
}

// getPrimaryKeys gets primary key columns for a table
func (s *SchemaIntrospectionService) getPrimaryKeys(
	ctx context.Context,
	connectionID string,
	tableName string,
) ([]string, error) {
	query := `
		SELECT a.attname
		FROM pg_index i
		JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
		WHERE i.indrelid = $1::regclass AND i.indisprimary
	`

	result, err := s.queryService.ExecuteQuery(ctx, connectionID, query, tableName)
	if err != nil {
		return nil, err
	}

	keys := make([]string, len(result.Rows))
	for i, row := range result.Rows {
		keys[i] = fmt.Sprintf("%v", row[0])
	}

	return keys, nil
}

// getForeignKeys gets foreign key relationships for a table
func (s *SchemaIntrospectionService) getForeignKeys(
	ctx context.Context,
	connectionID string,
	tableName string,
) ([]ForeignKey, error) {
	query := `
		SELECT
			tc.constraint_name,
			kcu.column_name,
			ccu.table_name AS foreign_table_name,
			ccu.column_name AS foreign_column_name
		FROM information_schema.table_constraints AS tc
		JOIN information_schema.key_column_usage AS kcu
			ON tc.constraint_name = kcu.constraint_name
			AND tc.table_schema = kcu.table_schema
		JOIN information_schema.constraint_column_usage AS ccu
			ON ccu.constraint_name = tc.constraint_name
			AND ccu.table_schema = tc.table_schema
		WHERE tc.constraint_type = 'FOREIGN KEY'
		AND tc.table_name = $1
	`

	result, err := s.queryService.ExecuteQuery(ctx, connectionID, query, tableName)
	if err != nil {
		return nil, err
	}

	fks := make([]ForeignKey, len(result.Rows))
	for i, row := range result.Rows {
		fks[i] = ForeignKey{
			Name:             fmt.Sprintf("%v", row[0]),
			Column:           fmt.Sprintf("%v", row[1]),
			ReferencedTable:  fmt.Sprintf("%v", row[2]),
			ReferencedColumn: fmt.Sprintf("%v", row[3]),
		}
	}

	return fks, nil
}

// getIndexes gets indexes for a table
func (s *SchemaIntrospectionService) getIndexes(
	ctx context.Context,
	connectionID string,
	tableName string,
) ([]IndexSchema, error) {
	query := `
		SELECT
			i.relname as index_name,
			a.attname as column_name,
			idx.indisunique as is_unique
		FROM pg_index idx
		JOIN pg_class t ON idx.indrelid = t.oid
		JOIN pg_class i ON idx.indexrelid = i.oid
		JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(idx.indkey)
		WHERE t.relname = $1
		ORDER BY i.relname, a.attnum
	`

	result, err := s.queryService.ExecuteQuery(ctx, connectionID, query, tableName)
	if err != nil {
		return nil, err
	}

	// Group columns by index
	indexMap := make(map[string]*IndexSchema)
	for _, row := range result.Rows {
		indexName := fmt.Sprintf("%v", row[0])
		columnName := fmt.Sprintf("%v", row[1])
		isUnique := fmt.Sprintf("%v", row[2]) == "true"

		if idx, exists := indexMap[indexName]; exists {
			idx.Columns = append(idx.Columns, columnName)
		} else {
			indexMap[indexName] = &IndexSchema{
				Name:    indexName,
				Columns: []string{columnName},
				Unique:  isUnique,
			}
		}
	}

	// Convert map to slice
	indexes := make([]IndexSchema, 0, len(indexMap))
	for _, idx := range indexMap {
		indexes = append(indexes, *idx)
	}

	return indexes, nil
}

// NewGeneratedCodeValidator creates a new code validator
func NewGeneratedCodeValidator(
	aiService *AIService,
	logger *zap.Logger,
) *GeneratedCodeValidator {
	return &GeneratedCodeValidator{
		aiService: aiService,
		logger:    logger,
	}
}

// Validate validates generated code
func (v *GeneratedCodeValidator) Validate(
	ctx context.Context,
	request *CodeGenerationRequest,
	files []GeneratedFile,
) (ValidationResult, error) {
	// Use AI to validate code quality
	systemPrompt := `You are a code quality expert. Review the generated code for:
1. Syntax errors
2. Type safety
3. Best practices
4. Security vulnerabilities
5. Performance issues
6. Code organization

Respond with JSON: {"valid": boolean, "errors": ["error1", ...], "warnings": ["warn1", ...], "suggestions": ["suggestion1", ...]}`

	// Build code summary
	var codeSummary bytes.Buffer
	codeSummary.WriteString(fmt.Sprintf("Language: %s\n", request.Language))
	codeSummary.WriteString(fmt.Sprintf("Framework: %s\n", request.Framework))
	codeSummary.WriteString("Files:\n")
	for _, file := range files {
		codeSummary.WriteString(fmt.Sprintf("- %s (%d lines)\n", file.Path, len(strings.Split(file.Content, "\n"))))
	}

	userMessage := fmt.Sprintf("Validate this generated code:\n\n%s", codeSummary.String())

	aiRequest := AIRequest{
		Messages: []AIMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userMessage},
		},
		Model:       ModelGPT4,
		Temperature: 0.2,
		MaxTokens:   1000,
	}

	response, err := v.aiService.Execute(ctx, aiRequest)
	if err != nil {
		return ValidationResult{Valid: false, Errors: []string{"AI validation failed"}}, nil
	}

	var result ValidationResult
	if err := json.Unmarshal([]byte(response.Content), &result); err != nil {
		return ValidationResult{Valid: false, Errors: []string{"Failed to parse validation result"}}, nil
	}

	return result, nil
}

// NewTemplateManager creates a new template manager
func NewTemplateManager(logger *zap.Logger) *TemplateManager {
	tm := &TemplateManager{
		templates: make(map[string]*template.Template),
		logger:    logger,
	}

	tm.registerDefaultTemplates()

	return tm
}

// Generate generates code from templates
func (tm *TemplateManager) Generate(request *CodeGenerationRequest) ([]GeneratedFile, error) {
	files := []GeneratedFile{}

	// Generate files based on template type
	switch request.Template {
	case "orm_models":
		return tm.generateORMModels(request)
	case "rest_api":
		return tm.generateRESTAPI(request)
	case "crud":
		return tm.generateCRUD(request)
	default:
		return nil, fmt.Errorf("unsupported template: %s", request.Template)
	}
}

// generateORMModels generates ORM model files
func (tm *TemplateManager) generateORMModels(request *CodeGenerationRequest) ([]GeneratedFile, error) {
	files := []GeneratedFile{}

	for _, table := range request.Schema.Tables {
		// Generate model file
		content, err := tm.renderTemplate(fmt.Sprintf("%s_orm_model", request.Language), table)
		if err != nil {
			return nil, err
		}

		files = append(files, GeneratedFile{
			Path:     fmt.Sprintf("models/%s.go", strings.ToLower(table.Name)),
			Content:  content,
			Language: request.Language,
			Size:     len(content),
		})
	}

	return files, nil
}

// generateRESTAPI generates REST API files
func (tm *TemplateManager) generateRESTAPI(request *CodeGenerationRequest) ([]GeneratedFile, error) {
	files := []GeneratedFile{}

	// Generate main API file
	mainContent, err := tm.renderTemplate(fmt.Sprintf("%s_rest_api_main", request.Language), request.Schema)
	if err != nil {
		return nil, err
	}

	files = append(files, GeneratedFile{
		Path:     "main.go",
		Content:  mainContent,
		Language: request.Language,
		Size:     len(mainContent),
	})

	// Generate handler files for each table
	for _, table := range request.Schema.Tables {
		handlerContent, err := tm.renderTemplate(fmt.Sprintf("%s_rest_api_handler", request.Language), table)
		if err != nil {
			return nil, err
		}

		files = append(files, GeneratedFile{
			Path:     fmt.Sprintf("handlers/%s_handler.go", strings.ToLower(table.Name)),
			Content:  handlerContent,
			Language: request.Language,
			Size:     len(handlerContent),
		})
	}

	return files, nil
}

// generateCRUD generates CRUD operation files
func (tm *TemplateManager) generateCRUD(request *CodeGenerationRequest) ([]GeneratedFile, error) {
	files := []GeneratedFile{}

	for _, table := range request.Schema.Tables {
		// Generate CRUD operations file
		content, err := tm.renderTemplate(fmt.Sprintf("%s_crud", request.Language), table)
		if err != nil {
			return nil, err
		}

		files = append(files, GeneratedFile{
			Path:     fmt.Sprintf("crud/%s_crud.go", strings.ToLower(table.Name)),
			Content:  content,
			Language: request.Language,
			Size:     len(content),
		})
	}

	return files, nil
}

// renderTemplate renders a template with data
func (tm *TemplateManager) renderTemplate(name string, data interface{}) (string, error) {
	tmpl, exists := tm.templates[name]
	if !exists {
		return "", fmt.Errorf("template not found: %s", name)
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return "", err
	}

	return buf.String(), nil
}

// registerDefaultTemplates registers default code templates
func (tm *TemplateManager) registerDefaultTemplates() {
	// Go ORM model template (simplified)
	goORMModel := `package models

type {{.Name}} struct {
	{{- range .Columns}}
	{{title .Name}} {{.Type}} ` + "`json:\"{{.Name}}\"`" + `{{if .Comment}} // {{.Comment}}{{end}}
	{{- end}}
}
`
	tmpl, _ := template.New("go_orm_model").Funcs(template.FuncMap{
		"title": strings.Title,
	}).Parse(goORMModel)
	tm.templates["go_orm_model"] = tmpl

	// TypeScript ORM model template
	tsORMModel := `export interface {{.Name}} {
	{{- range .Columns}}
	{{.Name}}: {{.Type}}{{if .Nullable}} | null{{end}};
	{{- end}}
}

export class {{.Name}}Model {
	// Model methods here
}
`
	tmpl, _ = template.New("typescript_orm_model").Parse(tsORMModel)
	tm.templates["typescript_orm_model"] = tmpl
}
