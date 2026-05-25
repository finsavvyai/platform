"""
MCPOverflow AI Crew Service
===========================

FastAPI service that exposes the CrewAI multi-agent orchestration
for MCP connector generation.

Endpoints:
    - POST /api/crew/generate-connector: Start connector generation
    - POST /api/crew/validate-and-heal: Validate and auto-heal connector
    - GET  /api/crew/jobs/{job_id}: Get job status
    - GET  /health: Health check
"""

from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, Any
import uuid
import asyncio
from datetime import datetime
import os
from dotenv import load_dotenv

from .crews.connector_crew import ConnectorGenerationCrew
from .workflows.self_healing import SelfHealingWorkflow

# Load environment variables
load_dotenv()

# Create FastAPI app
app = FastAPI(
    title="MCPOverflow AI Crew Service",
    description="Multi-agent AI orchestration for autonomous MCP connector generation",
    version="1.0.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# Request/Response Models
# ============================================================================

class ConnectorRequest(BaseModel):
    """Request to generate an MCP connector."""
    api_spec: dict = Field(..., description="API specification (OpenAPI, GraphQL, etc.)")
    language: str = Field(default="typescript", description="Target language")
    runtime: str = Field(default="cloudflare", description="Target runtime")
    mcp_version: str = Field(default="1.0.0", description="MCP specification version")
    user_id: str = Field(..., description="User ID for tracking")


class HealingRequest(BaseModel):
    """Request to validate and heal a connector."""
    connector_id: str = Field(..., description="ID of connector to heal")
    connector_code: dict = Field(..., description="Current connector code")
    test_code: dict = Field(..., description="Current test code")
    error_details: dict = Field(..., description="Error details from failed tests")
    user_id: str = Field(..., description="User ID for tracking")


class JobResponse(BaseModel):
    """Response when a job is created."""
    job_id: str
    status: str
    status_url: str
    created_at: str


class JobStatus(BaseModel):
    """Status of a background job."""
    id: str
    status: str  # queued, processing, completed, failed
    progress: int = 0
    result: Optional[dict] = None
    error: Optional[str] = None
    created_at: str
    completed_at: Optional[str] = None


# ============================================================================
# Job Storage (In-memory - use Redis in production)
# ============================================================================

jobs: dict[str, JobStatus] = {}


def create_job(job_type: str) -> str:
    """Create a new job entry."""
    job_id = str(uuid.uuid4())
    jobs[job_id] = JobStatus(
        id=job_id,
        status="queued",
        progress=0,
        created_at=datetime.utcnow().isoformat(),
    )
    return job_id


def update_job(
    job_id: str,
    status: Optional[str] = None,
    progress: Optional[int] = None,
    result: Optional[dict] = None,
    error: Optional[str] = None,
) -> None:
    """Update job status."""
    if job_id not in jobs:
        return
    
    if status:
        jobs[job_id].status = status
    if progress is not None:
        jobs[job_id].progress = progress
    if result is not None:
        jobs[job_id].result = result
    if error is not None:
        jobs[job_id].error = error
    if status in ("completed", "failed"):
        jobs[job_id].completed_at = datetime.utcnow().isoformat()


# ============================================================================
# Background Task Processors
# ============================================================================

async def process_connector_generation(job_id: str, request: ConnectorRequest) -> None:
    """Process connector generation in the background."""
    try:
        update_job(job_id, status="processing", progress=5)
        
        # Create the crew
        crew = ConnectorGenerationCrew(
            api_spec=request.api_spec,
            config={
                "language": request.language,
                "runtime": request.runtime,
                "mcp_version": request.mcp_version,
            },
        )
        
        update_job(job_id, progress=20)
        
        # Run the crew (this is CPU-bound, should be in thread pool)
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, crew.run)
        
        update_job(job_id, progress=80)
        
        # If validation failed, run self-healing
        if not result["success"] and result.get("errors"):
            workflow = SelfHealingWorkflow(max_attempts=3)
            healed_result = await loop.run_in_executor(
                None,
                lambda: workflow.run(
                    api_spec=request.api_spec,
                    config={
                        "language": request.language,
                        "runtime": request.runtime,
                    },
                ),
            )
            result = healed_result
        
        update_job(
            job_id,
            status="completed",
            progress=100,
            result=result,
        )
        
    except Exception as e:
        update_job(
            job_id,
            status="failed",
            error=str(e),
        )


