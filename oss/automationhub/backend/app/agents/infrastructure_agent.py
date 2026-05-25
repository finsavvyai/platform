"""
Infrastructure management agent implementation using Ansible.

This agent specializes in infrastructure automation, configuration management,
deployment orchestration, and system administration tasks.
"""

import asyncio
import logging
import subprocess
import tempfile
import yaml
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4

from pydantic import BaseModel

from app.agents.base import (
    UPMAgent, Task, TaskResult, TaskStatus, TaskType, ExecutionContext,
    ExecutionStep, Capability, AgentStatus
)
from app.services.llm import llm_service

logger = logging.getLogger(__name__)


class InfrastructureAgent(UPMAgent):
    """
    Infrastructure management agent using Ansible.
    
    Capabilities:
    - Server provisioning and configuration
    - Application deployment
    - System monitoring setup
    - Security hardening
    - Infrastructure as Code
    """
    
    def __init__(self, **kwargs):
        # Define infrastructure capabilities
        capabilities = [
            Capability(
                name="server_provisioning",
                description="Provision and configure servers",
                supported_task_types=[TaskType.INFRASTRUCTURE]
            ),
            Capability(
                name="application_deployment",
                description="Deploy applications and services",
                supported_task_types=[TaskType.INFRASTRUCTURE]
            ),
            Capability(
                name="configuration_management",
                description="Manage system configurations",
                supported_task_types=[TaskType.INFRASTRUCTURE]
            ),
            Capability(
                name="security_hardening",
                description="Apply security configurations and patches",
                supported_task_types=[TaskType.INFRASTRUCTURE]
            ),
            Capability(
                name="infrastructure_as_code",
                description="Generate and manage infrastructure code",
                supported_task_types=[TaskType.INFRASTRUCTURE]
            )
        ]
        
        super().__init__(
            name=kwargs.get("name", "InfrastructureAgent"),
            capabilities=capabilities,
            **kwargs
        )
        
        # Infrastructure-specific attributes
        self.ansible_config_dir = Path(tempfile.mkdtemp(prefix="upm_ansible_"))
        self.active_deployments: Dict[UUID, Dict[str, Any]] = {}
        
        # Create ansible config directory structure
        self._setup_ansible_environment()
    
    def _register_default_tools(self):
        """Register infrastructure-specific tools."""
        self.tools.register_tool("ansible_runner", self._run_ansible_playbook)
        self.tools.register_tool("generate_playbook", self._generate_playbook)
    
    def _setup_ansible_environment(self):
        """Setup Ansible configuration directory structure."""
        try:
            # Create directory structure
            (self.ansible_config_dir / "playbooks").mkdir(exist_ok=True)
            (self.ansible_config_dir / "inventory").mkdir(exist_ok=True)
            
            # Create basic ansible.cfg
            ansible_cfg = """
[defaults]
host_key_checking = False
inventory = inventory/hosts.yml
retry_files_enabled = False
stdout_callback = json

[ssh_connection]
pipelining = True
"""
            
            with open(self.ansible_config_dir / "ansible.cfg", "w") as f:
                f.write(ansible_cfg.strip())
            
            self.logger.info(f"Ansible environment setup at {self.ansible_config_dir}")
            
        except Exception as e:
            self.logger.error(f"Failed to setup Ansible environment: {e}")
            raise
    
    async def execute_task(self, task: Task, context: ExecutionContext) -> TaskResult:
        """Execute an infrastructure management task."""
        self.status = AgentStatus.BUSY
        started_at = datetime.utcnow()
        execution_steps = []
        
        try:
            self.logger.info(f"Executing infrastructure task: {task.name}")
            
            # Parse task parameters
            task_type = task.parameters.get("task_type", "deploy")
            target = task.parameters.get("target", "default")
            
            result = None
            
            if task_type == "deploy":
                result = await self._handle_deployment(task.parameters, context, execution_steps)
            elif task_type == "configure":
                result = await self._handle_configuration(task.parameters, context, execution_steps)
            elif task_type == "provision":
                result = await self._handle_provisioning(task.parameters, context, execution_steps)
            else:
                raise ValueError(f"Unsupported infrastructure task type: {task_type}")
            
            completed_at = datetime.utcnow()
            duration_ms = int((completed_at - started_at).total_seconds() * 1000)
            
            task_result = TaskResult(
                task_id=task.id,
                status=TaskStatus.COMPLETED,
                result=result,
                execution_steps=execution_steps,
                started_at=started_at,
                completed_at=completed_at,
                duration_ms=duration_ms,
                metadata={"task_type": task_type, "target": target}
            )
            
            self.update_performance_metrics(task_result)
            self.status = AgentStatus.IDLE
            return task_result
            
        except Exception as e:
            self.logger.error(f"Infrastructure task execution failed: {e}")
            self.status = AgentStatus.ERROR
            
            completed_at = datetime.utcnow()
            duration_ms = int((completed_at - started_at).total_seconds() * 1000)
            
            task_result = TaskResult(
                task_id=task.id,
                status=TaskStatus.FAILED,
                error=str(e),
                execution_steps=execution_steps,
                started_at=started_at,
                completed_at=completed_at,
                duration_ms=duration_ms
            )
            
            self.update_performance_metrics(task_result)
            return task_result
    
    async def _handle_deployment(
        self, parameters: Dict[str, Any], context: ExecutionContext, execution_steps: List[ExecutionStep]
    ) -> Dict[str, Any]:
        """Handle application deployment."""
        deployment_id = uuid4()
        
        # Generate deployment playbook
        step_started = datetime.utcnow()
        try:
            deployment_prompt = f"""
            Generate an Ansible playbook for deploying an application:
            - Parameters: {parameters}
            - Include tasks for: downloading, installing, configuring, starting service
            - Add proper error handling and idempotency
            Return as valid YAML.
            """
            
            playbook_result = await llm_service.generate_completion(
                prompt=deployment_prompt, temperature=0.1, max_tokens=1000
            )
            
            # Parse and save playbook
            try:
                # Check if this is a fallback response
                if playbook_result.get("fallback", False):
                    # Create a simple fallback playbook
                    playbook_data = [{
                        "name": "Fallback Deployment Playbook",
                        "hosts": "localhost",
                        "tasks": [{
                            "name": "Display fallback message",
                            "debug": {
                                "msg": "This is a fallback playbook - API key required for full functionality"
                            }
                        }]
                    }]
                else:
                    playbook_data = yaml.safe_load(playbook_result["content"])
            except yaml.YAMLError as e:
                # If YAML parsing fails, create a fallback playbook
                self.logger.warning(f"Generated playbook is invalid YAML: {e}, using fallback")
                playbook_data = [{
                    "name": "Fallback Deployment Playbook",
                    "hosts": "localhost", 
                    "tasks": [{
                        "name": "Display fallback message",
                        "debug": {
                            "msg": f"Fallback playbook created due to YAML error: {e}"
                        }
                    }]
                }]
            
            playbook_path = self.ansible_config_dir / "playbooks" / f"deploy_{deployment_id}.yml"
            with open(playbook_path, "w") as f:
                yaml.dump(playbook_data, f, default_flow_style=False)
            
            step = ExecutionStep(
                step_id=uuid4(), action="generate_deployment_playbook",
                parameters=parameters, result={"playbook_path": str(playbook_path)},
                started_at=step_started, completed_at=datetime.utcnow(),
                duration_ms=int((datetime.utcnow() - step_started).total_seconds() * 1000)
            )
            execution_steps.append(step)
            
            return {
                "deployment_id": str(deployment_id),
                "playbook_path": str(playbook_path),
                "status": "playbook_generated"
            }
            
        except Exception as e:
            self.logger.error(f"Deployment failed: {e}")
            raise
    
    async def _handle_configuration(
        self, parameters: Dict[str, Any], context: ExecutionContext, execution_steps: List[ExecutionStep]
    ) -> Dict[str, Any]:
        """Handle system configuration."""
        config_id = uuid4()
        
        step_started = datetime.utcnow()
        try:
            config_prompt = f"""
            Generate an Ansible playbook for system configuration:
            - Parameters: {parameters}
            - Include: system updates, package installation, service configuration
            - Ensure idempotency and error handling
            Return as valid YAML.
            """
            
            playbook_result = await llm_service.generate_completion(
                prompt=config_prompt, temperature=0.1, max_tokens=1000
            )
            
            # Handle fallback responses
            try:
                if playbook_result.get("fallback", False):
                    playbook_data = [{
                        "name": "Fallback Configuration Playbook",
                        "hosts": "localhost",
                        "tasks": [{
                            "name": "Display fallback message",
                            "debug": {
                                "msg": "This is a fallback playbook - API key required for full functionality"
                            }
                        }]
                    }]
                else:
                    playbook_data = yaml.safe_load(playbook_result["content"])
            except yaml.YAMLError as e:
                self.logger.warning(f"Generated playbook is invalid YAML: {e}, using fallback")
                playbook_data = [{
                    "name": "Fallback Configuration Playbook",
                    "hosts": "localhost",
                    "tasks": [{
                        "name": "Display fallback message", 
                        "debug": {
                            "msg": f"Fallback playbook created due to YAML error: {e}"
                        }
                    }]
                }]
            
            playbook_path = self.ansible_config_dir / "playbooks" / f"config_{config_id}.yml"
            
            with open(playbook_path, "w") as f:
                yaml.dump(playbook_data, f, default_flow_style=False)
            
            step = ExecutionStep(
                step_id=uuid4(), action="generate_configuration_playbook",
                parameters=parameters, result={"playbook_path": str(playbook_path)},
                started_at=step_started, completed_at=datetime.utcnow(),
                duration_ms=int((datetime.utcnow() - step_started).total_seconds() * 1000)
            )
            execution_steps.append(step)
            
            return {
                "configuration_id": str(config_id),
                "playbook_path": str(playbook_path),
                "status": "playbook_generated"
            }
            
        except Exception as e:
            self.logger.error(f"Configuration failed: {e}")
            raise
    
    async def _handle_provisioning(
        self, parameters: Dict[str, Any], context: ExecutionContext, execution_steps: List[ExecutionStep]
    ) -> Dict[str, Any]:
        """Handle server provisioning."""
        provision_id = uuid4()
        
        step_started = datetime.utcnow()
        try:
            provision_prompt = f"""
            Generate an Ansible playbook for server provisioning:
            - Parameters: {parameters}
            - Include security groups, key pairs, basic configuration
            - Add tags for identification and management
            Return as valid YAML.
            """
            
            playbook_result = await llm_service.generate_completion(
                prompt=provision_prompt, temperature=0.1, max_tokens=1000
            )
            
            playbook_data = yaml.safe_load(playbook_result["content"])
            playbook_path = self.ansible_config_dir / "playbooks" / f"provision_{provision_id}.yml"
            
            with open(playbook_path, "w") as f:
                yaml.dump(playbook_data, f, default_flow_style=False)
            
            step = ExecutionStep(
                step_id=uuid4(), action="generate_provisioning_playbook",
                parameters=parameters, result={"playbook_path": str(playbook_path)},
                started_at=step_started, completed_at=datetime.utcnow(),
                duration_ms=int((datetime.utcnow() - step_started).total_seconds() * 1000)
            )
            execution_steps.append(step)
            
            return {
                "provisioning_id": str(provision_id),
                "playbook_path": str(playbook_path),
                "status": "playbook_generated"
            }
            
        except Exception as e:
            self.logger.error(f"Provisioning failed: {e}")
            raise
    
    async def _run_ansible_playbook(
        self, playbook_path: str, inventory_path: str = None, variables: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Run an Ansible playbook."""
        try:
            cmd = ["ansible-playbook", playbook_path, "--check"]  # Dry run for safety
            
            if inventory_path:
                cmd.extend(["-i", inventory_path])
            
            if variables:
                import json
                cmd.extend(["--extra-vars", json.dumps(variables)])
            
            process = await asyncio.create_subprocess_exec(
                *cmd, cwd=str(self.ansible_config_dir),
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            return {
                "success": process.returncode == 0,
                "return_code": process.returncode,
                "stdout": stdout.decode() if stdout else "",
                "stderr": stderr.decode() if stderr else "",
                "command": " ".join(cmd)
            }
            
        except Exception as e:
            self.logger.error(f"Failed to run Ansible playbook: {e}")
            return {"success": False, "error": str(e)}
    
    async def _generate_playbook(self, objective: str, requirements: Dict[str, Any]) -> str:
        """Generate an Ansible playbook using AI."""
        try:
            prompt = f"""
            Generate an Ansible playbook for: {objective}
            Requirements: {requirements}
            Include proper task organization, error handling, and idempotency.
            Return as valid YAML.
            """
            
            result = await llm_service.generate_completion(
                prompt=prompt, temperature=0.1, max_tokens=1500
            )
            
            return result["content"]
            
        except Exception as e:
            self.logger.error(f"Playbook generation failed: {e}")
            raise
    
    async def _contribute_to_collaboration(
        self, objective: str, context: Optional[ExecutionContext] = None
    ) -> Dict[str, Any]:
        """Contribute infrastructure capabilities to collaboration."""
        try:
            analysis = await llm_service.analyze_task(
                task_description=f"Infrastructure contribution to: {objective}",
                context=f"Available capabilities: {[cap.name for cap in self.capabilities]}"
            )
            
            return {
                "agent_id": self.id,
                "agent_name": self.name,
                "agent_type": "infrastructure_management",
                "capabilities": [cap.name for cap in self.capabilities],
                "contribution_analysis": analysis.get("analysis", {}),
                "suggested_actions": [
                    "Provision required infrastructure",
                    "Configure system environments",
                    "Deploy applications and services",
                    "Setup monitoring and logging",
                    "Apply security hardening"
                ]
            }
            
        except Exception as e:
            self.logger.error(f"Collaboration contribution analysis failed: {e}")
            return {
                "agent_id": self.id,
                "agent_name": self.name,
                "agent_type": "infrastructure_management",
                "capabilities": [cap.name for cap in self.capabilities],
                "error": str(e)
            }
