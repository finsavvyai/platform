"""
Self-Healing Workflow
=====================

This module implements a LangGraph-based self-healing workflow that:
1. Generates connector code
2. Runs tests
3. Analyzes failures
4. Applies fixes
5. Repeats until tests pass (max 3 attempts)

This creates an autonomous "generate until tests pass" feature.
"""

from langgraph.graph import StateGraph, END
from typing import TypedDict, Annotated, Literal
import operator
import json
import subprocess
import tempfile
import os
from pathlib import Path


class WorkflowState(TypedDict):
    """State that flows through the self-healing workflow."""
    
    # Input
    api_spec: dict
    config: dict
    
    # Generated artifacts
    connector_code: dict  # filename -> code
    test_code: dict       # filename -> code
    
    # Test execution
    test_results: dict
    test_passed: bool
    
    # Error tracking
    errors: Annotated[list, operator.add]  # List of errors (append mode)
    
    # Fix tracking
    fix_attempts: int
    max_attempts: int
    proposed_fix: str
    
    # Final output
    final_result: dict


class SelfHealingWorkflow:
    """
    LangGraph workflow for self-correcting connector generation.
    
    This workflow implements an iterative approach:
    1. Generate initial connector and tests
    2. Run tests
    3. If tests fail, analyze and apply fixes
    4. Repeat until tests pass or max attempts reached
    
    Example:
        >>> workflow = SelfHealingWorkflow(max_attempts=3)
        >>> result = workflow.run(api_spec={"openapi": "3.0.0", ...})
        >>> if result["success"]:
        ...     print("All tests passing!")
    """
    
    def __init__(self, max_attempts: int = 3):
        """
        Initialize the self-healing workflow.
        
        Args:
            max_attempts: Maximum number of fix attempts before giving up
        """
        self.max_attempts = max_attempts
        self.graph = self._build_graph()
    
    def _build_graph(self) -> StateGraph:
        """Build the self-healing workflow graph."""
        
        # Create the graph
        workflow = StateGraph(WorkflowState)
        
        # Add nodes
        workflow.add_node("generate", self._generate_connector)
        workflow.add_node("run_tests", self._run_tests)
        workflow.add_node("analyze_failure", self._analyze_failure)
        workflow.add_node("apply_fix", self._apply_fix)
        workflow.add_node("finalize", self._finalize)
        
        # Add edges
        workflow.add_edge("generate", "run_tests")
        
        # Conditional edge after running tests
        workflow.add_conditional_edges(
            "run_tests",
            self._should_continue,
            {
                "analyze": "analyze_failure",
                "done": "finalize",
            }
        )
        
        workflow.add_edge("analyze_failure", "apply_fix")
        workflow.add_edge("apply_fix", "run_tests")  # Loop back to test
        
        # Set entry and exit
        workflow.set_entry_point("generate")
        workflow.add_edge("finalize", END)
        
        return workflow.compile()
    
    def _generate_connector(self, state: WorkflowState) -> WorkflowState:
        """Generate initial connector and test code."""
        from ..crews.connector_crew import ConnectorGenerationCrew
        
        # Use the crew to generate initial code
        crew = ConnectorGenerationCrew(
            api_spec=state["api_spec"],
            config=state["config"],
        )
        
        result = crew.run()
        
        # Extract code from crew result
        state["connector_code"] = result.get("connector", {})
        state["test_code"] = result.get("tests", {})
        
        return state
    
    def _run_tests(self, state: WorkflowState) -> WorkflowState:
        """Execute tests and capture results."""
        
        # Create temporary directory for test execution
        with tempfile.TemporaryDirectory() as tmpdir:
            try:
                # Write connector code
                for filename, code in state["connector_code"].items():
                    filepath = Path(tmpdir) / filename
                    filepath.parent.mkdir(parents=True, exist_ok=True)
                    filepath.write_text(code if isinstance(code, str) else json.dumps(code))
                
                # Write test code
                for filename, code in state["test_code"].items():
                    filepath = Path(tmpdir) / filename
                    filepath.parent.mkdir(parents=True, exist_ok=True)
                    filepath.write_text(code if isinstance(code, str) else json.dumps(code))
                
                # Write package.json if TypeScript
                if state["config"].get("language") == "typescript":
                    package_json = {
                        "name": "connector-test",
                        "type": "module",
                        "scripts": {"test": "vitest run"},
                        "devDependencies": {"vitest": "^1.0.0"}
                    }
                    (Path(tmpdir) / "package.json").write_text(json.dumps(package_json))
                
                # Run tests
                result = subprocess.run(
                    ["npm", "test"] if state["config"].get("language") == "typescript" 
                    else ["go", "test", "./..."],
                    capture_output=True,
                    text=True,
                    cwd=tmpdir,
                    timeout=120,  # 2 minute timeout
                )
                
                state["test_results"] = {
                    "passed": result.returncode == 0,
                    "stdout": result.stdout,
                    "stderr": result.stderr,
                    "returncode": result.returncode,
                }
                state["test_passed"] = result.returncode == 0
                
                if not state["test_passed"]:
                    state["errors"] = [{
                        "attempt": state["fix_attempts"] + 1,
                        "type": "test_failure",
                        "message": result.stderr or result.stdout,
                    }]
                
            except subprocess.TimeoutExpired:
                state["test_results"] = {
                    "passed": False,
                    "error": "Test execution timed out",
                }
                state["test_passed"] = False
                state["errors"] = [{
                    "attempt": state["fix_attempts"] + 1,
                    "type": "timeout",
                    "message": "Test execution timed out after 120 seconds",
                }]
                
            except Exception as e:
                state["test_results"] = {
                    "passed": False,
                    "error": str(e),
                }
                state["test_passed"] = False
                state["errors"] = [{
                    "attempt": state["fix_attempts"] + 1,
                    "type": "execution_error",
                    "message": str(e),
                }]
        
        return state
    
    def _should_continue(self, state: WorkflowState) -> Literal["analyze", "done"]:
        """
        Decide whether to continue fixing or finalize.
        
        Returns:
            "analyze" to continue fixing, "done" to finalize
        """
        # If tests passed, we're done
        if state["test_passed"]:
            return "done"
        
        # If we've exceeded max attempts, give up
        if state["fix_attempts"] >= state["max_attempts"]:
            return "done"
        
        # Otherwise, try to fix
        return "analyze"
    
    def _analyze_failure(self, state: WorkflowState) -> WorkflowState:
        """Analyze test failures and propose fixes."""
        from crewai import Agent, Task
        
        # Use the self-healer agent to analyze
        healer = Agent(
            role="Test Healer",
            goal="Analyze test failures and propose targeted fixes",
            backstory="""You are an expert at debugging test failures.
            You can read error messages, identify root causes, and provide
            precise code fixes. You understand TypeScript, Go, and testing
            frameworks like Jest, Vitest, and Go testing.""",
            allow_code_execution=True,
        )
        
        # Get the latest error
        latest_error = state["errors"][-1] if state["errors"] else {}
        
        # Format current code for analysis
        connector_summary = "\n".join([
            f"=== {name} ===\n{code[:500]}..."
            for name, code in state["connector_code"].items()
        ])
        
        test_summary = "\n".join([
            f"=== {name} ===\n{code[:500]}..."
            for name, code in state["test_code"].items()
        ])
        
        task = Task(
            description=f"""Analyze this test failure and provide exact code fixes.

Error Message:
{latest_error.get('message', 'Unknown error')}

Current Connector Code (truncated):
{connector_summary}

Current Test Code (truncated):
{test_summary}

Attempt: {state['fix_attempts'] + 1} of {state['max_attempts']}

Provide your fix as JSON with:
- "analysis": Brief explanation of what went wrong
- "files_to_update": Object with filename -> new code content

Be precise and only change what's necessary.""",
            expected_output="JSON with analysis and files_to_update",
            agent=healer,
        )
        
        # In a real implementation, this would execute the task
        # For now, we store a placeholder
        state["proposed_fix"] = "Placeholder for actual LLM-generated fix"
        
        return state
    
    def _apply_fix(self, state: WorkflowState) -> WorkflowState:
        """Apply the proposed fix to the code."""
        
        # Increment attempt counter
        state["fix_attempts"] = state["fix_attempts"] + 1
        
        # In a real implementation, we would:
        # 1. Parse the proposed_fix JSON
        # 2. Update the connector_code and test_code dictionaries
        # 3. The updated code gets tested on next iteration
        
        try:
            fix_data = json.loads(state["proposed_fix"])
            files_to_update = fix_data.get("files_to_update", {})
            
            for filename, new_code in files_to_update.items():
                if filename in state["connector_code"]:
                    state["connector_code"][filename] = new_code
                elif filename in state["test_code"]:
                    state["test_code"][filename] = new_code
                    
        except (json.JSONDecodeError, TypeError):
            # If we can't parse the fix, just continue with existing code
            pass
        
        return state
    
    def _finalize(self, state: WorkflowState) -> WorkflowState:
        """Finalize the workflow result."""
        
        state["final_result"] = {
            "success": state["test_passed"],
            "connector_code": state["connector_code"],
            "test_code": state["test_code"],
            "attempts": state["fix_attempts"],
            "errors": state["errors"],
            "final_test_results": state["test_results"],
        }
        
        return state
    
    def run(
        self,
        api_spec: dict,
        config: dict | None = None
    ) -> dict:
        """
        Execute the self-healing workflow.
        
        Args:
            api_spec: API specification to generate connector for
            config: Generation configuration
            
        Returns:
            Final result with success status, code, and errors
        """
        initial_state = WorkflowState(
            api_spec=api_spec,
            config=config or {"language": "typescript", "runtime": "cloudflare"},
            connector_code={},
            test_code={},
            test_results={},
            test_passed=False,
            errors=[],
            fix_attempts=0,
            max_attempts=self.max_attempts,
            proposed_fix="",
            final_result={},
        )
        
        final_state = self.graph.invoke(initial_state)
        
        return final_state["final_result"]
