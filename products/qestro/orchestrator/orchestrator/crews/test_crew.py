"""
Test Generation Crew
====================

Crew specialized in generating comprehensive tests.
"""

from pathlib import Path
from crewai import Crew, Task, Process
from orchestrator.agents.tester import create_tester_agent


class TestCrew:
    """
    Crew for generating comprehensive tests.
    
    This crew:
    1. Analyzes target code
    2. Generates appropriate tests
    3. Runs tests
    4. Reports coverage
    """
    
    def __init__(
        self,
        project_root: Path,
        target: str,
        test_type: str = "all",
    ):
        self.project_root = project_root
        self.target = target
        self.test_type = test_type
        
        self.tester = create_tester_agent()
        
        # Results
        self.generated_tests = None
        self.run_results = None
    
    def generate(self) -> str:
        """Generate tests for the target."""
        generate_task = Task(
            description=f"""
            Generate comprehensive {self.test_type} tests for:
            
            TARGET: {self.target}
            
            Steps:
            1. Find and read the target code
            2. Identify what needs to be tested
            3. Generate test cases
            4. Include edge cases
            5. Write test files
            
            Test types to generate:
            {self._get_test_types()}
            
            Use the Test Generator tool for AI-powered generation.
            Place tests in correct directories.
            """,
            expected_output="""
            - Test files created
            - Test cases list
            - Coverage expectations
            """,
            agent=self.tester,
        )
        
        crew = Crew(
            agents=[self.tester],
            tasks=[generate_task],
            process=Process.sequential,
            verbose=True,
        )
        
        self.generated_tests = crew.kickoff()
        return str(self.generated_tests)
    
    def run(self) -> str:
        """Run the generated tests."""
        if not self.generated_tests:
            self.generate()
        
        run_task = Task(
            description=f"""
            Run the generated tests and report results:
            
            GENERATED TESTS: {self.generated_tests}
            
            Steps:
            1. Run the appropriate test command
            2. Collect results
            3. Report coverage
            4. Fix any failing tests
            5. Rerun if needed
            
            Use the Test Runner tool.
            """,
            expected_output="""
            - Test run output
            - Pass/fail counts
            - Coverage percentage
            - Any failures that need attention
            """,
            agent=self.tester,
        )
        
        crew = Crew(
            agents=[self.tester],
            tasks=[run_task],
            process=Process.sequential,
            verbose=True,
        )
        
        self.run_results = crew.kickoff()
        return str(self.run_results)
    
    def _get_test_types(self) -> str:
        """Get description of test types to generate."""
        type_descriptions = {
            "unit": """
            - Unit tests for individual functions/classes
            - Mock external dependencies
            - Test edge cases and error handling
            """,
            "integration": """
            - Integration tests for API endpoints
            - Test with real database (test DB)
            - Test service interactions
            """,
            "e2e": """
            - End-to-end tests for user flows
            - Use Playwright
            - Test complete user journeys
            """,
            "all": """
            - Unit tests for functions/classes
            - Integration tests for APIs
            - E2E tests for critical flows
            """,
        }
        return type_descriptions.get(self.test_type, type_descriptions["all"])
