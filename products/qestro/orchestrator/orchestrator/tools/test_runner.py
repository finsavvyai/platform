"""
Test Runner Tool
================

Runs tests and reports results. Supports:
- Jest (unit tests)
- Vitest (frontend tests)
- Playwright (E2E tests)
"""

import subprocess
from pathlib import Path
from typing import Optional
from crewai.tools import BaseTool
from pydantic import Field


class TestRunnerTool(BaseTool):
    """Tool for running tests."""
    
    name: str = "Run Tests"
    description: str = """
    Run tests in the Qestro project.
    
    Input: {
        "type": "unit|integration|e2e|all",
        "filter": "optional test name filter",
        "coverage": true|false
    }
    
    Output: Test results with pass/fail status
    """
    
    project_root: Path = Field(default_factory=Path.cwd)
    
    def _run(self, type: str = "all", filter: str = None, 
             coverage: bool = False) -> str:
        """Run tests."""
        try:
            results = []
            
            if type in ["unit", "all"]:
                result = self._run_unit_tests(filter, coverage)
                results.append(f"Unit Tests:\n{result}")
            
            if type in ["integration", "all"]:
                result = self._run_integration_tests(filter)
                results.append(f"Integration Tests:\n{result}")
            
            if type in ["e2e", "all"]:
                result = self._run_e2e_tests(filter)
                results.append(f"E2E Tests:\n{result}")
            
            return "\n\n".join(results)
            
        except Exception as e:
            return f"Test runner error: {str(e)}"
    
    def _run_unit_tests(self, filter: str = None, coverage: bool = False) -> str:
        """Run Jest/Vitest unit tests."""
        backend_dir = self.project_root / "backend"
        
        cmd = ["npm", "test"]
        if coverage:
            cmd.append("--coverage")
        if filter:
            cmd.extend(["--", "--grep", filter])
        
        try:
            result = subprocess.run(
                cmd, cwd=backend_dir,
                capture_output=True, text=True, timeout=120
            )
            return result.stdout + result.stderr
        except subprocess.TimeoutExpired:
            return "Unit tests timed out"
        except Exception as e:
            return f"Error: {str(e)}"
    
    def _run_integration_tests(self, filter: str = None) -> str:
        """Run integration tests."""
        cmd = ["npm", "run", "test:integration"]
        if filter:
            cmd.extend(["--", "--grep", filter])
        
        try:
            result = subprocess.run(
                cmd, cwd=self.project_root,
                capture_output=True, text=True, timeout=180
            )
            return result.stdout + result.stderr
        except subprocess.TimeoutExpired:
            return "Integration tests timed out"
        except Exception as e:
            return f"Error: {str(e)}"
    
    def _run_e2e_tests(self, filter: str = None) -> str:
        """Run Playwright E2E tests."""
        cmd = ["npx", "playwright", "test"]
        if filter:
            cmd.extend(["--grep", filter])
        
        try:
            result = subprocess.run(
                cmd, cwd=self.project_root,
                capture_output=True, text=True, timeout=300
            )
            return result.stdout + result.stderr
        except subprocess.TimeoutExpired:
            return "E2E tests timed out"
        except Exception as e:
            return f"Error: {str(e)}"


class TypeCheckTool(BaseTool):
    """Tool for running TypeScript type checking."""
    
    name: str = "Type Check"
    description: str = """
    Run TypeScript type checking on the codebase.
    
    Input: {"target": "backend|frontend|all"}
    Output: Type errors if any
    """
    
    project_root: Path = Field(default_factory=Path.cwd)
    
    def _run(self, target: str = "all") -> str:
        """Run type checking."""
        results = []
        
        try:
            if target in ["backend", "all"]:
                result = subprocess.run(
                    ["npx", "tsc", "--noEmit"],
                    cwd=self.project_root / "backend",
                    capture_output=True, text=True, timeout=60
                )
                results.append(f"Backend:\n{result.stdout + result.stderr}")
            
            if target in ["frontend", "all"]:
                result = subprocess.run(
                    ["npx", "tsc", "--noEmit"],
                    cwd=self.project_root / "frontend",
                    capture_output=True, text=True, timeout=60
                )
                results.append(f"Frontend:\n{result.stdout + result.stderr}")
            
            return "\n\n".join(results) if results else "No errors"
            
        except Exception as e:
            return f"Type check error: {str(e)}"


class LintTool(BaseTool):
    """Tool for running linting."""
    
    name: str = "Lint"
    description: str = """
    Run ESLint on the codebase.
    
    Input: {"fix": true|false}
    Output: Lint errors/warnings
    """
    
    project_root: Path = Field(default_factory=Path.cwd)
    
    def _run(self, fix: bool = False) -> str:
        """Run linting."""
        try:
            cmd = ["npm", "run", "lint"]
            if fix:
                cmd.append("--", "--fix")
            
            result = subprocess.run(
                cmd, cwd=self.project_root,
                capture_output=True, text=True, timeout=60
            )
            return result.stdout + result.stderr
            
        except Exception as e:
            return f"Lint error: {str(e)}"
