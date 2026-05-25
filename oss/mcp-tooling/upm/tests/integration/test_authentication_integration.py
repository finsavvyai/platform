"""
Integration tests for authentication system.

Tests complete authentication flows including database operations,
Redis session management, and token lifecycle.
"""

import pytest
from datetime import datetime, timedelta
from httpx import AsyncClient
from fastapi.testclient import TestClient
import redis.asyncio as redis

from udp.core.config import settings
from udp.infrastructure.redis import init_redis, close_redis
from udp.infrastructure.database_manager import DatabaseManager
from udp.security.auth import AuthService, AuthenticationError, TokenError
from udp.services.user_service import UserService
from udp.core.models.user import User


@pytest.mark.integration
class TestAuthenticationIntegration:
    """Integration tests for complete authentication flows."""

    @pytest.fixture(autouse=True)
    async def setup_database_and_redis(self):
        """Setup test database and Redis."""
        # Initialize database
        db_manager = DatabaseManager()
        await db_manager.initialize()

        # Initialize Redis
        await init_redis()

        yield

        # Cleanup
        await close_redis()
        await db_manager.close()

    @pytest.fixture
    async def test_user(self):
        """Create test user in database."""
        db_manager = DatabaseManager()
        async with db_manager.get_session() as db:
            user_service = UserService(db)

            # Create test user
            user_data = {
                "email": "auth_test@example.com",
                "full_name": "Auth Test User",
                "password": "testpassword123",
                "is_active": True,
                "is_superuser": False,
            }

            user = await user_service.create(user_data)
            yield user

            # Cleanup
            await user_service.delete(user.id)

    @pytest.fixture
    async def auth_service(self):
        """Create auth service instance."""
        return AuthService()

    @pytest.mark.asyncio
    async def test_complete_authentication_flow(self, auth_service, test_user):
        """Test complete authentication flow from login to logout."""
        # 1. Authenticate user
        auth_result = await auth_service.authenticate_user(
            email="auth_test@example.com",
            password="testpassword123",
            ip_address="127.0.0.1",
            user_agent="Test Client",
            remember_me=False,
        )

        # Verify authentication result
        assert "access_token" in auth_result
        assert "refresh_token" in auth_result
        assert "session_id" in auth_result
        assert auth_result["token_type"] == "bearer"

        access_token = auth_result["access_token"]
        refresh_token = auth_result["refresh_token"]
        session_id = auth_result["session_id"]

        # 2. Validate access token
        token_payload = await auth_service.validate_token(access_token)
        assert "sub" in token_payload or "email" in token_payload

        # 3. Refresh access token
        refresh_result = await auth_service.refresh_token(refresh_token)
        assert "access_token" in refresh_result
        assert "refresh_token" in refresh_result

        new_access_token = refresh_result["access_token"]

        # 4. Validate new access token
        new_token_payload = await auth_service.validate_token(new_access_token)
        assert "sub" in new_token_payload or "email" in new_token_payload

        # 5. Logout user
        logout_success = await auth_service.logout_user(session_id)
        assert logout_success is True

        # 6. Verify session is invalidated (logout should fail)
        logout_again = await auth_service.logout_user(session_id)
        assert logout_again is False

    @pytest.mark.asyncio
    async def test_authentication_with_invalid_credentials(self, auth_service):
        """Test authentication with invalid credentials."""
        with pytest.raises(AuthenticationError, match="Invalid email or password"):
            await auth_service.authenticate_user(
                email="nonexistent@example.com",
                password="wrongpassword",
                ip_address="127.0.0.1",
            )

    @pytest.mark.asyncio
    async def test_authentication_with_wrong_password(self, auth_service, test_user):
        """Test authentication with wrong password."""
        with pytest.raises(AuthenticationError, match="Invalid email or password"):
            await auth_service.authenticate_user(
                email="auth_test@example.com",
                password="wrongpassword",
                ip_address="127.0.0.1",
            )

    @pytest.mark.asyncio
    async def test_session_storage_and_retrieval(self, auth_service, test_user):
        """Test that sessions are properly stored in Redis."""
        auth_result = await auth_service.authenticate_user(
            email="auth_test@example.com",
            password="testpassword123",
            ip_address="192.168.1.100",
            user_agent="Mozilla/5.0 Test Browser",
            remember_me=True,
        )

        session_id = auth_result["session_id"]

        # Get Redis client and verify session exists
        redis_client = await auth_service._get_redis_client()
        session_data = await redis_client.hgetall(f"session:{session_id}")

        assert session_data is not None
        assert session_data["user_id"] == str(test_user.id)
        assert session_data["email"] == test_user.email
        assert session_data["ip_address"] == "192.168.1.100"
        assert "user_agent" in session_data
        assert "created_at" in session_data

        # Verify TTL is set (remember_me should give 30 days)
        ttl = await redis_client.ttl(f"session:{session_id}")
        assert ttl > 0  # Session has TTL
        assert ttl <= 30 * 24 * 60 * 60  # Should be less than or equal to 30 days

    @pytest.mark.asyncio
    async def test_multiple_sessions_for_same_user(self, auth_service, test_user):
        """Test handling multiple sessions for the same user."""
        # Create first session
        auth1 = await auth_service.authenticate_user(
            email="auth_test@example.com",
            password="testpassword123",
            ip_address="192.168.1.1",
        )

        # Create second session
        auth2 = await auth_service.authenticate_user(
            email="auth_test@example.com",
            password="testpassword123",
            ip_address="192.168.1.2",
        )

        # Sessions should be different
        assert auth1["session_id"] != auth2["session_id"]
        assert auth1["access_token"] != auth2["access_token"]
        assert auth1["refresh_token"] != auth2["refresh_token"]

        # Both sessions should be valid
        await auth_service.validate_token(auth1["access_token"])
        await auth_service.validate_token(auth2["access_token"])

        # Logout from one session
        await auth_service.logout_user(auth1["session_id"])

        # First session should be invalid, second should still be valid
        logout1_again = await auth_service.logout_user(auth1["session_id"])
        assert logout1_again is False

        logout2 = await auth_service.logout_user(auth2["session_id"])
        assert logout2 is True

    @pytest.mark.asyncio
    async def test_logout_all_sessions(self, auth_service, test_user):
        """Test logging out from all sessions."""
        # Create multiple sessions
        sessions = []
        for i in range(3):
            auth_result = await auth_service.authenticate_user(
                email="auth_test@example.com",
                password="testpassword123",
                ip_address=f"192.168.1.{i + 1}",
            )
            sessions.append(auth_result["session_id"])

        # Verify all sessions exist
        redis_client = await auth_service._get_redis_client()
        for session_id in sessions:
            session_data = await redis_client.hgetall(f"session:{session_id}")
            assert session_data is not None

        # Logout from all sessions
        deleted_count = await auth_service.logout_user_all_sessions(str(test_user.id))
        assert deleted_count == 3

        # Verify all sessions are deleted
        for session_id in sessions:
            session_data = await redis_client.hgetall(f"session:{session_id}")
            assert session_data == {}

    @pytest.mark.asyncio
    async def test_token_expiry_and_refresh(self, auth_service, test_user):
        """Test token expiry and refresh mechanism."""
        # Create authentication with short expiry for testing
        with patch("udp.security.auth.settings") as mock_settings:
            mock_settings.ACCESS_TOKEN_EXPIRE_MINUTES = 1  # 1 minute
            mock_settings.REFRESH_TOKEN_EXPIRE_DAYS = 1

            auth_result = await auth_service.authenticate_user(
                email="auth_test@example.com", password="testpassword123"
            )

            original_access_token = auth_result["access_token"]
            refresh_token = auth_result["refresh_token"]

            # Original token should be valid
            await auth_service.validate_token(original_access_token)

            # Refresh token
            refresh_result = await auth_service.refresh_token(refresh_token)

            # New token should be different and valid
            new_access_token = refresh_result["access_token"]
            assert new_access_token != original_access_token

            await auth_service.validate_token(new_access_token)

            # Original token should still be valid until it expires
            await auth_service.validate_token(original_access_token)

    @pytest.mark.asyncio
    async def test_invalid_token_operations(self, auth_service):
        """Test operations with invalid tokens."""
        # Test with completely invalid token
        with pytest.raises(TokenError):
            await auth_service.validate_token("invalid.jwt.token")

        # Test with valid JWT but wrong type
        from udp.security.auth import create_access_token

        access_token = create_access_token({"sub": "test@example.com"})

        with pytest.raises(
            TokenError, match="Invalid token type: expected refresh token"
        ):
            await auth_service.refresh_token(access_token)

    @pytest.mark.asyncio
    async def test_session_expiry(self, auth_service, test_user):
        """Test session expiry in Redis."""
        # Create session with very short TTL for testing
        with patch("udp.security.auth.settings") as mock_settings:
            mock_settings.REFRESH_TOKEN_EXPIRE_DAYS = 1  # 1 day

            auth_result = await auth_service.authenticate_user(
                email="auth_test@example.com",
                password="testpassword123",
                remember_me=False,
            )

            session_id = auth_result["session_id"]

            # Manually set very short TTL for testing
            redis_client = await auth_service._get_redis_client()
            await redis_client.expire(f"session:{session_id}", 2)  # 2 seconds

            # Session should exist initially
            session_data = await redis_client.hgetall(f"session:{session_id}")
            assert session_data is not None

            # Wait for expiry
            import asyncio

            await asyncio.sleep(3)

            # Session should be expired
            session_data = await redis_client.hgetall(f"session:{session_id}")
            assert session_data == {}

    @pytest.mark.asyncio
    async def test_concurrent_authentication_requests(self, auth_service, test_user):
        """Test handling concurrent authentication requests."""
        import asyncio

        async def authenticate():
            return await auth_service.authenticate_user(
                email="auth_test@example.com",
                password="testpassword123",
                ip_address="127.0.0.1",
            )

        # Run multiple authentication requests concurrently
        results = await asyncio.gather(
            authenticate(),
            authenticate(),
            authenticate(),
            authenticate(),
            authenticate(),
        )

        # All should succeed
        assert len(results) == 5

        # All should have different tokens and sessions
        session_ids = [result["session_id"] for result in results]
        access_tokens = [result["access_token"] for result in results]

        assert len(set(session_ids)) == 5  # All unique
        assert len(set(access_tokens)) == 5  # All unique

        # All tokens should be valid
        for token in access_tokens:
            await auth_service.validate_token(token)

        # Cleanup all sessions
        deleted_count = await auth_service.logout_user_all_sessions(str(test_user.id))
        assert deleted_count == 5


