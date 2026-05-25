"""
OpenHands AI Engine Tool
========================

Connects to the OpenHands AI Engine (Cloudflare Worker) for:
- Test generation
- Code generation  
- Error analysis
- Self-healing suggestions
"""

import os
import httpx
from typing import Optional, Dict, Any
from crewai.tools import BaseTool
from pydantic import Field


class OpenHandsTool(BaseTool):
    """Tool for interacting with OpenHands AI Engine."""
    
    name: str = "OpenHands AI"
    description: str = """
    Use this tool to leverage AI for code and test generation.
    
    Capabilities:
    - generate_test: Generate tests from description
    - generate_connector: Generate API connectors from specs
    - analyze_error: Analyze and explain errors
    - heal_test: Suggest fixes for broken tests
    
    Input format: {"action": "generate_test", "params": {...}}
    """
    
    api_url: str = Field(
        default_factory=lambda: os.getenv(
            "OPENHANDS_API_URL", 
            "https://openhands-ai-engine.workers.dev"
        )
    )
    api_key: Optional[str] = Field(
        default_factory=lambda: os.getenv("OPENHANDS_API_KEY")
    )
    
    def _run(self, action: str, params: Dict[str, Any] = None) -> str:
        """Execute an OpenHands AI action."""
        params = params or {}
        
        endpoints = {
            "generate_test": "/api/qestro/generate-test",
            "generate_connector": "/api/qestro/generate-connector",
            "analyze_error": "/api/pipewarden/analyze-error",
            "heal_test": "/api/qestro/heal-test",
            "optimize_code": "/api/qestro/optimize",
        }
        
        if action not in endpoints:
            return f"Unknown action: {action}. Available: {list(endpoints.keys())}"
        
        endpoint = endpoints[action]
        
        try:
            headers = {"Content-Type": "application/json"}
            if self.api_key:
                headers["Authorization"] = f"Bearer {self.api_key}"
            
            with httpx.Client(timeout=60.0) as client:
                response = client.post(
                    f"{self.api_url}{endpoint}",
                    json=params,
                    headers=headers,
                )
                response.raise_for_status()
                return response.text
                
        except httpx.HTTPError as e:
            return f"OpenHands API error: {str(e)}"
        except Exception as e:
            return f"Error calling OpenHands: {str(e)}"
    
    async def _arun(self, action: str, params: Dict[str, Any] = None) -> str:
        """Async version of the tool."""
        params = params or {}
        
        endpoints = {
            "generate_test": "/api/qestro/generate-test",
            "generate_connector": "/api/qestro/generate-connector",
            "analyze_error": "/api/pipewarden/analyze-error",
            "heal_test": "/api/qestro/heal-test",
        }
        
        if action not in endpoints:
            return f"Unknown action: {action}"
        
        endpoint = endpoints[action]
        
        try:
            headers = {"Content-Type": "application/json"}
            if self.api_key:
                headers["Authorization"] = f"Bearer {self.api_key}"
            
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{self.api_url}{endpoint}",
                    json=params,
                    headers=headers,
                )
                response.raise_for_status()
                return response.text
                
        except httpx.HTTPError as e:
            return f"OpenHands API error: {str(e)}"


class TestGeneratorTool(BaseTool):
    """Specialized tool for generating tests."""
    
    name: str = "Test Generator"
    description: str = """
    Generate comprehensive tests for code.
    
    Input: {
        "description": "What to test",
        "code": "Optional: code to test",
        "platform": "web|mobile|api",
        "framework": "playwright|jest|vitest"
    }
    """
    
    openhands: OpenHandsTool = Field(default_factory=OpenHandsTool)
    
    def _run(self, description: str, code: str = None, 
             platform: str = "web", framework: str = "playwright") -> str:
        """Generate tests."""
        return self.openhands._run("generate_test", {
            "description": description,
            "code": code,
            "platform": platform,
            "framework": framework,
        })


class TestHealerTool(BaseTool):
    """Specialized tool for healing broken tests."""
    
    name: str = "Test Healer"
    description: str = """
    Fix broken tests automatically.
    
    Input: {
        "test_code": "The failing test code",
        "error": "The error message",
        "screenshot": "Optional: base64 screenshot"
    }
    """
    
    openhands: OpenHandsTool = Field(default_factory=OpenHandsTool)
    
    def _run(self, test_code: str, error: str, screenshot: str = None) -> str:
        """Heal a broken test."""
        return self.openhands._run("heal_test", {
            "test_code": test_code,
            "error": error,
            "screenshot": screenshot,
        })
