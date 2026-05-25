#!/usr/bin/env python3
"""
UPM.Plus Multi-Agent System Demo

This script demonstrates the key capabilities of the UPM.Plus multi-agent system
with practical examples and real-world scenarios.
"""

import asyncio
import json
import logging
import sys
from datetime import datetime
from pathlib import Path
from uuid import uuid4

# Add the backend directory to Python path
sys.path.insert(0, str(Path(__file__).parent / "backend"))

from app.agents import (
    initialize_agents, agent_registry, BrowserAgent, ConversationalAgent, 
    InfrastructureAgent, DataAgent, Task, TaskType, ExecutionContext
)
from app.services.task_executor import task_executor
from app.services.browser_automation import browser_automation_service

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class UPMPlusDemo:
    """Interactive demo of UPM.Plus capabilities."""
    
    def __init__(self):
        self.agents = {}
    
    async def run_demo(self):
        """Run the complete demo."""
        print("\n" + "="*80)
        print("🚀 Welcome to UPM.Plus - The Autonomous Digital Ecosystem Orchestrator")
        print("="*80)
        
        await self.setup_system()
        
        print("\n🎯 Available Demonstrations:")
        print("1. 🌐 Browser Automation Workflow")
        print("2. 💬 Conversational AI Assistant")
        print("3. 🏗️  Infrastructure Automation")
        print("4. 📊 Data Processing & Analysis")
        print("5. 🤝 Multi-Agent Collaboration")
        print("6. 🔄 Complete Workflow Orchestration")
        
        while True:
            try:
                choice = input("\nSelect a demo (1-6) or 'q' to quit: ").strip()
                
                if choice.lower() == 'q':
                    break
                elif choice == '1':
                    await self.demo_browser_automation()
                elif choice == '2':
                    await self.demo_conversational_ai()
                elif choice == '3':
                    await self.demo_infrastructure_automation()
                elif choice == '4':
                    await self.demo_data_processing()
                elif choice == '5':
                    await self.demo_multi_agent_collaboration()
                elif choice == '6':
                    await self.demo_complete_workflow()
                else:
                    print("❌ Invalid choice. Please select 1-6 or 'q'.")
                    
            except KeyboardInterrupt:
                break
        
        await self.cleanup_system()
        print("\n👋 Thank you for exploring UPM.Plus!")
    
    async def setup_system(self):
        """Initialize the demo system."""
        print("\n📋 Initializing UPM.Plus Multi-Agent System...")
        
        # Initialize agent types
        initialize_agents()
        
        # Start task executor
        await task_executor.start()
        
        # Create demo agents
        self.agents = {
            "browser": BrowserAgent(name="DemoBrowserAgent"),
            "conversational": ConversationalAgent(name="DemoConversationalAgent"),
            "infrastructure": InfrastructureAgent(name="DemoInfrastructureAgent"),
            "data": DataAgent(name="DemoDataAgent")
        }
        
        # Register agents
        for agent_type, agent in self.agents.items():
            agent_registry.register_agent(agent)
            await task_executor.register_agent(agent)
        
        print(f"✅ System initialized with {len(self.agents)} specialized agents")
        
        # Show system status
        status = await task_executor.get_system_status()
        print(f"📊 System Status: {status['registered_agents']} agents, Task Executor: {'Running' if status['executor_running'] else 'Stopped'}")
    
    async def demo_browser_automation(self):
        """Demonstrate browser automation capabilities."""
        print("\n" + "="*60)
        print("🌐 Browser Automation Demo")
        print("="*60)
        
        print("This demo shows how UPM.Plus can automate web browser tasks using AI.")
        
        # Show available templates
        templates = browser_automation_service.get_available_templates()
        print(f"\n📋 Available Workflow Templates ({len(templates)}):")
        for i, template in enumerate(templates, 1):
            print(f"  {i}. {template['name']}: {template['description']}")
        
        # Create a workflow from description
        print("\n🤖 Creating AI-Generated Workflow...")
        description = "Navigate to example.com, extract the main heading, and take a screenshot"
        
        workflow = await browser_automation_service.create_workflow_from_description(
            description=description,
            target_url="https://example.com"
        )
        
        print(f"✅ Generated workflow '{workflow.name}' with {len(workflow.actions)} actions:")
        for i, action in enumerate(workflow.actions, 1):
            print(f"  {i}. {action.action_type}: {action.selector or action.url or 'N/A'}")
        
        # Validate workflow
        validation = await browser_automation_service.validate_workflow(workflow)
        print(f"\n🔍 Workflow Validation: {'✅ Valid' if validation['valid'] else '❌ Invalid'}")
        if validation['warnings']:
            print(f"⚠️  Warnings: {', '.join(validation['warnings'])}")
        
        print("\n💡 In a real scenario, this workflow would:")
        print("   • Open a headless browser")
        print("   • Navigate to the target website")
        print("   • Use AI to identify page elements")
        print("   • Extract data and capture screenshots")
        print("   • Return structured results")
    
    async def demo_conversational_ai(self):
        """Demonstrate conversational AI capabilities."""
        print("\n" + "="*60)
        print("💬 Conversational AI Demo")
        print("="*60)
        
        print("This demo shows UPM.Plus's conversational AI with knowledge retrieval.")
        
        # Interactive conversation
        print("\n🤖 Starting conversation with AI agent...")
        print("(Type 'exit' to return to main menu)")
        
        session_id = uuid4()
        conversation_count = 0
        
        while conversation_count < 3:  # Limit for demo
            try:
                user_input = input(f"\nYou: ").strip()
                
                if user_input.lower() in ['exit', 'quit']:
                    break
                
                if not user_input:
                    continue
                
                # Create conversational task
                task = Task(
                    type=TaskType.CONVERSATION,
                    name=f"demo_conversation_{conversation_count}",
                    description="Demo conversation",
                    parameters={
                        "task_type": "conversation",
                        "session_id": str(session_id),
                        "message": user_input,
                        "system_prompt": "You are UPM.Plus, an AI assistant that helps with digital automation and orchestration. Be helpful and informative."
                    }
                )
                
                # Execute task
                context = ExecutionContext(session_id=session_id, user_id=uuid4())
                result = await self.agents["conversational"].execute_task(task, context)
                
                if result.status.value == "completed":
                    response = result.result.get("response", "I'm sorry, I couldn't process that.")
                    print(f"🤖 UPM.Plus: {response}")
                    
                    # Show metadata
                    knowledge_sources = result.result.get("knowledge_sources", 0)
                    if knowledge_sources > 0:
                        print(f"   📚 Used {knowledge_sources} knowledge sources")
                else:
                    print(f"❌ Error: {result.error}")
                
                conversation_count += 1
                
            except KeyboardInterrupt:
                break
        
        print(f"\n✅ Conversation demo completed ({conversation_count} exchanges)")
    
    async def demo_infrastructure_automation(self):
        """Demonstrate infrastructure automation capabilities."""
        print("\n" + "="*60)
        print("🏗️ Infrastructure Automation Demo")
        print("="*60)
        
        print("This demo shows how UPM.Plus can generate infrastructure automation code.")
        
        # Create infrastructure task
        print("\n🤖 Generating deployment playbook...")
        
        task = Task(
            type=TaskType.INFRASTRUCTURE,
            name="demo_deployment",
            description="Generate deployment playbook for a web application",
            parameters={
                "task_type": "deploy",
                "target": "production_servers",
                "variables": {
                    "app_name": "upm-plus-webapp",
                    "version": "1.0.0",
                    "environment": "production",
                    "replicas": 3
                }
            }
        )
        
        # Execute task
        context = ExecutionContext(session_id=uuid4())
        result = await self.agents["infrastructure"].execute_task(task, context)
        
        if result.status.value == "completed":
            deployment_info = result.result
            print(f"✅ Generated deployment configuration:")
            print(f"   📁 Deployment ID: {deployment_info.get('deployment_id', 'N/A')}")
            print(f"   📄 Playbook Path: {deployment_info.get('playbook_path', 'N/A')}")
            print(f"   📊 Status: {deployment_info.get('status', 'N/A')}")
            
            print(f"\n💡 Generated Ansible playbook includes:")
            print("   • Server provisioning and configuration")
            print("   • Application deployment and scaling")
            print("   • Load balancer setup")
            print("   • Monitoring and logging configuration")
            print("   • Security hardening measures")
        else:
            print(f"❌ Infrastructure automation failed: {result.error}")
    
    async def demo_data_processing(self):
        """Demonstrate data processing capabilities."""
        print("\n" + "="*60)
        print("📊 Data Processing & Analysis Demo")
        print("="*60)
        
        print("This demo shows UPM.Plus's data analysis and insight generation.")
        
        # Create sample dataset
        sample_data = [
            {"product": "Widget A", "sales": 1200, "region": "North", "month": "Jan"},
            {"product": "Widget B", "sales": 800, "region": "South", "month": "Jan"},
            {"product": "Widget A", "sales": 1350, "region": "North", "month": "Feb"},
            {"product": "Widget B", "sales": 950, "region": "South", "month": "Feb"},
            {"product": "Widget C", "sales": 600, "region": "East", "month": "Jan"},
            {"product": "Widget C", "sales": 750, "region": "East", "month": "Feb"},
        ]
        
        print(f"\n📈 Analyzing sample sales data ({len(sample_data)} records)...")
        
        # Store data in agent cache
        data_agent = self.agents["data"]
        cache_key = f"demo_data_{uuid4().hex[:8]}"
        data_agent.temp_data_cache[cache_key] = sample_data
        
        # Create data analysis task
        task = Task(
            type=TaskType.DATA_PROCESSING,
            name="demo_data_analysis",
            description="Analyze sales data and generate insights",
            parameters={
                "task_type": "analyze",
                "data_key": cache_key,
                "analysis_type": "descriptive"
            }
        )
        
        # Execute task
        context = ExecutionContext(session_id=uuid4())
        result = await data_agent.execute_task(task, context)
        
        if result.status.value == "completed":
            analysis = result.result
            print(f"✅ Data Analysis Complete:")
            print(f"   📊 Analysis ID: {analysis.get('analysis_id', 'N/A')}")
            print(f"   📏 Data Shape: {analysis.get('data_shape', 'N/A')}")
            
            insights = analysis.get('insights', [])
            if insights:
                print(f"\n🔍 AI-Generated Insights:")
                for i, insight in enumerate(insights[:3], 1):
                    print(f"   {i}. {insight}")
            
            print(f"\n💡 Analysis includes:")
            print("   • Statistical summaries and distributions")
            print("   • Correlation analysis between variables")
            print("   • Pattern recognition and anomaly detection")
            print("   • AI-powered insights and recommendations")
        else:
            print(f"❌ Data analysis failed: {result.error}")
    
    async def demo_multi_agent_collaboration(self):
        """Demonstrate multi-agent collaboration."""
        print("\n" + "="*60)
        print("🤝 Multi-Agent Collaboration Demo")
        print("="*60)
        
        print("This demo shows how multiple agents work together on complex tasks.")
        
        # Create collaboration scenario
        objective = "Create a comprehensive digital marketing analysis report"
        print(f"\n🎯 Collaboration Objective: {objective}")
        
        # Get participating agents
        browser_agent = self.agents["browser"]
        conversational_agent = self.agents["conversational"]
        data_agent = self.agents["data"]
        
        print(f"\n👥 Participating Agents:")
        print(f"   🌐 Browser Agent: Web data collection and automation")
        print(f"   💬 Conversational Agent: Analysis and report generation")
        print(f"   📊 Data Agent: Statistical analysis and insights")
        
        # Execute collaboration
        print(f"\n🤖 Starting multi-agent collaboration...")
        
        context = ExecutionContext(session_id=uuid4())
        collaboration_result = await browser_agent.collaborate(
            other_agents=[conversational_agent, data_agent],
            objective=objective,
            context=context
        )
        
        if collaboration_result.success:
            print(f"✅ Collaboration completed successfully!")
            print(f"   🆔 Collaboration ID: {collaboration_result.collaboration_id}")
            print(f"   👥 Participating Agents: {len(collaboration_result.participating_agents)}")
            
            # Show agent contributions
            print(f"\n📋 Agent Contributions:")
            for agent_id, contribution in collaboration_result.agent_contributions.items():
                agent_name = contribution.get("agent_name", "Unknown")
                agent_type = contribution.get("agent_type", "Unknown")
                print(f"   • {agent_name} ({agent_type})")
                
                suggested_actions = contribution.get("suggested_actions", [])
                if suggested_actions:
                    for action in suggested_actions[:2]:
                        print(f"     - {action}")
            
            print(f"\n💡 In a real scenario, this would result in:")
            print("   • Automated web data collection")
            print("   • Statistical analysis of marketing metrics")
            print("   • AI-generated insights and recommendations")
            print("   • Comprehensive report with visualizations")
        else:
            print(f"❌ Collaboration failed: {collaboration_result.error}")
    
    async def demo_complete_workflow(self):
        """Demonstrate a complete end-to-end workflow."""
        print("\n" + "="*60)
        print("🔄 Complete Workflow Orchestration Demo")
        print("="*60)
        
        print("This demo shows a complete workflow spanning multiple agents and tasks.")
        
        workflow_steps = [
            "1. 🌐 Browser Agent: Collect competitor data from websites",
            "2. 📊 Data Agent: Analyze collected data for trends",
            "3. 💬 Conversational Agent: Generate insights and recommendations",
            "4. 🏗️ Infrastructure Agent: Deploy updated marketing dashboard"
        ]
        
        print(f"\n📋 Workflow Steps:")
        for step in workflow_steps:
            print(f"   {step}")
        
        print(f"\n🚀 Executing workflow simulation...")
        
        # Simulate workflow execution
        for i, step in enumerate(workflow_steps, 1):
            print(f"\n⏳ Step {i}: {step.split(': ')[1]}")
            await asyncio.sleep(1)  # Simulate processing time
            
            if i == 1:
                print("   ✅ Collected 150 data points from 5 competitor websites")
            elif i == 2:
                print("   ✅ Identified 3 key trends and 2 market opportunities")
            elif i == 3:
                print("   ✅ Generated 5-page analysis report with recommendations")
            elif i == 4:
                print("   ✅ Deployed updated dashboard to production environment")
        
        print(f"\n🎉 Workflow completed successfully!")
        print(f"   ⏱️  Total execution time: {len(workflow_steps)} steps")
        print(f"   📊 Results: Comprehensive market analysis and deployed dashboard")
        print(f"   🔄 Next: Automated monitoring and periodic updates")
        
        print(f"\n💡 This demonstrates UPM.Plus's ability to:")
        print("   • Orchestrate complex multi-step workflows")
        print("   • Coordinate multiple specialized agents")
        print("   • Handle dependencies and error recovery")
        print("   • Provide real-time progress tracking")
        print("   • Scale from simple tasks to enterprise workflows")
    
    async def cleanup_system(self):
        """Clean up demo resources."""
        print("\n🧹 Cleaning up system resources...")
        
        try:
            await task_executor.stop()
            await browser_automation_service.cleanup()
            print("✅ Cleanup completed")
        except Exception as e:
            print(f"❌ Cleanup error: {e}")


async def main():
    """Main demo execution."""
    demo = UPMPlusDemo()
    await demo.run_demo()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\n👋 Demo interrupted. Goodbye!")
    except Exception as e:
        print(f"\n❌ Demo error: {e}")
        sys.exit(1)
