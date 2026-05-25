"""
Bug Fix Crew
============

Crew specialized in finding and fixing bugs.
"""

from pathlib import Path
from typing import Optional
from crewai import Crew, Task, Process
from orchestrator.agents.backend_dev import create_backend_developer_agent
from orchestrator.agents.frontend_dev import create_frontend_developer_agent
from orchestrator.agents.tester import create_tester_agent


class BugfixCrew:
    """
    Crew for fixing bugs and issues.
    
    This crew:
    1. Analyzes the issue
    2. Finds the root cause
    3. Implements the fix
    4. Verifies the fix works
    """
    
    def __init__(
        self,
        project_root: Path,
        issue_description: str,
        target_file: Optional[str] = None,
    ):
        self.project_root = project_root
        self.issue_description = issue_description
        self.target_file = target_file
        
        # We'll use backend_dev or frontend_dev based on the file type
        self.backend_dev = create_backend_developer_agent()
        self.frontend_dev = create_frontend_developer_agent()
        self.tester = create_tester_agent()
        
        # Results
        self.analysis = None
        self.fix_result = None
        self.verification = None
    
    def _get_appropriate_agent(self):
        """Get the right agent based on target file or issue description."""
        if self.target_file:
            if 'frontend' in self.target_file or '.tsx' in self.target_file:
                return self.frontend_dev
            return self.backend_dev
        
        # Guess from description
        frontend_keywords = ['component', 'page', 'ui', 'button', 'form', 'react']
        if any(kw in self.issue_description.lower() for kw in frontend_keywords):
            return self.frontend_dev
        return self.backend_dev
    
    def analyze(self) -> str:
        """Analyze the issue and find root cause."""
        agent = self._get_appropriate_agent()
        
        analyze_task = Task(
            description=f"""
            Analyze this bug/issue and find the root cause:
            
            ISSUE: {self.issue_description}
            
            TARGET FILE: {self.target_file or 'Not specified'}
            
            Steps:
            1. Search for relevant code
            2. Understand the expected behavior
            3. Identify what's going wrong
            4. Find the root cause
            5. Propose a fix
            
            Use file search and read tools to investigate.
            """,
            expected_output="""
            - Root cause analysis
            - Affected files
            - Proposed fix approach
            """,
            agent=agent,
        )
        
        crew = Crew(
            agents=[agent],
            tasks=[analyze_task],
            process=Process.sequential,
            verbose=True,
        )
        
        self.analysis = crew.kickoff()
        return str(self.analysis)
    
    def fix(self) -> str:
        """Implement the fix."""
        if not self.analysis:
            self.analyze()
        
        agent = self._get_appropriate_agent()
        
        fix_task = Task(
            description=f"""
            Implement the fix for this issue:
            
            ISSUE: {self.issue_description}
            
            ANALYSIS: {self.analysis}
            
            Steps:
            1. Modify the affected files
            2. Ensure the fix is complete
            3. Don't introduce new issues
            4. Follow existing code patterns
            
            Use OpenHands AI for generating the fix.
            Write the corrected code to files.
            """,
            expected_output="""
            - Files modified
            - Description of changes
            - Any side effects to watch for
            """,
            agent=agent,
        )
        
        crew = Crew(
            agents=[agent],
            tasks=[fix_task],
            process=Process.sequential,
            verbose=True,
        )
        
        self.fix_result = crew.kickoff()
        return str(self.fix_result)
    
    def verify(self) -> str:
        """Verify the fix works."""
        verify_task = Task(
            description=f"""
            Verify the bug fix works correctly:
            
            ISSUE: {self.issue_description}
            
            FIX APPLIED: {self.fix_result}
            
            Steps:
            1. Run existing tests
            2. Add a regression test for this bug
            3. Verify the fix works
            4. Ensure no regressions
            
            Run tests and report results.
            """,
            expected_output="""
            - Test results
            - Regression test added
            - Verification status (PASSED/FAILED)
            """,
            agent=self.tester,
        )
        
        crew = Crew(
            agents=[self.tester],
            tasks=[verify_task],
            process=Process.sequential,
            verbose=True,
        )
        
        self.verification = crew.kickoff()
        return str(self.verification)
