"""
Backend Developer Agent
=======================

Specialized agent for implementing backend code.
"""

from crewai import Agent
from orchestrator.tools.openhands import OpenHandsTool
from orchestrator.tools.file_ops import FileReadTool, FileWriteTool, FileSearchTool
from orchestrator.tools.test_runner import TypeCheckTool


def create_backend_developer_agent() -> Agent:
    """Create the backend developer agent."""
    return Agent(
        role="Senior Backend Developer",
        goal="Implement robust, well-tested backend code following best practices",
        backstory="""You are a senior backend developer specializing in TypeScript and Node.js.
        You have deep expertise in:
        - Express.js API development
        - Drizzle ORM and PostgreSQL
        - Service-oriented architecture
        - RESTful API design
        - Error handling and validation
        - Security best practices
        
        For the Qestro project, you follow these patterns:
        - Services go in backend/src/services/
        - Routes go in backend/src/routes/
        - Controllers go in backend/src/controllers/
        - Database schemas go in backend/src/database/schema/
        - Validation schemas go in backend/src/validation/
        
        You always:
        - Write TypeScript with proper types
        - Add error handling
        - Include input validation
        - Follow existing code patterns
        - Write JSDoc comments
        """,
        tools=[
            OpenHandsTool(),
            FileReadTool(),
            FileWriteTool(),
            FileSearchTool(),
            TypeCheckTool(),
        ],
        verbose=True,
        allow_delegation=False,
    )


class BackendDeveloperAgent:
    """Wrapper for the backend developer agent."""
    
    def __init__(self):
        self.agent = create_backend_developer_agent()
    
    def get_implementation_prompt(self, task: str, context: str = "") -> str:
        """Generate implementation prompt for a backend task."""
        return f"""
# Backend Implementation Task

## Task
{task}

## Context
{context}

## Implementation Guidelines

### File Location Conventions
- Services: `backend/src/services/{{ServiceName}}Service.ts`
- Routes: `backend/src/routes/{{resource}}.ts`
- Controllers: `backend/src/controllers/{{resource}}Controller.ts`
- Database schemas: `backend/src/database/schema/{{table}}.ts`

### Code Style
- Use TypeScript strict mode
- Export types and interfaces
- Use async/await for all async operations
- Wrap operations in try/catch
- Log errors with the logger utility
- Use Zod for validation

### Required Patterns
```typescript
// Service pattern
export class {{Name}}Service {{
    async methodName(params: InputType): Promise<OutputType> {{
        try {{
            // Implementation
        }} catch (error) {{
            logger.error('Operation failed:', error);
            throw error;
        }}
    }}
}}

// Route pattern
router.post('/endpoint', async (req, res) => {{
    try {{
        const validated = schema.parse(req.body);
        const result = await service.method(validated);
        res.json({{ success: true, data: result }});
    }} catch (error) {{
        res.status(500).json({{ success: false, error: error.message }});
    }}
}});
```

## Expected Deliverables
1. Implementation files
2. TypeScript types
3. Route registration
4. Error handling
"""
