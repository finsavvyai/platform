"""
UPM.Plus Complete Automation Examples - ALL Use Cases
Run: python3.12 examples/complete_automation_examples.py

This demonstrates ALL 4 agent types with real working code.
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from app.agents.browser_agent import BrowserAgent
from app.agents.conversational_agent import ConversationalAgent
from app.agents.infrastructure_agent import InfrastructureAgent
from app.agents.data_agent import DataAgent
from app.agents.base import Task, TaskType, ExecutionContext
from app.services.browser_automation import browser_automation_service
from uuid import uuid4
import pandas as pd


print("""
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║           UPM.Plus Complete Automation Demo                 ║
║           ALL Agent Types + Real Examples                   ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
""")


# ============================================================
# 1. BROWSER AUTOMATION
# ============================================================

async def demo_browser_automation():
    print("\n🤖 BROWSER AUTOMATION\n" + "="*60)
    
    agent = BrowserAgent()
    
    task = Task(
        type=TaskType.BROWSER_AUTOMATION,
        name="web_scraping",
        parameters={
            "actions": [
                {"action_type": "navigate", "url": "https://example.com"},
                {"action_type": "extract", "selector": "h1"},
                {"action_type": "extract", "selector": "p"},
                {"action_type": "screenshot", "options": {"type": "png"}}
            ]
        }
    )
    
    result = await agent.execute_task(task, ExecutionContext(session_id=uuid4()))
    
    print(f"✅ Status: {result.status}")
    print(f"⏱️  Time: {result.duration_ms}ms")
    print(f"📊 Steps: {len(result.execution_steps)}")
    
    for step in result.execution_steps:
        if step.result and not isinstance(step.result, dict):
            print(f"   📄 {step.action}: {step.result}")
    
    await agent.cleanup()
    return result


async def demo_form_automation():
    print("\n📝 FORM AUTOMATION\n" + "="*60)
    
    result = await browser_automation_service.fill_form(
        form_url="https://httpbin.org/forms/post",
        form_data={
            "input[name='custname']": "John Doe",
            "input[name='custemail']": "john@example.com"
        }
    )
    
    print(f"✅ Success: {result['success']}")
    print(f"📝 Fields filled: {result['fields_filled']}")
    print(f"⏱️  Time: {result['execution_time_ms']}ms")
    
    await browser_automation_service.cleanup()
    return result


async def demo_ai_workflow():
    print("\n🧠 AI-POWERED WORKFLOW\n" + "="*60)
    
    workflow = await browser_automation_service.create_workflow_from_description(
        description="Visit example.com and extract the main heading",
        target_url="https://example.com"
    )
    
    print(f"🤖 Generated {len(workflow.actions)} automated steps")
    
    result = await browser_automation_service.execute_workflow(workflow)
    
    print(f"✅ Success: {result.success}")
    print(f"⏱️  Time: {result.execution_time_ms}ms")
    
    return result


# ============================================================
# 2. CONVERSATIONAL AI
# ============================================================

async def demo_conversational_ai():
    print("\n💬 CONVERSATIONAL AI\n" + "="*60)
    
    agent = ConversationalAgent()
    session_id = uuid4()
    
    questions = [
        "What is cloud computing?",
        "What are its main benefits?",
        "How does it compare to on-premise?"
    ]
    
    for i, question in enumerate(questions, 1):
        print(f"\n👤 Q{i}: {question}")
        
        task = Task(
            type=TaskType.CONVERSATION,
            name=f"chat_{i}",
            parameters={
                "task_type": "conversation",
                "session_id": session_id,
                "message": question
            }
        )
        
        result = await agent.execute_task(task, ExecutionContext(session_id=session_id))
        
        if result.result:
            response = result.result.get('response', '')[:200]
            print(f"🤖 A{i}: {response}...")
    
    return agent


async def demo_customer_support():
    print("\n🎧 CUSTOMER SUPPORT BOT\n" + "="*60)
    
    agent = ConversationalAgent()
    session_id = uuid4()
    
    support_conversation = [
        "Hi, I need help with my account",
        "I can't log in to the system",
        "I already tried resetting my password"
    ]
    
    for msg in support_conversation:
        print(f"\n👤 Customer: {msg}")
        
        task = Task(
            type=TaskType.CONVERSATION,
            name="support",
            parameters={
                "task_type": "conversation",
                "session_id": session_id,
                "message": msg,
                "system_prompt": "You are a helpful customer support agent"
            }
        )
        
        result = await agent.execute_task(task, ExecutionContext(session_id=session_id))
        
        if result.result:
            print(f"🎧 Support: {result.result.get('response', 'No response')[:150]}...")
    
    return agent


# ============================================================
# 3. INFRASTRUCTURE AUTOMATION
# ============================================================

async def demo_infrastructure():
    print("\n🏗️  INFRASTRUCTURE AUTOMATION\n" + "="*60)
    
    agent = InfrastructureAgent()
    
    task = Task(
        type=TaskType.INFRASTRUCTURE,
        name="deploy_app",
        parameters={
            "task_type": "deploy",
            "target": "production",
            "variables": {
                "app_name": "web_app",
                "version": "v1.0.0",
                "replicas": 3
            }
        }
    )
    
    result = await agent.execute_task(task, ExecutionContext(session_id=uuid4()))
    
    print(f"✅ Status: {result.status}")
    print(f"⏱️  Time: {result.duration_ms}ms")
    
    if result.result:
        print(f"📋 Deployment ID: {result.result.get('deployment_id')}")
        print(f"📄 Playbook: {result.result.get('playbook_path')}")
    
    return result


# ============================================================
# 4. DATA PROCESSING
# ============================================================

async def demo_data_processing():
    print("\n📊 DATA PROCESSING\n" + "="*60)
    
    agent = DataAgent()
    
    # Create sample data
    data = pd.DataFrame({
        'product': ['Widget A', 'Widget B', 'Widget C'],
        'price': [19.99, 29.99, 39.99],
        'sales': [150, 200, 100],
        'revenue': [2998.50, 5998.00, 3999.00]
    })
    
    task = Task(
        type=TaskType.DATA_PROCESSING,
        name="sales_analysis",
        parameters={
            "task_type": "analyze",
            "data": data.to_dict(),
            "analysis_type": "descriptive"
        }
    )
    
    result = await agent.execute_task(task, ExecutionContext(session_id=uuid4()))
    
    print(f"✅ Status: {result.status}")
    print(f"⏱️  Time: {result.duration_ms}ms")
    
    if result.result:
        print(f"📈 Analysis type: {result.result.get('analysis_type')}")
        print(f"📊 Data shape: {result.result.get('data_shape')}")
        if result.result.get('results'):
            stats = result.result['results'].get('summary_statistics', {})
            print(f"💰 Avg price: ${stats.get('price', {}).get('mean', 0):.2f}")
            print(f"📦 Total sales: {stats.get('sales', {}).get('sum', 0)}")
    
    return result


# ============================================================
# 5. MULTI-AGENT COLLABORATION
# ============================================================

async def demo_multi_agent_collaboration():
    print("\n🤝 MULTI-AGENT COLLABORATION\n" + "="*60)
    
    # Create multiple agents
    browser_agent = BrowserAgent()
    ai_agent = ConversationalAgent()
    
    print("🤖 Agents collaborating on: 'Analyze competitor website'")
    
    result = await browser_agent.collaborate(
        other_agents=[ai_agent],
        objective="Scrape competitor website and provide strategic analysis",
        context=ExecutionContext(session_id=uuid4())
    )
    
    print(f"✅ Success: {result.success}")
    print(f"👥 Agents involved: {len(result.participating_agents)}")
    print(f"📊 Contributions: {len(result.agent_contributions)}")
    
    for agent_id, contribution in list(result.agent_contributions.items())[:2]:
        print(f"\n   Agent: {contribution.get('agent_name')}")
        print(f"   Type: {contribution.get('agent_type')}")
        print(f"   Capabilities: {len(contribution.get('capabilities', []))}")
    
    await browser_agent.cleanup()
    
    return result


# ============================================================
# MAIN RUNNER
# ============================================================

async def main():
    print("\n" + "="*60)
    print("Starting Complete UPM.Plus Automation Demo")
    print("="*60)
    
    demos = [
        ("Browser Automation", demo_browser_automation),
        ("Form Automation", demo_form_automation),
        ("AI Workflow", demo_ai_workflow),
        ("Conversational AI", demo_conversational_ai),
        ("Customer Support", demo_customer_support),
        ("Infrastructure", demo_infrastructure),
        ("Data Processing", demo_data_processing),
        ("Multi-Agent Collaboration", demo_multi_agent_collaboration),
    ]
    
    results = {}
    
    for name, demo_func in demos:
        try:
            result = await demo_func()
            results[name] = "✅ SUCCESS"
        except Exception as e:
            results[name] = f"❌ FAILED: {str(e)[:50]}"
            print(f"\n⚠️  Error in {name}: {e}")
    
    # Final Summary
    print("\n" + "="*60)
    print("DEMO SUMMARY")
    print("="*60)
    
    for name, status in results.items():
        print(f"{status} - {name}")
    
    successful = sum(1 for s in results.values() if s.startswith("✅"))
    print(f"\n✅ Completed: {successful}/{len(demos)} demos")
    
    print("\n" + "="*60)
    print("Demo Complete! All automation types demonstrated.")
    print("="*60 + "\n")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\n⚠️  Demo interrupted by user")
    except Exception as e:
        print(f"\n\n❌ Demo failed: {e}")
