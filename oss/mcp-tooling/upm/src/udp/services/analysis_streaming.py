"""
Real-Time Analysis Streaming Service

Provides real-time streaming of analysis progress and partial results
to connected WebSocket clients.
"""

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional

from ..api.websocket import (
    send_analysis_progress,
    send_dependency_update,
    send_policy_violation,
    send_vulnerability_alert,
)
from ..monitoring.workflow_logger import log_event

logger = logging.getLogger(__name__)


@dataclass
class AnalysisStage:
    """A stage in the analysis process."""

    name: str
    description: str
    progress_weight: float  # How much this stage contributes to total progress
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


@dataclass
class AnalysisProgress:
    """Progress information for an analysis."""

    analysis_id: str
    current_stage: str
    progress: float  # 0-100
    stages: list[AnalysisStage] = field(default_factory=list)
    started_at: datetime = field(default_factory=datetime.utcnow)
    status: str = "running"  # running, completed, failed, cancelled


class AnalysisStreamer:
    """
    Manages real-time streaming of analysis progress.

    Usage:
        streamer = AnalysisStreamer()
        async with streamer.stream_analysis(analysis_id, project_id) as stream:
            await streamer.start_stage("extracting", "Extracting dependencies", 10)
            # ... do extraction ...
            await streamer.complete_stage("extracting")

            await streamer.start_stage("scanning", "Scanning for vulnerabilities", 80)
            # ... do scanning ...
            streamer.update_progress(50, "Scanning dependencies...")
    """

    # Active streams
    _active_streams: dict[str, AnalysisProgress] = {}

    @classmethod
    def get_stream(cls, analysis_id: str) -> Optional["AnalysisStreamer"]:
        """Get existing stream for analysis."""
        if analysis_id in cls._active_streams:
            return AnalysisStreamer(analysis_id, cls._active_streams[analysis_id])
        return None

    def __init__(self, analysis_id: str, progress: Optional[AnalysisProgress] = None):
        self.analysis_id = analysis_id

        if progress:
            self.progress = progress
        else:
            self.progress = AnalysisProgress(analysis_id=analysis_id, current_stage="")

        self._total_weight = sum(s.progress_weight for s in self.progress.stages)
        self._completed_weight = 0.0

    async def __aenter__(self):
        """Enter stream context."""
        self._active_streams[self.analysis_id] = self.progress
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Exit stream context."""
        if exc_type is None:
            self.progress.status = "completed"
        else:
            self.progress.status = "failed"

        # Send final update
        await send_analysis_progress(
            self.analysis_id,
            100.0,
            "Analysis complete" if exc_type is None else "Analysis failed",
            stage=self.progress.current_stage,
        )

        # Clean up
        if self.analysis_id in self._active_streams:
            del self._active_streams[self.analysis_id]

        await log_event(
            "analysis_stream_ended",
            {"analysis_id": self.analysis_id, "status": self.progress.status},
        )

    async def start_stage(
        self, stage_name: str, description: str, weight: float = 10.0
    ) -> None:
        """Start a new analysis stage."""
        stage = AnalysisStage(
            name=stage_name,
            description=description,
            progress_weight=weight,
            started_at=datetime.utcnow(),
        )

        self.progress.stages.append(stage)
        self.progress.current_stage = stage_name

        # Send update
        await send_analysis_progress(
            self.analysis_id, self._calculate_progress(), description, stage_name
        )

        await log_event(
            "analysis_stage_started",
            {"analysis_id": self.analysis_id, "stage": stage_name},
        )

    async def update_stage(
        self, stage_name: str, progress: float, message: Optional[str] = None
    ) -> None:
        """Update progress within current stage."""
        # Find the stage
        stage = next((s for s in self.progress.stages if s.name == stage_name), None)

        if stage:
            # Calculate overall progress based on stage weight
            stage_progress = (progress / 100) * stage.progress_weight
            overall_progress = self._calculate_progress_before_stage() + stage_progress

            await send_analysis_progress(
                self.analysis_id,
                overall_progress,
                message or stage.description,
                stage_name,
            )

    async def complete_stage(self, stage_name: str) -> None:
        """Mark a stage as complete."""
        stage = next((s for s in self.progress.stages if s.name == stage_name), None)

        if stage:
            stage.completed_at = datetime.utcnow()

            # Send completion update
            await send_analysis_progress(
                self.analysis_id,
                self._calculate_progress(),
                f"{stage.description} - Complete",
                stage_name,
            )

    def _calculate_progress(self) -> float:
        """Calculate overall progress percentage."""
        total_weight = sum(s.progress_weight for s in self.progress.stages)
        if total_weight == 0:
            return 0.0

        completed = 0.0
        for stage in self.progress.stages:
            if stage.completed_at:
                completed += stage.progress_weight

        return (completed / total_weight) * 100

    def _calculate_progress_before_stage(self) -> float:
        """Calculate progress before current stage."""
        completed = 0.0
        for stage in self.progress.stages:
            if stage.completed_at:
                completed += stage.progress_weight

        return (completed / self._total_weight) * 100

    async def report_dependency(
        self, dependency: dict[str, Any], status: str = "scanned"
    ) -> None:
        """Report a dependency that was analyzed."""
        await send_dependency_update(
            self.analysis_id, {**dependency, "status": status}, "dependency_scanned"
        )

    async def report_vulnerability(self, vulnerability: dict[str, Any]) -> None:
        """Report a discovered vulnerability."""
        await send_vulnerability_alert(self.analysis_id, vulnerability)

    async def report_violation(self, violation: dict[str, Any]) -> None:
        """Report a policy violation."""
        await send_policy_violation(self.analysis_id, violation)

    async def update_progress(self, progress: float, message: str) -> None:
        """Update overall progress."""
        await send_analysis_progress(
            self.analysis_id, progress, message, self.progress.current_stage
        )


class StreamingAnalysisOrchestrator:
    """
    Orchestrates analysis with real-time progress streaming.

    This is the main service that coordinates:
    - Starting analysis tasks
    - Streaming progress updates
    - Reporting findings in real-time
    - Handling client subscriptions
    """

    def __init__(self):
        self._active_analyses: dict[str, AnalysisProgress] = {}
        self._subscribers: dict[str, Set[str]] = {}  # analysis_id -> connection_ids

    async def start_analysis(
        self,
        analysis_id: str,
        project_id: str,
        analysis_type: str = "full",  # full, vulnerabilities, compliance, sbom
        options: Optional[dict[str, Any]] = None,
    ) -> str:
        """Start a new analysis with streaming."""
        # Create progress tracker
        progress = AnalysisProgress(
            analysis_id=analysis_id, current_stage="initializing", status="running"
        )

        self._active_analyses[analysis_id] = progress

        # Notify subscribers
        await send_analysis_progress(
            analysis_id, 0.0, "Analysis starting...", "initializing"
        )

        # Start analysis in background
        asyncio.create_task(
            self._run_analysis(analysis_id, project_id, analysis_type, options or {})
        )

        return analysis_id

    async def _run_analysis(
        self,
        analysis_id: str,
        project_id: str,
        analysis_type: str,
        options: dict[str, Any],
    ) -> None:
        """Run the actual analysis with progress streaming."""
        streamer = AnalysisStreamer(analysis_id)

        try:
            # Initialize
            await streamer.start_stage("initializing", "Initializing analysis", 5)
            await asyncio.sleep(0.5)  # Simulate initialization
            await streamer.complete_stage("initializing")

            # Extract dependencies
            await streamer.start_stage("extracting", "Extracting dependencies", 15)
            dependencies = await self._extract_dependencies(project_id, streamer)
            await streamer.complete_stage("extracting")

            # Scan dependencies
            await streamer.start_stage("scanning", "Scanning dependencies", 40)
            vulnerabilities = await self._scan_dependencies(dependencies, streamer)
            await streamer.complete_stage("scanning")

            # Check policies
            await streamer.start_stage("policies", "Checking policies", 20)
            violations = await self._check_policies(dependencies, streamer)
            await streamer.complete_stage("policies")

            # Generate report
            await streamer.start_stage("reporting", "Generating report", 10)
            report = await self._generate_report(
                dependencies, vulnerabilities, violations
            )
            await streamer.complete_stage("reporting")

            # Complete
            await send_analysis_progress(
                analysis_id, 100.0, "Analysis complete", "complete"
            )

            # Save results
            await self._save_results(analysis_id, report)

        except Exception as e:
            logger.error(f"Analysis error: {e}")
            await send_analysis_progress(
                analysis_id,
                streamer.progress.progress,
                f"Analysis failed: {str(e)}",
                "error",
            )

    async def _extract_dependencies(
        self, project_id: str, streamer: AnalysisStreamer
    ) -> list[dict[str, Any]]:
        """Extract dependencies with progress updates."""
        # Placeholder - would use appropriate ecosystem adapter
        dependencies = []

        await streamer.update_progress(
            "extracting", 50, "Extracting Maven dependencies..."
        )

        return dependencies

    async def _scan_dependencies(
        self, dependencies: list[dict[str, Any]], streamer: AnalysisStreamer
    ) -> list[dict[str, Any]]:
        """Scan dependencies for vulnerabilities."""
        vulnerabilities = []

        for i, dep in enumerate(dependencies):
            progress = 50 + (i / len(dependencies)) * 50
            await streamer.update_progress(
                "scanning", progress, f"Scanning {dep.get('name')}..."
            )

            # Scan dependency
            vulns = await self._scan_single_dependency(dep)
            vulnerabilities.extend(vulns)

            # Report findings
            for vuln in vulns:
                await streamer.report_vulnerability(vuln)

        return vulnerabilities

    async def _scan_single_dependency(
        self, dependency: dict[str, Any]
    ) -> list[dict[str, Any]]:
        """Scan a single dependency."""
        # Placeholder - would use vulnerability scanner
        return []

    async def _check_policies(
        self, dependencies: list[dict[str, Any]], streamer: AnalysisStreamer
    ) -> list[dict[str, Any]]:
        """Check dependencies against security policies."""
        violations = []

        await streamer.update_progress("policies", 50, "Checking security policies...")

        # Placeholder - would use policy enforcer
        return violations

    async def _generate_report(
        self,
        dependencies: list[dict[str, Any]],
        vulnerabilities: list[dict[str, Any]],
        violations: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Generate analysis report."""
        return {
            "dependencies": dependencies,
            "vulnerabilities": vulnerabilities,
            "violations": violations,
            "timestamp": datetime.utcnow().isoformat(),
        }

    async def _save_results(self, analysis_id: str, report: dict[str, Any]) -> None:
        """Save analysis results to database."""
        # Placeholder - would save to database
        await log_event(
            "analysis_results_saved",
            {
                "analysis_id": analysis_id,
                "vulnerabilities": len(report.get("vulnerabilities", [])),
                "violations": len(report.get("violations", [])),
            },
        )

    async def cancel_analysis(self, analysis_id: str) -> bool:
        """Cancel a running analysis."""
        if analysis_id not in self._active_analyses:
            return False

        self._active_analyses[analysis_id].status = "cancelled"

        await send_analysis_progress(
            analysis_id,
            self._active_analyses[analysis_id].progress,
            "Analysis cancelled",
            "cancelled",
        )

        del self._active_analyses[analysis_id]

        return True

    def get_analysis_status(self, analysis_id: str) -> Optional[dict[str, Any]]:
        """Get status of an analysis."""
        if analysis_id not in self._active_analyses:
            return None

        progress = self._active_analyses[analysis_id]

        return {
            "analysis_id": analysis_id,
            "status": progress.status,
            "current_stage": progress.current_stage,
            "progress": progress.progress,
            "stages": [
                {
                    "name": s.name,
                    "description": s.description,
                    "weight": s.progress_weight,
                    "started_at": s.started_at.isoformat() if s.started_at else None,
                    "completed_at": s.completed_at.isoformat()
                    if s.completed_at
                    else None,
                }
                for s in progress.stages
            ],
            "started_at": progress.started_at.isoformat(),
        }


# Singleton instance
_orchestrator = StreamingAnalysisOrchestrator()


def get_analysis_orchestrator() -> StreamingAnalysisOrchestrator:
    """Get the singleton orchestrator instance."""
    return _orchestrator
