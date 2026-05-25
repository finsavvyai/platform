#!/usr/bin/env python3
"""
UPM.Plus Workflow Orchestration - Live Functionality Demo
Demonstrates the complete workflow orchestration system in action
"""

import asyncio
import json
from datetime import datetime
from uuid import UUID
from typing import Dict, Any

# Import our services
from app.services.workflow_orchestration import (
    workflow_orchestration_service,
    WorkflowDefinition,
    TaskDefinition,
    TaskType,
    ExecutionStrategy,
    WorkflowTemplate,
    RetryStrategy
)
from app.services.infrastructure_monitoring import infrastructure_monitoring_service

async def demo_complete_workflow_system():
    """Complete demonstration of the UPM.Plus workflow orchestration system"""

    print("🚀 UPM.Plus Workflow Orchestration - LIVE DEMO")
    print("=" * 60)

    # Demo 1: System Health Check
    print("\n📊 1. SYSTEM HEALTH CHECK")
    print("-" * 30)

    workflow_health = await workflow_orchestration_service.health_check()
    monitoring_health = await infrastructure_monitoring_service.health_check()

    print(f"✅ Workflow Service: {workflow_health['status']}")
    print(f"   - Active Workflows: {workflow_health['active_workflows']}")
    print(f"   - Total Workflows: {workflow_health['total_workflows']}")
    print(f"   - Queue Size: {workflow_health['queue_size']}")

    print(f"✅ Monitoring Service: {monitoring_health.get('status', 'healthy')}")
    print(f"   - Active Monitoring: {monitoring_health.get('active_monitoring_sessions', 0)}")
    print(f"   - Alert Rules: {monitoring_health.get('total_alert_rules', 0)}")

    # Demo 2: Create Advanced Multi-Stage Workflow
    print("\n🏗️  2. CREATING ADVANCED DEPLOYMENT PIPELINE")
    print("-" * 45)

    # Define a realistic full-stack deployment pipeline
    tasks = [
        TaskDefinition(
            name="🔧 Generate Microservice Code",
            type=TaskType.CODE_GENERATION,
            description="Generate FastAPI microservice with authentication",
            config={
                "language": "python",
                "framework": "fastapi",
                "features": ["auth", "database", "monitoring"],
                "api_endpoints": 5
            },
            timeout_seconds=120,
            retry_strategy=RetryStrategy.EXPONENTIAL_BACKOFF,
            priority=100
        ),

        TaskDefinition(
            name="🗄️  Setup Database Schema",
            type=TaskType.DATA_PROCESSING,
            description="Initialize PostgreSQL database with migrations",
            config={
                "database": "postgresql",
                "migrations": True,
                "indexes": True,
                "seed_data": True
            },
            dependencies=[],  # Can run in parallel with code generation
            timeout_seconds=60,
            priority=90
        ),

        TaskDefinition(
            name="🐳 Containerize Application",
            type=TaskType.INFRASTRUCTURE_DEPLOYMENT,
            description="Create Docker containers and Kubernetes manifests",
            config={
                "platform": "kubernetes",
                "replicas": 3,
                "health_checks": True,
                "auto_scaling": True
            },
            dependencies=[],  # Wait for code generation
            timeout_seconds=180,
            priority=80
        ),

        TaskDefinition(
            name="☁️  Deploy to Cloud",
            type=TaskType.INFRASTRUCTURE_DEPLOYMENT,
            description="Deploy to AWS EKS with load balancing",
            config={
                "cloud_provider": "aws",
                "region": "us-east-1",
                "environment": "production",
                "load_balancer": True,
                "ssl": True
            },
            dependencies=[],  # Wait for containerization
            timeout_seconds=300,
            priority=70
        ),

        TaskDefinition(
            name="📈 Setup Monitoring",
            type=TaskType.MONITORING_SETUP,
            description="Configure Prometheus, Grafana, and alerting",
            config={
                "metrics": ["cpu", "memory", "requests", "errors"],
                "alerts": ["high_cpu", "memory_leak", "error_rate"],
                "dashboards": ["application", "infrastructure"]
            },
            dependencies=[],  # Wait for deployment
            timeout_seconds=120,
            priority=60
        ),

        TaskDefinition(
            name="🧪 Run Health Checks",
            type=TaskType.API_CALL,
            description="Validate deployment with comprehensive tests",
            config={
                "test_types": ["health", "integration", "load"],
                "endpoints": ["/health", "/api/v1/users", "/api/v1/auth"],
                "load_test_duration": 300
            },
            dependencies=[],  # Wait for monitoring setup
            timeout_seconds=400,
            priority=50
        )
    ]

    # Set up dependencies properly
    tasks[2].dependencies = [tasks[0].id]  # Containerize depends on code generation
    tasks[3].dependencies = [tasks[2].id]  # Deploy depends on containerization
    tasks[4].dependencies = [tasks[3].id]  # Monitoring depends on deployment
    tasks[5].dependencies = [tasks[4].id]  # Health checks depend on monitoring

    workflow = WorkflowDefinition(
        name="🚀 Full-Stack Microservice Deployment Pipeline",
        description="Complete automated pipeline for microservice development, deployment, and monitoring",
        version="2.0.0",
        tasks=tasks,
        execution_strategy=ExecutionStrategy.ADAPTIVE,
        timeout_seconds=1800,  # 30 minutes
        max_parallel_tasks=3,
        auto_retry=True,
        notifications={
            "slack": {"webhook": "https://hooks.slack.com/...", "enabled": True},
            "email": {"recipients": ["devops@company.com"], "enabled": True}
        },
        metadata={
            "cost_estimate": "$50",
            "estimated_duration": "15 minutes",
            "complexity": "high",
            "team": "platform-engineering"
        },
        created_by="platform-engineer@company.com",
        tags=["production", "microservice", "automation", "ci-cd"]
    )

    create_result = await workflow_orchestration_service.create_workflow(workflow)
    print(f"✅ Workflow Created: {create_result['status']}")
    print(f"   📝 Workflow ID: {create_result['workflow_id']}")
    print(f"   📊 Tasks: {len(workflow.tasks)}")
    print(f"   ⚡ Strategy: {workflow.execution_strategy.value}")
    print(f"   💰 Cost Estimate: {workflow.metadata['cost_estimate']}")

    workflow_id = UUID(create_result['workflow_id'])

    # Demo 3: Create and Use Workflow Template
    print("\n📋 3. WORKFLOW TEMPLATE SYSTEM")
    print("-" * 35)

    # Create a reusable template
    template_workflow = WorkflowDefinition(
        name="API Development Template",
        description="Standard template for REST API development",
        tasks=[
            TaskDefinition(
                name="Generate {language} API",
                type=TaskType.CODE_GENERATION,
                config={"language": "{language}", "framework": "{framework}"}
            ),
            TaskDefinition(
                name="Setup {database} Database",
                type=TaskType.DATA_PROCESSING,
                config={"database": "{database}"}
            )
        ]
    )

    template = WorkflowTemplate(
        name="🔧 Standard API Development Template",
        description="Reusable template for creating REST APIs",
        category="development",
        workflow_definition=template_workflow,
        parameters=[
            {"name": "language", "type": "string", "default": "python"},
            {"name": "framework", "type": "string", "default": "fastapi"},
            {"name": "database", "type": "string", "default": "postgresql"}
        ],
        public=True
    )

    template_result = await workflow_orchestration_service.create_template(template)
    print(f"✅ Template Created: {template_result['status']}")
    print(f"   📋 Template ID: {template_result['template_id']}")

    # Use template to create new workflow
    if template_result['status'] == 'success':
        template_id = UUID(template_result['template_id'])
        new_workflow = await workflow_orchestration_service.create_workflow_from_template(
            template_id,
            {"language": "node.js", "framework": "express", "database": "mongodb"}
        )
        print(f"✅ Workflow from Template: {new_workflow['status']}")
        print(f"   🆕 New Workflow ID: {new_workflow['workflow_id']}")

    # Demo 4: Execute Workflow with Real-time Monitoring
    print("\n⚡ 4. WORKFLOW EXECUTION & MONITORING")
    print("-" * 40)

    execution_context = {
        "project_name": "payment-service",
        "environment": "production",
        "customer": "enterprise-client",
        "budget": 1000,
        "deadline": "2025-10-01"
    }

    execution_result = await workflow_orchestration_service.execute_workflow(
        workflow_id, execution_context
    )

    print(f"🚀 Execution Started: {execution_result['status']}")
    print(f"   🎯 Execution ID: {execution_result['execution_id']}")
    print(f"   📅 Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    execution_id = UUID(execution_result['execution_id'])

    # Monitor execution progress
    print("\n📊 Real-time Execution Monitoring:")
    for i in range(5):
        await asyncio.sleep(0.3)  # Small delay to show progression

        status_result = await workflow_orchestration_service.get_execution_status(execution_id)
        if status_result['status'] == 'success':
            print(f"   ⏳ Progress: {status_result['progress_percent']:.1f}% | "
                  f"Status: {status_result['workflow_status']} | "
                  f"Completed: {status_result['completed_tasks']}/{status_result['total_tasks']}")

            if status_result['workflow_status'] in ['completed', 'failed']:
                break

    # Demo 5: Workflow Control Operations
    print("\n🎮 5. WORKFLOW CONTROL OPERATIONS")
    print("-" * 38)

    # Test pause/resume functionality
    pause_result = await workflow_orchestration_service.pause_workflow(execution_id)
    print(f"⏸️  Pause Operation: {pause_result['status']}")

    await asyncio.sleep(0.2)

    resume_result = await workflow_orchestration_service.resume_workflow(execution_id)
    print(f"▶️  Resume Operation: {resume_result['status']}")

    # Demo 6: Analytics and Insights
    print("\n📈 6. ANALYTICS & PERFORMANCE INSIGHTS")
    print("-" * 42)

    analytics_result = await workflow_orchestration_service.get_workflow_analytics(workflow_id, 30)
    if analytics_result['status'] == 'success':
        analytics = analytics_result['analytics']
        print(f"📊 Workflow Analytics (30 days):")
        print(f"   • Total Executions: {analytics['total_executions']}")
        print(f"   • Success Rate: {analytics['success_rate_percent']:.1f}%")
        print(f"   • Avg Duration: {analytics['average_execution_time_seconds']:.2f}s")
        print(f"   • Failed Executions: {analytics['failed_executions']}")

    # Demo 7: Template Library
    print("\n📚 7. TEMPLATE LIBRARY")
    print("-" * 25)

    templates_result = await workflow_orchestration_service.list_templates()
    print(f"📋 Available Templates: {templates_result['total']}")
    for template in templates_result['templates']:
        print(f"   • {template['name']} (Category: {template['category']})")
        print(f"     Used: {template['use_count']} times | Rating: {template['rating']}/5.0")

    # Demo 8: System Status Summary
    print("\n🏁 8. FINAL SYSTEM STATUS")
    print("-" * 30)

    final_health = await workflow_orchestration_service.health_check()
    print(f"🏗️  Total Workflows: {final_health['total_workflows']}")
    print(f"⚡ Active Executions: {final_health['active_workflows']}")
    print(f"📋 Templates Available: {final_health['templates_available']}")
    print(f"📊 Total Executions: {final_health['total_executions']}")
    print(f"⏰ System Uptime: {final_health['timestamp']}")

    print("\n" + "=" * 60)
    print("🎉 DEMO COMPLETE - UPM.Plus Workflow Orchestration")
    print("✨ Full autonomous infrastructure management pipeline operational!")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(demo_complete_workflow_system())