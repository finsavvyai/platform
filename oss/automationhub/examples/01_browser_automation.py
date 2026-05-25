"""
Browser Automation Examples - Real Working Code
Run: python3.12 examples/01_browser_automation.py
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from app.agents.browser_agent import BrowserAgent
from app.agents.base import Task, TaskType, ExecutionContext
from app.services.browser_automation import browser_automation_service
from uuid import uuid4


async def example_1_basic_navigation():
    """Example 1: Basic navigation and data extraction"""
    print("\n" + "="*60)
    print("Example 1: Basic Navigation & Extraction")
    print("="*60)
    
    agent = BrowserAgent()
    
    task = Task(
        type=TaskType.BROWSER_AUTOMATION,
        name="basic_scraping",
        parameters={
            "actions": [
                {
                    "action_type": "navigate",
                    "url": "https://example.com"
                },
                {
                    "action_type": "extract",
                    "selector": "h1"
                },
                {
                    "action_type": "extract",
                    "selector": "p"
                }
            ]
        }
    )
    
    context = ExecutionContext(session_id=uuid4())
    result = await agent.execute_task(task, context)
    
    print(f"Status: {result.status}")
    print(f"Execution time: {result.duration_ms}ms")
    print(f"Steps executed: {len(result.execution_steps)}")
    
    for i, step in enumerate(result.execution_steps, 1):
        print(f"\nStep {i}: {step.action}")
        if step.result:
            print(f"  Result: {step.result}")
    
    await agent.cleanup()
    return result


async def example_2_form_automation():
    """Example 2: Form filling and submission"""
    print("\n" + "="*60)
    print("Example 2: Form Automation")
    print("="*60)
    
    result = await browser_automation_service.fill_form(
        form_url="https://httpbin.org/forms/post",
        form_data={
            "input[name='custname']": "John Doe",
            "input[name='custtel']": "555-1234",
            "input[name='custemail']": "john@example.com",
            "textarea[name='comments']": "This is an automated test"
        },
        submit_selector="button[type='submit']"
    )
    
    print(f"Success: {result['success']}")
    print(f"Fields filled: {result['fields_filled']}")
    print(f"Execution time: {result['execution_time_ms']}ms")
    print(f"Screenshots captured: {len(result['screenshots'])}")
    
    return result


async def example_3_web_scraping():
    """Example 3: Multi-element web scraping"""
    print("\n" + "="*60)
    print("Example 3: Web Scraping")
    print("="*60)
    
    result = await browser_automation_service.scrape_website(
        url="https://news.ycombinator.com",
        selectors=[
            ".titleline > a",  # Article titles
            ".score",          # Scores
            ".hnuser"          # Authors
        ],
        wait_selector=".itemlist"
    )
    
    print(f"Success: {result['success']}")
    print(f"URL: {result['url']}")
    print(f"Execution time: {result['execution_time_ms']}ms")
    
    if result['data']:
        for key, value in list(result['data'].items())[:3]:  # Show first 3
            print(f"\n{key}:")
            if isinstance(value, list):
                print(f"  Found {len(value)} items")
                print(f"  First 3: {value[:3]}")
            else:
                print(f"  {value}")
    
    return result


async def example_4_screenshot_capture():
    """Example 4: Screenshot capture"""
    print("\n" + "="*60)
    print("Example 4: Screenshot Capture")
    print("="*60)
    
    agent = BrowserAgent()
    
    task = Task(
        type=TaskType.BROWSER_AUTOMATION,
        name="capture_screenshot",
        parameters={
            "actions": [
                {
                    "action_type": "navigate",
                    "url": "https://example.com"
                },
                {
                    "action_type": "screenshot",
                    "options": {
                        "type": "png",
                        "full_page": True
                    }
                }
            ]
        }
    )
    
    context = ExecutionContext(session_id=uuid4())
    result = await agent.execute_task(task, context)
    
    print(f"Status: {result.status}")
    
    # Save screenshot
    for step in result.execution_steps:
        if step.result and isinstance(step.result, dict) and 'screenshot' in step.result:
            import base64
            screenshot_data = step.result['screenshot']
            screenshot_path = Path(__file__).parent / "screenshot_example.png"
            
            with open(screenshot_path, 'wb') as f:
                f.write(base64.b64decode(screenshot_data))
            
            print(f"Screenshot saved to: {screenshot_path}")
            print(f"Screenshot size: {len(screenshot_data)} bytes (base64)")
    
    await agent.cleanup()
    return result


async def example_5_ai_powered_automation():
    """Example 5: AI-generated workflow from natural language"""
    print("\n" + "="*60)
    print("Example 5: AI-Powered Workflow Generation")
    print("="*60)
    
    # AI generates the workflow from description
    workflow = await browser_automation_service.create_workflow_from_description(
        description="Navigate to example.com, find the main heading, extract all paragraphs, and take a screenshot",
        target_url="https://example.com"
    )
    
    print(f"Generated workflow: {workflow.name}")
    print(f"Actions: {len(workflow.actions)}")
    print("\nWorkflow steps:")
    for i, action in enumerate(workflow.actions, 1):
        print(f"  {i}. {action.action_type}")
        if action.url:
            print(f"     URL: {action.url}")
        if action.selector:
            print(f"     Selector: {action.selector}")
    
    # Execute the AI-generated workflow
    context = ExecutionContext(session_id=uuid4())
    result = await browser_automation_service.execute_workflow(workflow, context)
    
    print(f"\nExecution success: {result.success}")
    print(f"Results count: {len(result.results)}")
    print(f"Execution time: {result.execution_time_ms}ms")
    
    await browser_automation_service.cleanup()
    return result


async def example_6_monitoring_workflow():
    """Example 6: Website monitoring (track changes)"""
    print("\n" + "="*60)
    print("Example 6: Website Monitoring")
    print("="*60)
    
    # Start monitoring
    monitor_result = await browser_automation_service.monitor_website_changes(
        url="https://example.com",
        selector="h1",
        check_interval_seconds=300  # Check every 5 minutes
    )
    
    print(f"Monitoring started: {monitor_result['success']}")
    if monitor_result['success']:
        print(f"URL: {monitor_result['url']}")
        print(f"Selector: {monitor_result['selector']}")
        print(f"Initial content: {monitor_result['initial_content']}")
        print(f"Check interval: {monitor_result['check_interval_seconds']}s")
    
    # Simulate checking for changes
    print("\nSimulating change check...")
    check_result = await browser_automation_service.check_website_changes(
        url="https://example.com",
        selector="h1"
    )
    
    if check_result['success']:
        print(f"Has changed: {check_result['has_changed']}")
        print(f"Current content: {check_result['current_content']}")
    
    return check_result


async def example_7_batch_processing():
    """Example 7: Batch process multiple URLs"""
    print("\n" + "="*60)
    print("Example 7: Batch Processing")
    print("="*60)
    
    urls = [
        "https://example.com",
        "https://www.iana.org/domains/reserved",
        "https://httpbin.org/html"
    ]
    
    agent = BrowserAgent()
    results = []
    
    print(f"Processing {len(urls)} URLs...")
    
    for i, url in enumerate(urls, 1):
        print(f"\nProcessing {i}/{len(urls)}: {url}")
        
        task = Task(
            type=TaskType.BROWSER_AUTOMATION,
            name=f"scrape_{i}",
            parameters={
                "actions": [
                    {"action_type": "navigate", "url": url},
                    {"action_type": "extract", "selector": "h1"},
                    {"action_type": "extract", "selector": "title"}
                ]
            }
        )
        
        context = ExecutionContext(session_id=uuid4())
        result = await agent.execute_task(task, context)
        results.append({
            "url": url,
            "status": result.status.value,
            "duration_ms": result.duration_ms
        })
        
        print(f"  Status: {result.status.value}")
        print(f"  Time: {result.duration_ms}ms")
    
    print(f"\nBatch complete!")
    print(f"Total URLs processed: {len(results)}")
    print(f"Success rate: {sum(1 for r in results if r['status'] == 'completed')}/{len(results)}")
    
    await agent.cleanup()
    return results


async def example_8_advanced_workflow():
    """Example 8: Advanced workflow with conditionals"""
    print("\n" + "="*60)
    print("Example 8: Advanced Multi-Step Workflow")
    print("="*60)
    
    from app.services.browser_automation import BrowserWorkflow, BrowserAction
    
    # Create complex workflow
    workflow = BrowserWorkflow(
        name="advanced_workflow",
        description="Navigate, extract, validate, and report",
        actions=[
            BrowserAction(
                action_type="navigate",
                url="https://example.com"
            ),
            BrowserAction(
                action_type="wait",
                selector="body",
                timeout=5000
            ),
            BrowserAction(
                action_type="extract",
                selector="h1"
            ),
            BrowserAction(
                action_type="extract_all",
                selector="p",
                options={}
            ),
            BrowserAction(
                action_type="evaluate",
                options={
                    "script": "document.querySelectorAll('a').length"
                }
            ),
            BrowserAction(
                action_type="screenshot",
                options={"type": "png", "full_page": True}
            )
        ]
    )
    
    print(f"Workflow: {workflow.name}")
    print(f"Steps: {len(workflow.actions)}")
    
    context = ExecutionContext(session_id=uuid4())
    result = await browser_automation_service.execute_workflow(workflow, context)
    
    print(f"\nExecution success: {result.success}")
    print(f"Steps completed: {len(result.results)}")
    print(f"Time: {result.execution_time_ms}ms")
    
    print("\nResults:")
    for i, step_result in enumerate(result.results, 1):
        if step_result:
            print(f"  Step {i}: {step_result}")
    
    await browser_automation_service.cleanup()
    return result


async def main():
    """Run all browser automation examples"""
    print("\n" + "🤖" + "="*58 + "🤖")
    print("  UPM.Plus Browser Automation - Complete Examples")
    print("🤖" + "="*58 + "🤖\n")
    
    examples = [
        ("Basic Navigation", example_1_basic_navigation),
        ("Form Automation", example_2_form_automation),
        ("Web Scraping", example_3_web_scraping),
        ("Screenshot Capture", example_4_screenshot_capture),
        ("AI-Powered Automation", example_5_ai_powered_automation),
        ("Website Monitoring", example_6_monitoring_workflow),
        ("Batch Processing", example_7_batch_processing),
        ("Advanced Workflow", example_8_advanced_workflow),
    ]
    
    results = {}
    
    for name, example_func in examples:
        try:
            print(f"\n{'='*60}")
            print(f"Running: {name}")
            print(f"{'='*60}")
            result = await example_func()
            results[name] = {"success": True, "result": result}
            print(f"✅ {name} completed successfully")
        except Exception as e:
            results[name] = {"success": False, "error": str(e)}
            print(f"❌ {name} failed: {e}")
    
    # Summary
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    
    successful = sum(1 for r in results.values() if r["success"])
    total = len(results)
    
    print(f"\nCompleted: {successful}/{total} examples")
    print("\nResults:")
    for name, result in results.items():
        status = "✅" if result["success"] else "❌"
        print(f"  {status} {name}")
    
    print("\n" + "="*60)
    print("All browser automation examples completed!")
    print("="*60 + "\n")


if __name__ == "__main__":
    asyncio.run(main())
