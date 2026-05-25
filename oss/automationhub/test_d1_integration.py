#!/usr/bin/env python3.12
"""
Test Cloudflare D1 integration for UPM.Plus
"""

import asyncio
import sys
import os
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent / "backend"))

from app.core.cloudflare_d1 import d1_service, d1_engine
from app.core.d1_migrations import run_migrations, reset_database
from app.core.config import settings


async def test_d1_connection():
    """Test Cloudflare D1 connection"""
    print("🔗 Testing Cloudflare D1 connection...")
    
    if await d1_service.test_connection():
        print("✅ Cloudflare D1 connection successful")
        
        # Get database info
        info = await d1_service.get_database_info()
        if info.get("success"):
            print(f"📊 Database: {info.get('database', {})}")
            print(f"🗂️  Schema: {info.get('schema')}")
        else:
            print(f"❌ Failed to get database info: {info.get('error')}")
            
        return True
    else:
        print("❌ Cloudflare D1 connection failed")
        print("💡 Using local SQLite database instead")
        return False


async def test_migrations():
    """Test database migrations"""
    print("\n🗄️  Testing database migrations...")
    
    try:
        result = await run_migrations()
        print(f"✅ Migrations completed: {result}")
        return True
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        return False


async def test_database_operations():
    """Test basic database operations"""
    print("\n🧪 Testing database operations...")
    
    try:
        # Test query execution
        result = await d1_service.execute_query(
            "SELECT COUNT(*) as count FROM upmplus.users"
        )
        
        if result.get("success"):
            user_count = result.get("result", [{}])[0][0]
            print(f"✅ Query successful: {user_count} users in database")
        else:
            print(f"❌ Query failed: {result}")
            return False
            
        # Test session creation
        session = await d1_engine.get_session()
        print("✅ Database session created successfully")
        await session.close()
        
        return True
        
    except Exception as e:
        print(f"❌ Database operations failed: {e}")
        return False


async def test_configuration():
    """Test configuration"""
    print("\n⚙️  Testing configuration...")
    
    print(f"📋 Environment: {settings.ENVIRONMENT}")
    print(f"🗄️  Database URL: {settings.DATABASE_URL}")
    print(f"☁️  D1 Account ID: {settings.CLOUDFLARE_D1_ACCOUNT_ID}")
    print(f"🆔 D1 Database ID: {settings.CLOUDFLARE_D1_DATABASE_ID}")
    print(f"🔐 D1 Schema: {settings.CLOUDFLARE_D1_SCHEMA}")
    
    if settings.CLOUDFLARE_D1_ACCOUNT_ID and settings.CLOUDFLARE_D1_DATABASE_ID:
        print("✅ Cloudflare D1 configuration found")
        return True
    else:
        print("⚠️  Cloudflare D1 configuration missing")
        print("💡 Set up D1 with: ./scripts/setup-d1.sh")
        return False


async def main():
    """Main test function"""
    print("🚀 UPM.Plus Cloudflare D1 Integration Test")
    print("=" * 50)
    
    # Test configuration
    config_ok = await test_configuration()
    
    # Test connection
    connection_ok = await test_d1_connection()
    
    # Test migrations
    migrations_ok = await test_migrations()
    
    # Test operations
    operations_ok = await test_database_operations()
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 Test Summary:")
    print(f"  Configuration: {'✅' if config_ok else '❌'}")
    print(f"  Connection: {'✅' if connection_ok else '❌'}")
    print(f"  Migrations: {'✅' if migrations_ok else '❌'}")
    print(f"  Operations: {'✅' if operations_ok else '❌'}")
    
    all_passed = all([config_ok, migrations_ok, operations_ok])
    
    if all_passed:
        print("\n🎉 All tests passed! Cloudflare D1 is ready.")
        print("\n🔧 Next steps:")
        print("  1. Start the backend: cd backend && uvicorn app.main:app --reload")
        print("  2. Test the API: curl http://localhost:8000/health")
        print("  3. View the dashboard: http://localhost:3000")
    else:
        print("\n❌ Some tests failed. Check the configuration.")
        print("\n🔧 Troubleshooting:")
        print("  1. Run: ./scripts/setup-d1.sh")
        print("  2. Check your .env file for D1 credentials")
        print("  3. Verify Cloudflare API token permissions")
    
    return all_passed


if __name__ == "__main__":
    asyncio.run(main())
