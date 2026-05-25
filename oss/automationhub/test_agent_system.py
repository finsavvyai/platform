#!/usr/bin/env python3
"""
Comprehensive test script for UPM.Plus Multi-Agent System

This script tests all major components of the agent system:
- Agent registration and discovery
- Task execution and routing
- Multi-agent collaboration
- Browser automation workflows
- Conversational AI capabilities
- Infrastructure automation
- Data processing and analysis
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
from app.services.llm import llm_service
from app.services.browser_automation import browser_automation_service
from app.core.config import settings

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class AgentSystemTester:
    """Comprehensive test suite for the agent system."""
    
    def __init__(self):
        self.test_results = {
            "agent_registration": False,
            "task_execution": False,
            "browser_automation": False,
            "conversational_ai": False,
            "infrastructure_automation": False,
            "data_processing": False,
            "multi_agent_collaboration": False,
            "system_health": False
        }
        self.agents = {}
    
    async def run_all_tests(self):
        """Run all test suites."""
        logger.info("🚀 Starting UPM.Plus Multi-Agent System Tests")
        
        try:
            # Initialize system
            await self.setup_system()
            
            # Run individual tests
            await self.test_agent_registration()
            await self.test_task_execution()
            await self.test_browser_automation()
            await self.test_conversational_ai()
            await self.test_infrastructure_automation()
            await self.test_data_processing()
            await self.test_multi_agent_collaboration()
            await self.test_system_health()
            
            # Print results
            self.print_test_results()
            
        except Exception as e:
            logger.error(f"Test suite failed: {e}")
            raise
        finally:
            await self.cleanup_system()
    
    async def setup_system(self):
        """Initialize the agent system for testing."""
        logger.info("📋 Setting up agent system...")
        
        # Initialize agent types
        initialize_agents()
        
        # Start task executor
        await task_executor.start()
        
        # Create test agents
        self.agents = {
            "browser": BrowserAgent(),
            "conversational": ConversationalAgent(),
            "infrastructure": InfrastructureAgent(),
            "data": DataAgent()
        }
        
        # Register agents
        for agent_type, agent in self.agents.items():
            agent_registry.register_agent(agent)
            # Add agents to task executor pool
            task_executor.agent_pool[agent.id] = agent
        
        logger.info(f"✅ System setup complete with {len(self.agents)} agents")
    
    async def test_agent_registration(self):
        """Test agent registration and discovery."""
        logger.info("🔍 Testing agent registration and discovery...")
        
        try:
            # Test agent registry
            all_agents = agent_registry.list_agents()
            assert len(all_agents) >= 4, f"Expected at least 4 agents, found {len(all_agents)}"
            
            # Test agent discovery by capability
            browser_agents = agent_registry.list_agents(task_type_filter=TaskType.BROWSER_AUTOMATION)
            assert len(browser_agents) >= 1, "No browser automation agents found"
            
            # Test health checks
            health_results = await agent_registry.health_check_all()
            healthy_count = health_results.get("healthy_agents", 0)
            assert healthy_count >= 4, f"Expected at least 4 healthy agents, found {healthy_count}"
            
            self.test_results["agent_registration"] = True
            logger.info("✅ Agent registration test passed")
            
        except Exception as e:
            logger.error(f"❌ Agent registration test failed: {e}")
            self.test_results["agent_registration"] = False
    
    async def test_task_execution(self):
        """Test basic task execution and routing."""
        logger.info("⚙️ Testing task execution and routing...")
        
        try:
            # Create a simple browser task
            task = Task(
                type=TaskType.BROWSER_AUTOMATION,
                name="test_navigation",
                description="Navigate to example.com and take screenshot",
                parameters={
                    "actions": [
                        {
                            "action_type": "navigate",
                            "url": "https://example.com"
                        },
                        {
                            "action_type": "screenshot",
                            "options": {"type": "png"}
                        }
                    ]
                }
            )
            
            # Submit task
            task_id = await task_executor.submit_task(task)
            logger.info(f"Submitted task {task_id}")
            
            # Wait a bit for processing
            await asyncio.sleep(2)
            
            # Check system status
            status = await task_executor.get_system_status()
            logger.info(f"System status: {status}")
            
            self.test_results["task_execution"] = True
            logger.info("✅ Task execution test passed")
            
        except Exception as e:
            logger.error(f"❌ Task execution test failed: {e}")
            self.test_results["task_execution"] = False
    
    async def test_browser_automation(self):
        """Test browser automation capabilities."""
        logger.info("🌐 Testing browser automation...")
        
        try:
            # Test workflow creation from description
            workflow = await browser_automation_service.create_workflow_from_description(
                description="Navigate to example.com and extract the main heading",
                target_url="https://example.com"
            )
            
            assert workflow is not None, "Failed to create workflow"
            assert len(workflow.actions) > 0, "Workflow has no actions"
            
            # Test workflow validation
            validation = await browser_automation_service.validate_workflow(workflow)
            logger.info(f"Workflow validation: {validation}")
            
            # Test template availability
            templates = browser_automation_service.get_available_templates()
            assert len(templates) >= 3, f"Expected at least 3 templates, found {len(templates)}"
            
            self.test_results["browser_automation"] = True
            logger.info("✅ Browser automation test passed")
            
        except Exception as e:
            logger.error(f"❌ Browser automation test failed: {e}")
            self.test_results["browser_automation"] = False
    
    async def test_conversational_ai(self):
        """Test conversational AI capabilities."""
        logger.info("💬 Testing conversational AI...")
        
        try:
            # Create conversational task
            task = Task(
                type=TaskType.CONVERSATION,
                name="test_conversation",
                description="Test conversational capabilities",
                parameters={
                    "task_type": "conversation",
                    "message": "What is artificial intelligence?",
                    "system_prompt": "You are a helpful AI assistant."
                }
            )
            
            # Execute task directly with agent
            context = ExecutionContext(session_id=uuid4())
            result = await self.agents["conversational"].execute_task(task, context)
            
            assert result.status.value == "completed", f"Task failed: {result.error}"
            assert result.result is not None, "No result returned"
            
            logger.info(f"Conversational result: {result.result}")
            
            self.test_results["conversational_ai"] = True
            logger.info("✅ Conversational AI test passed")
            
        except Exception as e:
            logger.error(f"❌ Conversational AI test failed: {e}")
            self.test_results["conversational_ai"] = False
    
    async def test_infrastructure_automation(self):
        """Test infrastructure automation capabilities."""
        logger.info("🏗️ Testing infrastructure automation...")
        
        try:
            # Create infrastructure task
            task = Task(
                type=TaskType.INFRASTRUCTURE,
                name="test_infrastructure",
                description="Generate a deployment playbook",
                parameters={
                    "task_type": "deploy",
                    "target": "test_server",
                    "variables": {
                        "app_name": "test_app",
                        "version": "1.0.0"
                    }
                }
            )
            
            # Execute task directly with agent
            context = ExecutionContext(session_id=uuid4())
            result = await self.agents["infrastructure"].execute_task(task, context)
            
            assert result.status.value == "completed", f"Task failed: {result.error}"
            assert result.result is not None, "No result returned"
            
            logger.info(f"Infrastructure result: {result.result}")
            
            self.test_results["infrastructure_automation"] = True
            logger.info("✅ Infrastructure automation test passed")
            
        except Exception as e:
            logger.error(f"❌ Infrastructure automation test failed: {e}")
            self.test_results["infrastructure_automation"] = False
    
    async def test_data_processing(self):
        """Test data processing capabilities."""
        logger.info("📊 Testing data processing...")
        
        try:
            # Create sample data
            sample_data = [
                {"name": "Alice", "age": 30, "score": 85},
                {"name": "Bob", "age": 25, "score": 92},
                {"name": "Charlie", "age": 35, "score": 78}
            ]
            
            # Create data processing task
            task = Task(
                type=TaskType.DATA_PROCESSING,
                name="test_data_analysis",
                description="Analyze sample data",
                parameters={
                    "task_type": "analyze",
                    "data": sample_data,
                    "analysis_type": "descriptive"
                }
            )
            
            # Execute task directly with agent
            context = ExecutionContext(session_id=uuid4())
            
            # First, we need to simulate data being in cache
            data_agent = self.agents["data"]
            cache_key = "test_data_123"
            data_agent.temp_data_cache[cache_key] = sample_data
            
            # Update task parameters to use cached data
            task.parameters["data_key"] = cache_key
            
            result = await data_agent.execute_task(task, context)
            
            assert result.status.value == "completed", f"Task failed: {result.error}"
            assert result.result is not None, "No result returned"
            
            logger.info(f"Data processing result: {result.result}")
            
            self.test_results["data_processing"] = True
            logger.info("✅ Data processing test passed")
            
        except Exception as e:
            logger.error(f"❌ Data processing test failed: {e}")
            self.test_results["data_processing"] = False
    
    async def test_multi_agent_collaboration(self):
        """Test multi-agent collaboration."""
        logger.info("🤝 Testing multi-agent collaboration...")
        
        try:
            # Test collaboration between agents
            browser_agent = self.agents["browser"]
            conversational_agent = self.agents["conversational"]
            
            # Create collaboration scenario
            objective = "Create a comprehensive web analysis report"
            context = ExecutionContext(session_id=uuid4())
            
            # Test collaboration
            collaboration_result = await browser_agent.collaborate(
                other_agents=[conversational_agent],
                objective=objective,
                context=context
            )
            
            assert collaboration_result.success, f"Collaboration failed: {collaboration_result.error}"
            assert len(collaboration_result.participating_agents) >= 2, "Not enough participating agents"
            
            logger.info(f"Collaboration result: {collaboration_result.result}")
            
            self.test_results["multi_agent_collaboration"] = True
            logger.info("✅ Multi-agent collaboration test passed")
            
        except Exception as e:
            logger.error(f"❌ Multi-agent collaboration test failed: {e}")
            self.test_results["multi_agent_collaboration"] = False
    
    async def test_system_health(self):
        """Test overall system health and monitoring."""
        logger.info("🏥 Testing system health monitoring...")
        
        try:
            # Test task executor status
            executor_status = await task_executor.get_system_status()
            assert executor_status.get("running", False), "Task executor not running"
            
            # Test agent health
            for agent_type, agent in self.agents.items():
                health = await agent.health_check()
                assert health.get("healthy", False), f"Agent {agent_type} is not healthy"
            
            # Test registry stats
            registry_stats = agent_registry.get_registry_stats()
            assert registry_stats.get("total_agents", 0) >= 4, "Not enough registered agents"
            
            logger.info(f"System health: {executor_status}")
            logger.info(f"Registry stats: {registry_stats}")
            
            self.test_results["system_health"] = True
            logger.info("✅ System health test passed")
            
        except Exception as e:
            logger.error(f"❌ System health test failed: {e}")
            self.test_results["system_health"] = False
    
    def print_test_results(self):
        """Print comprehensive test results."""
        logger.info("\n" + "="*60)
        logger.info("🎯 UPM.Plus Multi-Agent System Test Results")
        logger.info("="*60)
        
        passed_tests = 0
        total_tests = len(self.test_results)
        
        for test_name, passed in self.test_results.items():
            status = "✅ PASS" if passed else "❌ FAIL"
            logger.info(f"{test_name.replace('_', ' ').title():<30} {status}")
            if passed:
                passed_tests += 1
        
        logger.info("="*60)
        logger.info(f"Overall Results: {passed_tests}/{total_tests} tests passed")
        
        if passed_tests == total_tests:
            logger.info("🎉 ALL TESTS PASSED! The multi-agent system is fully functional.")
        else:
            logger.warning(f"⚠️  {total_tests - passed_tests} tests failed. System needs attention.")
        
        logger.info("="*60)
    
    async def cleanup_system(self):
        """Clean up system resources."""
        logger.info("🧹 Cleaning up system resources...")
        
        try:
            # Stop task executor
            await task_executor.stop()
            
            # Cleanup browser automation
            await browser_automation_service.cleanup()
            
            logger.info("✅ System cleanup completed")
            
        except Exception as e:
            logger.error(f"❌ System cleanup failed: {e}")


async def main():
    """Main test execution function."""
    tester = AgentSystemTester()
    await tester.run_all_tests()


if __name__ == "__main__":
    # Check if we have required environment variables
    if not settings.OPENAI_API_KEY:
        logger.warning("⚠️  OPENAI_API_KEY not set. Some tests may fail.")
    
    # Run tests
    asyncio.run(main())
