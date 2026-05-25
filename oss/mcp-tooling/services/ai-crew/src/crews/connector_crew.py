"""
Connector Generation Crew
=========================

This module defines the CrewAI crew that orchestrates multiple AI agents
to generate, test, and validate MCP connectors.

The crew follows this workflow:
1. API Analyst analyzes the specification
2. Connector Generator creates the code
3. Test Engineer generates tests
4. QA Validator validates everything
5. Self Healer fixes any issues (if needed)
"""

from crewai import Crew, Task
from typing import Any, TypedDict
import json

from ..agents.definitions import MCPAgents


class ConnectorConfig(TypedDict):
    """Configuration for connector generation."""
    language: str  # "typescript" | "go"
    runtime: str   # "cloudflare" | "node" | "docker"
    mcp_version: str


class ConnectorResult(TypedDict):
    """Result of connector generation crew."""
    analysis: dict
    connector: dict
    tests: dict
    validation: dict
    success: bool
    errors: list


class ConnectorGenerationCrew:
    """
    Crew that generates, tests, and validates MCP connectors.
    
    This crew orchestrates multiple specialized AI agents to:
    1. Analyze the API specification
    2. Generate production-ready connector code
    3. Create comprehensive test suites
    4. Validate quality and security
    
    Example:
        >>> crew = ConnectorGenerationCrew(
        ...     api_spec={"openapi": "3.0.0", ...},
        ...     config={"language": "typescript", "runtime": "cloudflare"}
        ... )
        >>> result = crew.run()
        >>> if result["success"]:
        ...     print("Connector generated successfully!")
    """
    
    def __init__(
        self,
        api_spec: dict,
        config: dict,
        llm: str | None = None,
        verbose: bool = True
    ):
        """
        Initialize the connector generation crew.
        
        Args:
            api_spec: The API specification (OpenAPI, GraphQL, etc.)
            config: Generation configuration (language, runtime, etc.)
            llm: Optional LLM model override
            verbose: Whether to enable verbose logging
        """
        self.api_spec = api_spec
        self.config = config
        self.llm = llm
        self.verbose = verbose
        
        self._setup_agents()
        self._setup_tasks()
    
    def _setup_agents(self) -> None:
        """Initialize all agents for the crew."""
        self.analyst = MCPAgents.api_analyst(llm=self.llm)
        self.generator = MCPAgents.connector_generator(llm=self.llm)
        self.tester = MCPAgents.test_engineer(llm=self.llm)
        self.validator = MCPAgents.qa_validator(llm=self.llm)
        self.healer = MCPAgents.self_healer(llm=self.llm)
    
    def _setup_tasks(self) -> None:
        """Define all tasks for the crew."""
        
        # Format API spec for prompt
        spec_summary = self._summarize_spec()
        
        # Task 1: Analyze API
        self.analyze_task = Task(
            description=f"""Analyze this API specification and provide a comprehensive analysis.

API Specification Summary:
{spec_summary}

Full Specification:
{json.dumps(self.api_spec, indent=2)[:5000]}  # Truncate for context

Provide analysis including:
1. **API Purpose**: What does this API do?
2. **Domain Classification**: E-commerce, Social, Finance, etc.
3. **Authentication**: What auth methods are used?
4. **Rate Limiting**: Any rate limit information?
5. **Endpoints**: Key endpoints and their purposes
6. **MCP Tool Recommendations**: How to group endpoints into MCP tools
7. **Caching Strategy**: What should be cached and for how long?
8. **Error Handling**: Known error codes and recommended handling

Return your analysis as a structured JSON object.""",
            expected_output="JSON object with comprehensive API analysis",
            agent=self.analyst,
        )
        
        # Task 2: Generate Connector
        self.generate_task = Task(
            description=f"""Based on the API analysis, generate a complete MCP connector.

Target Configuration:
- Language: {self.config.get('language', 'typescript')}
- Runtime: {self.config.get('runtime', 'cloudflare')}
- MCP Version: {self.config.get('mcp_version', '1.0.0')}

Generate the following files:
1. **Main Connector File**: Index with all MCP tools
2. **Tool Definitions**: Individual tool implementations
3. **Type Definitions**: TypeScript types or Go structs
4. **Auth Handler**: Authentication implementation
5. **Error Handler**: Error handling utilities
6. **Config File**: Configuration schema

Requirements:
- Full type safety
- Comprehensive error handling with retries
- Rate limiting implementation
- Caching where appropriate
- Detailed documentation

Return as JSON with file names as keys and code as values.""",
            expected_output="JSON object with all generated code files",
            agent=self.generator,
            context=[self.analyze_task],  # Depends on analysis
        )
        
        # Task 3: Generate Tests
        self.test_task = Task(
            description="""Generate comprehensive tests for the MCP connector.

Test Requirements:
1. **Unit Tests**: Test each MCP tool in isolation
2. **Integration Tests**: Test with mocked API responses
3. **Error Tests**: Test all error handling paths
4. **Edge Cases**: Boundary values, null inputs, etc.
5. **Performance Tests**: Basic latency checks

For each tool, test:
- Successful requests
- Authentication failures
- Rate limiting responses
- Malformed responses
- Network errors

Use Jest/Vitest for TypeScript or Go testing for Go.
Target 90%+ code coverage.

Return as JSON with test file names as keys and code as values.""",
            expected_output="JSON object with all test files",
            agent=self.tester,
            context=[self.generate_task],  # Depends on generated code
        )
        
        # Task 4: Validate
        self.validate_task = Task(
            description="""Validate the generated connector and tests.

Validation Checklist:
1. **Code Quality**:
   - Code follows best practices
   - No code smells or anti-patterns
   - Proper documentation

2. **Security**:
   - No hardcoded secrets
   - Input validation on all parameters
   - Secure authentication handling
   - No injection vulnerabilities

3. **Performance**:
   - Efficient algorithms
   - Appropriate caching
   - No memory leaks

4. **MCP Compliance**:
   - Tools follow MCP specification
   - Proper tool descriptions
   - Correct input/output schemas

5. **Test Quality**:
   - Tests are meaningful
   - Good coverage of edge cases
   - Clear assertions

Return a validation report with:
- Overall status: PASS or FAIL
- List of issues (if any)
- Recommendations for improvement
- Quality score (0-100)""",
            expected_output="Validation report JSON with status, issues, and score",
            agent=self.validator,
            context=[self.generate_task, self.test_task],
        )
        
        self.tasks = [
            self.analyze_task,
            self.generate_task,
            self.test_task,
            self.validate_task,
        ]
    
    def _summarize_spec(self) -> str:
        """Create a summary of the API specification."""
        summary_parts = []
        
        # OpenAPI
        if "openapi" in self.api_spec:
            info = self.api_spec.get("info", {})
            summary_parts.append(f"OpenAPI {self.api_spec['openapi']}")
            summary_parts.append(f"Title: {info.get('title', 'Unknown')}")
            summary_parts.append(f"Version: {info.get('version', 'Unknown')}")
            
            paths = self.api_spec.get("paths", {})
            summary_parts.append(f"Endpoints: {len(paths)}")
        
        # GraphQL
        elif "schema" in self.api_spec or "__schema" in self.api_spec:
            summary_parts.append("GraphQL Schema")
        
        # Generic
        else:
            summary_parts.append(f"Spec Type: {self.api_spec.get('type', 'unknown')}")
        
        return "\n".join(summary_parts)
    
    def run(self) -> ConnectorResult:
        """
        Execute the crew and return results.
        
        Returns:
            ConnectorResult with analysis, connector, tests, validation, and success status
        """
        crew = Crew(
            agents=[self.analyst, self.generator, self.tester, self.validator],
            tasks=self.tasks,
            verbose=self.verbose,
        )
        
        result = crew.kickoff()
        
        # Parse results from each task
        try:
            task_outputs = result.tasks_output if hasattr(result, 'tasks_output') else []
            
            return ConnectorResult(
                analysis=self._parse_output(task_outputs[0] if len(task_outputs) > 0 else {}),
                connector=self._parse_output(task_outputs[1] if len(task_outputs) > 1 else {}),
                tests=self._parse_output(task_outputs[2] if len(task_outputs) > 2 else {}),
                validation=self._parse_output(task_outputs[3] if len(task_outputs) > 3 else {}),
                success=self._check_success(task_outputs[3] if len(task_outputs) > 3 else {}),
                errors=[],
            )
        except Exception as e:
            return ConnectorResult(
                analysis={},
                connector={},
                tests={},
                validation={},
                success=False,
                errors=[str(e)],
            )
    
    def _parse_output(self, output: Any) -> dict:
        """Parse task output to dictionary."""
        if isinstance(output, dict):
            return output
        if isinstance(output, str):
            try:
                return json.loads(output)
            except json.JSONDecodeError:
                return {"raw": output}
        return {"raw": str(output)}
    
    def _check_success(self, validation_output: Any) -> bool:
        """Check if validation passed."""
        if isinstance(validation_output, dict):
            status = validation_output.get("status", "").upper()
            return status == "PASS"
        if isinstance(validation_output, str):
            return "PASS" in validation_output.upper()
        return False
