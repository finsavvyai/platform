"""
Model Context Protocol (MCP) integration service.

This service provides MCP server management, tool execution, and integration
with the UPM.Plus agent system, leveraging AutoBoot's proven MCP architecture.
"""

import asyncio
import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Union
from uuid import UUID, uuid4

import websockets
from pydantic import BaseModel, Field
import httpx

from app.core.config import settings
from app.core.redis import redis_client
from app.services.llm import llm_service

logger = logging.getLogger(__name__)


class MCPServer(BaseModel):
    """MCP server configuration."""
    id: UUID = Field(default_factory=uuid4)
    name: str
    description: Optional[str] = None
    endpoint_url: str
    transport_type: str = "http"  # http, websocket, stdio
    auth_config: Dict[str, Any] = Field(default_factory=dict)
    capabilities: List[str] = Field(default_factory=list)
    tools: List[Dict[str, Any]] = Field(default_factory=list)
    resources: List[Dict[str, Any]] = Field(default_factory=list)
    status: str = "unknown"  # active, inactive, error, unknown
    last_health_check: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class MCPTool(BaseModel):
    """MCP tool definition."""
    name: str
    description: str
    server_id: UUID
    parameters: Dict[str, Any] = Field(default_factory=dict)
    required_params: List[str] = Field(default_factory=list)
    examples: List[Dict[str, Any]] = Field(default_factory=list)
    category: Optional[str] = None


class MCPToolExecution(BaseModel):
    """MCP tool execution record."""
    id: UUID = Field(default_factory=uuid4)
    tool_name: str
    server_id: UUID
    parameters: Dict[str, Any]
    result: Optional[Any] = None
    error: Optional[str] = None
    execution_time_ms: Optional[int] = None
    started_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    user_id: Optional[UUID] = None
    workflow_id: Optional[UUID] = None


class MCPRequest(BaseModel):
    """MCP JSON-RPC request."""
    jsonrpc: str = "2.0"
    id: Union[str, int, None] = None
    method: str
    params: Optional[Dict[str, Any]] = None


class MCPResponse(BaseModel):
    """MCP JSON-RPC response."""
    jsonrpc: str = "2.0"
    id: Union[str, int, None] = None
    result: Optional[Any] = None
    error: Optional[Dict[str, Any]] = None


