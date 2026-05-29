"""
Basic usage examples for SDLC.ai Python SDK

This example demonstrates the fundamental operations including:
- Authentication
- User management
- Document processing
- RAG queries
- Vector search
"""

import asyncio
import os
from pathlib import Path

from sdlc_sdk import SDLCClient, AsyncSDLCClient, Config
from sdlc_sdk.auth import APIKeyAuth, OAuthAuth
from sdlc_sdk.models.user import UserCreate
from sdlc_sdk.models.rag import RAGQuery


def sync_example():
    """Synchronous client example."""
    print("=== Synchronous Client Example ===\n")

    # Configure the client
    config = Config(
        base_url="https://api.sdlc.ai", timeout=30.0, retry=dict(max_retries=3)
    )

    # Initialize with API key authentication
    auth = APIKeyAuth(api_key=os.getenv("SDLC_API_KEY", "your-api-key"))

    # Create client
    with SDLCClient(config=config, auth=auth) as client:
        # Authenticate
        if client.authenticate():
            print("✅ Authentication successful")
        else:
            print("❌ Authentication failed")
            return

        # Get user info
        user_info = client.get_user_info()
        if user_info:
            print(f"👤 Logged in as: {user_info.get('email')}")

        # List users
        try:
            users = client.users.list(page_size=10)
            print(f"\n📋 Found {len(users.data)} users")
            for user in users.data[:3]:
                print(f"   - {user.name} ({user.email})")
        except Exception as e:
            print(f"❌ Failed to list users: {e}")

        # Create a new user
        try:
            new_user = client.users.create(
                UserCreate(
                    email="newuser@example.com",
                    name="New User",
                    tenant_id="your-tenant-id",
                    password="SecurePass123!",
                )
            )
            print(f"\n➕ Created user: {new_user.name} (ID: {new_user.id})")
        except Exception as e:
            print(f"❌ Failed to create user: {e}")

        # Upload a document
        try:
            doc_path = Path("examples/sample_document.pdf")
            if doc_path.exists():
                document = client.documents.upload(
                    file_path=str(doc_path),
                    name="Sample Document",
                    tenant_id="your-tenant-id",
                )
                print(f"\n📄 Uploaded document: {document.name} (ID: {document.id})")

                # Check processing status
                if document.processing_status == "completed":
                    print("✅ Document processed successfully")
                else:
                    print(f"⏳ Document status: {document.processing_status}")
            else:
                print(f"\n⚠️ Sample document not found at {doc_path}")
        except Exception as e:
            print(f"❌ Failed to upload document: {e}")

        # Perform RAG query
        try:
            rag_response = client.rag.query(
                query="What are the main security requirements?",
                tenant_id="your-tenant-id",
                top_k=5,
            )
            print(f"\n🤖 RAG Query: 'What are the main security requirements?'")
            print(f"📝 Answer: {rag_response.answer}")
            print(f"📊 Sources: {len(rag_response.sources)}")
            print(f"⏱️  Time: {rag_response.generation_time_ms}ms")
        except Exception as e:
            print(f"❌ Failed to perform RAG query: {e}")

        # Vector search
        try:
            # Using text query (will be embedded automatically)
            vector_results = client.vector.search(
                query_vector="security requirements",
                tenant_id="your-tenant-id",
                top_k=3,
            )
            print(f"\n🔍 Vector Search Results:")
            for i, result in enumerate(vector_results.results, 1):
                print(f"   {i}. Score: {result.score:.3f} - {result.document_name}")
        except Exception as e:
            print(f"❌ Failed to perform vector search: {e}")


async def async_example():
    """Asynchronous client example."""
    print("\n\n=== Asynchronous Client Example ===\n")

    # Configure the client
    config = Config(base_url="https://api.sdlc.ai", timeout=30.0)

    # Initialize with OAuth authentication
    auth = OAuthAuth(
        client_id=os.getenv("SDLC_CLIENT_ID", "your-client-id"),
        client_secret=os.getenv("SDLC_CLIENT_SECRET", "your-client-secret"),
        flow="client_credentials",
    )

    # Create async client
    async with AsyncSDLCClient(config=config, auth=auth) as client:
        # Authenticate
        if await client.authenticate():
            print("✅ Async authentication successful")
        else:
            print("❌ Async authentication failed")
            return

        # Get user info
        user_info = await client.get_user_info()
        if user_info:
            print(f"👤 Logged in as: {user_info.get('email')}")

        # Parallel operations
        try:
            # Run multiple operations concurrently
            users_task = client.users.list(page_size=10)
            tenants_task = client.tenants.list(page_size=10)
            docs_task = client.documents.list(page_size=10)

            users, tenants, documents = await asyncio.gather(
                users_task, tenants_task, docs_task, return_exceptions=True
            )

            if not isinstance(users, Exception):
                print(f"\n📋 Users: {len(users.data)}")
            if not isinstance(tenants, Exception):
                print(f"🏢 Tenants: {len(tenants.data)}")
            if not isinstance(documents, Exception):
                print(f"📄 Documents: {len(documents.data)}")

        except Exception as e:
            print(f"❌ Failed parallel operations: {e}")

        # Batch operations
        try:
            batch_requests = [
                {"method": "GET", "endpoint": "/users"},
                {"method": "GET", "endpoint": "/tenants"},
                {"method": "GET", "endpoint": "/documents"},
            ]

            responses = await client.batch_request(batch_requests, max_concurrency=3)
            print(f"\n📦 Batch requests completed: {len(responses)} responses")

        except Exception as e:
            print(f"❌ Failed batch operations: {e}")

        # Streaming file upload
        try:
            doc_path = Path("examples/large_document.pdf")
            if doc_path.exists():

                def progress_callback(bytes_transferred, total_bytes):
                    if total_bytes:
                        percent = (bytes_transferred / total_bytes) * 100
                        print(f"\r📤 Uploading: {percent:.1f}%", end="", flush=True)

                await client.upload_file(
                    endpoint="/documents/upload",
                    file_path=str(doc_path),
                    on_progress=progress_callback,
                )
                print("\n✅ Upload completed")
        except Exception as e:
            print(f"\n❌ Failed to upload file: {e}")


