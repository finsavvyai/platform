#!/usr/bin/env python3
"""
Direct API test without middleware interference
"""

import sys
from pathlib import Path
import asyncio

# Add the backend directory to Python path
sys.path.insert(0, str(Path(__file__).parent / "backend"))

async def test_direct_endpoints():
    """Test API endpoints directly without middleware"""
    try:
        # Import and test health endpoint function directly
        from app.main import health_check
        
        print("Testing health endpoint directly...")
        try:
            health_result = await health_check()
            print(f"✅ Health check result: {health_result}")
        except Exception as e:
            print(f"❌ Health check failed: {e}")
        
        # Test agent endpoints
        try:
            from app.api.v1.endpoints.agents import get_agents
            from app.core.database import get_db_session
            
            print("Testing agents endpoint directly...")
            async with get_db_session() as db:
                agents_result = await get_agents(db=db)
                print(f"✅ Agents result: {agents_result}")
        except Exception as e:
            print(f"❌ Agents endpoint failed: {e}")
        
        # Test authentication system
        try:
            from app.api.v1.endpoints.auth import register
            from app.schemas.auth import UserCreate
            from app.core.database import get_db_session
            
            print("Testing user registration directly...")
            user_data = UserCreate(
                email="test@example.com",
                password="testpassword123",
                full_name="Test User"
            )
            
            async with get_db_session() as db:
                user_result = await register(user_data=user_data, db=db)
                print(f"✅ User registration result: {user_result}")
        except Exception as e:
            print(f"❌ User registration failed: {e}")
            
        print("✅ Direct API tests completed")
        
    except Exception as e:
        print(f"❌ Direct API test failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_direct_endpoints())
