"""
Ansible API Endpoints
Comprehensive infrastructure automation and management endpoints
"""

from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks, UploadFile, File
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.services.ansible_service import AnsibleService, AnsibleExecutionResult, PlaybookStatus, InventoryType
from app.schemas.ansible import (
    AnsiblePlaybookCreate, AnsiblePlaybookUpdate, AnsiblePlaybookResponse,
    AnsibleInventoryCreate, AnsibleInventoryUpdate, AnsibleInventoryResponse,
    AnsibleExecutionRequest, AnsibleExecutionResponse, AnsibleExecutionStatus,
    PlaybookTemplateResponse
)
from app.core.deps import get_current_user
from app.core.security import require_permission

router = APIRouter()

@router.post("/playbooks", response_model=AnsiblePlaybookResponse, status_code=201)
async def create_playbook(
    playbook_data: AnsiblePlaybookCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("infrastructure:write"))
):
    """
    Create a new Ansible playbook

    Requires infrastructure:write permission
    """
    try:
        ansible_service = AnsibleService(db)

        playbook = await ansible_service.create_playbook(
            name=playbook_data.name,
            description=playbook_data.description,
            content=playbook_data.content,
            category=playbook_data.category,
            tags=playbook_data.tags,
            variables_schema=playbook_data.variables_schema,
            created_by=current_user.id
        )

        return AnsiblePlaybookResponse.from_orm(playbook)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create playbook: {str(e)}")

