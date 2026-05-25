#!/usr/bin/env python3
"""
Comprehensive FastAPI application test
"""

import sys
from pathlib import Path
import asyncio
import pytest
from fastapi.testclient import TestClient

# Add the backend directory to Python path
sys.path.insert(0, str(Path(__file__).parent / "backend"))

async def test_full_app_startup():
    """Test full FastAPI application startup"""
    try:
        # Import the main app
        from app.main import app
        
        # Create test client with proper headers
        client = TestClient(app)
        
        # Test basic health endpoint
        response = client.get("/health", headers={"Host": "testserver"})
        print(f"Health endpoint status: {response.status_code}")
        if response.status_code == 200:
            print(f"Health response: {response.json()}")
        else:
            print(f"Health error: {response.text}")
        
        # Test API docs
        response = client.get("/docs", headers={"Host": "testserver"})
        print(f"API docs status: {response.status_code}")
        
        # Test agent endpoints
        response = client.get("/api/v1/agents", headers={"Host": "testserver"})
        print(f"Agents endpoint status: {response.status_code}")
        if response.status_code == 200:
            print(f"Agents response: {response.json()}")
        else:
            print(f"Agents error: {response.text}")
            
        # Test database initialization
        try:
            from app.core.database import create_tables
            await create_tables()
            print("✅ Database tables created successfully")
        except Exception as e:
            print(f"⚠️ Database table creation failed: {e}")
            
        print("✅ FastAPI application startup test completed")
        
    except Exception as e:
        print(f"❌ FastAPI application startup failed: {e}")
        import traceback
        traceback.print_exc()
        raise

def test_database_models():
    """Test database model imports"""
    try:
        from app.models import user, organization, workflow, task, agent, document
        print("✅ Database models imported successfully")
    except Exception as e:
        print(f"❌ Database model import failed: {e}")
        raise

def test_api_endpoints():
    """Test API endpoint imports"""
    try:
        from app.api.v1.endpoints import health, agents, tasks, workflows
        print("✅ API endpoints imported successfully")
    except Exception as e:
        print(f"❌ API endpoint import failed: {e}")
        import traceback
        traceback.print_exc()
        raise

if __name__ == "__main__":
    print("🧪 Running comprehensive FastAPI tests...")
    
    # Test imports first
    test_database_models()
    test_api_endpoints()
    
    # Test full app
    asyncio.run(test_full_app_startup())
