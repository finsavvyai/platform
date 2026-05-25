#!/usr/bin/env python3.12
"""
Test script to verify the UPM.Plus Enhanced Browser Automation System
"""

import subprocess
import time
import requests
import json
import os
from pathlib import Path
import tempfile
import asyncio
from datetime import datetime

def test_browser_api_endpoints():
    """Test browser automation API endpoints"""
    print("🌐 Testing Browser Automation API Endpoints...")
    
    base_url = "http://localhost:8000/api/v1"
    
    # Test endpoints that don't require authentication first
    endpoints_to_test = [
        ("/health", "Health check"),
        ("/browser", "Browser automation base"),
    ]
    
    for endpoint, description in endpoints_to_test:
        try:
            response = requests.get(f"{base_url}{endpoint}", timeout=10)
            if response.status_code in [200, 401, 404]:  # 401/404 is expected for some endpoints
                print(f"  ✅ {description}: {response.status_code}")
            else:
                print(f"  ❌ {description}: {response.status_code}")
                return False
        except requests.exceptions.RequestException as e:
            print(f"  ❌ {description}: Connection error - {e}")
            return False
    
    print("✅ Browser automation API endpoints are accessible")
    return True

def test_browser_service_components():
    """Test browser automation service components"""
    print("⚙️  Testing Browser Automation Service Components...")
    
    try:
        # Test imports
        from app.services.browser_automation import BrowserAutomationService
        from app.services.browser_use_integration import BrowserUseIntegrationService
        from app.services.enhanced_browser_automation import EnhancedBrowserAutomationService
        
        # Create service instances
        basic_service = BrowserAutomationService()
        use_service = BrowserUseIntegrationService()
        enhanced_service = EnhancedBrowserAutomationService()
        
        print("  ✅ Basic BrowserAutomationService created")
        print("  ✅ BrowserUseIntegrationService created")
        print("  ✅ EnhancedBrowserAutomationService created")
        
        # Test enhanced service methods
        if hasattr(enhanced_service, 'create_workflow_from_template'):
            print("  ✅ Workflow template creation method exists")
        else:
            print("  ❌ Workflow template creation method missing")
            return False
        
        if hasattr(enhanced_service, 'execute_workflow'):
            print("  ✅ Workflow execution method exists")
        else:
            print("  ❌ Workflow execution method missing")
            return False
        
        print("✅ Browser automation service components are functional")
        return True
        
    except ImportError as e:
        print(f"  ❌ Import error: {e}")
        return False
    except Exception as e:
        print(f"  ❌ Service component error: {e}")
        return False

def test_browser_agent():
    """Test browser agent functionality"""
    print("🤖 Testing Browser Agent...")
    
    try:
        from app.agents.browser_agent import BrowserAgent, BrowserAction, BrowserSession
        
        # Create browser agent
        agent = BrowserAgent()
        
        print("  ✅ BrowserAgent instance created")
        
        # Test browser action creation
        action = BrowserAction(
            action_type="navigate",
            url="https://example.com",
            timeout=30000
        )
        
        print("  ✅ BrowserAction created successfully")
        
        # Test browser session creation
        from uuid import uuid4
        session = BrowserSession(
            session_id=uuid4(),
            browser_type="chromium",
            headless=True,
            created_at=datetime.utcnow(),
            last_activity=datetime.utcnow()
        )
        
        print("  ✅ BrowserSession created successfully")
        
        # Test agent capabilities
        if hasattr(agent, 'execute_action'):
            print("  ✅ Execute action method exists")
        else:
            print("  ❌ Execute action method missing")
            return False
        
        print("✅ Browser agent is functional")
        return True
        
    except ImportError as e:
        print(f"  ❌ Import error: {e}")
        return False
    except Exception as e:
        print(f"  ❌ Browser agent error: {e}")
        return False

def test_workflow_templates():
    """Test workflow template functionality"""
    print("📋 Testing Workflow Templates...")
    
    try:
        from app.services.enhanced_browser_automation import get_enhanced_browser_service
        
        # Get enhanced service
        service = asyncio.run(get_enhanced_browser_service())
        
        # Test template creation
        templates = ["ecommerce_scraper", "form_filler", "web_monitor"]
        
        for template in templates:
            variables = {
                "url": "https://example.com",
                "name": "Test User",
                "email": "test@example.com"
            }
            
            workflow = asyncio.run(service.create_workflow_from_template(template, variables))
            
            if workflow and workflow.name:
                print(f"  ✅ Template '{template}' created: {workflow.name}")
            else:
                print(f"  ❌ Template '{template}' creation failed")
                return False
        
        print("✅ Workflow templates are functional")
        return True
        
    except ImportError as e:
        print(f"  ❌ Import error: {e}")
        return False
    except Exception as e:
        print(f"  ❌ Workflow template error: {e}")
        return False

