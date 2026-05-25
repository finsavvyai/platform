#!/usr/bin/env python3
"""Quick test to verify LM Studio connection."""

import asyncio
import sys

async def test_lmstudio():
    """Test connection to LM Studio."""
    print("🔍 Testing LM Studio connection...")
    print()

    # Test 1: Check if LM Studio is running
    try:
        import httpx
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get("http://localhost:1234/v1/models")
            if response.status_code == 200:
                print("✅ LM Studio is running!")
                models = response.json().get("data", [])
                print(f"✅ Found {len(models)} model(s):")
                for model in models[:5]:  # Show first 5
                    print(f"   • {model.get('id', 'unknown')}")
                if len(models) > 5:
                    print(f"   ... and {len(models) - 5} more")
                print()
                return True
            else:
                print(f"❌ LM Studio returned status {response.status_code}")
                return False
    except Exception as e:
        print(f"❌ Cannot connect to LM Studio: {e}")
        print()
        print("💡 Troubleshooting:")
        print("   1. Make sure LM Studio application is open")
        print("   2. Click the '💬' icon (Local Server)")
        print("   3. Make sure 'Enable Server' is ON")
        print("   4. Check the port (default: 1234)")
        print()
        return False

async def test_finSavvyai_provider():
    """Test FinSavvyAI LM Studio provider."""
    print("🔍 Testing FinSavvyAI LM Studio provider...")
    print()

    try:
        from src.providers.lmstudio_provider import LMStudioProvider
        from src.providers.base import ChatRequest, ChatMessage

        provider = LMStudioProvider()
        print("✅ LMStudioProvider created")

        # Test health check
        is_healthy = await provider.health_check()
        if is_healthy:
            print("✅ Provider health check passed")
        else:
            print("❌ Provider health check failed")
            return False

        # List models
        models = await provider.list_models()
        print(f"✅ Provider found {len(models)} model(s)")

        # Test chat completion
        if models:
            print()
            print("🧪 Testing chat completion...")
            request = ChatRequest(
                model=models[0].id,
                messages=[
                    ChatMessage(role="user", content="Say 'Hello from LM Studio!' in one sentence.")
                ],
                temperature=0.7,
                max_tokens=50
            )

            response = await provider.chat(request)
            print(f"✅ Chat completion successful!")
            print(f"   Response: {response.content[:100]}...")
            print()

        return True

    except Exception as e:
        print(f"❌ Provider test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

async def main():
    """Run all tests."""
    print("=" * 60)
    print("  FinSavvyAI × LM Studio Connection Test")
    print("=" * 60)
    print()

    # Test 1: Direct connection
    lmstudio_ok = await test_lmstudio()

    if not lmstudio_ok:
        print()
        print("❌ Cannot proceed without LM Studio connection")
        print("   Please fix LM Studio setup and try again")
        sys.exit(1)

    print()

    # Test 2: FinSavvyAI provider
    provider_ok = await test_finSavvyai_provider()

    print()
    print("=" * 60)
    if provider_ok:
        print("  ✅ All tests passed! You're ready to use NotebookLM!")
    else:
        print("  ⚠️  Some tests failed. Check the errors above.")
    print("=" * 60)
    print()

    if provider_ok:
        print("🚀 Next steps:")
        print("   1. Start the gateway: python -m src.api.gateway")
        print("   2. Upload a document: curl -X POST http://localhost:8080/api/notebook/sources/upload -F 'file=@document.pdf'")
        print("   3. Query your documents: See docs/NOTEBOOKLM_QUICKSTART.md")

if __name__ == "__main__":
    asyncio.run(main())
