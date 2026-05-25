"""
Planner Agent
=============

The architect agent that breaks down features into tasks and decides which tools to use.
"""

from crewai import Agent
from orchestrator.tools.file_ops import FileSearchTool, DirectoryListTool


def create_planner_agent() -> Agent:
    """Create the planner agent."""
    return Agent(
        role="Senior Software Architect",
        goal="Break down features into implementable tasks and create comprehensive plans",
        backstory="""You are a senior software architect with 15+ years of experience.
        You excel at understanding complex requirements and breaking them into clear,
        actionable tasks. You understand the Qestro codebase deeply - it's a TypeScript
        full-stack application with:
        - Backend: Express.js, Drizzle ORM, PostgreSQL
        - Frontend: React, Tailwind CSS, Zustand
        - Testing: Playwright, Jest, Vitest
        
        You always consider:
        - Database schema changes needed
        - API endpoints required
        - Frontend components needed
        - Test coverage requirements
        - Integration with existing code
        """,
        tools=[FileSearchTool(), DirectoryListTool()],
        verbose=True,
        allow_delegation=True,
    )


class PlannerAgent:
    """Wrapper for the planner agent with helper methods."""
    
    def __init__(self):
        self.agent = create_planner_agent()
    
    def create_feature_plan(self, description: str) -> str:
        """Create a detailed plan for a feature."""
        plan_template = f"""
# Feature Implementation Plan

## Feature Description
{description}

## Analysis Required
1. What existing code is affected?
2. What new code is needed?
3. What tests need to be written?
4. What documentation is needed?

## Task Breakdown
Please analyze and create tasks for:

### Backend Tasks
- [ ] Database schema changes
- [ ] New services needed
- [ ] New API endpoints
- [ ] Existing code modifications

### Frontend Tasks
- [ ] New pages needed
- [ ] New components needed
- [ ] State management changes
- [ ] API integration

### Testing Tasks
- [ ] Unit tests
- [ ] Integration tests
- [ ] E2E tests

### Documentation Tasks
- [ ] API documentation
- [ ] User documentation
"""
        return plan_template
    
    def assign_tools(self, task_type: str) -> list:
        """Decide which tools to use for a task type."""
        tool_mapping = {
            "ui_prototype": ["bolt_new", "openhands"],
            "backend_api": ["openhands", "file_ops"],
            "database": ["file_ops", "openhands"],
            "frontend_component": ["bolt_new", "openhands", "file_ops"],
            "testing": ["openhands", "test_runner"],
            "bugfix": ["file_ops", "openhands", "test_runner"],
        }
        return tool_mapping.get(task_type, ["openhands", "file_ops"])
