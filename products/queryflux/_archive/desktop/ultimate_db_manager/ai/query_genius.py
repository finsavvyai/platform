#!/usr/bin/env python3
"""
AI Query Genius - The World's Most Advanced SQL Assistant
GPT-4 powered natural language to SQL conversion and optimization
"""

import os
import json
import asyncio
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass
from enum import Enum

from langchain_openai import ChatOpenAI
from langchain.prompts import ChatPromptTemplate
from langchain.schema import SystemMessage, HumanMessage
from langchain.agents import create_sql_agent
from langchain.agents.agent_toolkits import SQLDatabaseToolkit
from langchain.sql_database import SQLDatabase
from langchain_core.runnables import RunnableSequence

import logging

logger = logging.getLogger(__name__)

class QueryComplexity(Enum):
    SIMPLE = "simple"
    MODERATE = "moderate"
    COMPLEX = "complex"
    EXPERT = "expert"

@dataclass
class QueryAnalysis:
    """Analysis of a SQL query"""
    complexity: QueryComplexity
    estimated_time: float
    performance_score: int  # 1-100
    risks: List[str]
    optimizations: List[str]
    explanation: str

@dataclass
class QuerySuggestion:
    """AI-generated query suggestion"""
    sql: str
    confidence: float  # 0-1
    explanation: str
    performance_prediction: float
    alternative_approaches: List[str]

