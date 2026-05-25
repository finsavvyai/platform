"""
AI-Powered SQL Assistant with LangGraph
Natural language to SQL conversion with safety guardrails
"""

import re
import time
import json
import hashlib
from typing import Dict, List, Optional, Any, Tuple, TypedDict
from datetime import datetime
from dataclasses import dataclass, field

try:
    from langgraph.graph import StateGraph, END
    from langgraph.prebuilt import ToolNode
    from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
    from langchain_openai import ChatOpenAI
    from langchain_anthropic import ChatAnthropic
    LANGGRAPH_AVAILABLE = True
except ImportError:
    LANGGRAPH_AVAILABLE = False
    StateGraph = None
    END = None

import psycopg2
import psycopg2.extras
from .config import AIConfig, ModelProvider, SafetyLevel

class SQLAssistantState(TypedDict):
    """State for the SQL Assistant LangGraph workflow"""
    user_query: str
    db_connection_params: Dict[str, str]
    schema_info: Optional[Dict[str, Any]]
    intent: Optional[str]
    sql_query: Optional[str]
    safety_passed: bool
    execution_result: Optional[Dict[str, Any]]
    error_message: Optional[str]
    retry_count: int
    cost_info: Dict[str, float]
    confirmation_required: bool
    user_confirmed: bool

@dataclass
class SQLSafetyResult:
    """Result of SQL safety check"""
    is_safe: bool
    violations: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    modified_sql: Optional[str] = None

@dataclass 
class QueryResult:
    """Result of SQL query execution"""
    success: bool
    data: List[Dict[str, Any]] = field(default_factory=list)
    columns: List[str] = field(default_factory=list)
    row_count: int = 0
    execution_time: float = 0.0
    error_message: Optional[str] = None