class MCPIntegrationService:
    """
    MCP integration service for managing MCP servers and executing tools.
    
    Provides server discovery, tool execution, and integration with the
    UPM.Plus workflow system, based on AutoBoot's proven MCP patterns.
    """
    
    def __init__(self):
        self.registered_servers: Dict[UUID, MCPServer] = {}
        self.available_tools: Dict[str, MCPTool] = {}
        self.execution_history: List[MCPToolExecution] = []
        self.http_client = httpx.AsyncClient(timeout=30.0)
        self._initialize_default_servers()
    
    def _initialize_default_servers(self):
        """Initialize default MCP servers including AutoBoot."""
        # AutoBoot MCP server (leveraging proven implementation)
        autoboot_server = MCPServer(
            name="AutoBoot",
            description="Development server restart and project management",
            endpoint_url="https://autoboot.dev/.netlify/functions/mcp",
            transport_type="http",
            capabilities=["project_detection", "dev_server_management", "process_monitoring"],
            metadata={
                "provider": "FinSavvy AI",
                "version": "1.0.0",
                "documentation": "https://autoboot.dev/docs"
            }
        )
        self.registered_servers[autoboot_server.id] = autoboot_server
        
        # Add other default servers
        github_server = MCPServer(
            name="GitHub MCP",
            description="GitHub repository and issue management",
            endpoint_url="github://mcp-server",
            transport_type="stdio",
            capabilities=["repository_management", "issue_tracking", "pull_requests"]
        )
        self.registered_servers[github_server.id] = github_server
        
        logger.info(f"Initialized {len(self.registered_servers)} default MCP servers")
    
    async def register_server(self, server_config: Dict[str, Any]) -> UUID:
        """Register a new MCP server."""
        try:
            server = MCPServer(**server_config)
            
            # Perform health check and capability discovery
            await self._discover_server_capabilities(server)
            
            self.registered_servers[server.id] = server
            
            # Cache server info in Redis
            await redis_client.set(
                f"mcp_server:{server.id}",
                json.dumps(server.dict(), default=str),
                expire=3600
            )
            
            logger.info(f"Registered MCP server: {server.name}")
            return server.id
            
        except Exception as e:
            logger.error(f"Failed to register MCP server: {e}")
            raise
    
    async def _discover_server_capabilities(self, server: MCPServer):
        """Discover server capabilities, tools, and resources."""
        try:
            if server.transport_type == "http":
                await self._discover_http_server(server)
            elif server.transport_type == "websocket":
                await self._discover_websocket_server(server)
            else:
                logger.warning(f"Unsupported transport type: {server.transport_type}")
                
        except Exception as e:
            logger.error(f"Server discovery failed for {server.name}: {e}")
            server.status = "error"
    
    async def _discover_http_server(self, server: MCPServer):
        """Discover HTTP MCP server capabilities."""
        try:
            # Try to get server info
            response = await self.http_client.get(server.endpoint_url)
            if response.status_code == 200:
                server_info = response.json()
                server.capabilities = server_info.get("capabilities", [])
                server.metadata.update(server_info.get("metadata", {}))
            
            # Discover tools
            tools_request = MCPRequest(
                id="discover_tools",
                method="tools/list"
            )
            
            response = await self.http_client.post(
                server.endpoint_url,
                json=tools_request.dict(),
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                tools_response = MCPResponse(**response.json())
                if tools_response.result and "tools" in tools_response.result:
                    server.tools = tools_response.result["tools"]
                    
                    # Register tools
                    for tool_data in server.tools:
                        tool = MCPTool(
                            name=tool_data["name"],
                            description=tool_data.get("description", ""),
                            server_id=server.id,
                            parameters=tool_data.get("inputSchema", {}).get("properties", {}),
                            required_params=tool_data.get("inputSchema", {}).get("required", [])
                        )
                        self.available_tools[f"{server.name}:{tool.name}"] = tool
            
            server.status = "active"
            server.last_health_check = datetime.utcnow()
            
        except Exception as e:
            logger.error(f"HTTP server discovery failed: {e}")
            server.status = "error"
    
    async def _discover_websocket_server(self, server: MCPServer):
        """Discover WebSocket MCP server capabilities."""
        try:
            async with websockets.connect(server.endpoint_url) as websocket:
                # Send tools list request
                tools_request = MCPRequest(
                    id="discover_tools",
                    method="tools/list"
                )
                
                await websocket.send(json.dumps(tools_request.dict()))
                response_data = await websocket.recv()
                response = MCPResponse(**json.loads(response_data))
                
                if response.result and "tools" in response.result:
                    server.tools = response.result["tools"]
                    
                    # Register tools
                    for tool_data in server.tools:
                        tool = MCPTool(
                            name=tool_data["name"],
                            description=tool_data.get("description", ""),
                            server_id=server.id,
                            parameters=tool_data.get("inputSchema", {}).get("properties", {}),
                            required_params=tool_data.get("inputSchema", {}).get("required", [])
                        )
                        self.available_tools[f"{server.name}:{tool.name}"] = tool
                
                server.status = "active"
                server.last_health_check = datetime.utcnow()
                
        except Exception as e:
            logger.error(f"WebSocket server discovery failed: {e}")
            server.status = "error"
    
    async def execute_tool(
        self,
        tool_name: str,
        parameters: Dict[str, Any],
        user_id: Optional[UUID] = None,
        workflow_id: Optional[UUID] = None
    ) -> MCPToolExecution:
        """Execute an MCP tool."""
        execution = MCPToolExecution(
            tool_name=tool_name,
            server_id=uuid4(),  # Will be updated
            parameters=parameters,
            user_id=user_id,
            workflow_id=workflow_id
        )
        
        try:
            # Find tool and server
            tool = self.available_tools.get(tool_name)
            if not tool:
                raise ValueError(f"Tool not found: {tool_name}")
            
            server = self.registered_servers.get(tool.server_id)
            if not server:
                raise ValueError(f"Server not found for tool: {tool_name}")
            
            execution.server_id = server.id
            
            # Validate parameters
            missing_params = [p for p in tool.required_params if p not in parameters]
            if missing_params:
                raise ValueError(f"Missing required parameters: {missing_params}")
            
            # Execute tool based on transport type
            if server.transport_type == "http":
                result = await self._execute_http_tool(server, tool, parameters)
            elif server.transport_type == "websocket":
                result = await self._execute_websocket_tool(server, tool, parameters)
            else:
                raise ValueError(f"Unsupported transport type: {server.transport_type}")
            
            execution.result = result
            execution.completed_at = datetime.utcnow()
            execution.execution_time_ms = int(
                (execution.completed_at - execution.started_at).total_seconds() * 1000
            )
            
            logger.info(f"Tool {tool_name} executed successfully in {execution.execution_time_ms}ms")
            
        except Exception as e:
            execution.error = str(e)
            execution.completed_at = datetime.utcnow()
            execution.execution_time_ms = int(
                (execution.completed_at - execution.started_at).total_seconds() * 1000
            )
            logger.error(f"Tool execution failed: {e}")
        
        # Store execution history
        self.execution_history.append(execution)
        
        # Cache in Redis
        await redis_client.set(
            f"mcp_execution:{execution.id}",
            json.dumps(execution.dict(), default=str),
            expire=86400  # 24 hours
        )
        
        return execution
    
    async def _execute_http_tool(
        self,
        server: MCPServer,
        tool: MCPTool,
        parameters: Dict[str, Any]
    ) -> Any:
        """Execute tool via HTTP transport."""
        request = MCPRequest(
            id=str(uuid4()),
            method="tools/call",
            params={
                "name": tool.name,
                "arguments": parameters
            }
        )
        
        response = await self.http_client.post(
            server.endpoint_url,
            json=request.dict(),
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code != 200:
            raise Exception(f"HTTP request failed: {response.status_code}")
        
        mcp_response = MCPResponse(**response.json())
        
        if mcp_response.error:
            raise Exception(f"MCP error: {mcp_response.error}")
        
        return mcp_response.result
    
    async def _execute_websocket_tool(
        self,
        server: MCPServer,
        tool: MCPTool,
        parameters: Dict[str, Any]
    ) -> Any:
        """Execute tool via WebSocket transport."""
        async with websockets.connect(server.endpoint_url) as websocket:
            request = MCPRequest(
                id=str(uuid4()),
                method="tools/call",
                params={
                    "name": tool.name,
                    "arguments": parameters
                }
            )
            
            await websocket.send(json.dumps(request.dict()))
            response_data = await websocket.recv()
            mcp_response = MCPResponse(**json.loads(response_data))
            
            if mcp_response.error:
                raise Exception(f"MCP error: {mcp_response.error}")
            
            return mcp_response.result
    
    async def get_available_tools(self, category: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get list of available MCP tools."""
        tools = []
        for tool_key, tool in self.available_tools.items():
            if category and tool.category != category:
                continue
            
            server = self.registered_servers.get(tool.server_id)
            tools.append({
                "name": tool.name,
                "full_name": tool_key,
                "description": tool.description,
                "server_name": server.name if server else "Unknown",
                "parameters": tool.parameters,
                "required_params": tool.required_params,
                "category": tool.category,
                "examples": tool.examples
            })
        
        return tools
    
    async def get_server_status(self, server_id: UUID) -> Dict[str, Any]:
        """Get MCP server status and health."""
        server = self.registered_servers.get(server_id)
        if not server:
            return {"error": "Server not found"}
        
        # Perform health check
        try:
            if server.transport_type == "http":
                response = await self.http_client.get(
                    f"{server.endpoint_url}/health",
                    timeout=5.0
                )
                health_status = response.status_code == 200
            else:
                health_status = server.status == "active"
            
            server.status = "active" if health_status else "inactive"
            server.last_health_check = datetime.utcnow()
            
        except Exception as e:
            server.status = "error"
            logger.error(f"Health check failed for {server.name}: {e}")
        
        return {
            "id": server.id,
            "name": server.name,
            "status": server.status,
            "last_health_check": server.last_health_check,
            "tools_count": len([t for t in self.available_tools.values() if t.server_id == server.id]),
            "capabilities": server.capabilities,
            "endpoint_url": server.endpoint_url,
            "transport_type": server.transport_type
        }
    
    async def execute_tool_chain(
        self,
        tool_chain: List[Dict[str, Any]],
        user_id: Optional[UUID] = None,
        workflow_id: Optional[UUID] = None
    ) -> List[MCPToolExecution]:
        """Execute a chain of MCP tools with parameter passing."""
        executions = []
        context = {}
        
        for i, step in enumerate(tool_chain):
            tool_name = step["tool"]
            parameters = step.get("parameters", {})
            
            # Substitute parameters from previous results
            if i > 0 and step.get("use_previous_result"):
                previous_result = executions[-1].result
                if isinstance(previous_result, dict):
                    context.update(previous_result)
                else:
                    context["previous_result"] = previous_result
            
            # Substitute context variables in parameters
            resolved_parameters = self._resolve_parameters(parameters, context)
            
            # Execute tool
            execution = await self.execute_tool(
                tool_name=tool_name,
                parameters=resolved_parameters,
                user_id=user_id,
                workflow_id=workflow_id
            )
            
            executions.append(execution)
            
            # Stop chain if execution failed
            if execution.error:
                logger.error(f"Tool chain stopped at step {i} due to error: {execution.error}")
                break
            
            # Update context with result
            if execution.result:
                context[f"step_{i}_result"] = execution.result
        
        return executions
    
    def _resolve_parameters(self, parameters: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """Resolve parameter templates with context values."""
        resolved = {}
        
        for key, value in parameters.items():
            if isinstance(value, str) and value.startswith("{{") and value.endswith("}}"):
                # Template variable
                var_name = value[2:-2].strip()
                resolved[key] = context.get(var_name, value)
            elif isinstance(value, dict):
                resolved[key] = self._resolve_parameters(value, context)
            else:
                resolved[key] = value
        
        return resolved
    
    async def get_execution_history(
        self,
        user_id: Optional[UUID] = None,
        workflow_id: Optional[UUID] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Get MCP tool execution history."""
        filtered_executions = self.execution_history
        
        if user_id:
            filtered_executions = [e for e in filtered_executions if e.user_id == user_id]
        
        if workflow_id:
            filtered_executions = [e for e in filtered_executions if e.workflow_id == workflow_id]
        
        # Sort by started_at descending and limit
        sorted_executions = sorted(
            filtered_executions,
            key=lambda x: x.started_at,
            reverse=True
        )[:limit]
        
        return [
            {
                "id": e.id,
                "tool_name": e.tool_name,
                "server_id": e.server_id,
                "success": e.error is None,
                "execution_time_ms": e.execution_time_ms,
                "started_at": e.started_at,
                "completed_at": e.completed_at,
                "error": e.error
            }
            for e in sorted_executions
        ]
    
    async def suggest_tools_for_task(self, task_description: str) -> List[Dict[str, Any]]:
        """Use AI to suggest relevant MCP tools for a task."""
        try:
            available_tools = await self.get_available_tools()
            tools_summary = "\n".join([
                f"- {tool['name']}: {tool['description']}"
                for tool in available_tools[:20]  # Limit for prompt size
            ])
            
            analysis = await llm_service.analyze_task(
                task_description=task_description,
                context=f"Available MCP tools:\n{tools_summary}"
            )
            
            # Extract suggested tools from analysis
            suggested_tools = []
            analysis_result = analysis.get("analysis", {})
            
            if isinstance(analysis_result, dict):
                suggested_capabilities = analysis_result.get("required_capabilities", [])
                
                # Match capabilities to tools
                for tool in available_tools:
                    tool_desc_lower = tool["description"].lower()
                    if any(cap.lower() in tool_desc_lower for cap in suggested_capabilities):
                        suggested_tools.append({
                            "tool": tool,
                            "relevance_score": 0.8,  # Placeholder scoring
                            "reason": f"Matches capability: {suggested_capabilities[0]}"
                        })
            
            return suggested_tools[:5]  # Top 5 suggestions
            
        except Exception as e:
            logger.error(f"Tool suggestion failed: {e}")
            return []
    
    async def cleanup(self):
        """Cleanup MCP integration service resources."""
        try:
            await self.http_client.aclose()
            logger.info("MCP integration service cleanup completed")
        except Exception as e:
            logger.error(f"MCP integration service cleanup failed: {e}")


# Global MCP integration service instance
mcp_service = MCPIntegrationService()