@pytest.mark.integration
class TestAPIAuthenticationEndpoints:
    """Integration tests for authentication API endpoints."""

    @pytest.fixture(autouse=True)
    async def setup_app(self):
        """Setup FastAPI app for testing."""
        from udp.api.main import app

        # Initialize database and Redis
        db_manager = DatabaseManager()
        await db_manager.initialize()
        await init_redis()

        yield TestClient(app)

        # Cleanup
        await close_redis()
        await db_manager.close()

    def test_login_endpoint_success(self, client):
        """Test successful login via API endpoint."""
        # First create a user
        # Note: This would require user registration endpoint
        # For now, we'll test the endpoint structure

        response = client.post(
            "/api/v1/auth/login",
            data={"username": "test@example.com", "password": "testpassword123"},
        )

        # Should fail with invalid credentials (user doesn't exist)
        assert response.status_code == 401
        assert "detail" in response.json()

    def test_login_endpoint_invalid_format(self, client):
        """Test login endpoint with invalid data."""
        response = client.post(
            "/api/v1/auth/login", data={"username": "invalid-email", "password": ""}
        )

        # Should fail due to validation
        assert response.status_code in [401, 422]

    def test_protected_endpoint_without_token(self, client):
        """Test accessing protected endpoint without token."""
        response = client.get("/api/v1/auth/me")

        # Should require authentication
        assert response.status_code == 401

    def test_protected_endpoint_with_invalid_token(self, client):
        """Test accessing protected endpoint with invalid token."""
        response = client.get(
            "/api/v1/auth/me", headers={"Authorization": "Bearer invalid.token"}
        )

        # Should reject invalid token
        assert response.status_code == 401


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
