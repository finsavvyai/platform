"""
Advanced usage examples for SDLC.ai Python SDK

This example demonstrates advanced features including:
- Custom authentication flows
- Batch operations
- Streaming responses
- Error handling and retries
- Performance optimization
"""

import asyncio
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

from sdlc_sdk import AsyncSDLCClient, Config, SDLCClient
from sdlc_sdk.auth import JWTAuth, OAuthAuth
from sdlc_sdk.exceptions import AuthenticationError, RateLimitError, ValidationError
from sdlc_sdk.models.llm import LLMChatRequest, LLMMessage
from sdlc_sdk.models.rag import RAGConfig, RAGQuery
from sdlc_sdk.models.user import BulkUserCreate, UserCreate


class AdvancedSDLCClient(SDLCClient):
    """Extended client with advanced features."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._metrics = {"requests": 0, "errors": 0, "total_time": 0.0}

    def _request(self, *args, **kwargs):
        """Override to add metrics collection."""
        start_time = time.time()
        self._metrics["requests"] += 1

        try:
            response = super()._request(*args, **kwargs)
            self._metrics["total_time"] += time.time() - start_time
            return response
        except Exception:
            self._metrics["errors"] += 1
            self._metrics["total_time"] += time.time() - start_time
            raise

    def get_metrics(self) -> dict[str, Any]:
        """Get performance metrics."""
        avg_time = self._metrics["total_time"] / max(self._metrics["requests"], 1)
        return {
            **self._metrics,
            "average_time": avg_time,
            "error_rate": self._metrics["errors"] / max(self._metrics["requests"], 1),
        }


def custom_authentication_flow():
    """Example of custom OAuth flow."""
    print("=== Custom OAuth Flow ===\n")

    # Initialize OAuth client
    auth = OAuthAuth(
        client_id="your-client-id",
        client_secret="your-client-secret",
        redirect_uri="http://localhost:8080/callback",
        flow="authorization_code",
    )

    # Get authorization URL
    auth_url = auth.get_authorization_url(state="random-state-123")
    print(f"🔗 Visit this URL to authorize: {auth_url}")

    # Simulate getting auth code from callback
    auth_code = input("\nEnter authorization code: ").strip()
    auth.set_authorization_code(auth_code)

    # Create client and authenticate
    config = Config(base_url="https://api.sdlc.cc")
    client = AdvancedSDLCClient(config=config, auth=auth)

    try:
        if client.authenticate():
            print("✅ OAuth authentication successful")

            # Get user info
            user_info = client.get_user_info()
            if user_info:
                print(f"👤 Authenticated as: {user_info.get('email')}")
                print(f"🏢 Tenant: {user_info.get('tenant_id')}")

    except AuthenticationError as e:
        print(f"❌ Authentication failed: {e}")

    # Show performance metrics
    metrics = client.get_metrics()
    print("\n📊 Performance Metrics:")
    print(f"   Requests: {metrics['requests']}")
    print(f"   Errors: {metrics['errors']}")
    print(f"   Avg Time: {metrics['average_time']:.3f}s")
    print(f"   Error Rate: {metrics['error_rate']:.1%}")


def bulk_operations_example():
    """Example of bulk operations with error handling."""
    print("\n\n=== Bulk Operations Example ===\n")

    config = Config(
        base_url="https://api.sdlc.cc", retry={"max_retries": 5, "retry_backoff": 2.0}
    )
    auth = JWTAuth(token="your-jwt-token")

    with AdvancedSDLCClient(config=config, auth=auth) as client:
        # Prepare bulk user creation
        users_to_create = []
        for i in range(100):
            users_to_create.append(
                UserCreate(
                    email=f"user{i + 1:03d}@example.com",
                    name=f"User {i + 1}",
                    tenant_id="your-tenant-id",
                    password=f"TempPass{i + 1:03d}!",
                )
            )

        print(f"📝 Creating {len(users_to_create)} users...")

        try:
            # Create users in batches
            batch_size = 20
            total_created = 0
            total_failed = 0

            for i in range(0, len(users_to_create), batch_size):
                batch = users_to_create[i : i + batch_size]

                print(
                    f"   Processing batch {i // batch_size + 1}/{(len(users_to_create) + batch_size - 1) // batch_size}..."
                )

                try:
                    result = client.users.bulk_create(
                        BulkUserCreate(users=batch, continue_on_error=True)
                    )

                    total_created += result.successful
                    total_failed += result.failed

                    if result.failed > 0:
                        print(f"      ⚠️  {result.failed} users failed in this batch")
                        for error in result.errors[:3]:  # Show first 3 errors
                            print(f"         - {error.get('message', 'Unknown error')}")

                except Exception as e:
                    print(f"      ❌ Batch failed: {e}")
                    total_failed += len(batch)

            print("\n✅ Bulk operation completed:")
            print(f"   Successful: {total_created}")
            print(f"   Failed: {total_failed}")
            print(f"   Total: {total_created + total_failed}")

        except Exception as e:
            print(f"❌ Bulk operation failed: {e}")

        # Show metrics
        metrics = client.get_metrics()
        print("\n📊 Metrics:")
        print(f"   Total Requests: {metrics['requests']}")
        print(f"   Average Time: {metrics['average_time']:.3f}s")


def concurrent_operations_example():
    """Example of concurrent operations."""
    print("\n\n=== Concurrent Operations Example ===\n")

    config = Config(base_url="https://api.sdlc.cc")
    auth = JWTAuth(token="your-jwt-token")

    with AdvancedSDLCClient(config=config, auth=auth) as client:
        # Define tasks to run concurrently
        tasks = []

        # Task 1: Get users
        tasks.append(("get_users", lambda: client.users.list(page_size=50)))

        # Task 2: Get documents
        tasks.append(("get_documents", lambda: client.documents.list(page_size=50)))

        # Task 3: Get policies
        tasks.append(("get_policies", lambda: client.policies.list(page_size=50)))

        # Task 4: Get metrics
        tasks.append(
            (
                "get_metrics",
                lambda: client.monitoring.get_metrics(tenant_id="your-tenant-id"),
            )
        )

        print(f"🔄 Running {len(tasks)} operations concurrently...")

        # Execute tasks concurrently
        results = {}
        with ThreadPoolExecutor(max_workers=4) as executor:
            # Submit all tasks
            future_to_name = {executor.submit(task[1]): task[0] for task in tasks}

            # Collect results as they complete
            for future in as_completed(future_to_name):
                task_name = future_to_name[future]
                try:
                    result = future.result()
                    results[task_name] = result
                    print(f"   ✅ {task_name} completed")
                except Exception as e:
                    print(f"   ❌ {task_name} failed: {e}")

        # Process results
        print("\n📊 Results:")
        for name, result in results.items():
            if hasattr(result, "data"):
                print(f"   {name}: {len(result.data)} items")
            elif isinstance(result, dict):
                print(f"   {name}: {len(result)} fields")
            else:
                print(f"   {name}: {type(result).__name__}")

        # Show performance metrics
        metrics = client.get_metrics()
        print("\n📈 Performance:")
        print(f"   Total time: {metrics['total_time']:.2f}s")
        print(f"   Average per request: {metrics['average_time']:.3f}s")


async def streaming_responses_example():
    """Example of streaming responses."""
    print("\n\n=== Streaming Responses Example ===\n")

    config = Config(base_url="https://api.sdlc.cc")
    auth = JWTAuth(token="your-jwt-token")

    async with AsyncSDLCClient(config=config, auth=auth) as client:
        # Streaming chat completion
        print("💬 Streaming LLM Response:")
        print("-" * 40)

        try:
            request = LLMChatRequest(
                messages=[
                    LLMMessage(role="system", content="You are a helpful assistant."),
                    LLMMessage(
                        role="user",
                        content="Explain quantum computing in simple terms.",
                    ),
                ],
                model="gpt-3.5-turbo",
                stream=True,
                max_tokens=500,
            )

            full_response = ""
            async for chunk in client.llm.chat_stream(request):
                if chunk.delta:
                    print(chunk.delta, end="", flush=True)
                    full_response += chunk.delta

                if chunk.is_finished:
                    print("\n")
                    break

            print(f"\n📏 Response length: {len(full_response)} characters")

        except Exception as e:
            print(f"❌ Streaming failed: {e}")

        # Streaming file download
        print("\n📥 Streaming File Download:")
        print("-" * 40)

        try:
            downloaded_bytes = 0

            def progress_callback(bytes_transferred, total_bytes):
                nonlocal downloaded_bytes
                downloaded_bytes = bytes_transferred
                if total_bytes:
                    percent = (bytes_transferred / total_bytes) * 100
                    print(f"\r   Progress: {percent:.1f}%", end="", flush=True)

            await client.download_file(
                endpoint="/documents/example.pdf/download",
                file_path="downloads/example.pdf",
                on_progress=progress_callback,
            )

            print(f"\n✅ Downloaded {downloaded_bytes} bytes")

        except Exception as e:
            print(f"❌ Download failed: {e}")


async def advanced_rag_example():
    """Example of advanced RAG operations."""
    print("\n\n=== Advanced RAG Example ===\n")

    config = Config(base_url="https://api.sdlc.cc")
    auth = JWTAuth(token="your-jwt-token")

    async with AsyncSDLCClient(config=config, auth=auth) as client:
        # Configure RAG with custom settings
        rag_config = RAGConfig(
            retrieval_top_k=10,
            retrieval_score_threshold=0.7,
            semantic_weight=0.8,
            keyword_weight=0.2,
            enable_reranking=True,
            max_context_length=6000,
            system_prompt="You are an expert assistant. Provide detailed, accurate answers with citations.",
            include_citations=True,
            citation_format="apa",
        )

        # Complex RAG query with filters
        query = RAGQuery(
            query="What are the compliance requirements for handling PII data?",
            tenant_id="your-tenant-id",
            config=rag_config,
            filters={
                "document_type": "policy",
                "category": "compliance",
                "date_range": {"start": "2023-01-01", "end": "2024-12-31"},
            },
            history=[
                {"role": "user", "content": "What is PII?"},
                {
                    "role": "assistant",
                    "content": "PII stands for Personally Identifiable Information...",
                },
            ],
        )

        print("🤖 Performing advanced RAG query...")
        print(f"   Query: {query.query}")
        print(f"   Filters: {query.filters}")
        print(
            f"   Config: {rag_config.retrieval_top_k} sources, {rag_config.semantic_weight} semantic weight"
        )

        try:
            response = await client.rag.query(query)

            print("\n📝 Answer:")
            print("-" * 40)
            print(response.answer)

            print(f"\n📚 Sources ({len(response.sources)}):")
            for i, source in enumerate(response.sources, 1):
                print(f"\n{i}. {source.document_name}")
                print(f"   Score: {source.score:.3f}")
                print(f"   Citation: {source.citation_text or 'N/A'}")
                if source.page_number:
                    print(f"   Page: {source.page_number}")

            print("\n📊 Metrics:")
            print(f"   Confidence: {response.confidence:.2f}")
            print(f"   Relevance: {response.relevance_score:.2f}")
            print(f"   Generation time: {response.generation_time_ms}ms")
            print(f"   Retrieval time: {response.retrieval_time_ms}ms")
            print(f"   Tokens used: {response.tokens_used}")

            # Provide feedback
            feedback_response = await client.rag.provide_feedback(
                query_id=response.query_id,
                rating="helpful",
                comment="Very comprehensive answer with good citations.",
            )
            print(f"\n👍 Feedback submitted: {feedback_response.get('success', False)}")

        except Exception as e:
            print(f"❌ RAG query failed: {e}")


def error_handling_example():
    """Example of comprehensive error handling."""
    print("\n\n=== Error Handling Example ===\n")

    config = Config(
        base_url="https://api.sdlc.cc",
        retry={"max_retries": 3, "retry_backoff": 1.0, "retry_jitter": True},
    )
    auth = JWTAuth(token="invalid-token")  # Intentionally invalid

    with AdvancedSDLCClient(config=config, auth=auth) as client:
        operations = [
            ("Valid operation", lambda: client.get("/health")),
            ("Invalid auth", lambda: client.get("/users")),
            ("Invalid endpoint", lambda: client.get("/invalid/endpoint")),
            (
                "Validation error",
                lambda: client.users.create(
                    UserCreate(
                        email="invalid-email",
                        name="Test",
                        tenant_id="test",
                        password="short",
                    )
                ),
            ),
        ]

        for name, operation in operations:
            print(f"\n🔄 Testing: {name}")
            try:
                operation()
                print("   ✅ Success")
            except AuthenticationError as e:
                print(f"   🔐 Authentication Error: {e.message}")
                if e.suggestion:
                    print(f"   💡 Suggestion: {e.suggestion}")
            except RateLimitError as e:
                print(f"   ⏱️  Rate Limited: {e.message}")
                print(f"   ⏳ Retry after: {e.retry_after}s")
            except ValidationError as e:
                print(f"   ❌ Validation Error: {e.message}")
                if e.errors:
                    for error in e.errors[:3]:
                        print(f"      - {error}")
            except Exception as e:
                print(f"   ❓ Unexpected Error: {e}")

        # Show final metrics
        metrics = client.get_metrics()
        print("\n📊 Final Metrics:")
        print(f"   Requests: {metrics['requests']}")
        print(f"   Errors: {metrics['errors']}")
        print(f"   Error Rate: {metrics['error_rate']:.1%}")


async def main():
    """Run all advanced examples."""
    print("SDLC.ai Python SDK - Advanced Examples\n")
    print("=" * 50)

    # Run examples
    custom_authentication_flow()
    bulk_operations_example()
    concurrent_operations_example()
    await streaming_responses_example()
    await advanced_rag_example()
    error_handling_example()

    print("\n✅ All advanced examples completed!")


if __name__ == "__main__":
    asyncio.run(main())