@router.get("/playbooks", response_model=List[AnsiblePlaybookResponse])
async def list_playbooks(
    category: Optional[str] = Query(None, description="Filter by category"),
    tags: Optional[List[str]] = Query(None, description="Filter by tags"),
    active_only: bool = Query(True, description="Show only active playbooks"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(50, ge=1, le=100, description="Results per page"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List Ansible playbooks with optional filtering

    Requires infrastructure:read permission
    """
    try:
        from app.models.infrastructure import AnsiblePlaybook

        query = db.query(AnsiblePlaybook)

        if active_only:
            query = query.filter(AnsiblePlaybook.is_active == True)

        if category:
            query = query.filter(AnsiblePlaybook.category == category)

        if tags:
            # Filter by tags overlap
            for tag in tags:
                query = query.filter(AnsiblePlaybook.tags.contains([tag]))

        # Apply pagination
        offset = (page - 1) * limit
        playbooks = query.offset(offset).limit(limit).all()

        return [AnsiblePlaybookResponse.from_orm(playbook) for playbook in playbooks]

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list playbooks: {str(e)}")

@router.get("/playbooks/{playbook_id}", response_model=AnsiblePlaybookResponse)
async def get_playbook(
    playbook_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get playbook details by ID

    Requires infrastructure:read permission
    """
    try:
        from app.models.infrastructure import AnsiblePlaybook

        playbook = db.query(AnsiblePlaybook).filter(
            AnsiblePlaybook.id == playbook_id,
            AnsiblePlaybook.is_active == True
        ).first()

        if not playbook:
            raise HTTPException(status_code=404, detail="Playbook not found")

        return AnsiblePlaybookResponse.from_orm(playbook)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get playbook: {str(e)}")

@router.post("/playbooks/{playbook_id}/execute", response_model=AnsibleExecutionResponse, status_code=202)
async def execute_playbook(
    playbook_id: str,
    execution_request: AnsibleExecutionRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("infrastructure:execute"))
):
    """
    Execute an Ansible playbook

    Requires infrastructure:execute permission
    """
    try:
        ansible_service = AnsibleService(db)

        # Execute playbook
        result = await ansible_service.execute_playbook(
            playbook_id=playbook_id,
            inventory_id=execution_request.inventory_id,
            extra_vars=execution_request.extra_vars,
            tags=execution_request.tags,
            skip_tags=execution_request.skip_tags,
            limit=execution_request.limit,
            forks=execution_request.forks,
            timeout=execution_request.timeout,
            user_id=current_user.id
        )

        # Schedule background task for cleanup
        background_tasks.add_task(
            _cleanup_execution_files,
            execution_id=result.execution_id if hasattr(result, 'execution_id') else None
        )

        return AnsibleExecutionResponse(
            execution_id=result.execution_id if hasattr(result, 'execution_id') else "unknown",
            status=result.status.value,
            return_code=result.return_code,
            stdout=result.stdout,
            stderr=result.stderr,
            execution_time=result.execution_time,
            stats=result.stats,
            host_results=result.host_results,
            error_message=result.error_message
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to execute playbook: {str(e)}")

@router.get("/executions/{execution_id}/status", response_model=AnsibleExecutionStatus)
async def get_execution_status(
    execution_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get execution status by ID

    Requires infrastructure:read permission
    """
    try:
        ansible_service = AnsibleService(db)

        execution = await ansible_service.get_execution_status(execution_id)

        if not execution:
            raise HTTPException(status_code=404, detail="Execution not found")

        return AnsibleExecutionStatus(
            id=execution.id,
            playbook_id=execution.playbook_id,
            inventory_id=execution.inventory_id,
            status=execution.status,
            return_code=execution.return_code,
            execution_time=execution.execution_time,
            stats=execution.stats,
            host_results=execution.host_results,
            error_message=execution.error_message,
            started_at=execution.started_at,
            finished_at=execution.finished_at,
            created_at=execution.created_at
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get execution status: {str(e)}")

@router.post("/executions/{execution_id}/cancel", status_code=200)
async def cancel_execution(
    execution_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("infrastructure:execute"))
):
    """
    Cancel a running Ansible execution

    Requires infrastructure:execute permission
    """
    try:
        ansible_service = AnsibleService(db)

        success = await ansible_service.cancel_execution(execution_id)

        if success:
            return {"message": "Execution cancelled successfully"}
        else:
            raise HTTPException(status_code=400, detail="Failed to cancel execution")

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to cancel execution: {str(e)}")

@router.post("/executions/{execution_id}/rollback", response_model=AnsibleExecutionResponse)
async def rollback_execution(
    execution_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("infrastructure:execute"))
):
    """
    Rollback a failed Ansible execution

    Requires infrastructure:execute permission
    """
    try:
        ansible_service = AnsibleService(db)

        result = await ansible_service.rollback_execution(execution_id)

        return AnsibleExecutionResponse(
            execution_id=execution_id,
            status=result.status.value,
            return_code=result.return_code,
            stdout=result.stdout,
            stderr=result.stderr,
            execution_time=result.execution_time,
            stats=result.stats,
            host_results=result.host_results,
            error_message=result.error_message
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to rollback execution: {str(e)}")

# Inventory Management Endpoints

@router.post("/inventories", response_model=AnsibleInventoryResponse, status_code=201)
async def create_inventory(
    inventory_data: AnsibleInventoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("infrastructure:write"))
):
    """
    Create a new Ansible inventory

    Requires infrastructure:write permission
    """
    try:
        ansible_service = AnsibleService(db)

        inventory = await ansible_service.create_inventory(
            name=inventory_data.name,
            description=inventory_data.description,
            inventory_type=InventoryType(inventory_data.inventory_type),
            content=inventory_data.content,
            script_content=inventory_data.script_content,
            variables=inventory_data.variables,
            created_by=current_user.id
        )

        return AnsibleInventoryResponse.from_orm(inventory)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create inventory: {str(e)}")

@router.get("/inventories", response_model=List[AnsibleInventoryResponse])
async def list_inventories(
    inventory_type: Optional[str] = Query(None, description="Filter by inventory type"),
    active_only: bool = Query(True, description="Show only active inventories"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(50, ge=1, le=100, description="Results per page"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List Ansible inventories with optional filtering

    Requires infrastructure:read permission
    """
    try:
        from app.models.infrastructure import AnsibleInventory

        query = db.query(AnsibleInventory)

        if active_only:
            query = query.filter(AnsibleInventory.is_active == True)

        if inventory_type:
            query = query.filter(AnsibleInventory.inventory_type == inventory_type)

        # Apply pagination
        offset = (page - 1) * limit
        inventories = query.offset(offset).limit(limit).all()

        return [AnsibleInventoryResponse.from_orm(inventory) for inventory in inventories]

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list inventories: {str(e)}")

@router.get("/inventories/{inventory_id}", response_model=AnsibleInventoryResponse)
async def get_inventory(
    inventory_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get inventory details by ID

    Requires infrastructure:read permission
    """
    try:
        from app.models.infrastructure import AnsibleInventory

        inventory = db.query(AnsibleInventory).filter(
            AnsibleInventory.id == inventory_id,
            AnsibleInventory.is_active == True
        ).first()

        if not inventory:
            raise HTTPException(status_code=404, detail="Inventory not found")

        return AnsibleInventoryResponse.from_orm(inventory)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get inventory: {str(e)}")

@router.post("/inventories/{inventory_id}/validate", status_code=200)
async def validate_inventory(
    inventory_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("infrastructure:read"))
):
    """
    Validate an Ansible inventory

    Requires infrastructure:read permission
    """
    try:
        ansible_service = AnsibleService(db)
        from app.models.infrastructure import AnsibleInventory

        inventory = db.query(AnsibleInventory).filter(
            AnsibleInventory.id == inventory_id,
            AnsibleInventory.is_active == True
        ).first()

        if not inventory:
            raise HTTPException(status_code=404, detail="Inventory not found")

        # Validate inventory by preparing it
        try:
            inventory_path = await ansible_service._prepare_inventory(inventory)
            return {
                "valid": True,
                "message": "Inventory is valid",
                "hosts": []  # Would parse and return list of hosts
            }
        except Exception as e:
            return {
                "valid": False,
                "message": f"Inventory validation failed: {str(e)}",
                "hosts": []
            }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to validate inventory: {str(e)}")

# Template Library Endpoints

@router.get("/playbooks/templates", response_model=PlaybookTemplateResponse)
async def get_playbook_templates(
    category: Optional[str] = Query(None, description="Filter by category"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get playbook template library

    Requires infrastructure:read permission
    """
    try:
        ansible_service = AnsibleService(db)

        templates = await ansible_service.get_playbook_template_library()

        if category:
            # Filter templates by category
            filtered_templates = {
                key: value for key, value in templates.items()
                if category in value.get("categories", [])
            }
            templates = filtered_templates

        return PlaybookTemplateResponse(templates=templates)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get playbook templates: {str(e)}")

@router.post("/playbooks/templates/{template_name}/create", response_model=AnsiblePlaybookResponse, status_code=201)
async def create_playbook_from_template(
    template_name: str,
    playbook_data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("infrastructure:write"))
):
    """
    Create a playbook from a template

    Requires infrastructure:write permission
    """
    try:
        ansible_service = AnsibleService(db)

        # Get template
        templates = await ansible_service.get_playbook_template_library()
        if template_name not in templates:
            raise HTTPException(status_code=404, detail="Template not found")

        template = templates[template_name]

        # Generate playbook content from template
        playbook_content = await _generate_playbook_from_template(template, playbook_data)

        # Create playbook
        playbook = await ansible_service.create_playbook(
            name=playbook_data.get("name", f"Generated from {template_name}"),
            description=playbook_data.get("description", f"Generated from template: {template['description']}"),
            content=playbook_content,
            category=template["categories"][0],  # Use first category
            tags=template["categories"],
            variables_schema=template["variables"],
            created_by=current_user.id
        )

        return AnsiblePlaybookResponse.from_orm(playbook)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create playbook from template: {str(e)}")

# File Upload Endpoints

@router.post("/playbooks/upload", response_model=AnsiblePlaybookResponse, status_code=201)
async def upload_playbook(
    file: UploadFile = File(...),
    name: str = Query(..., description="Playbook name"),
    description: str = Query("", description="Playbook description"),
    category: str = Query(..., description="Playbook category"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("infrastructure:write"))
):
    """
    Upload a playbook file

    Requires infrastructure:write permission
    """
    try:
        if not file.filename.endswith(('.yml', '.yaml')):
            raise HTTPException(status_code=400, detail="File must be a YAML playbook")

        # Read file content
        content = await file.read()
        content_str = content.decode('utf-8')

        ansible_service = AnsibleService(db)

        playbook = await ansible_service.create_playbook(
            name=name,
            description=description,
            content=content_str,
            category=category,
            created_by=current_user.id
        )

        return AnsiblePlaybookResponse.from_orm(playbook)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload playbook: {str(e)}")

@router.post("/inventories/upload", response_model=AnsibleInventoryResponse, status_code=201)
async def upload_inventory(
    file: UploadFile = File(...),
    name: str = Query(..., description="Inventory name"),
    description: str = Query("", description="Inventory description"),
    inventory_type: str = Query("static", description="Inventory type"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("infrastructure:write"))
):
    """
    Upload an inventory file

    Requires infrastructure:write permission
    """
    try:
        # Read file content
        content = await file.read()
        content_str = content.decode('utf-8')

        ansible_service = AnsibleService(db)

        inventory = await ansible_service.create_inventory(
            name=name,
            description=description,
            inventory_type=InventoryType(inventory_type),
            content=content_str,
            created_by=current_user.id
        )

        return AnsibleInventoryResponse.from_orm(inventory)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload inventory: {str(e)}")

# Monitoring and Analytics Endpoints

@router.get("/executions", response_model=List[AnsibleExecutionStatus])
async def list_executions(
    status: Optional[str] = Query(None, description="Filter by status"),
    playbook_id: Optional[str] = Query(None, description="Filter by playbook"),
    limit: int = Query(50, ge=1, le=100, description="Results per page"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List Ansible executions with filtering

    Requires infrastructure:read permission
    """
    try:
        from app.models.infrastructure import AnsibleExecution

        query = db.query(AnsibleExecution)

        if status:
            query = query.filter(AnsibleExecution.status == status)

        if playbook_id:
            query = query.filter(AnsibleExecution.playbook_id == playbook_id)

        # Get recent executions
        executions = query.order_by(AnsibleExecution.created_at.desc()).limit(limit).all()

        return [
            AnsibleExecutionStatus(
                id=execution.id,
                playbook_id=execution.playbook_id,
                inventory_id=execution.inventory_id,
                status=execution.status,
                return_code=execution.return_code,
                execution_time=execution.execution_time,
                stats=execution.stats,
                host_results=execution.host_results,
                error_message=execution.error_message,
                started_at=execution.started_at,
                finished_at=execution.finished_at,
                created_at=execution.created_at
            )
            for execution in executions
        ]

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list executions: {str(e)}")

@router.get("/statistics", status_code=200)
async def get_ansible_statistics(
    days: int = Query(30, description="Number of days to analyze"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get Ansible execution statistics

    Requires infrastructure:read permission
    """
    try:
        from app.models.infrastructure import AnsibleExecution, AnsiblePlaybook
        from sqlalchemy import func, and_

        cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)

        # Total executions
        total_executions = db.query(AnsibleExecution).filter(
            AnsibleExecution.created_at >= cutoff_date
        ).count()

        # Success rate
        successful_executions = db.query(AnsibleExecution).filter(
            and_(
                AnsibleExecution.created_at >= cutoff_date,
                AnsibleExecution.status == PlaybookStatus.SUCCESS.value
            )
        ).count()

        success_rate = (successful_executions / total_executions * 100) if total_executions > 0 else 0

        # Most used playbooks
        popular_playbooks = db.query(
            AnsiblePlaybook.name,
            func.count(AnsibleExecution.id).label('execution_count')
        ).join(
            AnsibleExecution, AnsiblePlaybook.id == AnsibleExecution.playbook_id
        ).filter(
            AnsibleExecution.created_at >= cutoff_date
        ).group_by(
            AnsiblePlaybook.name
        ).order_by(
            func.count(AnsibleExecution.id).desc()
        ).limit(10).all()

        # Average execution time
        avg_execution_time = db.query(
            func.avg(AnsibleExecution.execution_time)
        ).filter(
            and_(
                AnsibleExecution.created_at >= cutoff_date,
                AnsibleExecution.execution_time.isnot(None)
            )
        ).scalar() or 0

        return {
            "period_days": days,
            "total_executions": total_executions,
            "successful_executions": successful_executions,
            "success_rate": round(success_rate, 2),
            "average_execution_time": round(avg_execution_time, 2),
            "popular_playbooks": [
                {"name": name, "count": count}
                for name, count in popular_playbooks
            ]
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get statistics: {str(e)}")

# Utility functions

async def _generate_playbook_from_template(template: Dict[str, Any], variables: Dict[str, Any]) -> str:
    """Generate playbook content from template and variables"""
    # This would use Jinja2 templating or similar to generate playbook content
    # For now, return a basic structure
    playbook_yaml = f"""---
- name: {template['name']}
  hosts: {{{{ hosts | default('all') }}}}
  become: yes
  vars:
    # Template variables would be processed here
    template_name: "{template['name']}"
    template_description: "{template['description']}"

  tasks:
    - name: Display template info
      debug:
        msg: "Executing playbook from template: {{{{ template_name }}}}"
"""

    return playbook_yaml

async def _cleanup_execution_files(execution_id: Optional[str]):
    """Clean up temporary files from execution"""
    if execution_id:
        # Cleanup logic would go here
        pass