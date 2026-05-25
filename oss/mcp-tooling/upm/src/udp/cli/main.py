"""
UDP CLI main entry point.

Production-ready command-line interface for Universal Dependency Platform.
"""

import asyncio
import json
import logging
import sys
from pathlib import Path
from typing import Optional, List
from uuid import UUID

import click
import httpx
from rich.console import Console
from rich.table import Table
from rich.progress import Progress, SpinnerColumn, TextColumn

from udp.workflows.dependency_analysis import DependencyAnalysisWorkflow
from udp.workflows.approval_workflow import ApprovalWorkflow, ApprovalType
from udp.tools.vulnerability_scanner import VulnerabilityScanner
from udp.tools.sbom_generator import SBOMGenerator
from udp.tools.ecosystems import get_ecosystem_for_file

console = Console()
logger = logging.getLogger(__name__)


@click.group()
@click.option('--verbose', '-v', is_flag=True, help='Enable verbose logging')
@click.option('--api-url', default='http://localhost:8040', help='UDP API base URL')
@click.option('--org-id', required=True, help='Organization ID')
@click.pass_context
def cli(ctx, verbose, api_url, org_id):
    """Universal Dependency Platform CLI - Enterprise dependency management."""
    ctx.ensure_object(dict)
    ctx.obj['verbose'] = verbose
    ctx.obj['api_url'] = api_url
    ctx.obj['org_id'] = UUID(org_id)
    
    # Configure logging
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )


@cli.command()
@click.argument('manifest_files', nargs=-1, type=click.Path(exists=True))
@click.option('--output', '-o', type=click.Path(), help='Output file path')
@click.option('--format', 'output_format', type=click.Choice(['json', 'table', 'csv']), default='table', help='Output format')
@click.pass_context
def analyze(ctx, manifest_files, output, output_format):
    """Analyze dependencies in manifest files."""
    if not manifest_files:
        console.print("[red]Error: No manifest files provided[/red]")
        sys.exit(1)
    
    console.print(f"[blue]Analyzing {len(manifest_files)} manifest files...[/blue]")
    
    async def run_analysis():
        workflow = DependencyAnalysisWorkflow(ctx.obj['org_id'])
        
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console
        ) as progress:
            task = progress.add_task("Analyzing dependencies...", total=None)
            
            try:
                result = await workflow.execute(
                    manifest_files=list(manifest_files),
                    analysis_options={"project_id": "cli-analysis"}
                )
                
                progress.update(task, description="Analysis complete!")
                
                # Display results
                _display_analysis_results(result, output_format, output)
                
            except Exception as e:
                console.print(f"[red]Analysis failed: {e}[/red]")
                sys.exit(1)
    
    asyncio.run(run_analysis())


@cli.command()
@click.argument('package_name')
@click.argument('package_version')
@click.option('--reason', required=True, help='Reason for approval request')
@click.option('--auto-approve', is_flag=True, help='Auto-approve if eligible')
@click.pass_context
def approve(ctx, package_name, package_version, reason, auto_approve):
    """Request approval for a package dependency."""
    console.print(f"[blue]Requesting approval for {package_name}@{package_version}...[/blue]")
    
    async def run_approval():
        workflow = ApprovalWorkflow(ctx.obj['org_id'])
        
        request_data = {
            "package_name": package_name,
            "package_version": package_version,
            "reason": reason,
            "auto_approve": auto_approve
        }
        
        try:
            result = await workflow.execute(
                request_type=ApprovalType.DEPENDENCY_UPDATE,
                request_data=request_data,
                requester_id=ctx.obj['org_id'],  # Mock requester ID
                requester_role="developer"
            )
            
            _display_approval_results(result)
            
        except Exception as e:
            console.print(f"[red]Approval request failed: {e}[/red]")
            sys.exit(1)
    
    asyncio.run(run_approval())


