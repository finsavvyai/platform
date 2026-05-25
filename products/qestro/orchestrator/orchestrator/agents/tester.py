"""
Tester Agent
============

Specialized agent for writing and running tests.
"""

from crewai import Agent
from orchestrator.tools.openhands import OpenHandsTool, TestGeneratorTool
from orchestrator.tools.file_ops import FileReadTool, FileWriteTool, FileSearchTool
from orchestrator.tools.test_runner import TestRunnerTool


def create_tester_agent() -> Agent:
    """Create the tester agent."""
    return Agent(
        role="Senior QA Engineer",
        goal="Ensure code quality through comprehensive testing",
        backstory="""You are a senior QA engineer with expertise in test automation.
        You specialize in:
        - Unit testing with Jest and Vitest
        - E2E testing with Playwright
        - Integration testing
        - Test-driven development
        - Coverage optimization
        
        For the Qestro project:
        - Backend tests go in backend/src/__tests__/
        - Frontend tests go in frontend/src/__tests__/
        - E2E tests go in tests/e2e/
        - Integration tests go in tests/integration/
        
        You always:
        - Write descriptive test names
        - Cover edge cases
        - Mock external dependencies
        - Assert on behavior, not implementation
        - Organize tests logically
        """,
        tools=[
            OpenHandsTool(),
            TestGeneratorTool(),
            FileReadTool(),
            FileWriteTool(),
            FileSearchTool(),
            TestRunnerTool(),
        ],
        verbose=True,
        allow_delegation=False,
    )


class TesterAgent:
    """Wrapper for the tester agent."""
    
    def __init__(self):
        self.agent = create_tester_agent()
    
    def get_test_generation_prompt(self, target: str, test_type: str) -> str:
        """Generate prompt for test creation."""
        return f"""
# Test Generation Task

## Target
{target}

## Test Type
{test_type}

## Test Patterns

### Unit Test Pattern (Jest/Vitest)
```typescript
import {{ describe, it, expect, vi }} from 'vitest';
import {{ TargetClass }} from '../TargetClass';

describe('TargetClass', () => {{
    describe('methodName', () => {{
        it('should handle normal case', async () => {{
            // Arrange
            const instance = new TargetClass();
            
            // Act
            const result = await instance.methodName(input);
            
            // Assert
            expect(result).toEqual(expected);
        }});
        
        it('should handle error case', async () => {{
            // Arrange
            const instance = new TargetClass();
            
            // Act & Assert
            await expect(instance.methodName(invalidInput))
                .rejects.toThrow('Expected error');
        }});
    }});
}});
```

### E2E Test Pattern (Playwright)
```typescript
import {{ test, expect }} from '@playwright/test';

test.describe('Feature Name', () => {{
    test('should complete user flow', async ({{ page }}) => {{
        // Navigate
        await page.goto('/path');
        
        // Interact
        await page.click('button[data-testid="action"]');
        await page.fill('input[name="field"]', 'value');
        
        // Assert
        await expect(page.locator('.result')).toContainText('success');
    }});
}});
```

## Coverage Goals
- Unit tests: 80%+ coverage
- E2E tests: Cover all critical user flows
- Integration tests: Cover all API endpoints

## Expected Deliverables
1. Test files in correct locations
2. Comprehensive test cases
3. Mocks for external dependencies
4. Test utilities if needed
"""
