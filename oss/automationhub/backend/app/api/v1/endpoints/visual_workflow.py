"""
Enhanced Visual Workflow API Endpoints

Provides REST API endpoints for the visual workflow designer with:
- Real-time collaboration support
- Workflow template management
- Advanced execution monitoring
- WebSocket integration for live updates
- Import/export functionality
"""

import asyncio
import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Union
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.services.workflow_engine import workflow_engine, WorkflowDefinition, WorkflowExecution, WorkflowStatus
from app.services.task_executor import task_executor
from app.services.redis import redis_client
from app.core.websocket import ConnectionManager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/visual-workflow", tags=["visual-workflow"])
connection_manager = ConnectionManager()

# Pydantic models
class WorkflowNodeModel(BaseModel):
    id: str
    type: str
    position: Dict[str, float]
    data: Dict[str, Any]

class WorkflowEdgeModel(BaseModel):
    id: str
    source: str
    target: str
    sourceHandle: Optional[str] = None
    targetHandle: Optional[str] = None
    type: str = "default"
    animated: bool = False

class WorkflowCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    nodes: List[WorkflowNodeModel]
    edges: List[WorkflowEdgeModel]
    metadata: Optional[Dict[str, Any]] = {}

class WorkflowUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    nodes: Optional[List[WorkflowNodeModel]] = None
    edges: Optional[List[WorkflowEdgeModel]] = None
    metadata: Optional[Dict[str, Any]] = None

class WorkflowTemplateRequest(BaseModel):
    name: str
    description: str
    category: str
    tags: List[str]
    difficulty: str
    estimated_time: str
    nodes: List[WorkflowNodeModel]
    edges: List[WorkflowEdgeModel]
    documentation: Optional[str] = None
    requirements: Optional[List[str]] = None

class WorkflowExecutionRequest(BaseModel):
    input_data: Optional[Dict[str, Any]] = {}
    variables: Optional[Dict[str, Any]] = {}

class WorkflowCollaborationEvent(BaseModel):
    type: str
    data: Dict[str, Any]
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class WorkflowImportRequest(BaseModel):
    workflow_data: Dict[str, Any]
    overwrite: bool = False

# Active collaboration sessions
collaboration_sessions: Dict[str, Dict[str, Any]] = {}

