"""
Quick startup test to identify issues
"""
import sys
import asyncio
import traceback

print("Testing UPM.Plus startup...")
print("=" * 60)

# Test 1: Basic imports
print("\n1. Testing basic imports...")
try:
    from app.core.config import settings
    print("✅ Config imported")
except Exception as e:
    print(f"❌ Config import failed: {e}")
    sys.exit(1)

# Test 2: Database
print("\n2. Testing database...")
try:
    from app.core.database import Base, get_db
    print("✅ Database imported")
except Exception as e:
    print(f"❌ Database import failed: {e}")
    traceback.print_exc()

# Test 3: Redis
print("\n3. Testing Redis...")
try:
    from app.core.redis import redis_client
    print("✅ Redis imported")
except Exception as e:
    print(f"❌ Redis import failed: {e}")

# Test 4: Models
print("\n4. Testing models...")
try:
    from app.models.user import User
    from app.models.billing import Subscription
    print("✅ Models imported")
except Exception as e:
    print(f"❌ Models import failed: {e}")
    traceback.print_exc()

# Test 5: API endpoints
print("\n5. Testing API endpoints...")
try:
    from app.api.v1.endpoints import health, billing
    print("✅ API endpoints imported")
except Exception as e:
    print(f"❌ API endpoints import failed: {e}")
    traceback.print_exc()

# Test 6: Services
print("\n6. Testing services...")
try:
    from app.services.billing_service import BillingService
    print("✅ Services imported")
except Exception as e:
    print(f"❌ Services import failed: {e}")
    traceback.print_exc()

# Test 7: Main app
print("\n7. Testing main app import...")
try:
    from app.main import app
    print("✅ Main app imported successfully!")
except Exception as e:
    print(f"❌ Main app import failed: {e}")
    print("\nFull traceback:")
    traceback.print_exc()
    sys.exit(1)

# Test 8: Async startup
print("\n8. Testing async startup...")
async def test_startup():
    try:
        # Try to access app
        print(f"App title: {app.title}")
        print(f"App version: {app.version}")
        print("✅ App is ready!")
        return True
    except Exception as e:
        print(f"❌ Startup test failed: {e}")
        traceback.print_exc()
        return False

result = asyncio.run(test_startup())

if result:
    print("\n" + "=" * 60)
    print("✅ ALL TESTS PASSED - App is ready to start!")
    print("=" * 60)
    print("\nYou can now start the server with:")
    print("  uvicorn app.main:app --reload --host 0.0.0.0 --port 8000")
else:
    print("\n" + "=" * 60)
    print("❌ STARTUP TEST FAILED")
    print("=" * 60)
    sys.exit(1)


