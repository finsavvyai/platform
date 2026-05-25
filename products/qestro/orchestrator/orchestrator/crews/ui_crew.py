"""
UI Creation Crew
================

Crew specialized in creating UI components and pages.
Leverages Bolt.new for rapid prototyping.
"""

from pathlib import Path
from typing import Optional
from crewai import Crew, Task, Process
from orchestrator.agents.frontend_dev import create_frontend_developer_agent
from orchestrator.tools.bolt_api import BoltNewTool


class UICrew:
    """
    Crew for creating UI components and pages.
    
    This crew:
    1. Creates a Bolt.new prototype (optional)
    2. Implements the component/page
    3. Integrates with existing codebase
    """
    
    def __init__(
        self,
        project_root: Path,
        ui_description: str,
        target_page: Optional[str] = None,
        use_bolt_prototype: bool = True,
    ):
        self.project_root = project_root
        self.ui_description = ui_description
        self.target_page = target_page
        self.use_bolt_prototype = use_bolt_prototype
        
        self.frontend_dev = create_frontend_developer_agent()
        self.bolt_tool = BoltNewTool(project_root=project_root)
        
        # Results
        self.prototype = None
        self.implementation = None
        self.integration = None
    
    def create_prototype(self) -> str:
        """Create a Bolt.new prototype."""
        result = self.bolt_tool._run(
            description=self.ui_description,
            framework="react",
            style="tailwind",
        )
        self.prototype = result
        return result
    
    def implement(self) -> str:
        """Implement the UI component/page."""
        context = ""
        if self.prototype:
            context = f"PROTOTYPE:\n{self.prototype}"
        
        implement_task = Task(
            description=f"""
            Create the UI component/page:
            
            DESCRIPTION: {self.ui_description}
            
            TARGET PAGE: {self.target_page or 'New component'}
            
            {context}
            
            Implementation:
            1. Create React component(s)
            2. Use Tailwind CSS for styling
            3. Add TypeScript types
            4. Include loading/error states
            5. Make it accessible
            
            Follow existing patterns in frontend/src/components.
            """,
            expected_output="""
            - Component files created
            - TypeScript types
            - Ready for integration
            """,
            agent=self.frontend_dev,
        )
        
        crew = Crew(
            agents=[self.frontend_dev],
            tasks=[implement_task],
            process=Process.sequential,
            verbose=True,
        )
        
        self.implementation = crew.kickoff()
        return str(self.implementation)
    
    def integrate(self) -> str:
        """Integrate with existing codebase."""
        integrate_task = Task(
            description=f"""
            Integrate the new UI into the Qestro codebase:
            
            COMPONENT: {self.ui_description}
            
            IMPLEMENTATION: {self.implementation}
            
            Integration steps:
            1. Add to appropriate page or create new page
            2. Update routing if needed
            3. Connect to state management
            4. Connect to API services
            5. Update navigation/sidebar if needed
            """,
            expected_output="""
            - Files modified for integration
            - Routing changes
            - State connections
            - Ready to use
            """,
            agent=self.frontend_dev,
        )
        
        crew = Crew(
            agents=[self.frontend_dev],
            tasks=[integrate_task],
            process=Process.sequential,
            verbose=True,
        )
        
        self.integration = crew.kickoff()
        return str(self.integration)
