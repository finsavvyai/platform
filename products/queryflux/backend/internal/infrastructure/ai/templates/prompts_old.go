package templates

const (
	// NLToSQLTemplate converts natural language to SQL
	NLToSQLTemplate = `You are an expert SQL generator. Convert the following natural language request into a precise SQL query.

Database Type: {{.DatabaseType}}
Database Schema:
{{.Schema}}

Natural Language Request: {{.NLQuery}}

Additional Context: {{.Context}}

{{if .Examples}}
Examples:
{{range .Examples}}
- {{.NLQuery}} -> {{.SQLQuery}}
{{end}}
{{end}}

Rules:
1. Generate valid SQL for {{.DatabaseType}}
2. Use only the tables and columns provided in the schema
3. Return ONLY the SQL query without any explanation, markdown formatting, or code blocks
4. Use proper JOIN syntax when joining tables
5. Include WHERE clauses for filtering conditions mentioned in the request
6. Use appropriate aggregate functions (COUNT, SUM, AVG, etc.) when needed
7. Apply ORDER BY for sorting requirements
8. Include LIMIT clause if a specific number of results is requested

SQL Query:`

	// QueryOptimizationTemplate analyzes and optimizes SQL queries
	QueryOptimizationTemplate = `You are a database performance expert. Analyze the following SQL query and provide optimization suggestions.

Database Type: {{.DatabaseType}}
SQL Query:
{{.SQLQuery}}

{{if .ExecutionPlan}}
Execution Plan:
{{.ExecutionPlan}}
{{end}}

{{if .PerformanceMetrics}}
Performance Metrics:
- Execution Time: {{.PerformanceMetrics.ExecutionTime}}
- Rows Returned: {{.PerformanceMetrics.RowsReturned}}
- Rows Scanned: {{.PerformanceMetrics.RowsScanned}}
- Memory Usage: {{.PerformanceMetrics.MemoryUsage}}
{{end}}

Provide a comprehensive analysis in the following JSON format:
{
  "optimized_query": "The optimized version of the query",
  "explanation": "Brief explanation of what was changed and why",
  "improvements": [
    {
      "type": "index|join|where|order_by|general",
      "description": "Description of the improvement",
      "impact": "high|medium|low",
      "change": "Before -> After"
    }
  ],
  "suggested_indexes": [
    {
      "table": "Table name",
      "columns": ["col1", "col2"],
      "type": "btree|hash|gin|gist",
      "reason": "Why this index would help",
      "impact": "high|medium|low",
      "estimated_gain": 25.0
    }
  ],
  "estimated_gain": 25.0,
  "confidence": 0.85
}

Focus on:
1. Identifying missing indexes that would significantly improve performance
2. Optimizing JOIN operations and join order
3. Improving WHERE clause conditions for better filtering
4. Eliminating unnecessary columns or operations
5. Suggesting query rewrites for better performance

Response:`

	// QueryExplanationTemplate explains SQL queries in human-readable terms
	QueryExplanationTemplate = `You are a SQL educator. Explain the following SQL query in clear, human-readable terms.

Database Type: {{.DatabaseType}}
SQL Query:
{{.SQLQuery}}

Target Audience: {{.Audience}} (beginner|intermediate|expert)
Complexity Level: {{.Complexity}} (simple|moderate|complex)
Language: {{.Language}}

Provide a comprehensive explanation in the following JSON format:
{
  "explanation": "A clear, concise explanation of what the query does",
  "steps": [
    {
      "order": 1,
      "operation": "Type of operation (e.g., SCAN, JOIN, FILTER, SORT)",
      "description": "What happens in this step",
      "table": "Table involved if applicable",
      "condition": "Conditions applied if any",
      "estimated_cost": 100.0
    }
  ],
  "complexity": "simple|moderate|complex",
  "performance_tips": [
    {
      "type": "indexing|query_structure|best_practice",
      "description": "Tip related to this query pattern",
      "impact": "high|medium|low"
    }
  ],
  "vocabulary": [
    {
      "term": "Technical term used",
      "definition": "Clear definition of the term",
      "example": "Example usage in context"
    }
  ]
}

Guidelines:
1. Break down the query into logical steps
2. Explain each step clearly for the target audience
3. Define technical terms for beginners
4. Provide practical performance tips
5. Use analogies or real-world examples when helpful

Response:`

	// ErrorAnalysisTemplate analyzes SQL errors and provides fixes
	ErrorAnalysisTemplate = `You are a database expert helping debug SQL queries.

Database Type: {{.DatabaseType}}
SQL Query:
{{.SQLQuery}}

Error Message:
{{.ErrorMessage}}

Analyze the error and provide a solution in this JSON format:
{
  "error_type": "syntax|logic|permission|constraint|other",
  "root_cause": "What's causing the error",
  "fixed_query": "The corrected SQL query",
  "explanation": "Why the error occurred and how the fix addresses it",
  "prevention_tips": [
    "Tip to avoid similar errors in the future"
  ],
  "confidence": 0.95
}

Response:`

	// SchemaAnalysisTemplate analyzes database schema for optimization
	SchemaAnalysisTemplate = `You are a database design expert. Analyze the following database schema for potential improvements.

Database Type: {{.DatabaseType}}
Database Schema:
{{.Schema}}

Provide analysis in this JSON format:
{
  "overall_health": "excellent|good|fair|poor",
  "issues": [
    {
      "type": "normalization|indexing|naming|performance|security",
      "severity": "high|medium|low",
      "description": "Description of the issue",
      "recommendation": "How to fix it",
      "impact": "Impact of fixing this issue"
    }
  ],
  "optimization_suggestions": [
    {
      "category": "indexes|constraints|partitioning|architecture",
      "suggestion": "Specific suggestion",
      "benefit": "Expected benefit",
      "effort": "low|medium|high"
    }
  ],
  "missing_indexes": [
    {
      "table": "Table name",
      "columns": ["col1", "col2"],
      "reason": "Why this index is needed",
      "priority": "high|medium|low"
    }
  ]
}

Focus on:
1. Normalization issues (duplicate data, anomalies)
2. Missing indexes on frequently queried columns
3. Foreign key constraints that should be added
4. Naming conventions and consistency
5. Potential performance bottlenecks

Response:`
)