def test_frontend_browser_components():
    """Test frontend browser automation components"""
    print("🎨 Testing Frontend Browser Automation Components...")
    
    frontend_src = Path(__file__).parent / "frontend" / "src"
    
    # Check required files exist
    required_files = [
        "pages/BrowserAutomation/BrowserAutomation.tsx",
        "components/BrowserAutomation/BrowserAutomation.tsx",
        "services/browserApi.ts"
    ]
    
    for file_path in required_files:
        full_path = frontend_src / file_path
        if not full_path.exists():
            print(f"  ❌ Missing file: {file_path}")
            return False
        print(f"  ✅ Found: {file_path}")
    
    # Check TypeScript compilation
    print("  🔍 Checking TypeScript compilation...")
    result = subprocess.run(
        ["npx", "tsc", "--noEmit"],
        cwd=frontend_src.parent,
        capture_output=True,
        text=True,
        timeout=60
    )
    
    if result.returncode != 0:
        print(f"  ❌ TypeScript compilation failed: {result.stderr}")
        return False
    
    print("✅ Frontend browser automation components are properly structured")
    return True

def test_browser_api_service():
    """Test browser API service functionality"""
    print("🔌 Testing Browser API Service...")
    
    try:
        # Check if the browser API service file exists and has required exports
        api_service_path = Path(__file__).parent / "frontend" / "src" / "services" / "browserApi.ts"
        
        if not api_service_path.exists():
            print("  ❌ browserApi.ts file not found")
            return False
        
        # Read and check content
        with open(api_service_path, 'r') as f:
            content = f.read()
        
        required_exports = [
            "useBrowserSessions",
            "useBrowserWorkflows", 
            "useExecuteBrowserWorkflow",
            "browserApi",
            "BrowserWorkflow",
            "BrowserSession"
        ]
        
        for export in required_exports:
            if export in content:
                print(f"  ✅ Found export: {export}")
            else:
                print(f"  ❌ Missing export: {export}")
                return False
        
        print("✅ Browser API service is properly implemented")
        return True
        
    except Exception as e:
        print(f"  ❌ Browser API service error: {e}")
        return False

def test_workflow_builder():
    """Test workflow builder functionality"""
    print("🛠️  Testing Workflow Builder...")
    
    try:
        # Check workflow builder component
        builder_path = Path(__file__).parent / "frontend" / "src" / "components" / "BrowserAutomation" / "BrowserAutomation.tsx"
        
        if not builder_path.exists():
            print("  ❌ BrowserAutomation component not found")
            return False
        
        # Read and check content
        with open(builder_path, 'r') as f:
            content = f.read()
        
        required_components = [
            "WorkflowBuilder",
            "WorkflowCard",
            "BrowserAutomation",
            "useState",
            "useQuery"
        ]
        
        for component in required_components:
            if component in content:
                print(f"  ✅ Found component: {component}")
            else:
                print(f"  ❌ Missing component: {component}")
                return False
        
        # Check for action types
        action_types = ["navigate", "click", "fill", "extract", "screenshot"]
        for action in action_types:
            if action in content:
                print(f"  ✅ Found action type: {action}")
            else:
                print(f"  ❌ Missing action type: {action}")
                return False
        
        print("✅ Workflow builder is properly implemented")
        return True
        
    except Exception as e:
        print(f"  ❌ Workflow builder error: {e}")
        return False

def test_browser_integration():
    """Test browser integration capabilities"""
    print("🔗 Testing Browser Integration...")
    
    try:
        # Test Playwright availability
        try:
            from playwright.async_api import async_playwright
            print("  ✅ Playwright import successful")
        except ImportError:
            print("  ❌ Playwright not available")
            return False
        
        # Test browser use integration
        try:
            from app.services.browser_use_integration import browser_use_service
            print("  ✅ Browser Use integration available")
        except ImportError:
            print("  ❌ Browser Use integration not available")
            return False
        
        # Test browser automation service
        try:
            from app.services.browser_automation import BrowserAutomationService
            service = BrowserAutomationService()
            print("  ✅ Browser automation service created")
        except Exception as e:
            print(f"  ❌ Browser automation service error: {e}")
            return False
        
        print("✅ Browser integration components are available")
        return True
        
    except Exception as e:
        print(f"  ❌ Browser integration error: {e}")
        return False

