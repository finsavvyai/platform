"""
Frontend Developer Agent
========================

Specialized agent for implementing frontend code.
"""

from crewai import Agent
from orchestrator.tools.openhands import OpenHandsTool
from orchestrator.tools.file_ops import FileReadTool, FileWriteTool, FileSearchTool
from orchestrator.tools.bolt_api import BoltNewTool


def create_frontend_developer_agent() -> Agent:
    """Create the frontend developer agent."""
    return Agent(
        role="Senior Frontend Developer",
        goal="Create beautiful, accessible, and performant React components",
        backstory="""You are a senior frontend developer specializing in React and TypeScript.
        You have deep expertise in:
        - React with TypeScript
        - Tailwind CSS for styling
        - Zustand for state management
        - Modern UI/UX patterns
        - Accessibility (WCAG 2.1)
        - Performance optimization
        
        For the Qestro project, you follow these patterns:
        - Pages go in frontend/src/pages/
        - Components follow atomic design in frontend/src/components/
        - Stores go in frontend/src/stores/
        - Hooks go in frontend/src/hooks/
        - Services go in frontend/src/services/
        
        You always:
        - Write TypeScript with proper types
        - Use Tailwind CSS, not inline styles
        - Create reusable components
        - Add proper loading/error states
        - Ensure accessibility
        - Use semantic HTML
        """,
        tools=[
            OpenHandsTool(),
            FileReadTool(),
            FileWriteTool(),
            FileSearchTool(),
            BoltNewTool(),
        ],
        verbose=True,
        allow_delegation=False,
    )


class FrontendDeveloperAgent:
    """Wrapper for the frontend developer agent."""
    
    def __init__(self):
        self.agent = create_frontend_developer_agent()
    
    def get_implementation_prompt(self, task: str, context: str = "") -> str:
        """Generate implementation prompt for a frontend task."""
        return f"""
# Frontend Implementation Task

## Task
{task}

## Context
{context}

## Implementation Guidelines

### File Location Conventions
- Pages: `frontend/src/pages/{{PageName}}.tsx`
- Components: `frontend/src/components/{{category}}/{{ComponentName}}.tsx`
- Stores: `frontend/src/stores/{{name}}Store.ts`
- Services: `frontend/src/services/{{name}}.ts`

### Component Categories (Atomic Design)
- atoms: Basic UI elements (Button, Input, Badge)
- molecules: Combinations (FormField, Card, Modal)
- organisms: Complex sections (DataTable, Sidebar)
- layout: Page layouts (MainLayout, AuthLayout)

### Code Style
- Functional components with hooks
- TypeScript interfaces for props
- Tailwind CSS for all styling
- Named exports for components
- Default export for pages

### Required Patterns
```tsx
// Component pattern
interface {{Name}}Props {{
    title: string;
    onAction: () => void;
}}

export function {{Name}}({{ title, onAction }}: {{Name}}Props) {{
    return (
        <div className="p-4 bg-gray-800 rounded-lg">
            <h2 className="text-lg font-semibold text-white">{{title}}</h2>
            <button 
                onClick={{onAction}}
                className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded"
            >
                Action
            </button>
        </div>
    );
}}

// Page pattern
export default function {{Page}}Page() {{
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    if (isLoading) return <LoadingSpinner />;
    if (error) return <ErrorMessage message={{error}} />;
    
    return (
        <MainLayout>
            <PageContent />
        </MainLayout>
    );
}}
```

## Styling Guidelines
- Dark theme by default (bg-gray-900, text-white)
- Use rounded corners (rounded-lg)
- Add hover states (hover:bg-gray-700)
- Smooth transitions (transition-all duration-200)
- Proper spacing (p-4, gap-4)

## Expected Deliverables
1. Component files
2. Type definitions
3. Any needed hooks or utilities
4. Integration with existing pages/routes
"""