@cli.command()
@click.argument('manifest_files', nargs=-1, type=click.Path(exists=True))
@click.option('--output', '-o', type=click.Path(), help='Output file path')
@click.option('--format', 'output_format', type=click.Choice(['cyclonedx', 'spdx']), default='cyclonedx', help='SBOM format')
@click.pass_context
def sbom(ctx, manifest_files, output, format):
    """Generate Software Bill of Materials (SBOM)."""
    if not manifest_files:
        console.print("[red]Error: No manifest files provided[/red]")
        sys.exit(1)
    
    console.print(f"[blue]Generating {format.upper()} SBOM for {len(manifest_files)} manifest files...[/blue]")
    
    async def run_sbom_generation():
        # First analyze dependencies
        workflow = DependencyAnalysisWorkflow(ctx.obj['org_id'])
        analysis_result = await workflow.execute(
            manifest_files=list(manifest_files),
            analysis_options={"project_id": "sbom-generation"}
        )
        
        if not analysis_result.get('dependency_graphs'):
            console.print("[red]No dependency graphs found[/red]")
            sys.exit(1)
        
        # Generate SBOM
        sbom_generator = SBOMGenerator(ctx.obj['org_id'])
        dependency_graph = analysis_result['dependency_graphs'][0]  # Use first graph
        
        sbom_data = sbom_generator.generate_sbom(
            dependency_graph=dependency_graph,
            format_type=format,
            include_metadata=True
        )
        
        # Output SBOM
        if output:
            sbom_generator.export_sbom(sbom_data, format, output)
            console.print(f"[green]SBOM exported to {output}[/green]")
        else:
            console.print(json.dumps(sbom_data, indent=2))
    
    asyncio.run(run_sbom_generation())


@cli.command()
@click.argument('manifest_files', nargs=-1, type=click.Path(exists=True))
@click.option('--output', '-o', type=click.Path(), help='Output file path')
@click.pass_context
def scan(ctx, manifest_files, output):
    """Scan dependencies for vulnerabilities."""
    if not manifest_files:
        console.print("[red]Error: No manifest files provided[/red]")
        sys.exit(1)
    
    console.print(f"[blue]Scanning {len(manifest_files)} manifest files for vulnerabilities...[/blue]")
    
    async def run_scan():
        # First analyze dependencies
        workflow = DependencyAnalysisWorkflow(ctx.obj['org_id'])
        analysis_result = await workflow.execute(
            manifest_files=list(manifest_files),
            analysis_options={"project_id": "vulnerability-scan"}
        )
        
        if not analysis_result.get('resolved_packages'):
            console.print("[red]No packages found to scan[/red]")
            sys.exit(1)
        
        # Scan for vulnerabilities
        scanner = VulnerabilityScanner(ctx.obj['org_id'])
        scan_results = await scanner.scan_packages(analysis_result['resolved_packages'])
        
        # Display results
        _display_scan_results(scan_results, output)
    
    asyncio.run(run_scan())


@cli.command()
@click.pass_context
def status(ctx):
    """Check UDP service status."""
    console.print("[blue]Checking UDP service status...[/blue]")
    
    try:
        response = httpx.get(f"{ctx.obj['api_url']}/health/", timeout=10.0)
        if response.status_code == 200:
            health_data = response.json()
            console.print("[green]✓ UDP service is healthy[/green]")
            console.print(f"  Version: {health_data.get('version', 'unknown')}")
            console.print(f"  Environment: {health_data.get('environment', 'unknown')}")
        else:
            console.print(f"[red]✗ UDP service returned status {response.status_code}[/red]")
            sys.exit(1)
    except httpx.RequestError as e:
        console.print(f"[red]✗ Failed to connect to UDP service: {e}[/red]")
        sys.exit(1)


@cli.command()
@click.pass_context
def ecosystems(ctx):
    """List supported package ecosystems."""
    console.print("[blue]Fetching supported ecosystems...[/blue]")
    
    try:
        response = httpx.get(f"{ctx.obj['api_url']}/api/v1/dependencies/ecosystems/supported", timeout=10.0)
        if response.status_code == 200:
            data = response.json()
            
            table = Table(title="Supported Ecosystems")
            table.add_column("Type", style="cyan")
            table.add_column("Name", style="green")
            table.add_column("Description", style="yellow")
            table.add_column("Extensions", style="magenta")
            
            for ecosystem in data.get('ecosystems', []):
                table.add_row(
                    ecosystem.get('type', ''),
                    ecosystem.get('name', ''),
                    ecosystem.get('description', ''),
                    ', '.join(ecosystem.get('supported_extensions', []))
                )
            
            console.print(table)
            console.print(f"\n[blue]Total: {data.get('total', 0)} ecosystems, {data.get('total_extensions', 0)} extensions[/blue]")
        else:
            console.print(f"[red]Failed to fetch ecosystems: {response.status_code}[/red]")
            sys.exit(1)
    except httpx.RequestError as e:
        console.print(f"[red]Failed to connect to UDP service: {e}[/red]")
        sys.exit(1)


