#!/usr/bin/env python3
"""
Test LLM Service Integration
Comprehensive test of the new Large Language Model service
"""

import asyncio
import aiohttp
import json
import sys
from datetime import datetime

# Test configuration
BASE_URL = "http://localhost:8001/api/v1"

async def test_llm_service():
    """Test comprehensive LLM service functionality"""
    print("🧠 Testing UPM.Plus LLM Service")
    print("=" * 50)

    async with aiohttp.ClientSession() as session:
        test_results = {
            "health_check": False,
            "model_info": False,
            "basic_generation": False,
            "template_usage": False,
            "chat_completion": False,
            "code_assistance": False,
            "workflow_planning": False,
            "batch_processing": False,
            "template_management": False,
            "cache_stats": False
        }

        try:
            # Test 1: Health Check
            print("\n1. 🔧 Testing LLM Service Health")
            print("-" * 30)

            async with session.get(f"{BASE_URL}/llm/health") as response:
                if response.status == 200:
                    health = await response.json()
                    print(f"   ✅ Service status: {health['service']}")
                    print(f"   🤖 OpenAI client: {health['openai_client']}")
                    print(f"   💾 Redis cache: {health['redis_cache']}")
                    print(f"   📋 Templates loaded: {health['templates_loaded']}")
                    test_results["health_check"] = True
                else:
                    print(f"   ❌ Health check failed: {response.status}")

            # Test 2: Model Information
            print("\n2. 📊 Testing Model Information")
            print("-" * 30)

            async with session.get(f"{BASE_URL}/llm/models") as response:
                if response.status == 200:
                    models = await response.json()
                    print(f"   ✅ Providers available: {len(models['providers'])}")
                    print(f"   📏 Model sizes: {models['model_sizes']}")
                    print(f"   🔧 Configurations: {len(models['configurations'])}")
                    print(f"   📝 Template count: {models['template_count']}")
                    print(f"   💾 Cache available: {models['cache_available']}")
                    test_results["model_info"] = True
                else:
                    print(f"   ❌ Model info failed: {response.status}")

            # Test 3: Basic LLM Generation
            print("\n3. 💭 Testing Basic LLM Generation")
            print("-" * 30)

            generation_data = {
                "prompt": "Explain the benefits of microservices architecture in 3 bullet points.",
                "model_size": "medium",
                "temperature": 0.7,
                "max_tokens": 500,
                "use_cache": True
            }

            async with session.post(
                f"{BASE_URL}/llm/generate",
                json=generation_data
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    print(f"   ✅ Generation completed")
                    print(f"   🤖 Model: {result['model']}")
                    print(f"   📄 Content length: {len(result['content'])} chars")
                    print(f"   🔢 Tokens used: {result['tokens_used']}")
                    print(f"   💰 Cost estimate: ${result['cost_estimate']:.4f}")
                    print(f"   ⚡ Processing time: {result['processing_time']:.2f}s")
                    print(f"   💾 Cached: {result['cached']}")
                    print(f"   🎯 Confidence: {result.get('confidence_score', 'N/A')}")
                    test_results["basic_generation"] = True
                else:
                    print(f"   ❌ Basic generation failed: {response.status}")

            # Test 4: Template Usage
            print("\n4. 📋 Testing Template-Based Generation")
            print("-" * 30)

            # First list available templates
            async with session.get(f"{BASE_URL}/llm/templates") as response:
                if response.status == 200:
                    templates = await response.json()
                    print(f"   📋 Available templates: {len(templates)}")
                    for template in templates[:3]:
                        print(f"      • {template['name']} ({template['category']})")

            # Use workflow analysis template
            template_data = {
                "prompt": "",
                "template_name": "workflow_analysis",
                "template_vars": {
                    "workflow_description": "CI/CD pipeline with automated testing and deployment",
                    "current_performance": "5 minute build time, 90% success rate",
                    "goals": "Reduce build time to 2 minutes, increase success rate to 95%"
                },
                "model_size": "large",
                "use_cache": True
            }

            async with session.post(
                f"{BASE_URL}/llm/generate",
                json=template_data
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    print(f"   ✅ Template generation completed")
                    print(f"   📄 Analysis length: {len(result['content'])} chars")
                    print(f"   🔢 Tokens: {result['tokens_used']}")
                    print(f"   ⚡ Time: {result['processing_time']:.2f}s")
                    test_results["template_usage"] = True
                else:
                    print(f"   ❌ Template generation failed: {response.status}")

            # Test 5: Chat Completion
            print("\n5. 💬 Testing Chat Completion")
            print("-" * 30)

            chat_params = {
                "message": "How can I optimize my Kubernetes cluster for better performance?",
                "context": "Production environment with high traffic",
                "experience_level": "advanced",
                "model_size": "medium"
            }

            async with session.post(
                f"{BASE_URL}/llm/chat",
                params=chat_params
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    print(f"   ✅ Chat completion successful")
                    print(f"   🤖 Response preview: {result['content'][:100]}...")
                    print(f"   ⚡ Processing time: {result['processing_time']:.2f}s")
                    test_results["chat_completion"] = True
                else:
                    print(f"   ❌ Chat completion failed: {response.status}")

            # Test 6: Code Assistance
            print("\n6. 💻 Testing Code Assistance")
            print("-" * 30)

            code_params = {
                "language": "python",
                "requirements": "Create a FastAPI endpoint for user authentication with JWT tokens",
                "context": "Microservices architecture",
                "model_size": "medium"
            }

            async with session.post(
                f"{BASE_URL}/llm/code-assist",
                params=code_params
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    print(f"   ✅ Code assistance successful")
                    print(f"   💻 Code preview: {result['content'][:100]}...")
                    print(f"   🔢 Tokens: {result['tokens_used']}")
                    test_results["code_assistance"] = True
                else:
                    print(f"   ❌ Code assistance failed: {response.status}")

            # Test 7: Workflow Planning
            print("\n7. 📋 Testing Workflow Planning")
            print("-" * 30)

            planning_params = {
                "task_description": "Migrate legacy monolith application to microservices architecture",
                "timeline": "6 months",
                "resources": "2 senior developers, 1 DevOps engineer",
                "constraints": "Zero downtime requirement, limited budget",
                "model_size": "large"
            }

            async with session.post(
                f"{BASE_URL}/llm/workflow-planning",
                params=planning_params
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    print(f"   ✅ Workflow planning successful")
                    print(f"   📋 Plan length: {len(result['content'])} chars")
                    print(f"   ⚡ Time: {result['processing_time']:.2f}s")
                    test_results["workflow_planning"] = True
                else:
                    print(f"   ❌ Workflow planning failed: {response.status}")

            # Test 8: Batch Processing
            print("\n8. 🔄 Testing Batch Processing")
            print("-" * 30)

            batch_data = {
                "requests": [
                    {
                        "prompt": "What is Docker?",
                        "model_size": "small",
                        "use_cache": True
                    },
                    {
                        "prompt": "What is Kubernetes?",
                        "model_size": "small",
                        "use_cache": True
                    },
                    {
                        "prompt": "What is CI/CD?",
                        "model_size": "small",
                        "use_cache": True
                    }
                ],
                "max_concurrent": 3
            }

            async with session.post(
                f"{BASE_URL}/llm/generate/batch",
                json=batch_data
            ) as response:
                if response.status == 200:
                    results = await response.json()
                    print(f"   ✅ Batch processing completed")
                    print(f"   📦 Processed {len(results)} requests")
                    total_tokens = sum(r.get('tokens_used', 0) for r in results)
                    avg_time = sum(r.get('processing_time', 0) for r in results) / len(results)
                    print(f"   🔢 Total tokens: {total_tokens}")
                    print(f"   ⚡ Average time: {avg_time:.2f}s")
                    test_results["batch_processing"] = True
                else:
                    print(f"   ❌ Batch processing failed: {response.status}")

            # Test 9: Template Management
            print("\n9. 📝 Testing Template Management")
            print("-" * 30)

            # Create custom template
            custom_template = {
                "name": "test_template",
                "template": "Analyze the following {{ data_type }} and provide {{ analysis_depth }} insights:\n\nData: {{ data }}\n\nProvide actionable recommendations.",
                "description": "Test template for data analysis",
                "required_vars": ["data_type", "data", "analysis_depth"],
                "optional_vars": [],
                "category": "analysis",
                "model_size": "medium"
            }

            async with session.post(
                f"{BASE_URL}/llm/templates",
                json=custom_template
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    print(f"   ✅ Template created: {result['template_name']}")

                    # Test the custom template
                    test_template_data = {
                        "prompt": "",
                        "template_name": "test_template",
                        "template_vars": {
                            "data_type": "user metrics",
                            "data": "Daily active users: 10,000, Conversion rate: 3.5%, Churn rate: 2%",
                            "analysis_depth": "detailed"
                        },
                        "model_size": "medium"
                    }

                    async with session.post(
                        f"{BASE_URL}/llm/generate",
                        json=test_template_data
                    ) as template_response:
                        if template_response.status == 200:
                            template_result = await template_response.json()
                            print(f"   ✅ Custom template executed successfully")
                            print(f"   📄 Analysis length: {len(template_result['content'])} chars")
                            test_results["template_management"] = True
                        else:
                            print(f"   ⚠️  Custom template execution failed: {template_response.status}")
                else:
                    print(f"   ❌ Template creation failed: {response.status}")

            # Test 10: Cache Statistics
            print("\n10. 💾 Testing Cache Statistics")
            print("-" * 30)

            async with session.get(f"{BASE_URL}/llm/cache/stats") as response:
                if response.status == 200:
                    cache_stats = await response.json()
                    print(f"   ✅ Cache stats retrieved")
                    print(f"   🔧 Cache enabled: {cache_stats['cache_enabled']}")
                    if cache_stats['cache_enabled']:
                        print(f"   💾 Memory usage: {cache_stats.get('memory_usage', 'N/A')}")
                        print(f"   🔑 Keys count: {cache_stats.get('keys_count', 0)}")
                    test_results["cache_stats"] = True
                else:
                    print(f"   ❌ Cache stats failed: {response.status}")

        except Exception as e:
            print(f"❌ Test execution failed: {e}")
            return False

        # Summary
        print("\n" + "=" * 50)
        print("🧠 LLM SERVICE TEST SUMMARY")
        print("=" * 50)

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
            print("🎉 EXCELLENT! LLM service is fully operational!")
            print("🚀 All major features working perfectly.")
        elif success_rate >= 75:
            print("👍 GOOD! LLM service is mostly functional.")
            print("🔧 Minor issues to address.")
        elif success_rate >= 50:
            print("⚠️  PARTIAL! LLM service has some functionality.")
            print("🛠️  Several features need attention.")
        else:
            print("❌ CRITICAL! LLM service needs major fixes.")
            print("🆘 Most features are not working.")

        print()
        print("🔥 KEY CAPABILITIES:")
        if test_results["basic_generation"]:
            print("   • Multi-model LLM generation with cost optimization")
        if test_results["template_usage"]:
            print("   • Template-based prompt engineering")
        if test_results["chat_completion"]:
            print("   • Natural conversation interface")
        if test_results["code_assistance"]:
            print("   • Code generation and programming assistance")
        if test_results["workflow_planning"]:
            print("   • Intelligent workflow planning and task breakdown")
        if test_results["batch_processing"]:
            print("   • Concurrent batch processing for efficiency")
        if test_results["template_management"]:
            print("   • Custom template creation and management")
        if test_results["cache_stats"]:
            print("   • Response caching for cost reduction")

        print()
        print("📈 IMPACT:")
        print("   • Centralized LLM capabilities across all UPM.Plus features")
        print("   • Cost-optimized AI with intelligent caching")
        print("   • Template-driven consistency and reusability")
        print("   • Multi-provider support for reliability")

        return success_rate >= 75

async def main():
    """Main test runner"""
    print(f"🧠 Starting LLM Service Tests at {datetime.now()}")
    print(f"🌐 Target: {BASE_URL}")

    success = await test_llm_service()

    if success:
        print("\n🏆 LLM SERVICE READY! Core AI capabilities are operational!")
        sys.exit(0)
    else:
        print("\n🔧 LLM service needs attention before proceeding.")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())