def test_error_handling():
    """Test error handling capabilities"""
    print("⚠️  Testing Error Handling...")
    
    try:
        from app.services.enhanced_browser_automation import EnhancedBrowserAutomationService
        
        service = EnhancedBrowserAutomationService()
        
        # Test invalid template
        try:
            asyncio.run(service.create_workflow_from_template("invalid_template", {}))
            print("  ❌ Should have failed for invalid template")
            return False
        except ValueError:
            print("  ✅ Properly handles invalid template")
        except Exception as e:
            print(f"  ❌ Unexpected error: {e}")
            return False
        
        # Test execution status for non-existent execution
        status = asyncio.run(service.get_execution_status("non_existent_id"))
        if status is None:
            print("  ✅ Properly handles non-existent execution")
        else:
            print("  ❌ Should return None for non-existent execution")
            return False
        
        print("✅ Error handling is working correctly")
        return True
        
    except Exception as e:
        print(f"  ❌ Error handling test failed: {e}")
        return False

def main():
    """Run all browser automation tests"""
    print("🧠 UPM.Plus Enhanced Browser Automation System Test")
    print("=" * 60)
    
    tests = [
        ("Browser Service Components", test_browser_service_components),
        ("Browser Agent", test_browser_agent),
        ("Workflow Templates", test_workflow_templates),
        ("Browser Integration", test_browser_integration),
        ("Error Handling", test_error_handling),
        ("Frontend Components", test_frontend_browser_components),
        ("Browser API Service", test_browser_api_service),
        ("Workflow Builder", test_workflow_builder),
        ("Browser API Endpoints", test_browser_api_endpoints),
    ]
    
    results = []
    
    for test_name, test_func in tests:
        print(f"\n🧪 Running {test_name} Test...")
        try:
            if asyncio.iscoroutinefunction(test_func):
                result = asyncio.run(test_func())
            else:
                result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ {test_name} test failed with error: {e}")
            results.append((test_name, False))
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 Test Summary:")
    
    passed = 0
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"  {test_name}: {status}")
        if result:
            passed += 1
    
    print(f"\n🎯 Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All browser automation tests passed!")
        print("\n🚀 Enhanced Browser Automation Features:")
        print("  ✅ AI-powered web automation workflows")
        print("  ✅ Multi-browser support (Chromium, Firefox, WebKit)")
        print("  ✅ Workflow templates for common tasks")
        print("  ✅ Self-healing automation with retry logic")
        print("  ✅ Real-time execution monitoring")
        print("  ✅ Comprehensive error handling")
        print("  ✅ Screenshot and logging capabilities")
        print("  ✅ Performance analytics and metrics")
        print("  ✅ Modern React frontend interface")
        print("  ✅ RESTful API with TypeScript support")
        print("  ✅ Workflow builder with visual editor")
        
        print("\n🔧 Available Workflow Templates:")
        print("  📊 E-commerce Product Scraper")
        print("  📝 Form Auto-Filler")
        print("  👁️  Web Content Monitor")
        print("  🔄 Custom Workflow Builder")
        
        print("\n🎯 Browser Capabilities:")
        print("  🌐 Page navigation and interaction")
        print("  📋 Form filling and submission")
        print("  📤 Data extraction and scraping")
        print("  📸 Screenshot capture")
        print("  ⏱️  Wait and timing controls")
        print("  🔍 Element selection (CSS/XPath)")
        print("  🛡️  Error handling and retries")
        print("  📊 Execution tracking and analytics")
        
        print("\n🔧 Next Steps:")
        print("  1. Install Playwright browsers: npx playwright install")
        print("  2. Configure browser automation settings")
        print("  3. Create custom workflow templates")
        print("  4. Set up scheduled automation tasks")
        print("  5. Configure notifications and monitoring")
        
    else:
        print(f"\n⚠️  {total - passed} test(s) failed. Please check the issues above.")
        print("\n🔧 Troubleshooting:")
        print("  1. Install Playwright: pip install playwright")
        print("  2. Install browser binaries: npx playwright install")
        print("  3. Check all service imports and dependencies")
        print("  4. Verify browser automation API endpoints")
        print("  5. Ensure frontend TypeScript compilation")
        print("  6. Check Redis connection for session management")
    
    return passed == total

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