def _display_analysis_results(result, output_format, output_file):
    """Display dependency analysis results."""
    if output_format == 'json':
        output_data = {
            "summary": {
                "total_packages": len(result.get('resolved_packages', [])),
                "vulnerabilities": len(result.get('vulnerabilities', [])),
                "policy_violations": len(result.get('policy_violations', [])),
                "license_violations": len(result.get('license_violations', []))
            },
            "packages": [
                {
                    "name": pkg.name,
                    "version": pkg.version,
                    "ecosystem": pkg.ecosystem.value
                }
                for pkg in result.get('resolved_packages', [])
            ],
            "vulnerabilities": [
                {
                    "package": vuln.package_name,
                    "version": vuln.package_version,
                    "cve": vuln.cve_id,
                    "severity": vuln.severity.value,
                    "description": vuln.description
                }
                for vuln in result.get('vulnerabilities', [])
            ]
        }
        
        if output_file:
            with open(output_file, 'w') as f:
                json.dump(output_data, f, indent=2)
            console.print(f"[green]Results exported to {output_file}[/green]")
        else:
            console.print(json.dumps(output_data, indent=2))
    
    else:
        # Table format
        table = Table(title="Dependency Analysis Results")
        table.add_column("Metric", style="cyan")
        table.add_column("Count", style="green")
        
        table.add_row("Total Packages", str(len(result.get('resolved_packages', []))))
        table.add_row("Vulnerabilities", str(len(result.get('vulnerabilities', []))))
        table.add_row("Policy Violations", str(len(result.get('policy_violations', []))))
        table.add_row("License Violations", str(len(result.get('license_violations', []))))
        
        console.print(table)
        
        # Show vulnerabilities if any
        vulnerabilities = result.get('vulnerabilities', [])
        if vulnerabilities:
            vuln_table = Table(title="Vulnerabilities Found")
            vuln_table.add_column("Package", style="cyan")
            vuln_table.add_column("Version", style="green")
            vuln_table.add_column("CVE", style="yellow")
            vuln_table.add_column("Severity", style="red")
            
            for vuln in vulnerabilities:
                vuln_table.add_row(
                    vuln.package_name,
                    vuln.package_version,
                    vuln.cve_id,
                    vuln.severity.value.upper()
                )
            
            console.print(vuln_table)


def _display_approval_results(result):
    """Display approval workflow results."""
    console.print(f"[blue]Approval Request: {result['workflow_id']}[/blue]")
    console.print(f"Status: {result['status'].value}")
    console.print(f"Decision: {result.get('final_decision', 'pending')}")
    
    if result.get('decision_rationale'):
        console.print(f"Rationale: {result['decision_rationale']}")
    
    if result.get('auto_approval_eligible'):
        console.print("[green]✓ Auto-approval eligible[/green]")
    else:
        console.print("[yellow]⚠ Manual approval required[/yellow]")


def _display_scan_results(scan_results, output_file):
    """Display vulnerability scan results."""
    total_vulnerabilities = sum(len(vulns) for vulns in scan_results.values())
    
    if total_vulnerabilities == 0:
        console.print("[green]✓ No vulnerabilities found[/green]")
        return
    
    console.print(f"[red]Found {total_vulnerabilities} vulnerabilities across {len(scan_results)} packages[/red]")
    
    # Create summary table
    table = Table(title="Vulnerability Scan Summary")
    table.add_column("Package", style="cyan")
    table.add_column("Vulnerabilities", style="red")
    table.add_column("Critical", style="red")
    table.add_column("High", style="yellow")
    table.add_column("Medium", style="blue")
    
    for package_name, vulnerabilities in scan_results.items():
        if vulnerabilities:
            critical = len([v for v in vulnerabilities if v.severity.value == 'critical'])
            high = len([v for v in vulnerabilities if v.severity.value == 'high'])
            medium = len([v for v in vulnerabilities if v.severity.value == 'medium'])
            
            table.add_row(
                package_name,
                str(len(vulnerabilities)),
                str(critical),
                str(high),
                str(medium)
            )
    
    console.print(table)
    
    if output_file:
        output_data = {
            "scan_timestamp": str(datetime.utcnow()),
            "total_packages": len(scan_results),
            "total_vulnerabilities": total_vulnerabilities,
            "results": {
                package: [
                    {
                        "cve_id": vuln.cve_id,
                        "severity": vuln.severity.value,
                        "description": vuln.description,
                        "published_date": vuln.published_date.isoformat()
                    }
                    for vuln in vulnerabilities
                ]
                for package, vulnerabilities in scan_results.items()
            }
        }
        
        with open(output_file, 'w') as f:
            json.dump(output_data, f, indent=2)
        console.print(f"[green]Scan results exported to {output_file}[/green]")


if __name__ == '__main__':
    cli()
