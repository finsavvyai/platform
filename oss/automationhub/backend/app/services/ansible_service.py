"""
Ansible Integration Service
Comprehensive infrastructure automation and management using Ansible
"""

import os
import json
import yaml
import asyncio
import subprocess
import tempfile
import logging
from typing import List, Dict, Any, Optional, Tuple, Union
from datetime import datetime, timezone
from pathlib import Path
from dataclasses import dataclass, asdict
from enum import Enum

from sqlalchemy.orm import Session
from app.models.infrastructure import AnsiblePlaybook, AnsibleInventory, AnsibleExecution
from app.core.config import settings

logger = logging.getLogger(__name__)

class PlaybookStatus(Enum):
    """Ansible playbook execution status"""
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    CANCELLED = "cancelled"
    TIMEOUT = "timeout"

class InventoryType(Enum):
    """Ansible inventory types"""
    STATIC = "static"
    DYNAMIC = "dynamic"
    HYBRID = "hybrid"

@dataclass
class AnsibleExecutionResult:
    """Result of Ansible execution"""
    status: PlaybookStatus
    return_code: Optional[int] = None
    stdout: Optional[str] = None
    stderr: Optional[str] = None
    execution_time: Optional[float] = None
    stats: Optional[Dict[str, Any]] = None
    host_results: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None

