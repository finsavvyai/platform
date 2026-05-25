"""
Feature Implementation Crew
============================

The main crew that implements complete features end-to-end.
Coordinates all agents to deliver production-ready code.
"""

from pathlib import Path
from typing import Optional
from crewai import Crew, Task, Process
from orchestrator.agents.planner import create_planner_agent
from orchestrator.agents.backend_dev import create_backend_developer_agent
from orchestrator.agents.frontend_dev import create_frontend_developer_agent
from orchestrator.agents.tester import create_tester_agent
from orchestrator.agents.reviewer import create_reviewer_agent


class FeatureCrew:
    """
    Crew for implementing complete features.
    
    This is the main orchestration crew that:
    1. Plans the feature architecture
    2. Implements backend code
    3. Implements frontend code
    4. Generates tests
    5. Reviews and validates everything
    """
    
    def __init__(
        self,
        project_root: Path,
        feature_description: str,
        branch_name: Optional[str] = None,
        dry_run: bool = False,
    ):
        self.project_root = project_root
        self.feature_description = feature_description
        self.branch_name = branch_name
        self.dry_run = dry_run
        
        # Initialize agents
        self.planner = create_planner_agent()
        self.backend_dev = create_backend_developer_agent()
        self.frontend_dev = create_frontend_developer_agent()
        self.tester = create_tester_agent()
        self.reviewer = create_reviewer_agent()
        
        # Results storage
        self.plan = None
        self.backend_result = None
        self.frontend_result = None
        self.test_result = None
        self.review_result = None
    
    def plan(self) -> str:
        """Phase 1: Plan the feature implementation."""
        planning_task = Task(
            description=f"""
            Analyze and create an implementation plan for this feature:
            
            {self.feature_description}
            
            Create a detailed plan that includes:
            1. Overview of what needs to be built
            2. Backend tasks (services, routes, database)
            3. Frontend tasks (pages, components, state)
            4. Testing requirements
            5. Integration points with existing code
            
            Search the codebase to understand existing patterns and
            identify files that need to be modified.
            """,
            expected_output="""
            A detailed implementation plan with:
            - List of files to create
            - List of files to modify
            - Database schema changes
            - API endpoints to add
            - Components to create
            - Tests to write
            """,
            agent=self.planner,
        )
        
        crew = Crew(
            agents=[self.planner],
            tasks=[planning_task],
            process=Process.sequential,
            verbose=True,
        )
        
        self.plan = crew.kickoff()
        return str(self.plan)
    
    def implement_backend(self) -> str:
        """Phase 2: Implement backend code."""
        if not self.plan:
            self.plan()
        
        backend_task = Task(
            description=f"""
            Implement the backend code for this feature based on the plan:
            
            FEATURE: {self.feature_description}
            
            PLAN: {self.plan}
            
            Implementation steps:
            1. Create any needed database migrations
            2. Create service classes
            3. Create route handlers
            4. Add validation schemas
            5. Register routes in the main app
            
            Follow existing code patterns in the backend/src directory.
            Use OpenHands AI for code generation.
            Write files to the correct locations.
            """,
            expected_output="""
            - List of files created/modified
            - Summary of implementation
            - Any notes or warnings
            """,
            agent=self.backend_dev,
        )
        
        crew = Crew(
            agents=[self.backend_dev],
            tasks=[backend_task],
            process=Process.sequential,
            verbose=True,
        )
        
        self.backend_result = crew.kickoff()
        return str(self.backend_result)
    
    def implement_frontend(self) -> str:
        """Phase 3: Implement frontend code."""
        if not self.plan:
            self.plan()
        
        frontend_task = Task(
            description=f"""
            Implement the frontend code for this feature based on the plan:
            
            FEATURE: {self.feature_description}
            
            PLAN: {self.plan}
            
            BACKEND IMPLEMENTATION: {self.backend_result}
            
            Implementation steps:
            1. Create new React components
            2. Create new pages if needed
            3. Update state management
            4. Add API integration
            5. Add routing
            
            Consider using Bolt.new for rapid prototyping if creating
            complex UI components. Follow existing patterns in frontend/src.
            """,
            expected_output="""
            - List of components created
            - List of pages created/modified
            - State management changes
            - Summary of implementation
            """,
            agent=self.frontend_dev,
        )
        
        crew = Crew(
            agents=[self.frontend_dev],
            tasks=[frontend_task],
            process=Process.sequential,
            verbose=True,
        )
        
        self.frontend_result = crew.kickoff()
        return str(self.frontend_result)
    
    def generate_tests(self) -> str:
        """Phase 4: Generate comprehensive tests."""
        test_task = Task(
            description=f"""
            Generate comprehensive tests for the implemented feature:
            
            FEATURE: {self.feature_description}
            
            BACKEND CODE: {self.backend_result}
            
            FRONTEND CODE: {self.frontend_result}
            
            Generate:
            1. Unit tests for new services
            2. Unit tests for new components
            3. Integration tests for API endpoints
            4. E2E tests for user flows
            
            Use the Test Generator tool for AI-powered test generation.
            Place tests in the correct directories.
            Run tests to verify they pass.
            """,
            expected_output="""
            - List of test files created
            - Test run results
            - Coverage report
            """,
            agent=self.tester,
        )
        
        crew = Crew(
            agents=[self.tester],
            tasks=[test_task],
            process=Process.sequential,
            verbose=True,
        )
        
        self.test_result = crew.kickoff()
        return str(self.test_result)
    
    def validate(self) -> str:
        """Phase 5: Review and validate everything."""
        review_task = Task(
            description=f"""
            Review all the code that was implemented for this feature:
            
            FEATURE: {self.feature_description}
            
            Run the following checks:
            1. Type checking (tsc --noEmit)
            2. Linting (eslint)
            3. All tests pass
            4. Code review checklist
            
            Provide a summary of:
            - What was implemented
            - Code quality assessment
            - Any issues found
            - Recommendations
            """,
            expected_output="""
            - Type check results
            - Lint results
            - Test results
            - Review summary
            - Final approval or issues list
            """,
            agent=self.reviewer,
        )
        
        crew = Crew(
            agents=[self.reviewer],
            tasks=[review_task],
            process=Process.sequential,
            verbose=True,
        )
        
        self.review_result = crew.kickoff()
        return str(self.review_result)
    
    def run_full_pipeline(self) -> str:
        """Run the complete feature implementation pipeline."""
        results = []
        
        # Phase 1: Planning
        print("📋 Phase 1: Planning...")
        plan = self.plan()
        results.append(f"## Planning\n{plan}")
        
        if self.dry_run:
            return "\n\n".join(results)
        
        # Phase 2: Backend
        print("⚙️ Phase 2: Backend Implementation...")
        backend = self.implement_backend()
        results.append(f"## Backend\n{backend}")
        
        # Phase 3: Frontend
        print("🎨 Phase 3: Frontend Implementation...")
        frontend = self.implement_frontend()
        results.append(f"## Frontend\n{frontend}")
        
        # Phase 4: Testing
        print("🧪 Phase 4: Test Generation...")
        tests = self.generate_tests()
        results.append(f"## Tests\n{tests}")
        
        # Phase 5: Validation
        print("✅ Phase 5: Validation...")
        validation = self.validate()
        results.append(f"## Validation\n{validation}")
        
        return "\n\n".join(results)