class AIQueryGenius:
    """The ultimate AI-powered SQL assistant"""

    def __init__(self, api_key: Optional[str] = None):
        """Initialize the AI Query Genius"""
        self.api_key = api_key or os.environ.get("OPENAI_API_KEY")
        if not self.api_key:
            logger.warning("No OpenAI API key provided. AI features will be disabled.")
            self.enabled = False
            return

        self.enabled = True
        self.llm = ChatOpenAI(
            model="gpt-4-turbo-preview",
            temperature=0.1,  # Low temperature for consistent SQL generation
            api_key=self.api_key,
            max_tokens=2000
        )

        # Initialize prompt templates
        self.setup_prompts()

        logger.info("🤖 AI Query Genius initialized with GPT-4")

    def setup_prompts(self):
        """Setup prompt templates for different AI tasks"""

        # Natural language to SQL prompt
        self.nl_to_sql_prompt = ChatPromptTemplate.from_messages([
            ("system", """You are the world's most advanced SQL expert. Your job is to convert natural language questions into optimal SQL queries.

RULES:
1. Generate syntactically correct PostgreSQL
2. Use proper table/column names from the schema
3. Consider performance and use indexes wisely
4. Handle edge cases (NULL values, data types)
5. Use CTEs and window functions when beneficial
6. Always explain your reasoning

SCHEMA INFORMATION:
{schema_info}

AVAILABLE FUNCTIONS:
- STRING_AGG() for concatenation
- EXTRACT() for date parts
- COALESCE() for NULL handling
- CASE WHEN for conditional logic

Generate clean, efficient SQL that a senior developer would write."""),

            ("human", "Convert this to SQL: {question}")
        ])

        # Query optimization prompt
        self.optimization_prompt = ChatPromptTemplate.from_messages([
            ("system", """You are a PostgreSQL performance optimization expert. Analyze the given query and provide specific optimization recommendations.

ANALYZE FOR:
1. Index usage and recommendations
2. Query execution plan improvements
3. JOIN order optimization
4. Subquery vs CTE performance
5. Data type optimizations
6. Potential bottlenecks

PROVIDE:
- Rewritten optimized query
- Specific index recommendations
- Performance impact estimation
- Potential risks/trade-offs

SCHEMA INFO:
{schema_info}"""),

            ("human", "Optimize this query: {query}")
        ])

        # Query explanation prompt
        self.explanation_prompt = ChatPromptTemplate.from_messages([
            ("system", """You are a SQL teacher who explains complex queries in simple terms. Break down the query into understandable parts.

EXPLAIN:
1. What the query does (business logic)
2. How it works (technical approach)
3. Each part's purpose
4. Expected performance characteristics
5. Potential issues or improvements

Use simple language that a junior developer could understand."""),

            ("human", "Explain this query: {query}")
        ])

        # Schema analysis prompt
        self.schema_analysis_prompt = ChatPromptTemplate.from_messages([
            ("system", """You are a database architect analyzing schema design. Provide insights and recommendations.

ANALYZE:
1. Table relationships and constraints
2. Normalization opportunities
3. Index strategy
4. Data type optimization
5. Scalability concerns
6. Best practice recommendations

Be specific and actionable."""),

            ("human", "Analyze this schema: {schema}")
        ])

    async def natural_language_to_sql(
        self,
        question: str,
        schema_info: Dict[str, Any],
        context: Optional[Dict] = None
    ) -> QuerySuggestion:
        """Convert natural language to SQL using GPT-4"""

        if not self.enabled:
            return QuerySuggestion(
                sql="-- AI features disabled (no OpenAI API key)",
                confidence=0.0,
                explanation="OpenAI API key required for AI features",
                performance_prediction=0.0,
                alternative_approaches=[]
            )

        try:
            # Format schema information
            schema_text = self.format_schema_for_ai(schema_info)

            # Generate SQL using the chain
            chain = self.nl_to_sql_prompt | self.llm

            response = await chain.ainvoke({
                "question": question,
                "schema_info": schema_text
            })

            # Parse the response
            sql_query, confidence, explanation = self.parse_sql_response(response.content)

            # Predict performance
            performance_prediction = await self.predict_query_performance(sql_query, schema_info)

            # Generate alternatives
            alternatives = await self.generate_alternative_approaches(question, schema_info)

            return QuerySuggestion(
                sql=sql_query,
                confidence=confidence,
                explanation=explanation,
                performance_prediction=performance_prediction,
                alternative_approaches=alternatives
            )

        except Exception as e:
            logger.error(f"Natural language to SQL failed: {e}")
            return QuerySuggestion(
                sql=f"-- Error: {str(e)}",
                confidence=0.0,
                explanation=f"Failed to generate SQL: {str(e)}",
                performance_prediction=0.0,
                alternative_approaches=[]
            )

    async def optimize_query(
        self,
        query: str,
        schema_info: Dict[str, Any],
        execution_stats: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Optimize a SQL query using AI"""

        if not self.enabled:
            return {
                "optimized_query": query,
                "improvements": ["AI features disabled"],
                "performance_gain": "0%",
                "confidence": 0.0
            }

        try:
            schema_text = self.format_schema_for_ai(schema_info)

            # Add execution stats if available
            context = f"Original query: {query}\n"
            if execution_stats:
                context += f"Execution time: {execution_stats.get('time', 'N/A')}\n"
                context += f"Rows affected: {execution_stats.get('rows', 'N/A')}\n"

            chain = self.optimization_prompt | self.llm

            response = await chain.ainvoke({
                "query": context,
                "schema_info": schema_text
            })

            return self.parse_optimization_response(response.content)

        except Exception as e:
            logger.error(f"Query optimization failed: {e}")
            return {
                "optimized_query": query,
                "improvements": [f"Optimization failed: {str(e)}"],
                "performance_gain": "0%",
                "confidence": 0.0
            }

    async def explain_query(self, query: str, context: Optional[Dict] = None) -> str:
        """Explain a SQL query in plain English"""

        if not self.enabled:
            return "AI features disabled. Please provide OpenAI API key for query explanations."

        try:
            chain = self.explanation_prompt | self.llm

            response = await chain.ainvoke({
                "query": query
            })

            return response.content

        except Exception as e:
            logger.error(f"Query explanation failed: {e}")
            return f"Failed to explain query: {str(e)}"

    async def analyze_schema(self, schema_info: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze database schema and provide recommendations"""

        if not self.enabled:
            return {
                "analysis": "AI features disabled",
                "recommendations": [],
                "issues": [],
                "score": 0
            }

        try:
            schema_text = self.format_schema_for_ai(schema_info)

            chain = self.schema_analysis_prompt | self.llm

            response = await chain.ainvoke({
                "schema": schema_text
            })

            return self.parse_schema_analysis(response.content)

        except Exception as e:
            logger.error(f"Schema analysis failed: {e}")
            return {
                "analysis": f"Schema analysis failed: {str(e)}",
                "recommendations": [],
                "issues": [str(e)],
                "score": 0
            }

    async def generate_test_data(
        self,
        table_name: str,
        schema: Dict[str, Any],
        num_rows: int = 100
    ) -> str:
        """Generate realistic test data for a table"""

        if not self.enabled:
            return "-- AI features disabled"

        try:
            prompt = f"""Generate realistic test data INSERT statements for this table:

Table: {table_name}
Schema: {json.dumps(schema, indent=2)}
Rows needed: {num_rows}

Requirements:
1. Generate realistic, diverse data
2. Respect foreign key constraints
3. Include edge cases (NULL values where allowed)
4. Use proper data types
5. Make data meaningful for testing

Generate complete INSERT statements."""

            response = await self.llm.ainvoke([HumanMessage(content=prompt)])
            return response.content

        except Exception as e:
            logger.error(f"Test data generation failed: {e}")
            return f"-- Error generating test data: {str(e)}"

    async def detect_query_issues(self, query: str, schema_info: Dict[str, Any]) -> List[Dict[str, str]]:
        """Detect potential issues in a SQL query"""

        issues = []

        if not self.enabled:
            return [{"type": "warning", "message": "AI issue detection disabled"}]

        try:
            prompt = f"""Analyze this SQL query for potential issues:

Query: {query}
Schema: {self.format_schema_for_ai(schema_info)}

Look for:
1. Performance issues (missing indexes, inefficient JOINs)
2. Security issues (SQL injection risks)
3. Logic errors (incorrect conditions)
4. Data type mismatches
5. Missing constraints or validations
6. Scalability concerns

Return issues in this format:
TYPE: CRITICAL/WARNING/INFO
MESSAGE: Description of the issue
SOLUTION: How to fix it"""

            response = await self.llm.ainvoke([HumanMessage(content=prompt)])
            return self.parse_issues_response(response.content)

        except Exception as e:
            logger.error(f"Issue detection failed: {e}")
            return [{"type": "error", "message": f"Issue detection failed: {str(e)}"}]

    def format_schema_for_ai(self, schema_info: Dict[str, Any]) -> str:
        """Format schema information for AI prompts"""

        formatted = "DATABASE SCHEMA:\n"
        formatted += "=" * 50 + "\n\n"

        for table_name, table_info in schema_info.items():
            formatted += f"Table: {table_name}\n"
            formatted += "-" * 30 + "\n"

            if isinstance(table_info, list):
                # Column information
                for col in table_info:
                    col_line = f"  • {col.get('column_name', 'unknown')}"
                    col_line += f" ({col.get('data_type', 'unknown')})"
                    if col.get('is_nullable') == 'NO':
                        col_line += " NOT NULL"
                    if col.get('column_default'):
                        col_line += f" DEFAULT {col.get('column_default')}"
                    formatted += col_line + "\n"
            else:
                formatted += f"  Info: {str(table_info)}\n"

            formatted += "\n"

        return formatted

    def parse_sql_response(self, response: str) -> Tuple[str, float, str]:
        """Parse SQL generation response"""

        # Extract SQL from response (look for SQL code blocks)
        lines = response.split('\n')
        sql_lines = []
        in_sql_block = False
        explanation_lines = []

        for line in lines:
            if '```sql' in line.lower():
                in_sql_block = True
                continue
            elif '```' in line and in_sql_block:
                in_sql_block = False
                continue
            elif in_sql_block:
                sql_lines.append(line)
            else:
                explanation_lines.append(line)

        sql_query = '\n'.join(sql_lines).strip()
        explanation = '\n'.join(explanation_lines).strip()

        # Estimate confidence based on response quality
        confidence = 0.8 if sql_query and len(sql_query) > 10 else 0.3

        return sql_query, confidence, explanation

    def parse_optimization_response(self, response: str) -> Dict[str, Any]:
        """Parse query optimization response"""

        # Basic parsing - in production, this would be more sophisticated
        return {
            "optimized_query": self.extract_sql_from_response(response),
            "improvements": self.extract_improvements(response),
            "performance_gain": "10-30%",  # Estimate
            "confidence": 0.7,
            "full_analysis": response
        }

    def extract_sql_from_response(self, response: str) -> str:
        """Extract SQL query from AI response"""

        lines = response.split('\n')
        sql_lines = []
        in_sql_block = False

        for line in lines:
            if '```sql' in line.lower():
                in_sql_block = True
                continue
            elif '```' in line and in_sql_block:
                break
            elif in_sql_block:
                sql_lines.append(line)

        return '\n'.join(sql_lines).strip() if sql_lines else response

    def extract_improvements(self, response: str) -> List[str]:
        """Extract improvement suggestions from response"""

        improvements = []
        lines = response.split('\n')

        for line in lines:
            line = line.strip()
            if any(keyword in line.lower() for keyword in ['recommend', 'improve', 'optimize', 'suggest']):
                if line and not line.startswith('#'):
                    improvements.append(line)

        return improvements[:5]  # Limit to top 5 improvements

    async def predict_query_performance(self, query: str, schema_info: Dict[str, Any]) -> float:
        """Predict query execution time"""

        # Simple heuristic-based prediction
        # In production, this would use ML models trained on execution statistics

        score = 1.0  # Base score (1 second)

        # Analyze query complexity
        query_lower = query.lower()

        # JOINs add complexity
        join_count = query_lower.count('join')
        score *= (1 + join_count * 0.5)

        # Subqueries add complexity
        subquery_count = query_lower.count('select') - 1  # -1 for main SELECT
        score *= (1 + subquery_count * 0.3)

        # Aggregations can be expensive
        if any(agg in query_lower for agg in ['group by', 'order by', 'having']):
            score *= 1.5

        # Wildcards are slower
        if 'select *' in query_lower:
            score *= 1.2

        return min(score, 60.0)  # Cap at 60 seconds

    async def generate_alternative_approaches(
        self,
        question: str,
        schema_info: Dict[str, Any]
    ) -> List[str]:
        """Generate alternative ways to write the same query"""

        if not self.enabled:
            return []

        try:
            prompt = f"""For this question: "{question}"

Given schema: {self.format_schema_for_ai(schema_info)}

Provide 3 different SQL approaches:
1. Performance-optimized approach
2. Readability-focused approach
3. Maintainability-focused approach

Each should solve the same problem but emphasize different priorities."""

            response = await self.llm.ainvoke([HumanMessage(content=prompt)])

            # Parse alternatives from response
            alternatives = []
            lines = response.split('\n')
            current_alt = []

            for line in lines:
                if line.strip().startswith(('1.', '2.', '3.', 'Approach')):
                    if current_alt:
                        alternatives.append('\n'.join(current_alt).strip())
                        current_alt = []
                current_alt.append(line)

            if current_alt:
                alternatives.append('\n'.join(current_alt).strip())

            return alternatives[:3]

        except Exception as e:
            logger.error(f"Alternative generation failed: {e}")
            return []

    def parse_schema_analysis(self, response: str) -> Dict[str, Any]:
        """Parse schema analysis response"""

        return {
            "analysis": response,
            "recommendations": self.extract_recommendations(response),
            "issues": self.extract_issues(response),
            "score": self.calculate_schema_score(response)
        }

    def extract_recommendations(self, response: str) -> List[str]:
        """Extract recommendations from analysis"""

        recommendations = []
        lines = response.split('\n')

        for line in lines:
            line = line.strip()
            if any(keyword in line.lower() for keyword in ['recommend', 'should', 'consider', 'suggest']):
                if line and len(line) > 10:
                    recommendations.append(line)

        return recommendations[:5]

    def extract_issues(self, response: str) -> List[str]:
        """Extract issues from analysis"""

        issues = []
        lines = response.split('\n')

        for line in lines:
            line = line.strip()
            if any(keyword in line.lower() for keyword in ['issue', 'problem', 'concern', 'warning']):
                if line and len(line) > 10:
                    issues.append(line)

        return issues[:5]

    def calculate_schema_score(self, response: str) -> int:
        """Calculate schema quality score (1-100)"""

        # Simple scoring based on response content
        score = 70  # Base score

        response_lower = response.lower()

        # Positive indicators
        if 'well designed' in response_lower:
            score += 10
        if 'good' in response_lower:
            score += 5
        if 'efficient' in response_lower:
            score += 5

        # Negative indicators
        if 'issue' in response_lower:
            score -= 10
        if 'problem' in response_lower:
            score -= 15
        if 'concern' in response_lower:
            score -= 5

        return max(0, min(100, score))

    def parse_issues_response(self, response: str) -> List[Dict[str, str]]:
        """Parse issues detection response"""

        issues = []
        lines = response.split('\n')
        current_issue = {}

        for line in lines:
            line = line.strip()
            if line.startswith('TYPE:'):
                if current_issue:
                    issues.append(current_issue)
                current_issue = {"type": line.split(':', 1)[1].strip().lower()}
            elif line.startswith('MESSAGE:'):
                current_issue["message"] = line.split(':', 1)[1].strip()
            elif line.startswith('SOLUTION:'):
                current_issue["solution"] = line.split(':', 1)[1].strip()

        if current_issue:
            issues.append(current_issue)

        return issues

# Global AI assistant instance
ai_query_genius = None

def get_ai_query_genius() -> AIQueryGenius:
    """Get the global AI Query Genius instance"""
    global ai_query_genius
    if ai_query_genius is None:
        ai_query_genius = AIQueryGenius()
    return ai_query_genius

__all__ = [
    'AIQueryGenius',
    'QueryAnalysis',
    'QuerySuggestion',
    'QueryComplexity',
    'get_ai_query_genius'
]