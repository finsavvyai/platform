"""
Git Operations Tool
===================

Git operations for the orchestrator.
"""

import subprocess
from pathlib import Path
from typing import Optional
from crewai.tools import BaseTool
from pydantic import Field


class GitTool(BaseTool):
    """Tool for Git operations."""
    
    name: str = "Git"
    description: str = """
    Perform Git operations.
    
    Actions:
    - status: Get current git status
    - branch: Create or switch branch
    - commit: Commit changes
    - diff: Show changes
    
    Input: {"action": "status|branch|commit|diff", "params": {...}}
    """
    
    project_root: Path = Field(default_factory=Path.cwd)
    
    def _run(self, action: str, params: dict = None) -> str:
        """Execute git action."""
        params = params or {}
        
        try:
            if action == "status":
                return self._git_status()
            elif action == "branch":
                return self._git_branch(params.get("name"), params.get("checkout", True))
            elif action == "commit":
                return self._git_commit(params.get("message", "Auto-commit by AI"))
            elif action == "diff":
                return self._git_diff(params.get("staged", False))
            else:
                return f"Unknown action: {action}"
                
        except Exception as e:
            return f"Git error: {str(e)}"
    
    def _git_status(self) -> str:
        """Get git status."""
        result = subprocess.run(
            ["git", "status", "--short"],
            cwd=self.project_root,
            capture_output=True, text=True
        )
        return result.stdout if result.stdout else "Clean working directory"
    
    def _git_branch(self, name: str, checkout: bool = True) -> str:
        """Create and/or checkout branch."""
        if not name:
            # List branches
            result = subprocess.run(
                ["git", "branch", "-a"],
                cwd=self.project_root,
                capture_output=True, text=True
            )
            return result.stdout
        
        # Create and checkout
        cmd = ["git", "checkout", "-b", name] if checkout else ["git", "branch", name]
        result = subprocess.run(
            cmd, cwd=self.project_root,
            capture_output=True, text=True
        )
        return result.stdout + result.stderr
    
    def _git_commit(self, message: str) -> str:
        """Stage all and commit."""
        # Stage all
        subprocess.run(
            ["git", "add", "-A"],
            cwd=self.project_root,
            capture_output=True
        )
        
        # Commit
        result = subprocess.run(
            ["git", "commit", "-m", message],
            cwd=self.project_root,
            capture_output=True, text=True
        )
        return result.stdout + result.stderr
    
    def _git_diff(self, staged: bool = False) -> str:
        """Show diff."""
        cmd = ["git", "diff"]
        if staged:
            cmd.append("--staged")
        
        result = subprocess.run(
            cmd, cwd=self.project_root,
            capture_output=True, text=True
        )
        return result.stdout if result.stdout else "No changes"
