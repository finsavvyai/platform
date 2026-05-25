"""
Reviewer Agent
==============

Quality assurance agent that reviews code and suggests improvements.
"""

from crewai import Agent
from orchestrator.tools.file_ops import FileReadTool, FileSearchTool
from orchestrator.tools.test_runner import TypeCheckTool, LintTool, TestRunnerTool


def create_reviewer_agent() -> Agent:
    """Create the reviewer agent."""
    return Agent(
        role="Senior Code Reviewer",
        goal="Ensure code quality, security, and adherence to best practices",
        backstory="""You are a senior code reviewer with expertise in TypeScript, Node.js, and React.
        You focus on:
        - Code quality and readability
        - Security vulnerabilities
        - Performance issues
        - Best practices adherence
        - Test coverage
        - Documentation quality
        
        You provide constructive feedback and suggestions for improvement.
        You check for:
        - Type safety
        - Error handling
        - Input validation
        - SQL injection
        - XSS vulnerabilities
        - Performance bottlenecks
        - Code duplication
        """,
        tools=[
            FileReadTool(),
            FileSearchTool(),
            TypeCheckTool(),
            LintTool(),
            TestRunnerTool(),
        ],
        verbose=True,
        allow_delegation=False,
    )


class ReviewerAgent:
    """Wrapper for the reviewer agent."""
    
    def __init__(self):
        self.agent = create_reviewer_agent()
    
    def get_review_checklist(self) -> str:
        """Get the code review checklist."""
        return """
# Code Review Checklist

## TypeScript/JavaScript
- [ ] Proper TypeScript types (no `any` unless justified)
- [ ] Error handling with try/catch
- [ ] Input validation
- [ ] No console.log in production code
- [ ] Proper async/await usage
- [ ] No unused imports or variables

## Security
- [ ] No hardcoded secrets
- [ ] Input sanitization
- [ ] Parameterized queries (no SQL injection)
- [ ] Proper authentication checks
- [ ] CSRF protection where needed

## Performance
- [ ] No N+1 queries
- [ ] Proper memoization where needed
- [ ] Lazy loading for heavy components
- [ ] Efficient algorithms

## React
- [ ] Proper hooks usage
- [ ] No side effects in render
- [ ] Proper loading/error states
- [ ] Accessibility (aria labels, semantic HTML)
- [ ] Responsive design

## Testing
- [ ] Unit tests for new functions
- [ ] Edge cases covered
- [ ] Mocks are appropriate
- [ ] Tests are not flaky

## Documentation
- [ ] JSDoc comments for public APIs
- [ ] README updates if needed
- [ ] Type exports for external use
"""
