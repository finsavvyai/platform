"""
Database seeding utilities
"""

import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import logging
from datetime import datetime
import uuid

from app.core.database import get_db_session
from app.models.user import User
from app.models.organization import Organization
from app.models.agent import Agent
from app.models.workflow import Workflow

logger = logging.getLogger(__name__)


async def create_default_organization() -> Organization:
    """Create default organization"""
    async with get_db_session() as db:
        # Check if default organization exists
        result = await db.execute(
            select(Organization).where(Organization.name == "Default Organization")
        )
        existing_org = result.scalar_one_or_none()
        
        if existing_org:
            logger.info("Default organization already exists")
            return existing_org
        
        # Create default organization
        org = Organization(
            name="Default Organization",
            description="Default organization for UPM.Plus",
            subscription_plan="free",
            settings={
                "max_workflows": 10,
                "max_agents": 5,
                "max_documents": 100
            },
            security_settings={
                "require_2fa": False,
                "session_timeout": 3600
            }
        )
        
        db.add(org)
        await db.commit()
        await db.refresh(org)
        
        logger.info(f"Created default organization: {org.id}")
        return org


async def create_admin_user(organization: Organization) -> User:
    """Create admin user"""
    async with get_db_session() as db:
        # Check if admin user exists
        result = await db.execute(
            select(User).where(User.email == "admin@upmplus.ai")
        )
        existing_user = result.scalar_one_or_none()
        
        if existing_user:
            logger.info("Admin user already exists")
            return existing_user
        
        # Create admin user
        user = User(
            email="admin@upmplus.ai",
            hashed_password="$2b$12$placeholder_hash",  # TODO: Use proper password hashing
            full_name="UPM.Plus Administrator",
            is_active=True,
            is_superuser=True,
            is_verified=True,
            organization_id=organization.id,
            subscription_tier="enterprise",
            usage_limits={
                "workflows_per_month": -1,  # Unlimited
                "agents_per_month": -1,
                "api_calls_per_month": -1
            },
            preferences={
                "theme": "light",
                "notifications": True,
                "language": "en"
            }
        )
        
        db.add(user)
        await db.commit()
        await db.refresh(user)
        
        logger.info(f"Created admin user: {user.id}")
        return user


async def create_default_agents() -> list[Agent]:
    """Create default agents"""
    async with get_db_session() as db:
        agents = []
        
        # Browser automation agent
        browser_agent = Agent(
            name="Browser Automation Agent",
            description="AI agent for web browser automation tasks",
            agent_type="browser",
            capabilities=[
                "web_navigation",
                "element_interaction",
                "data_extraction",
                "screenshot_capture"
            ],
            llm_config={
                "model": "gpt-3.5-turbo",
                "temperature": 0.1,
                "max_tokens": 1000
            },
            tools=[
                "playwright",
                "selenium",
                "browser_use"
            ],
            status="inactive",
            is_enabled=True,
            settings={
                "headless": True,
                "timeout": 30,
                "retry_attempts": 3
            }
        )
        
        # Infrastructure agent
        infra_agent = Agent(
            name="Infrastructure Management Agent",
            description="AI agent for infrastructure automation with Ansible",
            agent_type="infrastructure",
            capabilities=[
                "server_provisioning",
                "configuration_management",
                "deployment_automation",
                "monitoring_setup"
            ],
            llm_config={
                "model": "gpt-3.5-turbo",
                "temperature": 0.1,
                "max_tokens": 1500
            },
            tools=[
                "ansible",
                "terraform",
                "docker"
            ],
            status="inactive",
            is_enabled=True,
            settings={
                "vault_enabled": True,
                "dry_run": False,
                "parallel_execution": True
            }
        )
        
        # Conversational agent
        conv_agent = Agent(
            name="Conversational AI Agent",
            description="AI agent for natural language interactions and knowledge retrieval",
            agent_type="conversational",
            capabilities=[
                "natural_language_processing",
                "knowledge_retrieval",
                "conversation_management",
                "context_awareness"
            ],
            llm_config={
                "model": "gpt-4",
                "temperature": 0.7,
                "max_tokens": 2000
            },
            tools=[
                "openai_api",
                "vector_search",
                "rag_pipeline"
            ],
            status="inactive",
            is_enabled=True,
            settings={
                "memory_enabled": True,
                "context_window": 4000,
                "response_streaming": True
            }
        )
        
        agents_to_create = [browser_agent, infra_agent, conv_agent]
        
        for agent in agents_to_create:
            # Check if agent already exists
            result = await db.execute(
                select(Agent).where(Agent.name == agent.name)
            )
            existing_agent = result.scalar_one_or_none()
            
            if not existing_agent:
                db.add(agent)
                agents.append(agent)
                logger.info(f"Creating default agent: {agent.name}")
            else:
                agents.append(existing_agent)
                logger.info(f"Default agent already exists: {agent.name}")
        
        await db.commit()
        
        # Refresh all agents
        for agent in agents:
            await db.refresh(agent)
        
        return agents


async def create_sample_workflow(user: User, agents: list[Agent]) -> Workflow:
    """Create sample workflow"""
    async with get_db_session() as db:
        # Check if sample workflow exists
        result = await db.execute(
            select(Workflow).where(Workflow.name == "Sample Web Automation Workflow")
        )
        existing_workflow = result.scalar_one_or_none()
        
        if existing_workflow:
            logger.info("Sample workflow already exists")
            return existing_workflow
        
        # Create sample workflow
        workflow = Workflow(
            name="Sample Web Automation Workflow",
            description="A sample workflow that demonstrates web automation capabilities",
            owner_id=user.id,
            organization_id=user.organization_id,
            nodes=[
                {
                    "id": "node_1",
                    "type": "browser_action",
                    "name": "Navigate to Website",
                    "config": {
                        "action": "navigate",
                        "url": "https://example.com"
                    }
                },
                {
                    "id": "node_2",
                    "type": "browser_action",
                    "name": "Extract Page Title",
                    "config": {
                        "action": "extract_text",
                        "selector": "title"
                    }
                }
            ],
            connections=[
                {
                    "from": "node_1",
                    "to": "node_2"
                }
            ],
            variables={
                "target_url": "https://example.com",
                "output_format": "json"
            },
            status="draft",
            is_template=True,
            is_public=True,
            tags=["sample", "web_automation", "tutorial"],
            category="automation"
        )
        
        db.add(workflow)
        await db.commit()
        await db.refresh(workflow)
        
        logger.info(f"Created sample workflow: {workflow.id}")
        return workflow


async def seed_database():
    """Seed database with initial data"""
    logger.info("Starting database seeding...")
    
    try:
        # Create default organization
        org = await create_default_organization()
        
        # Create admin user
        admin_user = await create_admin_user(org)
        
        # Create default agents
        agents = await create_default_agents()
        
        # Create sample workflow
        sample_workflow = await create_sample_workflow(admin_user, agents)
        
        logger.info("Database seeding completed successfully")
        
        return {
            "organization": org,
            "admin_user": admin_user,
            "agents": agents,
            "sample_workflow": sample_workflow
        }
        
    except Exception as e:
        logger.error(f"Database seeding failed: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(seed_database())