package templates

import "fmt"

// SQL query generation prompts
const (
	// Prompt templates for different query types
	SelectPromptTemplate = `Generate a SQL SELECT query to %s for table "%s".
Include only necessary columns, use proper JOIN syntax, and add reasonable WHERE clauses for common use cases.`

	InsertPromptTemplate = `Generate a SQL INSERT statement for table "%s" with these columns: %s.
Include proper VALUES clause and parameter placeholders.`

	UpdatePromptTemplate = `Generate a SQL UPDATE statement for table "%s" to %s.
Include proper WHERE clause to target specific records.`

	DeletePromptTemplate = `Generate a SQL DELETE statement for table "%s" to %s.
Include proper WHERE clause to avoid accidental full table deletion.`

	// Natural language to SQL prompts
	NLToSQLPrompt = `Convert this natural language request to SQL: "%s"
Database schema context:
%s

Requirements:
- Use proper SQL syntax for %s
- Include appropriate JOINs if needed
- Add reasonable WHERE clauses
- Use parameterized queries where appropriate
- Consider performance implications`

	// Query optimization prompts
	OptimizationPrompt = `Analyze and optimize this SQL query for better performance:
Original Query: %s
Database Type: %s
Table Context: %s

Provide optimization suggestions for:
1. Index usage
2. Query structure
3. JOIN optimization
4. WHERE clause efficiency
5. Potential bottlenecks`

	// Schema analysis prompts
	SchemaAnalysisPrompt = `Analyze this database schema and provide insights:
Schema: %s
Database Type: %s

Provide analysis on:
1. Normalization level
2. Potential indexing opportunities
3. Performance considerations
4. Security implications
5. Suggested improvements`
)

// PromptBuilder helps build dynamic prompts
type PromptBuilder struct {
	databaseType string
	schemaInfo   string
	tableName    string
}

// NewPromptBuilder creates a new prompt builder
func NewPromptBuilder(dbType, schema, table string) *PromptBuilder {
	return &PromptBuilder{
		databaseType: dbType,
		schemaInfo:   schema,
		tableName:    table,
	}
}

// BuildSelectPrompt builds a SELECT query prompt
func (p *PromptBuilder) BuildSelectPrompt(description string) string {
	return fmt.Sprintf(SelectPromptTemplate, description, p.tableName)
}

// BuildInsertPrompt builds an INSERT query prompt
func (p *PromptBuilder) BuildInsertPrompt(columns []string) string {
	columnsStr := ""
	for i, col := range columns {
		if i > 0 {
			columnsStr += ", "
		}
		columnsStr += col
	}
	return fmt.Sprintf(InsertPromptTemplate, p.tableName, columnsStr)
}

// BuildUpdatePrompt builds an UPDATE query prompt
func (p *PromptBuilder) BuildUpdatePrompt(description string) string {
	return fmt.Sprintf(UpdatePromptTemplate, p.tableName, description)
}

// BuildDeletePrompt builds a DELETE query prompt
func (p *PromptBuilder) BuildDeletePrompt(description string) string {
	return fmt.Sprintf(DeletePromptTemplate, p.tableName, description)
}

// BuildNLToSQLPrompt builds a natural language to SQL prompt
func (p *PromptBuilder) BuildNLToSQLPrompt(naturalLanguage string) string {
	return fmt.Sprintf(NLToSQLPrompt, naturalLanguage, p.schemaInfo, p.databaseType)
}

// BuildOptimizationPrompt builds a query optimization prompt
func (p *PromptBuilder) BuildOptimizationPrompt(query string) string {
	return fmt.Sprintf(OptimizationPrompt, query, p.databaseType, p.schemaInfo)
}

// BuildSchemaAnalysisPrompt builds a schema analysis prompt
func (p *PromptBuilder) BuildSchemaAnalysisPrompt() string {
	return fmt.Sprintf(SchemaAnalysisPrompt, p.schemaInfo, p.databaseType)
}

// Predefined system prompts for AI interactions
const (
	SystemPrompt = `You are an expert database administrator and SQL query optimizer.
You help users write efficient, secure, and correct SQL queries.
Always consider:
- SQL injection prevention
- Performance optimization
- Proper error handling
- Database-specific best practices
- Data security and privacy`

	ErrorAnalysisPrompt = `Analyze this SQL error and provide a solution:
Error: %s
Query: %s
Database: %s

Explain:
1. What caused the error
2. How to fix it
3. How to prevent similar errors
4. Best practices related to this issue`

	QueryExplanationPrompt = `Explain this SQL query in simple terms:
Query: %s
Database Type: %s

Provide:
1. What the query does
2. How it works step by step
3. Potential performance implications
4. Suggestions for improvement`
)

// GetPromptByType returns the appropriate prompt template
func GetPromptByType(promptType string) string {
	switch promptType {
	case "select":
		return SelectPromptTemplate
	case "insert":
		return InsertPromptTemplate
	case "update":
		return UpdatePromptTemplate
	case "delete":
		return DeletePromptTemplate
	case "optimize":
		return OptimizationPrompt
	case "analyze":
		return SchemaAnalysisPrompt
	case "system":
		return SystemPrompt
	case "error":
		return ErrorAnalysisPrompt
	case "explain":
		return QueryExplanationPrompt
	default:
		return SystemPrompt
	}
}