async def process_healing(job_id: str, request: HealingRequest) -> None:
    """Process connector healing in the background."""
    try:
        update_job(job_id, status="processing", progress=10)
        
        # Create self-healing workflow
        workflow = SelfHealingWorkflow(max_attempts=3)
        
        update_job(job_id, progress=30)
        
        # Run healing workflow
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            lambda: workflow.run(
                api_spec={},  # Would need to retrieve from storage
                config={"language": "typescript", "runtime": "cloudflare"},
            ),
        )
        
        update_job(
            job_id,
            status="completed",
            progress=100,
            result=result,
        )
        
    except Exception as e:
        update_job(
            job_id,
            status="failed",
            error=str(e),
        )


# ============================================================================
# API Endpoints
# ============================================================================

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "ai-crew",
        "version": "1.0.0",
        "components": {
            "crewai": "available",
            "langgraph": "available",
        },
    }


@app.post("/api/crew/generate-connector", response_model=JobResponse)
async def generate_connector(
    request: ConnectorRequest,
    background_tasks: BackgroundTasks,
):
    """
    Start MCP connector generation with AI crew.
    
    This endpoint starts an async job that:
    1. Analyzes the API specification
    2. Generates connector code
    3. Creates test suite
    4. Validates quality
    5. Self-heals if validation fails
    
    Returns a job ID to poll for status.
    """
    job_id = create_job("connector_generation")
    
    background_tasks.add_task(
        process_connector_generation,
        job_id,
        request,
    )
    
    return JobResponse(
        job_id=job_id,
        status="queued",
        status_url=f"/api/crew/jobs/{job_id}",
        created_at=datetime.utcnow().isoformat(),
    )


@app.post("/api/crew/validate-and-heal", response_model=JobResponse)
async def validate_and_heal(
    request: HealingRequest,
    background_tasks: BackgroundTasks,
):
    """
    Validate an existing connector and auto-heal if broken.
    
    This endpoint:
    1. Runs tests on the provided connector
    2. Analyzes any failures
    3. Applies fixes
    4. Repeats until tests pass or max attempts reached
    
    Returns a job ID to poll for status.
    """
    job_id = create_job("connector_healing")
    
    background_tasks.add_task(
        process_healing,
        job_id,
        request,
    )
    
    return JobResponse(
        job_id=job_id,
        status="queued",
        status_url=f"/api/crew/jobs/{job_id}",
        created_at=datetime.utcnow().isoformat(),
    )


@app.get("/api/crew/jobs/{job_id}", response_model=JobStatus)
async def get_job_status(job_id: str):
    """
    Get the status of a background job.
    
    Poll this endpoint to track job progress.
    """
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return jobs[job_id]


@app.get("/api/crew/jobs")
async def list_jobs(limit: int = 20):
    """
    List recent jobs.
    
    Returns the most recent jobs ordered by creation time.
    """
    sorted_jobs = sorted(
        jobs.values(),
        key=lambda j: j.created_at,
        reverse=True,
    )[:limit]
    
    return {
        "jobs": [
            {
                "id": job.id,
                "status": job.status,
                "progress": job.progress,
                "created_at": job.created_at,
                "completed_at": job.completed_at,
            }
            for job in sorted_jobs
        ],
        "total": len(jobs),
    }


# ============================================================================
# Run Server
# ============================================================================

def main():
    """Run the FastAPI server."""
    import uvicorn
    
    host = os.getenv("AI_CREW_HOST", "0.0.0.0")
    port = int(os.getenv("AI_CREW_PORT", "8090"))
    
    uvicorn.run(
        "src.main:app",
        host=host,
        port=port,
        reload=os.getenv("AI_CREW_DEV", "false").lower() == "true",
    )


if __name__ == "__main__":
    main()
