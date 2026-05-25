"""
MCP (Model Context Protocol) API endpoints.

Provides RESTful API access to MCP server management, tool execution,
and integration capabilities for the UPM.Plus ecosystem.
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Depends, Query, Body
from pydantic import BaseModel, Field

from app.services.mcp_integration import mcp_service, MCPServer, MCPToolExecution
from app.core.auth import get_current_user
from app.schemas.auth import User

logger = logging.getLogger(__name__)

router = APIRouter()


class MCPServerCreate(BaseModel):
    """Request model for creating MCP server."""
    name: str
    description: Optional[str] = None
    endpoint_url: str
    transport_type: str = "http"
    auth_config: Dict[str, Any] = Field(default_factory=dict)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class MCPServerResponse(BaseModel):
    """Response model for MCP server."""
    id: UUID
    name: str
    description: Optional[str]
    endpoint_url: str
    transport_type: str
    status: str
    capabilities: List[str]
    tools_count: int
    last_health_check: Optional[datetime]
    created_at: datetime


class MCPToolExecuteRequest(BaseModel):
    """Request model for executing MCP tool."""
    tool_name: str
    parameters: Dict[str, Any] = Field(default_factory=dict)
    workflow_id: Optional[UUID] = None


class MCPToolChainRequest(BaseModel):
    """Request model for executing MCP tool chain."""
    tool_chain: List[Dict[str, Any]]
    workflow_id: Optional[UUID] = None


class MCPToolResponse(BaseModel):
    """Response model for MCP tool information."""
    name: str
    full_name: str
    description: str
    server_name: str
    parameters: Dict[str, Any]
    required_params: List[str]
    category: Optional[str]
    examples: List[Dict[str, Any]]


class MCPExecutionResponse(BaseModel):
    """Response model for MCP tool execution."""
    id: UUID
    tool_name: str
    server_id: UUID
    parameters: Dict[str, Any]
    result: Optional[Any] = None
    error: Optional[str] = None
    execution_time_ms: Optional[int] = None
    started_at: datetime
    completed_at: Optional[datetime] = None
    success: bool


@router.get("/servers", response_model=List[MCPServerResponse])
async def list_mcp_servers(
    current_user: User = Depends(get_current_user)
):
    """List all registered MCP servers."""
    try:
        servers = []
        for server_id, server in mcp_service.registered_servers.items():
            status_info = await mcp_service.get_server_status(server_id)

            servers.append(MCPServerResponse(
                id=server.id,
                name=server.name,
                description=server.description,
                endpoint_url=server.endpoint_url,
                transport_type=server.transport_type,
                status=status_info.get("status", "unknown"),
                capabilities=server.capabilities,
                tools_count=status_info.get("tools_count", 0),
                last_health_check=server.last_health_check,
                created_at=server.created_at
            ))

        return servers

    except Exception as e:
        logger.error(f"Failed to list MCP servers: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve MCP servers")


@router.post("/servers", response_model=Dict[str, UUID])
async def register_mcp_server(
    server_config: MCPServerCreate,
    current_user: User = Depends(get_current_user)
):
    """Register a new MCP server."""
    try:
        server_id = await mcp_service.register_server(server_config.dict())
        return {"server_id": server_id}

    except Exception as e:
        logger.error(f"Failed to register MCP server: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to register server: {str(e)}")


@router.get("/servers/{server_id}/status")
async def get_mcp_server_status(
    server_id: UUID,
    current_user: User = Depends(get_current_user)
):
    """Get MCP server status and health information."""
    try:
        status = await mcp_service.get_server_status(server_id)

        if "error" in status:
            raise HTTPException(status_code=404, detail=status["error"])

        return status

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get server status: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve server status")


@router.get("/tools", response_model=List[MCPToolResponse])
async def list_mcp_tools(
    category: Optional[str] = Query(None, description="Filter tools by category"),
    current_user: User = Depends(get_current_user)
):
    """List all available MCP tools."""
    try:
        tools = await mcp_service.get_available_tools(category=category)
        return [MCPToolResponse(**tool) for tool in tools]

    except Exception as e:
        logger.error(f"Failed to list MCP tools: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve MCP tools")


@router.post("/tools/execute", response_model=MCPExecutionResponse)
async def execute_mcp_tool(
    request: MCPToolExecuteRequest,
    current_user: User = Depends(get_current_user)
):
    """Execute an MCP tool with given parameters."""
    try:
        execution = await mcp_service.execute_tool(
            tool_name=request.tool_name,
            parameters=request.parameters,
            user_id=current_user.id,
            workflow_id=request.workflow_id
        )

        return MCPExecutionResponse(
            id=execution.id,
            tool_name=execution.tool_name,
            server_id=execution.server_id,
            parameters=execution.parameters,
            result=execution.result,
            error=execution.error,
            execution_time_ms=execution.execution_time_ms,
            started_at=execution.started_at,
            completed_at=execution.completed_at,
            success=execution.error is None
        )

    except Exception as e:
        logger.error(f"Failed to execute MCP tool: {e}")
        raise HTTPException(status_code=400, detail=f"Tool execution failed: {str(e)}")


@router.post("/tools/execute-chain", response_model=List[MCPExecutionResponse])
async def execute_mcp_tool_chain(
    request: MCPToolChainRequest,
    current_user: User = Depends(get_current_user)
):
    """Execute a chain of MCP tools with parameter passing."""
    try:
        executions = await mcp_service.execute_tool_chain(
            tool_chain=request.tool_chain,
            user_id=current_user.id,
            workflow_id=request.workflow_id
        )

        return [
            MCPExecutionResponse(
                id=execution.id,
                tool_name=execution.tool_name,
                server_id=execution.server_id,
                parameters=execution.parameters,
                result=execution.result,
                error=execution.error,
                execution_time_ms=execution.execution_time_ms,
                started_at=execution.started_at,
                completed_at=execution.completed_at,
                success=execution.error is None
            )
            for execution in executions
        ]

    except Exception as e:
        logger.error(f"Failed to execute MCP tool chain: {e}")
        raise HTTPException(status_code=400, detail=f"Tool chain execution failed: {str(e)}")


@router.get("/executions", response_model=List[Dict[str, Any]])
async def get_mcp_execution_history(
    workflow_id: Optional[UUID] = Query(None, description="Filter by workflow ID"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of executions to return"),
    current_user: User = Depends(get_current_user)
):
    """Get MCP tool execution history."""
    try:
        history = await mcp_service.get_execution_history(
            user_id=current_user.id,
            workflow_id=workflow_id,
            limit=limit
        )

        return history

    except Exception as e:
        logger.error(f"Failed to get execution history: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve execution history")


@router.post("/tools/suggest")
async def suggest_tools_for_task(
    task_description: str = Body(..., embed=True),
    current_user: User = Depends(get_current_user)
):
    """Get AI-powered tool suggestions for a given task description."""
    try:
        suggestions = await mcp_service.suggest_tools_for_task(task_description)
        return {"suggestions": suggestions}

    except Exception as e:
        logger.error(f"Failed to suggest tools: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate tool suggestions")


@router.get("/health")
async def mcp_service_health():
    """Check MCP service health."""
    try:
        # Check if MCP service is running and responsive
        servers_count = len(mcp_service.registered_servers)
        tools_count = len(mcp_service.available_tools)

        # Perform a quick health check on active servers
        active_servers = 0
        for server_id in mcp_service.registered_servers.keys():
            status = await mcp_service.get_server_status(server_id)
            if status.get("status") == "active":
                active_servers += 1

        return {
            "status": "healthy",
            "servers_registered": servers_count,
            "active_servers": active_servers,
            "tools_available": tools_count,
            "service_uptime": "operational"
        }

    except Exception as e:
        logger.error(f"MCP health check failed: {e}")
        raise HTTPException(status_code=503, detail="MCP service unhealthy")


@router.get("/stats")
async def get_mcp_statistics(
    current_user: User = Depends(get_current_user)
):
    """Get MCP service usage statistics."""
    try:
        # Calculate statistics from execution history
        total_executions = len(mcp_service.execution_history)
        successful_executions = len([e for e in mcp_service.execution_history if e.error is None])

        # User-specific statistics
        user_executions = [e for e in mcp_service.execution_history if e.user_id == current_user.id]
        user_total = len(user_executions)
        user_successful = len([e for e in user_executions if e.error is None])

        # Calculate average execution time
        execution_times = [e.execution_time_ms for e in mcp_service.execution_history if e.execution_time_ms]
        avg_execution_time = sum(execution_times) / len(execution_times) if execution_times else 0

        # Most used tools
        tool_usage = {}
        for execution in mcp_service.execution_history:
            tool_usage[execution.tool_name] = tool_usage.get(execution.tool_name, 0) + 1

        most_used_tools = sorted(tool_usage.items(), key=lambda x: x[1], reverse=True)[:5]

        return {
            "total_executions": total_executions,
            "successful_executions": successful_executions,
            "success_rate": successful_executions / total_executions if total_executions > 0 else 0,
            "average_execution_time_ms": round(avg_execution_time, 2),
            "user_statistics": {
                "total_executions": user_total,
                "successful_executions": user_successful,
                "success_rate": user_successful / user_total if user_total > 0 else 0
            },
            "most_used_tools": [{"tool": tool, "usage_count": count} for tool, count in most_used_tools],
            "servers_status": {
                "total": len(mcp_service.registered_servers),
                "active": len([s for s in mcp_service.registered_servers.values() if s.status == "active"])
            }
        }

    except Exception as e:
        logger.error(f"Failed to get MCP statistics: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve statistics")