class SQLAssistant:
    """LangGraph-based AI assistant for SQL operations"""
    
    def __init__(self, config: Optional[AIConfig] = None):
        if not LANGGRAPH_AVAILABLE:
            raise ImportError("LangGraph dependencies not available. Install with: pip install langgraph langchain-openai langchain-anthropic")
        
        self.config = config or AIConfig.create_default()
        self.llm = self._create_llm()
        self.graph = self._create_workflow()
        self.schema_cache: Dict[str, Dict] = {}
        
    def _create_llm(self):
        """Create the appropriate LLM based on configuration"""
        model_config = self.config.get_model_config()
        
        if self.config.provider == ModelProvider.OPENAI:
            return ChatOpenAI(**model_config)
        elif self.config.provider == ModelProvider.ANTHROPIC:
            return ChatAnthropic(**model_config)
        elif self.config.provider == ModelProvider.OLLAMA:
            # For Ollama, we'll use a simple HTTP client
            return self._create_ollama_client(model_config)
        else:
            raise ValueError(f"Unsupported provider: {self.config.provider}")
    
    def _create_ollama_client(self, config):
        """Create Ollama client wrapper"""
        # Simplified Ollama client - in practice you'd use the official client
        class OllamaClient:
            def __init__(self, base_url, model):
                self.base_url = base_url
                self.model = model
            
            def invoke(self, messages):
                # This would make HTTP requests to Ollama API
                # For now, return a placeholder
                return AIMessage(content="[Ollama integration placeholder - implement HTTP client]")
        
        return OllamaClient(config.get('base_url'), config.get('model'))
    
    def _create_workflow(self) -> StateGraph:
        """Create the LangGraph workflow for SQL generation"""
        workflow = StateGraph(SQLAssistantState)
        
        # Define nodes
        workflow.add_node("classify_intent", self._classify_intent)
        workflow.add_node("load_schema", self._load_schema)
        workflow.add_node("generate_sql", self._generate_sql)
        workflow.add_node("safety_check", self._safety_check)
        workflow.add_node("require_confirmation", self._require_confirmation)
        workflow.add_node("execute_sql", self._execute_sql)
        workflow.add_node("handle_error", self._handle_error)
        workflow.add_node("present_result", self._present_result)
        
        # Define the flow
        workflow.set_entry_point("classify_intent")
        
        # Intent classification -> Schema loading
        workflow.add_edge("classify_intent", "load_schema")
        
        # Schema loading -> SQL generation
        workflow.add_edge("load_schema", "generate_sql")
        
        # SQL generation -> Safety check
        workflow.add_edge("generate_sql", "safety_check")
        
        # Safety check routing
        workflow.add_conditional_edges(
            "safety_check",
            self._route_after_safety,
            {
                "safe": "require_confirmation",
                "unsafe": "present_result",
                "retry": "generate_sql"
            }
        )
        
        # Confirmation routing
        workflow.add_conditional_edges(
            "require_confirmation", 
            self._route_after_confirmation,
            {
                "confirmed": "execute_sql",
                "denied": "present_result"
            }
        )
        
        # Execution routing
        workflow.add_conditional_edges(
            "execute_sql",
            self._route_after_execution,
            {
                "success": "present_result",
                "error": "handle_error"
            }
        )
        
        # Error handling routing  
        workflow.add_conditional_edges(
            "handle_error",
            self._route_after_error,
            {
                "retry": "generate_sql",
                "give_up": "present_result"
            }
        )
        
        # All paths end at present_result
        workflow.add_edge("present_result", END)
        
        return workflow.compile()
    
    def _classify_intent(self, state: SQLAssistantState) -> SQLAssistantState:
        """Classify user intent (question, admin task, etc.)"""
        user_query = state["user_query"]
        
        # Simple keyword-based classification for now
        admin_keywords = ["create", "drop", "alter", "delete", "update", "insert", "grant", "revoke"]
        question_keywords = ["what", "how many", "show me", "list", "find", "get", "which"]
        
        query_lower = user_query.lower()
        
        if any(keyword in query_lower for keyword in admin_keywords):
            intent = "admin_task"
        elif any(keyword in query_lower for keyword in question_keywords):
            intent = "question" 
        else:
            intent = "general"
        
        state["intent"] = intent
        return state
    
    def _load_schema(self, state: SQLAssistantState) -> SQLAssistantState:
        """Load and cache database schema information"""
        conn_params = state["db_connection_params"]
        
        # Create cache key
        cache_key = self._get_cache_key(conn_params)
        
        # Check cache first
        if cache_key in self.schema_cache:
            cached_time = self.schema_cache[cache_key].get('_cached_at', 0)
            if time.time() - cached_time < self.config.schema_cache_ttl:
                state["schema_info"] = self.schema_cache[cache_key]
                return state
        
        # Load schema from database
        try:
            schema_info = self._introspect_schema(conn_params)
            schema_info['_cached_at'] = time.time()
            
            # Cache the result
            self.schema_cache[cache_key] = schema_info
            state["schema_info"] = schema_info
            
        except Exception as e:
            state["error_message"] = f"Failed to load schema: {str(e)}"
            state["schema_info"] = {"tables": [], "error": str(e)}
        
        return state
    
    def _generate_sql(self, state: SQLAssistantState) -> SQLAssistantState:
        """Generate SQL query using LLM with schema context"""
        user_query = state["user_query"]
        schema_info = state.get("schema_info", {})
        intent = state.get("intent", "general")
        
        # Build schema context
        schema_context = self._build_schema_context(schema_info)
        
        # Create system prompt
        system_prompt = self._build_system_prompt(intent, schema_context)
        
        # Create messages
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_query)
        ]
        
        try:
            # Generate SQL using LLM
            response = self.llm.invoke(messages)
            
            # Extract SQL from response
            sql_query = self._extract_sql_from_response(response.content)
            
            state["sql_query"] = sql_query
            
            # Update cost info (simplified)
            if "cost_info" not in state:
                state["cost_info"] = {"total_cost": 0.0, "api_calls": 0}
            state["cost_info"]["api_calls"] += 1
            
        except Exception as e:
            state["error_message"] = f"Failed to generate SQL: {str(e)}"
        
        return state
    
    def _safety_check(self, state: SQLAssistantState) -> SQLAssistantState:
        """Perform safety checks on generated SQL"""
        sql_query = state.get("sql_query", "")
        
        if not sql_query:
            state["safety_passed"] = False
            state["error_message"] = "No SQL query to check"
            return state
        
        safety_result = self._check_sql_safety(sql_query)
        state["safety_passed"] = safety_result.is_safe
        
        if not safety_result.is_safe:
            state["error_message"] = f"Safety check failed: {'; '.join(safety_result.violations)}"
        elif safety_result.modified_sql:
            state["sql_query"] = safety_result.modified_sql
        
        return state
    
    def _require_confirmation(self, state: SQLAssistantState) -> SQLAssistantState:
        """Require user confirmation before execution"""
        if self.config.require_confirmation:
            state["confirmation_required"] = True
            # In a real implementation, this would pause and wait for user input
            # For now, we'll assume confirmation is given
            state["user_confirmed"] = True
        else:
            state["user_confirmed"] = True
        
        return state
    
    def _execute_sql(self, state: SQLAssistantState) -> SQLAssistantState:
        """Execute the SQL query safely"""
        sql_query = state.get("sql_query", "")
        conn_params = state["db_connection_params"]
        
        if not sql_query:
            state["error_message"] = "No SQL query to execute"
            return state
        
        try:
            result = self._execute_query_safely(sql_query, conn_params)
            state["execution_result"] = {
                "success": result.success,
                "data": result.data,
                "columns": result.columns,
                "row_count": result.row_count,
                "execution_time": result.execution_time,
                "error_message": result.error_message
            }
        except Exception as e:
            state["error_message"] = f"Execution failed: {str(e)}"
            state["execution_result"] = {"success": False, "error_message": str(e)}
        
        return state
    
    def _handle_error(self, state: SQLAssistantState) -> SQLAssistantState:
        """Handle execution errors and decide whether to retry"""
        retry_count = state.get("retry_count", 0)
        
        if retry_count < self.config.max_retries:
            state["retry_count"] = retry_count + 1
            # Clear previous SQL to force regeneration
            state["sql_query"] = None
            state["error_message"] = None
        
        return state
    
    def _present_result(self, state: SQLAssistantState) -> SQLAssistantState:
        """Present the final result to the user"""
        # This is the final node - just return the state
        return state
    
    def _route_after_safety(self, state: SQLAssistantState) -> str:
        """Route after safety check"""
        if not state.get("safety_passed", False):
            retry_count = state.get("retry_count", 0)
            if retry_count < self.config.max_retries:
                return "retry"
            return "unsafe"
        return "safe"
    
    def _route_after_confirmation(self, state: SQLAssistantState) -> str:
        """Route after confirmation"""
        return "confirmed" if state.get("user_confirmed", False) else "denied"
    
    def _route_after_execution(self, state: SQLAssistantState) -> str:
        """Route after execution"""
        result = state.get("execution_result", {})
        return "success" if result.get("success", False) else "error"
    
    def _route_after_error(self, state: SQLAssistantState) -> str:
        """Route after error handling"""
        retry_count = state.get("retry_count", 0)
        return "retry" if retry_count < self.config.max_retries else "give_up"
    
    def process_query(self, user_query: str, db_connection_params: Dict[str, str]) -> Dict[str, Any]:
        """Process a natural language query and return results"""
        initial_state = {
            "user_query": user_query,
            "db_connection_params": db_connection_params,
            "schema_info": None,
            "intent": None,
            "sql_query": None,
            "safety_passed": False,
            "execution_result": None,
            "error_message": None,
            "retry_count": 0,
            "cost_info": {"total_cost": 0.0, "api_calls": 0},
            "confirmation_required": False,
            "user_confirmed": False
        }
        
        # Run the workflow
        final_state = self.graph.invoke(initial_state)
        
        return {
            "success": final_state.get("execution_result", {}).get("success", False),
            "sql_query": final_state.get("sql_query"),
            "result": final_state.get("execution_result"),
            "error": final_state.get("error_message"),
            "cost_info": final_state.get("cost_info"),
            "safety_passed": final_state.get("safety_passed", False)
        }
    
    def _get_cache_key(self, conn_params: Dict[str, str]) -> str:
        """Generate cache key for database connection"""
        key_parts = [
            conn_params.get('host', 'localhost'),
            conn_params.get('port', '5432'),
            conn_params.get('dbname', 'postgres')
        ]
        return hashlib.md5(':'.join(key_parts).encode()).hexdigest()[:12]  # Truncate to 12 chars as expected by tests
    
    def _normalize_query(self, query: str) -> str:
        """Normalize SQL query by removing comments and extra whitespace"""
        # Remove line comments
        query = re.sub(r'--.*$', '', query, flags=re.MULTILINE)
        
        # Remove block comments
        query = re.sub(r'/\*.*?\*/', '', query, flags=re.DOTALL)
        
        # Normalize whitespace
        query = ' '.join(query.split())
        
        return query.lower().strip()
    
    def _extract_query_info(self, query: str) -> Dict[str, Any]:
        """Extract information from SQL query"""
        normalized = self._normalize_query(query)
        
        info = {
            'type': 'unknown',
            'category': 'unknown',  # Add category alias for backward compatibility
            'tables': [],
            'columns': [],
            'estimated_complexity': 'low'
        }
        
        # Determine query type
        if normalized.startswith('select'):
            info['type'] = 'select'
            info['category'] = 'select'
        elif normalized.startswith('insert'):
            info['type'] = 'insert'
            info['category'] = 'insert'
        elif normalized.startswith('update'):
            info['type'] = 'update'
            info['category'] = 'update'
        elif normalized.startswith('delete'):
            info['type'] = 'delete'
            info['category'] = 'delete'
        
        # Extract table names (simplified)
        if info['type'] == 'select':
            from_match = re.search(r'from\s+(\w+)', normalized)
            if from_match:
                info['tables'].append(from_match.group(1))
        elif info['type'] == 'insert':
            into_match = re.search(r'into\s+(\w+)', normalized)
            if into_match:
                info['tables'].append(into_match.group(1))
        elif info['type'] == 'update':
            update_match = re.search(r'update\s+(\w+)', normalized)
            if update_match:
                info['tables'].append(update_match.group(1))
        elif info['type'] == 'delete':
            delete_match = re.search(r'delete\s+from\s+(\w+)', normalized)
            if delete_match:
                info['tables'].append(delete_match.group(1))
        
        return info
    
    def _create_template(self, query: str) -> str:
        """Create a template from a SQL query"""
        # Replace literal values with placeholders
        template = query
        
        # Replace string literals
        template = re.sub(r"'[^']*'", '?', template)
        
        # Replace numeric literals
        template = re.sub(r'\b\d+\b', '?', template)
        
        return template
    
    def _introspect_schema(self, conn_params: Dict[str, str]) -> Dict[str, Any]:
        """Introspect database schema"""
        try:
            with psycopg2.connect(**conn_params) as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    # Get tables with basic info
                    cur.execute("""
                        SELECT 
                            t.table_name,
                            t.table_type,
                            COALESCE(
                                (SELECT COUNT(*) 
                                 FROM information_schema.columns c 
                                 WHERE c.table_name = t.table_name 
                                 AND c.table_schema = t.table_schema), 
                                0
                            ) as column_count
                        FROM information_schema.tables t
                        WHERE t.table_schema = 'public'
                        AND t.table_type IN ('BASE TABLE', 'VIEW')
                        ORDER BY t.table_name
                    """)
                    
                    tables = []
                    for row in cur.fetchall():
                        table_info = dict(row)
                        
                        # Get columns for this table
                        cur.execute("""
                            SELECT column_name, data_type, is_nullable
                            FROM information_schema.columns
                            WHERE table_name = %s AND table_schema = 'public'
                            ORDER BY ordinal_position
                        """, (table_info['table_name'],))
                        
                        table_info['columns'] = [dict(col) for col in cur.fetchall()]
                        tables.append(table_info)
                    
                    return {"tables": tables}
        
        except Exception as e:
            return {"tables": [], "error": str(e)}
    
    def _build_schema_context(self, schema_info: Dict[str, Any]) -> str:
        """Build schema context string for the LLM"""
        if not schema_info or "error" in schema_info:
            return "No schema information available."
        
        context_parts = ["Database Schema:"]
        
        for table in schema_info.get("tables", []):
            table_name = table["table_name"]
            table_type = table.get("table_type", "TABLE")
            
            context_parts.append(f"\n{table_type}: {table_name}")
            
            for col in table.get("columns", []):
                col_name = col["column_name"]
                data_type = col["data_type"]
                nullable = "NULL" if col["is_nullable"] == "YES" else "NOT NULL"
                context_parts.append(f"  - {col_name} ({data_type}, {nullable})")
        
        return "\n".join(context_parts)
    
    def _build_system_prompt(self, intent: str, schema_context: str) -> str:
        """Build system prompt based on intent and schema"""
        base_prompt = """You are a PostgreSQL expert assistant. Generate safe, efficient SQL queries based on user requests.

SAFETY RULES:
- Only generate SELECT queries unless explicitly requested otherwise
- Always include LIMIT clause (max 50 rows unless specified)
- Never generate queries that could modify data without explicit permission
- Use proper table and column names from the provided schema

"""
        
        safety_level = self.config.safety_level
        if safety_level == SafetyLevel.STRICT:
            base_prompt += """STRICT MODE: Only SELECT queries allowed. No DDL/DML operations.
"""
        elif safety_level == SafetyLevel.MODERATE:
            base_prompt += """MODERATE MODE: DDL/DML allowed but requires explicit confirmation.
"""
        
        base_prompt += f"""
{schema_context}

Generate a PostgreSQL query that answers the user's question. Respond with only the SQL query, no explanations or additional text."""
        
        return base_prompt
    
    def _extract_sql_from_response(self, response_content: str) -> str:
        """Extract SQL query from LLM response"""
        # Remove markdown code blocks
        content = response_content.strip()
        
        # Remove ```sql or ``` blocks
        if "```" in content:
            lines = content.split('\n')
            sql_lines = []
            in_code_block = False
            
            for line in lines:
                if line.strip().startswith('```'):
                    in_code_block = not in_code_block
                    continue
                if in_code_block:
                    sql_lines.append(line)
            
            if sql_lines:
                content = '\n'.join(sql_lines)
        
        # Clean up the SQL
        content = content.strip()
        if not content.endswith(';'):
            content += ';'
        
        return content
    
    def _check_sql_safety(self, sql_query: str) -> SQLSafetyResult:
        """Check SQL query safety"""
        violations = []
        warnings = []
        modified_sql = None
        
        sql_upper = sql_query.upper().strip()
        
        # Check safety level restrictions
        if self.config.safety_level == SafetyLevel.STRICT:
            # Check for dangerous keywords first
            dangerous_keywords = ['DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'CREATE', 'GRANT', 'REVOKE']
            for keyword in dangerous_keywords:
                if f' {keyword} ' in f' {sql_upper} ' or sql_upper.startswith(keyword):
                    violations.append(f"Keyword '{keyword}' not allowed in strict mode")
            
            # Only SELECT allowed
            if not sql_upper.startswith('SELECT'):
                violations.append("Only SELECT queries allowed in strict mode")
        
        # Check for LIMIT clause
        if sql_upper.startswith('SELECT') and 'LIMIT' not in sql_upper:
            # Add LIMIT automatically
            if sql_query.endswith(';'):
                modified_sql = sql_query[:-1] + f' LIMIT {self.config.max_rows};'
            else:
                modified_sql = sql_query + f' LIMIT {self.config.max_rows}'
            warnings.append(f"Added LIMIT {self.config.max_rows} for safety")
        
        # Check for potentially expensive operations
        expensive_patterns = ['SELECT \\*', 'CROSS JOIN', 'CARTESIAN']
        for pattern in expensive_patterns:
            if re.search(pattern, sql_upper):
                warnings.append(f"Query may be expensive: contains {pattern}")
        
        return SQLSafetyResult(
            is_safe=len(violations) == 0,
            violations=violations,
            warnings=warnings,
            modified_sql=modified_sql
        )
    
    def _execute_query_safely(self, sql_query: str, conn_params: Dict[str, str]) -> QueryResult:
        """Execute SQL query with safety constraints"""
        start_time = time.time()
        
        try:
            with psycopg2.connect(**conn_params) as conn:
                # Set timeout
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    cur.execute(f"SET statement_timeout = {self.config.statement_timeout * 1000}")  # milliseconds
                    
                    # Execute the query
                    cur.execute(sql_query)
                    
                    # Fetch results
                    if cur.description:
                        columns = [desc[0] for desc in cur.description]
                        rows = cur.fetchall()
                        data = [dict(row) for row in rows]
                        row_count = len(data)
                    else:
                        columns = []
                        data = []
                        row_count = cur.rowcount
                    
                    execution_time = time.time() - start_time
                    
                    return QueryResult(
                        success=True,
                        data=data,
                        columns=columns,
                        row_count=row_count,
                        execution_time=execution_time
                    )
        
        except Exception as e:
            execution_time = time.time() - start_time
            return QueryResult(
                success=False,
                execution_time=execution_time,
                error_message=str(e)
            )