@router.get("/workflows", response_model=List[Dict[str, Any]])
async def get_workflows(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get user workflows with pagination and filtering"""
    try:
        workflows = await workflow_engine.list_workflows(created_by=current_user.id)

        # Apply filters
        if search:
            search_lower = search.lower()
            workflows = [w for w in workflows
                       if search_lower in w.name.lower()
                       or (w.description and search_lower in w.description.lower())]

        # Apply pagination
        total = len(workflows)
        workflows = workflows[skip:skip + limit]

        return [
            {
                "id": str(w.id),
                "name": w.name,
                "description": w.description,
                "created_at": w.created_at.isoformat(),
                "updated_at": w.updated_at.isoformat(),
                "node_count": len(w.nodes),
                "edge_count": len(w.connections),
                "status": "active",
            }
            for w in workflows
        ]
    except Exception as e:
        logger.error(f"Error fetching workflows: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/workflows/{workflow_id}")
async def get_workflow(
    workflow_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get specific workflow by ID"""
    try:
        workflow_uuid = UUID(workflow_id)
        workflow = await workflow_engine.get_workflow(workflow_uuid)

        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")

        # Convert to frontend format
        nodes = [
            {
                "id": node.id,
                "type": "workflowNode",
                "position": node.position,
                "data": {
                    "nodeType": node.type.value,
                    "label": node.name,
                    "status": "idle",
                    "config": node.config,
                }
            }
            for node in workflow.nodes
        ]

        edges = [
            {
                "id": edge.id,
                "source": edge.source_node_id,
                "target": edge.target_node_id,
                "sourceHandle": edge.source_output,
                "targetHandle": edge.target_input,
                "type": "default",
                "animated": False,
            }
            for edge in workflow.connections
        ]

        return {
            "id": str(workflow.id),
            "name": workflow.name,
            "description": workflow.description,
            "version": workflow.version,
            "nodes": nodes,
            "edges": edges,
            "variables": workflow.variables,
            "settings": workflow.settings,
            "created_at": workflow.created_at.isoformat(),
            "updated_at": workflow.updated_at.isoformat(),
        }
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid workflow ID")
    except Exception as e:
        logger.error(f"Error fetching workflow: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/workflows")
async def create_workflow(
    workflow_data: WorkflowCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create new workflow"""
    try:
        # Convert to workflow engine format
        nodes = []
        for node in workflow_data.nodes:
            node_def = {
                "id": node.id,
                "type": node.data.get("nodeType", "data-input"),
                "name": node.data.get("label", node.id),
                "position": node.position,
                "config": node.data.get("config", {}),
                "inputs": [],
                "outputs": [],
            }
            nodes.append(node_def)

        connections = []
        for edge in workflow_data.edges:
            connection = {
                "id": edge.id,
                "source_node_id": edge.source,
                "source_output": edge.sourceHandle or "default",
                "target_node_id": edge.target,
                "target_input": edge.targetHandle or "default",
            }
            connections.append(connection)

        workflow_def = {
            "name": workflow_data.name,
            "description": workflow_data.description,
            "nodes": nodes,
            "connections": connections,
            "variables": workflow_data.metadata.get("variables", {}),
            "triggers": workflow_data.metadata.get("triggers", []),
            "settings": workflow_data.metadata.get("settings", {}),
            "created_by": current_user.id,
        }

        workflow_id = await workflow_engine.create_workflow(workflow_def)

        return {
            "id": str(workflow_id),
            "message": "Workflow created successfully",
            "status": "created",
        }
    except Exception as e:
        logger.error(f"Error creating workflow: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/workflows/{workflow_id}")
async def update_workflow(
    workflow_id: str,
    workflow_data: WorkflowUpdateRequest,
    current_user: User = Depends(get_current_user)
):
    """Update existing workflow"""
    try:
        workflow_uuid = UUID(workflow_id)
        workflow = await workflow_engine.get_workflow(workflow_uuid)

        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")

        # Update workflow properties
        update_data = workflow_data.dict(exclude_unset=True)

        # Convert nodes and edges if provided
        if "nodes" in update_data:
            nodes = []
            for node in update_data["nodes"]:
                node_def = {
                    "id": node.id,
                    "type": node.data.get("nodeType", "data-input"),
                    "name": node.data.get("label", node.id),
                    "position": node.position,
                    "config": node.data.get("config", {}),
                    "inputs": [],
                    "outputs": [],
                }
                nodes.append(node_def)
            workflow.nodes = nodes

        if "edges" in update_data:
            connections = []
            for edge in update_data["edges"]:
                connection = {
                    "id": edge.id,
                    "source_node_id": edge.source,
                    "source_output": edge.sourceHandle or "default",
                    "target_node_id": edge.target,
                    "target_input": edge.targetHandle or "default",
                }
                connections.append(connection)
            workflow.connections = connections

        if "name" in update_data:
            workflow.name = update_data["name"]
        if "description" in update_data:
            workflow.description = update_data["description"]

        workflow.updated_at = datetime.utcnow()

        # Store updated workflow
        workflow_engine.workflows[workflow_uuid] = workflow

        # Update in Redis
        await redis_client.set(
            f"workflow:{workflow_uuid}",
            json.dumps(workflow.dict(), default=str),
            expire=3600 * 24
        )

        return {
            "message": "Workflow updated successfully",
            "status": "updated",
        }
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid workflow ID")
    except Exception as e:
        logger.error(f"Error updating workflow: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/workflows/{workflow_id}")
async def delete_workflow(
    workflow_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete workflow"""
    try:
        workflow_uuid = UUID(workflow_id)
        workflow = await workflow_engine.get_workflow(workflow_uuid)

        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")

        # Remove from engine
        if workflow_uuid in workflow_engine.workflows:
            del workflow_engine.workflows[workflow_uuid]

        # Remove from Redis
        await redis_client.delete(f"workflow:{workflow_uuid}")

        return {
            "message": "Workflow deleted successfully",
            "status": "deleted",
        }
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid workflow ID")
    except Exception as e:
        logger.error(f"Error deleting workflow: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/workflows/{workflow_id}/execute")
async def execute_workflow(
    workflow_id: str,
    execution_data: WorkflowExecutionRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """Execute workflow"""
    try:
        workflow_uuid = UUID(workflow_id)

        # Start execution
        execution_id = await workflow_engine.execute_workflow(
            workflow_uuid,
            execution_data.input_data,
            current_user.id
        )

        # Add monitoring task
        background_tasks.add_task(
            monitor_workflow_execution,
            execution_id,
            current_user.id
        )

        return {
            "execution_id": str(execution_id),
            "message": "Workflow execution started",
            "status": "running",
        }
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid workflow ID")
    except Exception as e:
        logger.error(f"Error executing workflow: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/workflows/{workflow_id}/executions")
async def get_workflow_executions(
    workflow_id: str,
    status: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user)
):
    """Get workflow execution history"""
    try:
        workflow_uuid = UUID(workflow_id)

        # Filter by status if provided
        status_filter = None
        if status:
            try:
                status_filter = WorkflowStatus(status)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid status")

        executions = await workflow_engine.list_executions(
            workflow_id=workflow_uuid,
            status=status_filter
        )

        return [
            {
                "id": str(execution.id),
                "workflow_id": str(execution.workflow_id),
                "status": execution.status.value,
                "input_data": execution.input_data,
                "output_data": execution.output_data,
                "started_at": execution.started_at.isoformat(),
                "completed_at": execution.completed_at.isoformat() if execution.completed_at else None,
                "error": execution.error,
            }
            for execution in executions
        ]
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid workflow ID")
    except Exception as e:
        logger.error(f"Error fetching executions: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/executions/{execution_id}")
async def get_execution(
    execution_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get specific execution details"""
    try:
        execution_uuid = UUID(execution_id)
        execution = await workflow_engine.get_execution(execution_uuid)

        if not execution:
            raise HTTPException(status_code=404, detail="Execution not found")

        return {
            "id": str(execution.id),
            "workflow_id": str(execution.workflow_id),
            "status": execution.status.value,
            "input_data": execution.input_data,
            "output_data": execution.output_data,
            "current_nodes": execution.current_nodes,
            "completed_nodes": execution.completed_nodes,
            "failed_nodes": execution.failed_nodes,
            "execution_context": execution.execution_context,
            "started_at": execution.started_at.isoformat(),
            "completed_at": execution.completed_at.isoformat() if execution.completed_at else None,
            "error": execution.error,
            "started_by": str(execution.started_by) if execution.started_by else None,
        }
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid execution ID")
    except Exception as e:
        logger.error(f"Error fetching execution: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/executions/{execution_id}/pause")
async def pause_execution(
    execution_id: str,
    current_user: User = Depends(get_current_user)
):
    """Pause workflow execution"""
    try:
        execution_uuid = UUID(execution_id)
        success = await workflow_engine.pause_workflow(execution_uuid)

        if not success:
            raise HTTPException(status_code=400, detail="Cannot pause execution")

        return {
            "message": "Execution paused successfully",
            "status": "paused",
        }
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid execution ID")
    except Exception as e:
        logger.error(f"Error pausing execution: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/executions/{execution_id}/resume")
async def resume_execution(
    execution_id: str,
    human_input: Optional[Dict[str, Any]] = None,
    current_user: User = Depends(get_current_user)
):
    """Resume paused workflow execution"""
    try:
        execution_uuid = UUID(execution_id)
        success = await workflow_engine.resume_workflow(execution_uuid, human_input)

        if not success:
            raise HTTPException(status_code=400, detail="Cannot resume execution")

        return {
            "message": "Execution resumed successfully",
            "status": "running",
        }
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid execution ID")
    except Exception as e:
        logger.error(f"Error resuming execution: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/executions/{execution_id}/cancel")
async def cancel_execution(
    execution_id: str,
    current_user: User = Depends(get_current_user)
):
    """Cancel workflow execution"""
    try:
        execution_uuid = UUID(execution_id)
        success = await workflow_engine.cancel_workflow(execution_uuid)

        if not success:
            raise HTTPException(status_code=400, detail="Cannot cancel execution")

        return {
            "message": "Execution cancelled successfully",
            "status": "cancelled",
        }
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid execution ID")
    except Exception as e:
        logger.error(f"Error cancelling execution: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Template endpoints
@router.get("/templates")
async def get_workflow_templates(
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user)
):
    """Get workflow templates"""
    try:
        # For now, return hardcoded templates
        # In production, this would fetch from database
        templates = [
            {
                "id": "web-scraper-basic",
                "name": "Basic Web Scraper",
                "description": "Extract data from websites using browser automation",
                "category": "web-scraping",
                "tags": ["scraping", "browser", "data-extraction"],
                "difficulty": "beginner",
                "estimated_time": "10 min",
                "rating": 4.5,
                "downloads": 1250,
            },
            {
                "id": "api-data-pipeline",
                "name": "API Data Pipeline",
                "description": "Fetch data from APIs and process it",
                "category": "api-integration",
                "tags": ["api", "data-processing", "rest"],
                "difficulty": "intermediate",
                "estimated_time": "15 min",
                "rating": 4.8,
                "downloads": 890,
            },
        ]

        # Apply filters
        if category:
            templates = [t for t in templates if t["category"] == category]

        if search:
            search_lower = search.lower()
            templates = [t for t in templates
                       if search_lower in t["name"].lower()
                       or search_lower in t["description"].lower()
                       or any(search_lower in tag.lower() for tag in t["tags"])]

        return templates
    except Exception as e:
        logger.error(f"Error fetching templates: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/workflows/import")
async def import_workflow(
    import_data: WorkflowImportRequest,
    current_user: User = Depends(get_current_user)
):
    """Import workflow from data"""
    try:
        workflow_data = import_data.workflow_data

        # Validate workflow data structure
        required_fields = ["name", "nodes", "edges"]
        for field in required_fields:
            if field not in workflow_data:
                raise HTTPException(status_code=400, detail=f"Missing required field: {field}")

        # Convert to workflow engine format
        nodes = []
        for node in workflow_data["nodes"]:
            node_def = {
                "id": node["id"],
                "type": node["data"].get("nodeType", "data-input"),
                "name": node["data"].get("label", node["id"]),
                "position": node["position"],
                "config": node["data"].get("config", {}),
                "inputs": [],
                "outputs": [],
            }
            nodes.append(node_def)

        connections = []
        for edge in workflow_data["edges"]:
            connection = {
                "id": edge["id"],
                "source_node_id": edge["source"],
                "source_output": edge.get("sourceHandle", "default"),
                "target_node_id": edge["target"],
                "target_input": edge.get("targetHandle", "default"),
            }
            connections.append(connection)

        workflow_def = {
            "name": workflow_data["name"],
            "description": workflow_data.get("description", ""),
            "nodes": nodes,
            "connections": connections,
            "variables": workflow_data.get("variables", {}),
            "triggers": workflow_data.get("triggers", []),
            "settings": workflow_data.get("settings", {}),
            "created_by": current_user.id,
        }

        workflow_id = await workflow_engine.create_workflow(workflow_def)

        return {
            "workflow_id": str(workflow_id),
            "message": "Workflow imported successfully",
            "status": "imported",
        }
    except Exception as e:
        logger.error(f"Error importing workflow: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/workflows/{workflow_id}/export")
async def export_workflow(
    workflow_id: str,
    current_user: User = Depends(get_current_user)
):
    """Export workflow data"""
    try:
        workflow_uuid = UUID(workflow_id)
        workflow = await workflow_engine.get_workflow(workflow_uuid)

        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")

        # Convert to export format
        export_data = {
            "name": workflow.name,
            "description": workflow.description,
            "version": workflow.version,
            "nodes": [
                {
                    "id": node.id,
                    "type": "workflowNode",
                    "position": node.position,
                    "data": {
                        "nodeType": node.type.value,
                        "label": node.name,
                        "status": "idle",
                        "config": node.config,
                    }
                }
                for node in workflow.nodes
            ],
            "edges": [
                {
                    "id": edge.id,
                    "source": edge.source_node_id,
                    "target": edge.target_node_id,
                    "sourceHandle": edge.source_output,
                    "targetHandle": edge.target_input,
                    "type": "default",
                    "animated": False,
                }
                for edge in workflow.connections
            ],
            "variables": workflow.variables,
            "settings": workflow.settings,
            "metadata": {
                "exported_at": datetime.utcnow().isoformat(),
                "exported_by": current_user.email,
                "version": "1.0",
            },
        }

        return export_data
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid workflow ID")
    except Exception as e:
        logger.error(f"Error exporting workflow: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# WebSocket endpoint for real-time collaboration
@router.websocket("/workflows/{workflow_id}/collaborate")
async def websocket_collaboration(
    websocket: WebSocket,
    workflow_id: str,
    user_id: str = Query(...),
    user_name: str = Query(...),
):
    """WebSocket endpoint for real-time workflow collaboration"""
    try:
        workflow_uuid = UUID(workflow_id)

        # Verify workflow exists
        workflow = await workflow_engine.get_workflow(workflow_uuid)
        if not workflow:
            await websocket.close(code=1008, reason="Workflow not found")
            return

        await websocket.accept()

        # Add to collaboration session
        if workflow_id not in collaboration_sessions:
            collaboration_sessions[workflow_id] = {
                "users": {},
                "workflow": workflow,
            }

        # Add user to session
        session_user = {
            "id": user_id,
            "name": user_name,
            "color": f"#{hash(user_id) % 16777215:06x}",  # Generate color from user ID
            "websocket": websocket,
            "cursor": None,
            "selected_nodes": [],
        }
        collaboration_sessions[workflow_id]["users"][user_id] = session_user

        # Send current state
        await websocket.send_json({
            "type": "session_joined",
            "data": {
                "workflow_id": workflow_id,
                "users": [
                    {
                        "id": uid,
                        "name": u["name"],
                        "color": u["color"],
                        "cursor": u["cursor"],
                    }
                    for uid, u in collaboration_sessions[workflow_id]["users"].items()
                    if uid != user_id
                ],
            }
        })

        # Notify other users
        await connection_manager.broadcast_to_room(
            workflow_id,
            {
                "type": "user_joined",
                "data": {
                    "user_id": user_id,
                    "name": user_name,
                    "color": session_user["color"],
                }
            },
            exclude_websocket=websocket
        )

        # Handle messages
        while True:
            try:
                message = await websocket.receive_json()
                await handle_collaboration_message(workflow_id, user_id, message)
            except WebSocketDisconnect:
                break
            except Exception as e:
                logger.error(f"Error in collaboration websocket: {e}")
                break

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"Error setting up collaboration websocket: {e}")
    finally:
        # Clean up
        if workflow_id in collaboration_sessions:
            if user_id in collaboration_sessions[workflow_id]["users"]:
                del collaboration_sessions[workflow_id]["users"][user_id]

            # Notify other users
            await connection_manager.broadcast_to_room(
                workflow_id,
                {
                    "type": "user_left",
                    "data": {
                        "user_id": user_id,
                        "name": user_name,
                    }
                }
            )

            # Clean up empty session
            if not collaboration_sessions[workflow_id]["users"]:
                del collaboration_sessions[workflow_id]

async def handle_collaboration_message(workflow_id: str, user_id: str, message: Dict[str, Any]):
    """Handle collaboration WebSocket message"""
    try:
        if workflow_id not in collaboration_sessions:
            return

        session = collaboration_sessions[workflow_id]
        user = session["users"].get(user_id)
        if not user:
            return

        message_type = message.get("type")
        message_data = message.get("data", {})

        # Update user state based on message type
        if message_type == "cursor_move":
            user["cursor"] = message_data
        elif message_type == "node_select":
            user["selected_nodes"] = message_data.get("node_ids", [])
        elif message_type == "workflow_update":
            # Update workflow and broadcast to others
            if "nodes" in message_data:
                # Update nodes in workflow
                pass
            if "edges" in message_data:
                # Update edges in workflow
                pass

        # Broadcast to other users in the session
        broadcast_message = {
            "type": message_type,
            "user_id": user_id,
            "user_name": user["name"],
            "user_color": user["color"],
            "data": message_data,
        }

        for uid, other_user in session["users"].items():
            if uid != user_id:
                try:
                    await other_user["websocket"].send_json(broadcast_message)
                except Exception:
                    # User disconnected, will be cleaned up on next message or disconnect
                    pass

    except Exception as e:
        logger.error(f"Error handling collaboration message: {e}")

async def monitor_workflow_execution(execution_id: UUID, user_id: UUID):
    """Monitor workflow execution and update Redis with real-time status"""
    try:
        while True:
            execution = await workflow_engine.get_execution(execution_id)
            if not execution:
                break

            # Update execution status in Redis for real-time monitoring
            await redis_client.set(
                f"execution:status:{execution_id}",
                json.dumps({
                    "status": execution.status.value,
                    "current_nodes": execution.current_nodes,
                    "completed_nodes": execution.completed_nodes,
                    "failed_nodes": execution.failed_nodes,
                    "progress": len(execution.completed_nodes) / max(len(execution.current_nodes) + len(execution.completed_nodes), 1) * 100,
                    "updated_at": datetime.utcnow().isoformat(),
                }),
                expire=3600 * 24  # 24 hours
            )

            # Check if execution is complete
            if execution.status in [WorkflowStatus.COMPLETED, WorkflowStatus.FAILED, WorkflowStatus.CANCELLED]:
                break

            # Wait before next check
            await asyncio.sleep(1)

    except Exception as e:
        logger.error(f"Error monitoring execution {execution_id}: {e}")
        # Store error status
        await redis_client.set(
            f"execution:status:{execution_id}",
            json.dumps({
                "status": "error",
                "error": str(e),
                "updated_at": datetime.utcnow().isoformat(),
            }),
            expire=3600 * 24
        )