class AnsibleService:
    """
    Comprehensive Ansible integration service
    Handles playbook execution, inventory management, and infrastructure automation
    """

    def __init__(self, db: Session):
        self.db = db
        self.ansible_path = settings.ANSIBLE_PATH or "/usr/bin/ansible"
        self.ansible_playbook_path = settings.ANSIBLE_PLAYBOOK_PATH or "/usr/bin/ansible-playbook"
        self.playbooks_dir = Path(settings.ANSIBLE_PLAYBOOKS_DIR or "ansible/playbooks")
        self.inventory_dir = Path(settings.ANSIBLE_INVENTORY_DIR or "ansible/inventory")
        self.roles_dir = Path(settings.ANSIBLE_ROLES_DIR or "ansible/roles")
        self.temp_dir = Path("/tmp/ansible_upmplus")

        # Ensure directories exist
        self._ensure_directories()

    def _ensure_directories(self):
        """Ensure Ansible directories exist"""
        for directory in [self.playbooks_dir, self.inventory_dir, self.roles_dir, self.temp_dir]:
            directory.mkdir(parents=True, exist_ok=True)

    async def execute_playbook(
        self,
        playbook_id: str,
        inventory_id: Optional[str] = None,
        extra_vars: Optional[Dict[str, Any]] = None,
        tags: Optional[List[str]] = None,
        skip_tags: Optional[List[str]] = None,
        limit: Optional[str] = None,
        forks: Optional[int] = None,
        timeout: Optional[int] = None,
        user_id: Optional[str] = None
    ) -> AnsibleExecutionResult:
        """
        Execute an Ansible playbook

        Args:
            playbook_id: ID of the playbook to execute
            inventory_id: ID of the inventory to use (optional)
            extra_vars: Additional variables for the playbook
            tags: Tags to execute
            skip_tags: Tags to skip
            limit: Limit execution to specific hosts
            forks: Number of parallel processes
            timeout: Execution timeout in seconds
            user_id: User requesting the execution

        Returns:
            Execution result with status and details
        """
        try:
            # Get playbook from database
            playbook = self.db.query(AnsiblePlaybook).filter(
                AnsiblePlaybook.id == playbook_id,
                AnsiblePlaybook.is_active == True
            ).first()

            if not playbook:
                raise ValueError(f"Playbook {playbook_id} not found or inactive")

            # Get inventory
            inventory_path = None
            if inventory_id:
                inventory = self.db.query(AnsibleInventory).filter(
                    AnsibleInventory.id == inventory_id,
                    AnsibleInventory.is_active == True
                ).first()
                if inventory:
                    inventory_path = await self._prepare_inventory(inventory)
            else:
                # Use default inventory
                inventory_path = self.inventory_dir / "hosts"

            # Create execution record
            execution = AnsibleExecution(
                playbook_id=playbook_id,
                inventory_id=inventory_id,
                status=PlaybookStatus.PENDING.value,
                extra_vars=extra_vars,
                tags=tags,
                skip_tags=skip_tags,
                limit=limit,
                forks=forks or 10,
                timeout=timeout or 3600,
                created_by=user_id,
                created_at=datetime.now(timezone.utc)
            )

            self.db.add(execution)
            self.db.commit()
            self.db.refresh(execution)

            # Update status to running
            execution.status = PlaybookStatus.RUNNING.value
            execution.started_at = datetime.now(timezone.utc)
            self.db.commit()

            # Prepare and execute playbook
            result = await self._execute_ansible_playbook(
                playbook,
                inventory_path,
                execution,
                extra_vars,
                tags,
                skip_tags,
                limit,
                forks,
                timeout
            )

            # Update execution record with results
            execution.status = result.status.value
            execution.return_code = result.return_code
            execution.stdout = result.stdout
            execution.stderr = result.stderr
            execution.execution_time = result.execution_time
            execution.stats = result.stats
            execution.host_results = result.host_results
            execution.finished_at = datetime.now(timezone.utc)

            if result.error_message:
                execution.error_message = result.error_message

            self.db.commit()
            self.db.refresh(execution)

            return result

        except Exception as e:
            logger.error(f"Failed to execute playbook {playbook_id}: {str(e)}")
            raise

    async def _execute_ansible_playbook(
        self,
        playbook: AnsiblePlaybook,
        inventory_path: Path,
        execution: AnsibleExecution,
        extra_vars: Optional[Dict[str, Any]],
        tags: Optional[List[str]],
        skip_tags: Optional[List[str]],
        limit: Optional[str],
        forks: int,
        timeout: int
    ) -> AnsibleExecutionResult:
        """
        Execute ansible-playbook command
        """
        try:
            start_time = datetime.now(timezone.utc)

            # Prepare playbook file
            playbook_path = await self._prepare_playbook(playbook)

            # Build command
            cmd = [
                str(self.ansible_playbook_path),
                str(playbook_path),
                "-i", str(inventory_path),
                "--forks", str(forks),
                "--timeout", str(timeout)
            ]

            # Add tags
            if tags:
                cmd.extend(["--tags", ",".join(tags)])

            # Add skip tags
            if skip_tags:
                cmd.extend(["--skip-tags", ",".join(skip_tags)])

            # Add limit
            if limit:
                cmd.extend(["--limit", limit])

            # Add extra variables
            if extra_vars:
                extra_vars_file = await self._create_extra_vars_file(extra_vars, execution.id)
                cmd.extend(["--extra-vars", f"@{extra_vars_file}"])

            # Add verbosity for better logging
            cmd.extend(["-v"])

            # Execute command
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=self.temp_dir
            )

            try:
                stdout, stderr = await asyncio.wait_for(
                    process.communicate(),
                    timeout=timeout
                )
            except asyncio.TimeoutError:
                process.kill()
                await process.wait()
                return AnsibleExecutionResult(
                    status=PlaybookStatus.TIMEOUT,
                    error_message=f"Execution timed out after {timeout} seconds"
                )

            execution_time = (datetime.now(timezone.utc) - start_time).total_seconds()

            # Parse results
            return_code = process.returncode
            stdout_text = stdout.decode('utf-8') if stdout else ""
            stderr_text = stderr.decode('utf-8') if stderr else ""

            # Parse Ansible stats from output
            stats = await self._parse_ansible_stats(stdout_text)
            host_results = await self._parse_host_results(stdout_text)

            status = PlaybookStatus.SUCCESS if return_code == 0 else PlaybookStatus.FAILED
            error_message = stderr_text if return_code != 0 else None

            return AnsibleExecutionResult(
                status=status,
                return_code=return_code,
                stdout=stdout_text,
                stderr=stderr_text,
                execution_time=execution_time,
                stats=stats,
                host_results=host_results,
                error_message=error_message
            )

        except Exception as e:
            logger.error(f"Error executing ansible-playbook: {str(e)}")
            return AnsibleExecutionResult(
                status=PlaybookStatus.FAILED,
                error_message=str(e)
            )

    async def _prepare_playbook(self, playbook: AnsiblePlaybook) -> Path:
        """Prepare playbook file from database content"""
        playbook_file = self.temp_dir / f"playbook_{playbook.id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.yml"

        # Parse YAML content
        try:
            playbook_content = yaml.safe_load(playbook.content)

            # Write to temporary file
            with open(playbook_file, 'w') as f:
                yaml.dump(playbook_content, f, default_flow_style=False)

            return playbook_file

        except Exception as e:
            logger.error(f"Failed to prepare playbook {playbook.id}: {str(e)}")
            raise

    async def _prepare_inventory(self, inventory: AnsibleInventory) -> Path:
        """Prepare inventory file from database content"""
        inventory_file = self.temp_dir / f"inventory_{inventory.id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        try:
            if inventory.inventory_type == InventoryType.STATIC.value:
                # Static inventory from content
                with open(inventory_file, 'w') as f:
                    f.write(inventory.content)

            elif inventory.inventory_type == InventoryType.DYNAMIC.value:
                # Dynamic inventory using script
                if inventory.script_content:
                    # Write script file
                    script_file = inventory_file.with_suffix('.py')
                    with open(script_file, 'w') as f:
                        f.write(inventory.script_content)

                    # Make script executable
                    os.chmod(script_file, 0o755)

                    # Use script as inventory
                    inventory_file = script_file

            elif inventory.inventory_type == InventoryType.HYBRID.value:
                # Combine static and dynamic inventory
                # This would require more complex logic to merge inventories
                with open(inventory_file, 'w') as f:
                    f.write(inventory.content)

            return inventory_file

        except Exception as e:
            logger.error(f"Failed to prepare inventory {inventory.id}: {str(e)}")
            raise

    async def _create_extra_vars_file(self, extra_vars: Dict[str, Any], execution_id: str) -> Path:
        """Create extra variables file for Ansible execution"""
        extra_vars_file = self.temp_dir / f"extra_vars_{execution_id}.json"

        # Add execution metadata
        extra_vars_with_meta = {
            **extra_vars,
            "upmplus_execution_id": execution_id,
            "upmplus_execution_time": datetime.now(timezone.utc).isoformat()
        }

        with open(extra_vars_file, 'w') as f:
            json.dump(extra_vars_with_meta, f, indent=2)

        return extra_vars_file

    async def _parse_ansible_stats(self, stdout: str) -> Dict[str, Any]:
        """Parse Ansible execution statistics from stdout"""
        stats = {
            "ok": 0,
            "changed": 0,
            "unreachable": 0,
            "failed": 0,
            "skipped": 0,
            "rescued": 0,
            "ignored": 0
        }

        try:
            # Look for playbook recap section
            lines = stdout.split('\n')
            in_recap = False

            for line in lines:
                if "PLAY RECAP" in line:
                    in_recap = True
                    continue

                if in_recap and line.strip():
                    # Parse host stats
                    parts = line.split()
                    if len(parts) >= 5:
                        host = parts[0]
                        host_stats = parts[1:]

                        # Count different statuses
                        for stat in host_stats:
                            if stat == "ok=":
                                stats["ok"] += 1
                            elif stat == "changed=":
                                stats["changed"] += 1
                            elif stat == "unreachable=":
                                stats["unreachable"] += 1
                            elif stat == "failed=":
                                stats["failed"] += 1
                            elif stat == "skipped=":
                                stats["skipped"] += 1
                            elif stat == "rescued=":
                                stats["rescued"] += 1
                            elif stat == "ignored=":
                                stats["ignored"] += 1

            return stats

        except Exception as e:
            logger.error(f"Failed to parse Ansible stats: {str(e)}")
            return stats

    async def _parse_host_results(self, stdout: str) -> Dict[str, Any]:
        """Parse detailed host results from stdout"""
        host_results = {}

        try:
            lines = stdout.split('\n')
            current_host = None
            current_task = None
            current_result = None

            for line in lines:
                # TASK lines
                if line.startswith("TASK ["):
                    task_parts = line[6:].strip("] ")
                    current_task = task_parts

                # Host lines in results
                elif line.startswith("  \"") and current_task:
                    host = line.strip("\"").strip("\":")
                    current_host = host

                # Result status lines
                elif current_host and ("=>" in line or "==" in line):
                    if "ok" in line.lower():
                        status = "ok"
                    elif "changed" in line.lower():
                        status = "changed"
                    elif "failed" in line.lower():
                        status = "failed"
                    elif "skipped" in line.lower():
                        status = "skipped"
                    else:
                        status = "unknown"

                    if current_host not in host_results:
                        host_results[current_host] = []

                    host_results[current_host].append({
                        "task": current_task,
                        "status": status,
                        "output": line.strip()
                    })

            return host_results

        except Exception as e:
            logger.error(f"Failed to parse host results: {str(e)}")
            return host_results

    async def create_playbook(
        self,
        name: str,
        description: str,
        content: str,
        category: str,
        tags: Optional[List[str]] = None,
        variables_schema: Optional[Dict[str, Any]] = None,
        created_by: Optional[str] = None
    ) -> AnsiblePlaybook:
        """
        Create a new Ansible playbook

        Args:
            name: Playbook name
            description: Playbook description
            content: Playbook YAML content
            category: Playbook category
            tags: Playbook tags
            variables_schema: Schema for playbook variables
            created_by: User creating the playbook

        Returns:
            Created playbook object
        """
        try:
            # Validate playbook content
            await self._validate_playbook_content(content)

            playbook = AnsiblePlaybook(
                name=name,
                description=description,
                content=content,
                category=category,
                tags=tags or [],
                variables_schema=variables_schema,
                is_active=True,
                created_by=created_by,
                created_at=datetime.now(timezone.utc)
            )

            self.db.add(playbook)
            self.db.commit()
            self.db.refresh(playbook)

            logger.info(f"Created Ansible playbook: {name}")
            return playbook

        except Exception as e:
            logger.error(f"Failed to create playbook {name}: {str(e)}")
            raise

    async def create_inventory(
        self,
        name: str,
        description: str,
        inventory_type: InventoryType,
        content: Optional[str] = None,
        script_content: Optional[str] = None,
        variables: Optional[Dict[str, Any]] = None,
        created_by: Optional[str] = None
    ) -> AnsibleInventory:
        """
        Create a new Ansible inventory

        Args:
            name: Inventory name
            description: Inventory description
            inventory_type: Type of inventory (static/dynamic/hybrid)
            content: Static inventory content
            script_content: Dynamic inventory script
            variables: Inventory variables
            created_by: User creating the inventory

        Returns:
            Created inventory object
        """
        try:
            inventory = AnsibleInventory(
                name=name,
                description=description,
                inventory_type=inventory_type.value,
                content=content,
                script_content=script_content,
                variables=variables,
                is_active=True,
                created_by=created_by,
                created_at=datetime.now(timezone.utc)
            )

            self.db.add(inventory)
            self.db.commit()
            self.db.refresh(inventory)

            logger.info(f"Created Ansible inventory: {name}")
            return inventory

        except Exception as e:
            logger.error(f"Failed to create inventory {name}: {str(e)}")
            raise

    async def _validate_playbook_content(self, content: str) -> None:
        """Validate Ansible playbook content"""
        try:
            # Parse YAML to ensure it's valid
            playbook_data = yaml.safe_load(content)

            # Basic structure validation
            if not isinstance(playbook_data, list):
                raise ValueError("Playbook must be a list of plays")

            for play in playbook_data:
                if not isinstance(play, dict):
                    raise ValueError("Each play must be a dictionary")

                # Check for required play elements
                if 'hosts' not in play:
                    raise ValueError("Play must specify hosts")

        except yaml.YAMLError as e:
            raise ValueError(f"Invalid YAML syntax: {str(e)}")

    async def get_execution_status(self, execution_id: str) -> Optional[AnsibleExecution]:
        """Get execution status by ID"""
        return self.db.query(AnsibleExecution).filter(
            AnsibleExecution.id == execution_id
        ).first()

    async def cancel_execution(self, execution_id: str) -> bool:
        """Cancel a running Ansible execution"""
        try:
            execution = await self.get_execution_status(execution_id)

            if not execution:
                raise ValueError(f"Execution {execution_id} not found")

            if execution.status != PlaybookStatus.RUNNING.value:
                raise ValueError("Execution is not running and cannot be cancelled")

            # Update status
            execution.status = PlaybookStatus.CANCELLED.value
            execution.finished_at = datetime.now(timezone.utc)
            self.db.commit()

            logger.info(f"Cancelled Ansible execution: {execution_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to cancel execution {execution_id}: {str(e)}")
            raise

    async def get_playbook_template_library(self) -> Dict[str, Any]:
        """Get library of playbook templates"""
        templates = {
            "system_setup": {
                "name": "System Setup",
                "description": "Basic system configuration and package installation",
                "categories": ["system", "setup"],
                "variables": {
                    "package_list": {
                        "type": "array",
                        "description": "List of packages to install",
                        "default": ["vim", "git", "curl"]
                    },
                    "timezone": {
                        "type": "string",
                        "description": "System timezone",
                        "default": "UTC"
                    }
                }
            },
            "user_management": {
                "name": "User Management",
                "description": "Create and manage system users",
                "categories": ["users", "security"],
                "variables": {
                    "users": {
                        "type": "array",
                        "description": "List of users to create",
                        "items": {
                            "username": {"type": "string"},
                            "shell": {"type": "string", "default": "/bin/bash"},
                            "groups": {"type": "array", "default": []}
                        }
                    }
                }
            },
            "web_server": {
                "name": "Web Server Setup",
                "description": "Install and configure Nginx or Apache",
                "categories": ["web", "server"],
                "variables": {
                    "web_server": {
                        "type": "string",
                        "description": "Web server type",
                        "enum": ["nginx", "apache"],
                        "default": "nginx"
                    },
                    "sites": {
                        "type": "array",
                        "description": "List of websites to configure"
                    }
                }
            },
            "database": {
                "name": "Database Setup",
                "description": "Install and configure PostgreSQL or MySQL",
                "categories": ["database", "storage"],
                "variables": {
                    "database_type": {
                        "type": "string",
                        "description": "Database type",
                        "enum": ["postgresql", "mysql"],
                        "default": "postgresql"
                    },
                    "databases": {
                        "type": "array",
                        "description": "List of databases to create"
                    }
                }
            }
        }

        return templates

    async def rollback_execution(self, execution_id: str) -> AnsibleExecutionResult:
        """
        Rollback a failed Ansible execution

        This would execute the reverse playbook if available,
        or use Ansible's built-in rollback capabilities
        """
        try:
            execution = await self.get_execution_status(execution_id)

            if not execution:
                raise ValueError(f"Execution {execution_id} not found")

            if execution.status != PlaybookStatus.FAILED.value:
                raise ValueError("Can only rollback failed executions")

            # Get playbook
            playbook = self.db.query(AnsiblePlaybook).filter(
                AnsiblePlaybook.id == execution.playbook_id
            ).first()

            if not playbook:
                raise ValueError("Playbook not found")

            # Check if rollback playbook exists
            rollback_playbook = self.db.query(AnsiblePlaybook).filter(
                AnsiblePlaybook.name == f"{playbook.name}_rollback"
            ).first()

            if not rollback_playbook:
                return AnsibleExecutionResult(
                    status=PlaybookStatus.FAILED,
                    error_message="No rollback playbook available"
                )

            # Execute rollback
            return await self.execute_playbook(
                playbook_id=rollback_playbook.id,
                inventory_id=execution.inventory_id,
                extra_vars=execution.extra_vars,
                user_id=execution.created_by
            )

        except Exception as e:
            logger.error(f"Failed to rollback execution {execution_id}: {str(e)}")
            raise

    async def cleanup_temp_files(self, older_than_hours: int = 24) -> int:
        """Clean up temporary Ansible files"""
        try:
            cutoff_time = datetime.now(timezone.utc) - timedelta(hours=older_than_hours)
            cleaned_count = 0

            for file_path in self.temp_dir.glob("*"):
                try:
                    if file_path.stat().st_mtime < cutoff_time.timestamp():
                        if file_path.is_file():
                            file_path.unlink()
                            cleaned_count += 1
                        elif file_path.is_dir():
                            import shutil
                            shutil.rmtree(file_path)
                            cleaned_count += 1
                except Exception as e:
                    logger.warning(f"Failed to delete temp file {file_path}: {str(e)}")

            logger.info(f"Cleaned up {cleaned_count} temporary files")
            return cleaned_count

        except Exception as e:
            logger.error(f"Failed to cleanup temp files: {str(e)}")
            raise