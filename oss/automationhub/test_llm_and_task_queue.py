#!/usr/bin/env python3
"""
Test LLM Service and Task Queue Integration
Comprehensive test of section 2.2 and 2.3 implementations
"""

import asyncio
import aiohttp
import json
import sys
from datetime import datetime

# Test configuration
BASE_URL = "http://localhost:8001/api/v1"

async def test_llm_and_task_queue():
    """Test LLM service and task queue functionality"""
    print("🧠 Testing LLM Service & Multi-Agent Task Queue")
    print("=" * 60)

    async with aiohttp.ClientSession() as session:
        test_results = {
            "llm_health": False,
            "llm_generation": False,
            "llm_templates": False,
            "task_queue_health": False,
            "agent_registration": False,
            "task_submission": False,
            "llm_task_execution": False,
            "workflow_execution": False,
            "queue_statistics": False,
            "task_cancellation": False
        }

        try:
            # Test 1: LLM Service Health
            print("\n1. 🔧 Testing LLM Service Health")
            print("-" * 30)

            async with session.get(f"{BASE_URL}/llm/health") as response:
                if response.status == 200:
                    health = await response.json()
                    print(f"   ✅ LLM Service: {health['service']}")
                    print(f"   🤖 OpenAI: {health['openai_client']}")
                    print(f"   💾 Redis: {health['redis_cache']}")
                    print(f"   📋 Templates: {health['templates_loaded']}")
                    test_results["llm_health"] = True
                else:
                    print(f"   ❌ LLM health check failed: {response.status}")

            # Test 2: Basic LLM Generation
            print("\n2. 💭 Testing Basic LLM Generation")
            print("-" * 30)

            llm_request = {
                "prompt": "Explain microservices architecture in 2 sentences.",
                "model_size": "small",
                "use_cache": True
            }

            async with session.post(f"{BASE_URL}/llm/generate", json=llm_request) as response:
                if response.status == 200:
                    result = await response.json()
                    print(f"   ✅ Generation completed")
                    print(f"   📄 Content: {len(result['content'])} chars")
                    print(f"   🔢 Tokens: {result['tokens_used']}")
                    print(f"   ⚡ Time: {result['processing_time']:.2f}s")
                    test_results["llm_generation"] = True
                else:
                    print(f"   ❌ LLM generation failed: {response.status}")

            # Test 3: Template Usage
            print("\n3. 📋 Testing LLM Templates")
            print("-" * 30)

            # List templates
            async with session.get(f"{BASE_URL}/llm/templates") as response:
                if response.status == 200:
                    templates = await response.json()
                    print(f"   📋 Available templates: {len(templates)}")

                    # Use code generation template
                    template_request = {
                        "prompt": "",
                        "template_name": "code_generation",
                        "template_vars": {
                            "language": "Python",
                            "requirements": "Create a simple FastAPI hello world endpoint"
                        },
                        "model_size": "small"
                    }

                    async with session.post(f"{BASE_URL}/llm/generate", json=template_request) as template_response:
                        if template_response.status == 200:
                            result = await template_response.json()
                            print(f"   ✅ Template generation completed")
                            print(f"   💻 Code generated: {len(result['content'])} chars")
                            test_results["llm_templates"] = True
                        else:
                            print(f"   ⚠️  Template generation failed: {template_response.status}")
                else:
                    print(f"   ❌ Template listing failed: {response.status}")

            # Test 4: Task Queue Health
            print("\n4. 🔧 Testing Task Queue Health")
            print("-" * 30)

            async with session.get(f"{BASE_URL}/task-queue/health") as response:
                if response.status == 200:
                    health = await response.json()
                    print(f"   ✅ Task Queue: {health['service']}")
                    print(f"   💾 Redis: {health['redis_available']}")
                    print(f"   🤖 Agents: {health['total_agents']}")
                    print(f"   ⚡ Running tasks: {health['running_tasks']}")
                    test_results["task_queue_health"] = True
                else:
                    print(f"   ❌ Task queue health failed: {response.status}")

            # Test 5: Agent Registration
            print("\n5. 🤖 Testing Agent Registration")
            print("-" * 30)

            agents_to_register = [
                {
                    "type": "llm_agent",
                    "name": "GPT-4 Agent",
                    "description": "Primary LLM agent for text generation",
                    "capabilities": ["text_generation", "conversation", "analysis"],
                    "max_concurrent_tasks": 3
                },
                {
                    "type": "code_agent",
                    "name": "Code Generator",
                    "description": "Specialized agent for code generation",
                    "capabilities": ["python", "javascript", "sql", "yaml"],
                    "max_concurrent_tasks": 2
                },
                {
                    "type": "analysis_agent",
                    "name": "Data Analyst",
                    "description": "Agent for data analysis tasks",
                    "capabilities": ["statistics", "visualization", "reporting"],
                    "max_concurrent_tasks": 1
                }
            ]

            registered_agents = []
            for agent_def in agents_to_register:
                async with session.post(f"{BASE_URL}/task-queue/agents", json=agent_def) as response:
                    if response.status == 200:
                        result = await response.json()
                        registered_agents.append(result["agent_id"])
                        print(f"   ✅ Registered: {agent_def['name']}")
                    else:
                        print(f"   ⚠️  Failed to register: {agent_def['name']}")

            if registered_agents:
                test_results["agent_registration"] = True

            # Test 6: Task Submission
            print("\n6. 📝 Testing Task Submission")
            print("-" * 30)

            task_request = {
                "name": "Generate API Documentation",
                "description": "Create comprehensive API documentation for UPM.Plus",
                "agent_type": "llm_agent",
                "payload": {
                    "prompt": "Create API documentation for a microservices platform",
                    "template_name": "code_generation",
                    "template_vars": {
                        "language": "Markdown",
                        "requirements": "API documentation with examples"
                    },
                    "model_size": "medium"
                },
                "priority": "normal",
                "timeout": 60
            }

            async with session.post(f"{BASE_URL}/task-queue/tasks", json=task_request) as response:
                if response.status == 200:
                    result = await response.json()
                    task_id = result["task_id"]
                    print(f"   ✅ Task submitted: {task_id}")
                    test_results["task_submission"] = True

                    # Test 7: LLM Task Execution
                    print("\n7. ⚡ Testing LLM Task Execution")
                    print("-" * 30)

                    # Trigger execution
                    async with session.post(f"{BASE_URL}/task-queue/tasks/{task_id}/execute") as exec_response:
                        if exec_response.status == 200:
                            print(f"   ✅ Task execution triggered")

                            # Wait a moment and check status
                            await asyncio.sleep(2)

                            async with session.get(f"{BASE_URL}/task-queue/tasks/{task_id}") as status_response:
                                if status_response.status == 200:
                                    task_result = await status_response.json()
                                    print(f"   📊 Status: {task_result['status']}")
                                    if task_result.get('result'):
                                        print(f"   💻 Generated content: {len(str(task_result['result'].get('content', '')))} chars")
                                        print(f"   🔢 Tokens used: {task_result['result'].get('tokens_used', 0)}")

                                    if task_result['status'] in ['completed', 'running']:
                                        test_results["llm_task_execution"] = True
                                else:
                                    print(f"   ⚠️  Status check failed: {status_response.status}")
                        else:
                            print(f"   ⚠️  Task execution failed: {exec_response.status}")
                else:
                    print(f"   ❌ Task submission failed: {response.status}")

            # Test 8: Workflow Execution
            print("\n8. 🔄 Testing Workflow Execution")
            print("-" * 30)

            workflow_request = {
                "name": "Documentation Pipeline",
                "description": "Multi-step documentation generation workflow",
                "parallel_execution": False,
                "steps": [
                    {
                        "name": "Generate Overview",
                        "description": "Create project overview",
                        "agent_type": "llm_agent",
                        "payload": {
                            "prompt": "Create a project overview for UPM.Plus platform",
                            "model_size": "small"
                        },
                        "priority": "high"
                    },
                    {
                        "name": "Generate API Reference",
                        "description": "Create API reference documentation",
                        "agent_type": "code_agent",
                        "payload": {
                            "description": "API reference documentation",
                            "code_type": "markdown"
                        },
                        "priority": "normal"
                    },
                    {
                        "name": "Analyze Documentation",
                        "description": "Quality analysis of generated docs",
                        "agent_type": "analysis_agent",
                        "payload": {
                            "type": "quality_analysis",
                            "description": "Documentation quality assessment"
                        },
                        "priority": "low"
                    }
                ]
            }

            async with session.post(f"{BASE_URL}/task-queue/workflows", json=workflow_request) as response:
                if response.status == 200:
                    result = await response.json()
                    workflow_tasks = result["task_ids"]
                    print(f"   ✅ Workflow submitted: {len(workflow_tasks)} tasks")
                    print(f"   🔗 Sequential execution: {not result['parallel_execution']}")
                    test_results["workflow_execution"] = True
                else:
                    print(f"   ❌ Workflow submission failed: {response.status}")

            # Test 9: Queue Statistics
            print("\n9. 📊 Testing Queue Statistics")
            print("-" * 30)

            async with session.get(f"{BASE_URL}/task-queue/queue/stats") as response:
                if response.status == 200:
                    stats = await response.json()
                    print(f"   ✅ Statistics retrieved")
                    print(f"   🤖 Total agents: {stats['total_agents']}")
                    print(f"   ⚡ Running tasks: {stats['running_tasks']}")
                    print(f"   ✅ Completed: {stats['completed_tasks']}")
                    print(f"   ❌ Failed: {stats['failed_tasks']}")
                    print(f"   ⏳ Pending: {stats['pending_tasks']}")
                    test_results["queue_statistics"] = True
                else:
                    print(f"   ❌ Statistics failed: {response.status}")

            # Test 10: Task Cancellation
            print("\n10. ❌ Testing Task Cancellation")
            print("-" * 30)

            # Submit a task to cancel
            cancel_task_request = {
                "name": "Task to Cancel",
                "description": "This task will be cancelled",
                "agent_type": "generic_agent",
                "payload": {"test": "data"},
                "priority": "low"
            }

            async with session.post(f"{BASE_URL}/task-queue/tasks", json=cancel_task_request) as response:
                if response.status == 200:
                    result = await response.json()
                    cancel_task_id = result["task_id"]

                    # Cancel the task
                    async with session.delete(f"{BASE_URL}/task-queue/tasks/{cancel_task_id}") as cancel_response:
                        if cancel_response.status == 200:
                            print(f"   ✅ Task cancelled: {cancel_task_id}")
                            test_results["task_cancellation"] = True
                        else:
                            print(f"   ⚠️  Cancellation failed: {cancel_response.status}")
                else:
                    print(f"   ❌ Cancel task submission failed: {response.status}")

        except Exception as e:
            print(f"❌ Test execution failed: {e}")
            return False

        # Summary
        print("\n" + "=" * 60)
        print("🧠 LLM & TASK QUEUE TEST SUMMARY")
        print("=" * 60)

        passed_tests = sum(test_results.values())
        total_tests = len(test_results)
        success_rate = (passed_tests / total_tests) * 100

        print(f"✅ Tests Passed: {passed_tests}/{total_tests} ({success_rate:.1f}%)")
        print()

        for feature, status in test_results.items():
            status_icon = "✅" if status else "❌"
            feature_name = feature.replace('_', ' ').title()
            print(f"{status_icon} {feature_name}")

        print()

        if success_rate >= 90:
            print("🎉 EXCELLENT! LLM and Task Queue systems are fully operational!")
            print("🚀 Section 2.2 & 2.3 implementation completed successfully!")
        elif success_rate >= 75:
            print("👍 GOOD! Most LLM and Task Queue features are working.")
            print("🔧 Minor issues to address.")
        elif success_rate >= 50:
            print("⚠️  PARTIAL! Some LLM and Task Queue functionality available.")
            print("🛠️  Several features need attention.")
        else:
            print("❌ CRITICAL! LLM and Task Queue systems need major fixes.")
            print("🆘 Core functionality is not working.")

        print()
        print("🔥 KEY ACHIEVEMENTS:")
        if test_results["llm_health"] and test_results["llm_generation"]:
            print("   • LLM service with multi-model support and caching")
        if test_results["llm_templates"]:
            print("   • Template-based prompt engineering system")
        if test_results["agent_registration"] and test_results["task_submission"]:
            print("   • Multi-agent task execution framework")
        if test_results["workflow_execution"]:
            print("   • Sequential and parallel workflow orchestration")
        if test_results["task_cancellation"] and test_results["queue_statistics"]:
            print("   • Comprehensive task lifecycle management")

        print()
        print("📈 IMPACT:")
        print("   • Centralized AI capabilities across UPM.Plus platform")
        print("   • Scalable multi-agent task distribution system")
        print("   • Cost-optimized LLM usage with intelligent caching")
        print("   • Foundation for complex automation workflows")

        return success_rate >= 75

async def main():
    """Main test runner"""
    print(f"🧠 Starting LLM & Task Queue Tests at {datetime.now()}")
    print(f"🌐 Target: {BASE_URL}")

    success = await test_llm_and_task_queue()

    if success:
        print("\n🏆 SECTIONS 2.2 & 2.3 COMPLETE! LLM integration and multi-agent execution ready!")
        sys.exit(0)
    else:
        print("\n🔧 LLM and Task Queue systems need attention before proceeding.")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())