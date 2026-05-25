#!/usr/bin/env python3
"""
Qestro AI Orchestrator - Main CLI Entry Point
=============================================

The single command that orchestrates all AI tools to build features automatically.

Examples:
    qestro-ai feature "Build a self-healing test locator system"
    qestro-ai fix "The dashboard is not loading test results"
    qestro-ai ui "Create a test recording player component"
    qestro-ai test "Generate comprehensive tests for PaymentService"
"""

import os
from pathlib import Path
from typing import Optional
import typer
from rich.console import Console
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn
from dotenv import load_dotenv

from orchestrator.crews.feature_crew import FeatureCrew
from orchestrator.crews.bugfix_crew import BugfixCrew
from orchestrator.crews.ui_crew import UICrew
from orchestrator.crews.test_crew import TestCrew

# Load environment variables
load_dotenv()

app = typer.Typer(
    name="qestro-ai",
    help="🤖 AI Orchestrator - One command to build complete features",
    add_completion=False,
)
console = Console()


def get_project_root() -> Path:
    """Get the Qestro project root directory."""
    return Path(__file__).parent.parent.parent


@app.command()
def feature(
    description: str = typer.Argument(..., help="Description of the feature to build"),
    branch: Optional[str] = typer.Option(None, "--branch", "-b", help="Git branch name"),
    dry_run: bool = typer.Option(False, "--dry-run", help="Plan only, don't execute"),
):
    """
    🚀 Build a complete feature end-to-end.
    
    This command will:
    1. Plan the feature architecture
    2. Create backend (API, services, database)
    3. Create frontend (pages, components)
    4. Generate tests
    5. Run validation
    
    Example:
        qestro-ai feature "Build a self-healing test locator system"
    """
    console.print(Panel.fit(
        f"[bold blue]🚀 Building Feature[/bold blue]\n\n{description}",
        border_style="blue"
    ))
    
    project_root = get_project_root()
    
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
    ) as progress:
        task = progress.add_task("Initializing AI Crew...", total=None)
        
        crew = FeatureCrew(
            project_root=project_root,
            feature_description=description,
            branch_name=branch,
            dry_run=dry_run,
        )
        
        progress.update(task, description="Planning feature architecture...")
        plan = crew.plan()
        
        if dry_run:
            console.print("\n[yellow]Dry run - showing plan only:[/yellow]")
            console.print(plan)
            return
        
        progress.update(task, description="Implementing backend...")
        crew.implement_backend()
        
        progress.update(task, description="Implementing frontend...")
        crew.implement_frontend()
        
        progress.update(task, description="Generating tests...")
        crew.generate_tests()
        
        progress.update(task, description="Running validation...")
        result = crew.validate()
    
    console.print(Panel.fit(
        f"[bold green]✅ Feature Complete![/bold green]\n\n{result}",
        border_style="green"
    ))


@app.command()
def fix(
    issue: str = typer.Argument(..., help="Description of the bug to fix"),
    file: Optional[str] = typer.Option(None, "--file", "-f", help="Specific file with the bug"),
):
    """
    🔧 Fix a bug or issue automatically.
    
    This command will:
    1. Analyze the issue
    2. Find the root cause
    3. Implement the fix
    4. Verify the fix works
    
    Example:
        qestro-ai fix "Login page not redirecting after authentication"
    """
    console.print(Panel.fit(
        f"[bold yellow]🔧 Fixing Issue[/bold yellow]\n\n{issue}",
        border_style="yellow"
    ))
    
    project_root = get_project_root()
    
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
    ) as progress:
        task = progress.add_task("Analyzing issue...", total=None)
        
        crew = BugfixCrew(
            project_root=project_root,
            issue_description=issue,
            target_file=file,
        )
        
        progress.update(task, description="Finding root cause...")
        analysis = crew.analyze()
        
        progress.update(task, description="Implementing fix...")
        crew.fix()
        
        progress.update(task, description="Verifying fix...")
        result = crew.verify()
    
    console.print(Panel.fit(
        f"[bold green]✅ Bug Fixed![/bold green]\n\n{result}",
        border_style="green"
    ))


@app.command()
def ui(
    description: str = typer.Argument(..., help="Description of the UI to create"),
    page: Optional[str] = typer.Option(None, "--page", "-p", help="Target page name"),
    prototype_first: bool = typer.Option(True, "--prototype/--no-prototype", help="Create Bolt.new prototype first"),
):
    """
    🎨 Create UI components or pages.
    
    This command will:
    1. Create a prototype in Bolt.new (optional)
    2. Implement the component/page
    3. Integrate with existing code
    4. Add styling and animations
    
    Example:
        qestro-ai ui "Create an analytics dashboard with charts and filters"
    """
    console.print(Panel.fit(
        f"[bold magenta]🎨 Creating UI[/bold magenta]\n\n{description}",
        border_style="magenta"
    ))
    
    project_root = get_project_root()
    
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
    ) as progress:
        task = progress.add_task("Designing UI...", total=None)
        
        crew = UICrew(
            project_root=project_root,
            ui_description=description,
            target_page=page,
            use_bolt_prototype=prototype_first,
        )
        
        if prototype_first:
            progress.update(task, description="Creating Bolt.new prototype...")
            crew.create_prototype()
        
        progress.update(task, description="Implementing components...")
        crew.implement()
        
        progress.update(task, description="Integrating with codebase...")
        result = crew.integrate()
    
    console.print(Panel.fit(
        f"[bold green]✅ UI Created![/bold green]\n\n{result}",
        border_style="green"
    ))


@app.command()
def test(
    target: str = typer.Argument(..., help="What to generate tests for"),
    type: str = typer.Option("all", "--type", "-t", help="Test type: unit, integration, e2e, all"),
):
    """
    🧪 Generate comprehensive tests.
    
    This command will:
    1. Analyze the target code
    2. Generate appropriate tests
    3. Run the tests
    4. Report coverage
    
    Example:
        qestro-ai test "PaymentService" --type unit
        qestro-ai test "checkout flow" --type e2e
    """
    console.print(Panel.fit(
        f"[bold cyan]🧪 Generating Tests[/bold cyan]\n\nTarget: {target}\nType: {type}",
        border_style="cyan"
    ))
    
    project_root = get_project_root()
    
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
    ) as progress:
        task = progress.add_task("Analyzing code...", total=None)
        
        crew = TestCrew(
            project_root=project_root,
            target=target,
            test_type=type,
        )
        
        progress.update(task, description="Generating tests...")
        crew.generate()
        
        progress.update(task, description="Running tests...")
        result = crew.run()
    
    console.print(Panel.fit(
        f"[bold green]✅ Tests Complete![/bold green]\n\n{result}",
        border_style="green"
    ))


@app.command()
def status():
    """📊 Show orchestrator status and configuration."""
    console.print(Panel.fit(
        "[bold]🤖 Qestro AI Orchestrator[/bold]\n\n"
        f"Project Root: {get_project_root()}\n"
        f"OpenAI Key: {'✅ Set' if os.getenv('OPENAI_API_KEY') else '❌ Missing'}\n"
        f"Anthropic Key: {'✅ Set' if os.getenv('ANTHROPIC_API_KEY') else '❌ Missing'}\n"
        f"OpenHands URL: {os.getenv('OPENHANDS_API_URL', 'Not set')}\n",
        border_style="blue"
    ))


if __name__ == "__main__":
    app()