def policy_management_example():
    """Policy management example."""
    print("\n\n=== Policy Management Example ===\n")

    config = Config(base_url="https://api.sdlc.ai")
    auth = APIKeyAuth(api_key=os.getenv("SDLC_API_KEY", "your-api-key"))

    with SDLCClient(config=config, auth=auth) as client:
        try:
            # Create a policy
            policy = client.policies.create(
                name="Data Retention Policy",
                tenant_id="your-tenant-id",
                rules=[
                    {
                        "name": "Retain PII for 7 years",
                        "condition": "document.category == 'PII'",
                        "action": "retain",
                        "priority": 1,
                    },
                    {
                        "name": "Encrypt sensitive data",
                        "condition": "document.sensitivity in ['confidential', 'secret']",
                        "action": "encrypt",
                        "priority": 2,
                    },
                ],
            )
            print(f"📋 Created policy: {policy.name} (ID: {policy.id})")

            # Test the policy
            test_result = client.policies.test(
                policy_id=policy.id,
                test_data={
                    "document": {
                        "category": "PII",
                        "sensitivity": "confidential",
                        "content": "Sensitive user data",
                    }
                },
            )
            print(f"🧪 Policy test: {'PASSED' if test_result.passed else 'FAILED'}")
            if not test_result.passed:
                print(f"   Error: {test_result.error_message}")

            # Deploy the policy
            if test_result.passed:
                deployment = client.policies.deploy(
                    policy_id=policy.id, strategy="blue_green"
                )
                print(f"🚀 Policy deployed: {deployment.id}")
                print(f"   Status: {deployment.status}")

        except Exception as e:
            print(f"❌ Policy management failed: {e}")


def monitoring_example():
    """Monitoring and analytics example."""
    print("\n\n=== Monitoring Example ===\n")

    config = Config(base_url="https://api.sdlc.ai")
    auth = APIKeyAuth(api_key=os.getenv("SDLC_API_KEY", "your-api-key"))

    with SDLCClient(config=config, auth=auth) as client:
        try:
            # Get health check
            health = client.monitoring.health_check()
            print(f"🏥 System Health: {health.status.upper()}")
            if health.components:
                print("   Components:")
                for name, status in health.components.items():
                    print(f"   - {name}: {status.status}")

            # Get metrics
            metrics = client.monitoring.get_metrics(
                tenant_id="your-tenant-id", period="24h"
            )
            print(f"\n📊 Metrics (24h):")
            print(f"   API Requests: {metrics.api_requests:,}")
            print(f"   Success Rate: {metrics.success_rate:.1f}%")
            print(f"   Avg Response Time: {metrics.average_response_time_ms:.1f}ms")
            print(f"   Active Users: {metrics.active_users:,}")
            print(f"   Documents Processed: {metrics.documents_processed:,}")

            # Get audit logs
            logs = client.monitoring.get_audit_logs(
                tenant_id="your-tenant-id",
                event_types=["user.login", "document.upload"],
                limit=10,
            )
            print(f"\n📋 Recent Audit Logs:")
            for log in logs[:5]:
                print(f"   - {log.event_type}: {log.description}")

        except Exception as e:
            print(f"❌ Monitoring failed: {e}")


def main():
    """Run all examples."""
    print("SDLC.ai Python SDK Examples\n")
    print("=" * 50)

    # Check for API key
    if not os.getenv("SDLC_API_KEY"):
        print("⚠️  Warning: SDLC_API_KEY environment variable not set")
        print("   Set it with: export SDLC_API_KEY=your-api-key\n")

    # Run synchronous example
    sync_example()

    # Run asynchronous example
    asyncio.run(async_example())

    # Run policy management example
    policy_management_example()

    # Run monitoring example
    monitoring_example()

    print("\n✅ All examples completed!")


if __name__ == "__main__":
    main()
