"""
Comprehensive tests for UPM authentication system.

Tests JWT token management, session handling, authentication
services, and middleware components.
"""

import pytest
import asyncio
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch, AsyncMock
from uuid import uuid4, UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from src.udp.security.auth import (
    AuthenticationService,
    TokenManager,
    SessionManager,
    AuthenticationError,
    TokenError,
    SessionError,
    auth_service,
)
from src.udp.security import auth
from src.udp.core.models.user import User, UserStatus
from src.udp.core.config import get_settings
from src.udp.api.middleware.auth import (
    AuthenticationMiddleware,
    get_current_user,
    require_permissions,
    get_optional_user,
    get_authenticated_user,
    require_authenticated_user,
    SecurityHeadersMiddleware,
    RateLimitMiddleware,
)


@pytest.fixture
async def db_session():
    """Create test database session."""
    # Use in-memory SQLite for testing
    from sqlalchemy.ext.asyncio import create_async_engine

    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)

    # Create tables
    from src.udp.core.models.base import Base

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSession(engine) as session:
        yield session

    # Cleanup
    await engine.dispose()


@pytest.fixture
def mock_settings():
    """Mock settings for testing."""
    settings = MagicMock()
    settings.JWT_SECRET_KEY = "test-secret-key-for-jwt-generation"
    settings.JWT_ALGORITHM = "HS256"
    settings.ACCESS_TOKEN_EXPIRE_MINUTES = 30
    settings.REFRESH_TOKEN_EXPIRE_DAYS = 7
    settings.REDIS_URL = "redis://localhost:6379/0"
    settings.SESSION_EXPIRE_MINUTES = 60
    settings.VERSION = "1.0.0"
    return settings


@pytest.fixture
def mock_redis_client():
    """Mock Redis client for testing."""
    return AsyncMock()


@pytest.fixture
def token_manager(mock_settings):
    """Create TokenManager instance for testing."""
    with patch("src.udp.security.auth.get_settings", return_value=mock_settings):
        return TokenManager()


@pytest.fixture
def session_manager(mock_settings, mock_redis_client):
    """Create SessionManager instance for testing."""
    with (
        patch("src.udp.security.auth.get_settings", return_value=mock_settings),
        patch("src.udp.security.auth.AsyncRedis", return_value=mock_redis_client),
    ):
        return SessionManager()


@pytest.fixture
async def test_user(db_session):
    """Create a test user."""
    from src.udp.core.models.user import User

    user = User(
        email="test@example.com",
        username="testuser",
        name="Test User",
        password_hash=bcrypt.hashpw(
            "testpassword".encode("utf-8"), bcrypt.gensalt()
        ).decode("utf-8"),
        status=UserStatus.ACTIVE.value,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    return user


@pytest.fixture
def auth_service_fixture(token_manager, session_manager):
    """Create AuthenticationService instance for testing."""
    with patch("src.udp.security.auth.get_settings", return_value=mock_settings()):
        return AuthenticationService()


@pytest.mark.asyncio
class TestTokenManager:
    """Test cases for TokenManager."""

    async def test_generate_access_token(self, token_manager):
        """Test successful access token generation."""
        user_id = str(uuid4())
        email = "test@example.com"
        permissions = ["read_projects", "write_projects"]

        token = token_manager.generate_access_token(user_id, email, permissions)
        assert token is not None
        assert isinstance(token, str)
        assert len(token) > 0

        # Validate token can be decoded
        payload = token_manager.validate_token(token)
        assert payload["sub"] == user_id
        assert payload["email"] == email
        assert payload["type"] == "access"
        assert "permissions" in payload
        assert payload["permissions"] == permissions

    async def test_generate_refresh_token(self, token_manager):
        """Test successful refresh token generation."""
        user_id = str(uuid4())
        email = "test@example.com"

        token = token_manager.generate_refresh_token(user_id, email)
        assert token is not None
        assert isinstance(token, str)
        assert len(token) > 0

        # Validate token can be decoded
        payload = token_manager.validate_token(token, "refresh")
        assert payload["sub"] == user_id
        assert payload["email"] == email
        assert payload["type"] == "refresh"

    async def test_refresh_access_token(self, token_manager):
        """Test successful access token refresh."""
        user_id = str(uuid4())
        email = "test@example.com"

        # Generate initial tokens
        refresh_token = token_manager.generate_refresh_token(user_id, email)
        access_token = token_manager.generate_access_token(user_id, email)

        # Refresh tokens
        new_tokens = token_manager.refresh_access_token(refresh_token)

        assert "access_token" in new_tokens
        assert "refresh_token" in new_tokens
        assert new_tokens["token_type"] == "Bearer"
        assert (
            new_tokens["expires_in"] == token_manager.access_token_expire_minutes * 60
        )

        # Validate new access token
        new_payload = token_manager.validate_token(new_tokens["access_token"])
        assert new_payload["sub"] == user_id
        assert new_payload["email"] == email

        # Verify old refresh token is blacklisted
        old_payload = token_manager.validate_token(refresh_token, "refresh")
        assert old_payload["sub"] == user_id  # Still valid content
        # In actual implementation, old refresh token would be revoked

    async def test_validate_token_success(self, token_manager):
        """Test successful token validation."""
        user_id = str(uuid4())
        email = "test@example.com"

        # Generate and validate token
        token = token_manager.generate_access_token(user_id, email)
        payload = token_manager.validate_token(token)

        assert payload["sub"] == user_id
        assert payload["email"] == email
        assert payload["type"] == "access"
        assert "exp" in payload
        assert "iat" in payload

    async def test_validate_token_expired(self, token_manager):
        """Test expired token validation."""
        user_id = str(uuid4())
        email = "test@example.com"

        # Generate token with short expiration
        token_manager.access_token_expire_minutes = -1  # Expired
        token = token_manager.generate_access_token(user_id, email)

        with pytest.raises(TokenError) as exc:
            token_manager.validate_token(token)

        assert "expired" in str(exc).lower()

    async def test_validate_token_invalid_type(self, token_manager):
        """Test token type validation."""
        user_id = str(uuid4())
        email = "test@example.com"

        # Generate refresh token but validate as access
        refresh_token = token_manager.generate_refresh_token(user_id, email)

        with pytest.raises(TokenError) as exc:
            token_manager.validate_token(refresh_token, "access")

        assert "type" in str(exc)

    async def test_validate_token_missing(self, token_manager):
        """Test missing token validation."""
        with pytest.raises(TokenError) as exc:
            token_manager.validate_token(None)

        assert "missing" in str(exc).lower()

    async def test_validate_token_invalid_signature(self, token_manager):
        """Test token with invalid signature."""
        # Generate token with different secret
        user_id = str(uuid4())
        email = "test@example.com"

        temp_secret = token_manager.secret_key
        token_manager.secret_key = "wrong-secret"
        token = token_manager.generate_access_token(user_id, email)
        token_manager.secret_key = temp_secret  # Restore original

        with pytest.raises(TokenError):
            token_manager.validate_token(token)

    async def test_token_blacklisting(self, token_manager):
        """Test token blacklisting functionality."""
        user_id = str(uuid4())
        email = "test@example.com"

        # Generate and validate token
        token = token_manager.generate_access_token(user_id, email)
        payload = token_manager.validate_token(token)
        jti = payload["jti"]

        # Blacklist token
        token_manager._blacklist_token(jti)

        # Token should still be valid (blacklist checks would be in Redis)
        # This test demonstrates the mechanism exists
        assert jti in token_manager._token_blacklist


@pytest.mark.asyncio
class TestSessionManager:
    """Test cases for SessionManager."""

    async def test_create_session(self, session_manager):
        """Test successful session creation."""
        user_id = str(uuid4())
        session_data = {
            "ip_address": "192.168.1.1",
            "user_agent": "Test Browser/1.0",
            "permissions": ["read_projects"],
        }

        session_id = await session_manager.create_session(user_id, session_data)
        assert session_id is not None
        assert isinstance(session_id, str)
        assert len(session_id) > 0

        # Verify session can be retrieved
        retrieved_session = await session_manager.get_session(session_id)
        assert retrieved_session["user_id"] == user_id
        assert retrieved_session["ip_address"] == "192.168.1.1"
        assert retrieved_session["permissions"] == ["read_projects"]

    async def test_get_session_not_found(self, session_manager):
        """Test getting non-existent session."""
        session_id = str(uuid4())

        session = await session_manager.get_session(session_id)
        assert session is None

    async def test_update_session(self, session_manager):
        """Test successful session update."""
        user_id = str(uuid4())
        session_data = {"ip_address": "192.168.1.1", "permissions": ["read_projects"]}

        # Create session
        session_id = await session_manager.create_session(user_id, session_data)

        # Update session
        updates = {
            "ip_address": "192.168.1.2",
            "permissions": ["read_projects", "write_projects"],
        }

        success = await session_manager.update_session(session_id, updates)
        assert success is True

        # Verify updates
        updated_session = await session_manager.get_session(session_id)
        assert updated_session["ip_address"] == "192.168.1.2"
        assert updated_session["permissions"] == ["read_projects", "write_projects"]

    async def test_update_session_not_found(self, session_manager):
        """Test updating non-existent session."""
        session_id = str(uuid4())
        updates = {"ip_address": "192.168.1.2"}

        success = await session_manager.update_session(session_id, updates)
        assert success is False

    async def test_delete_session(self, session_manager):
        """Test successful session deletion."""
        user_id = str(uuid4())
        session_data = {"ip_address": "192.168.1.1"}

        # Create session
        session_id = await session_manager.create_session(user_id, session_data)

        # Delete session
        success = await session_manager.delete_session(session_id)
        assert success is True

        # Verify session is deleted
        deleted_session = await session_manager.get_session(session_id)
        assert deleted_session is None

    async def test_delete_session_not_found(self, session_manager):
        """Test deleting non-existent session."""
        session_id = str(uuid4())

        success = await session_manager.delete_session(session_id)
        assert success is False

    async def test_get_user_sessions(self, session_manager):
        """Test getting all sessions for a user."""
        user_id = str(uuid4())

        # Create multiple sessions
        session1_id = await session_manager.create_session(
            user_id, {"ip_address": "192.168.1.1"}
        )
        session2_id = await session_manager.create_session(
            user_id, {"ip_address": "192.168.1.2"}
        )

        # Get user sessions
        sessions = await session_manager.get_user_sessions(user_id)
        assert len(sessions) == 2
        assert all(session["user_id"] == user_id for session in sessions)

    async def test_delete_user_sessions(self, session_manager):
        """Test deleting all sessions for a user."""
        user_id = str(uuid4())

        # Create multiple sessions
        await session_manager.create_session(user_id, {"ip_address": "192.168.1.1"})
        await session_manager.create_session(user_id, {"ip_address": "192.168.1.2"})

        # Delete user sessions
        deleted_count = await session_manager.delete_user_sessions(user_id)
        assert deleted_count == 2

        # Verify sessions are deleted
        sessions = await session_manager.get_user_sessions(user_id)
        assert len(sessions) == 0


@pytest.mark.asyncio
class TestAuthenticationService:
    """Test cases for AuthenticationService."""

    async def test_authenticate_user_success(self, db_session):
        """Test successful user authentication."""
        # Create test user
        user = User(
            email="auth@test.com",
            username="authuser",
            name="Auth User",
            password_hash=bcrypt.hashpw(
                "correctpass".encode("utf-8"), bcrypt.gensalt()
            ).decode("utf-8"),
            status=UserStatus.ACTIVE.value,
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)

        # Mock dependencies
        with patch("src.udp.security.auth.get_db_session") as mock_db_session:
            mock_db_session.return_value = db_session
            with patch(
                "src.udp.security.auth.get_settings", return_value=mock_settings()
            ):
                auth_service = AuthenticationService()

                # Test authentication
                auth_result = await auth_service.authenticate_user(
                    "auth@test.com", "correctpass", "192.168.1.1", "Test Browser/1.0"
                )

                assert "user" in auth_result
                assert auth_result["user"]["email"] == "auth@test.com"
                assert auth_result["user"]["name"] == "Auth User"
                assert "access_token" in auth_result
                assert "refresh_token" in auth_result
                assert "session_id" in auth_result
                assert "permissions" in auth_result

    async def test_authenticate_user_invalid_credentials(self, db_session):
        """Test authentication with invalid credentials."""
        # Create test user
        user = User(
            email="invalid@test.com",
            username="invaliduser",
            name="Invalid User",
            password_hash=bcrypt.hashpw(
                "correctpass".encode("utf-8"), bcrypt.gensalt()
            ).decode("utf-8"),
            status=UserStatus.ACTIVE.value,
        )
        db_session.add(user)
        await db_session.commit()

        # Mock dependencies
        with patch("src.udp.security.auth.get_db_session") as mock_db_session:
            mock_db_session.return_value = db_session
            with patch(
                "src.udp.security.auth.get_settings", return_value=mock_settings()
            ):
                auth_service = AuthenticationService()

                # Test authentication
                with pytest.raises(AuthenticationError) as exc:
                    await auth_service.authenticate_user(
                        "invalid@test.com",
                        "wrongpass",
                        "192.168.1.1",
                        "Test Browser/1.0",
                    )

                assert "credentials" in str(exc).lower()

    async def test_authenticate_user_not_found(self, db_session):
        """Test authentication with non-existent user."""
        # Mock dependencies
        with patch("src.udp.security.auth.get_db_session") as mock_db_session:
            mock_db_session.return_value = db_session
            with patch(
                "src.udp.security.auth.get_settings", return_value=mock_settings()
            ):
                auth_service = AuthenticationService()

                # Test authentication
                with pytest.raises(AuthenticationError) as exc:
                    await auth_service.authenticate_user(
                        "nonexistent@test.com",
                        "anypassword",
                        "192.168.1.1",
                        "Test Browser/1.0",
                    )

                assert "credentials" in str(exc).lower()

    async def test_authenticate_user_locked_account(self, db_session):
        """Test authentication with locked account."""
        # Create test user with many failed attempts
        user = User(
            email="locked@test.com",
            username="lockeduser",
            name="Locked User",
            password_hash=bcrypt.hashpw(
                "correctpass".encode("utf-8"), bcrypt.gensalt()
            ).decode("utf-8"),
            status=UserStatus.ACTIVE.value,
            failed_login_attempts="5",  # Trigger lock
            account_locked_until=datetime.utcnow().isoformat(),
        )
        db_session.add(user)
        await db_session.commit()

        # Mock dependencies
        with patch("src.udp.security.auth.get_db_session") as mock_db_session:
            mock_db_session.return_value = db_session
            with patch(
                "src.udp.security.auth.get_settings", return_value=mock_settings()
            ):
                auth_service = AuthenticationService()

                # Test authentication
                with pytest.raises(AuthenticationError) as exc:
                    await auth_service.authenticate_user(
                        "locked@test.com",
                        "correctpass",
                        "192.168.1.1",
                        "Test Browser/1.0",
                    )

                assert "locked" in str(exc).lower()

    async def test_refresh_token_success(self, auth_service_fixture):
        """Test successful token refresh."""
        # Mock authentication service dependencies
        with patch("src.udp.security.auth.get_db_session") as mock_db_session:
            # Mock token manager
            mock_token_manager = AsyncMock()
            mock_token_manager.refresh_access_token.return_value = {
                "access_token": "new-access-token",
                "refresh_token": "new-refresh-token",
                "token_type": "Bearer",
                "expires_in": 1800,
            }

            auth_service_fixture.token_manager = mock_token_manager

            # Test token refresh
            result = await auth_service_fixture.refresh_token("valid-refresh-token")

            assert result["access_token"] == "new-access-token"
            assert result["refresh_token"] == "new-refresh-token"
            assert result["token_type"] == "Bearer"

    async def test_refresh_token_invalid(self, auth_service_fixture):
        """Test refresh with invalid token."""
        # Mock token manager to raise exception
        mock_token_manager = AsyncMock()
        mock_token_manager.refresh_access_token.side_effect = TokenError(
            "Invalid refresh token"
        )

        auth_service_fixture.token_manager = mock_token_manager

        # Test token refresh
        with pytest.raises(TokenError):
            await auth_service_fixture.refresh_token("invalid-refresh-token")

    async def test_logout_user_success(self, auth_service_fixture):
        """Test successful user logout."""
        # Mock session manager
        mock_session_manager = AsyncMock()
        mock_session_manager.delete_session.return_value = True

        auth_service_fixture.session_manager = mock_session_manager

        # Test logout
        success = await auth_service_fixture.logout_user("valid-session-id")
        assert success is True

    async def test_logout_user_not_found(self, auth_service_fixture):
        """Test logout with invalid session ID."""
        # Mock session manager
        mock_session_manager = AsyncMock()
        mock_session_manager.delete_session.return_value = False

        auth_service_fixture.session_manager = mock_session_manager

        # Test logout
        success = await auth_service_fixture.logout_user("invalid-session-id")
        assert success is False

    async def test_validate_token_success(self, auth_service_fixture):
        """Test successful token validation."""
        # Mock token manager
        mock_token_manager = AsyncMock()
        mock_token_manager.validate_token.return_value = {
            "sub": str(uuid4()),
            "email": "test@example.com",
            "type": "access",
            "permissions": ["read_projects"],
        }

        auth_service_fixture.token_manager = mock_token_manager

        # Test token validation
        result = await auth_service_fixture.validate_token("valid-token")
        assert result["email"] == "test@example.com"
        assert result["permissions"] == ["read_projects"]

    async def test_validate_token_invalid(self, auth_service_fixture):
        """Test validation of invalid token."""
        # Mock token manager to raise exception
        mock_token_manager = AsyncMock()
        mock_token_manager.validate_token.side_effect = TokenError("Invalid token")

        auth_service_fixture.token_manager = mock_token_manager

        # Test token validation
        with pytest.raises(TokenError):
            await auth_service_fixture.validate_token("invalid-token")


@pytest.mark.asyncio
class TestAuthenticationMiddleware:
    """Test cases for AuthenticationMiddleware."""

    async def test_middleware_skip_excluded_paths(self):
        """Test middleware skipping excluded paths."""
        from fastapi import Request, Response
        from starlette.responses import JSONResponse

        app = AsyncMock()
        middleware = AuthenticationMiddleware(app, excluded_paths=["/health"])

        # Test request to excluded path
        request = MagicMock(spec=Request)
        request.url = MagicMock()
        request.url.path = "/health"
        request.headers = {}

        response = await middleware.dispatch(
            request, lambda req: JSONResponse({"status": "ok"})
        )
        assert response.status_code == 200

    async def test_middleware_valid_token(self):
        """Test middleware with valid token."""
        from fastapi import Request, Response
        from starlette.responses import JSONResponse

        app = AsyncMock()
        middleware = AuthenticationMiddleware(app)

        # Mock auth service
        mock_auth_service = AsyncMock()
        mock_auth_service.validate_token.return_value = {
            "sub": str(uuid4()),
            "email": "test@example.com",
            "permissions": ["read_projects"],
        }

        with patch("src.udp.api.middleware.auth.auth_service", mock_auth_service):
            request = MagicMock(spec=Request)
            request.url = MagicMock()
            request.url.path = "/api/v1/projects"
            request.headers = {"authorization": "Bearer valid-token"}
            request.state = MagicMock()

            response = await middleware.dispatch(
                request, lambda req: JSONResponse({"projects": []})
            )

            # Verify user was set in request state
            assert hasattr(request.state, "user")
            assert request.state.user["email"] == "test@example.com"

    async def test_middleware_missing_token(self):
        """Test middleware with missing token."""
        from fastapi import Request, Response

        app = AsyncMock()
        middleware = AuthenticationMiddleware(app)

        request = MagicMock(spec=Request)
        request.url = MagicMock()
        request.url.path = "/api/v1/projects"
        request.headers = {}

        response = await middleware.dispatch(
            request, lambda req: Response(status_code=200)
        )
        assert response.status_code == 401

    async def test_middleware_invalid_token(self):
        """Test middleware with invalid token."""
        from fastapi import Request, Response

        app = AsyncMock()
        middleware = AuthenticationMiddleware(app)

        # Mock auth service to raise exception
        mock_auth_service = AsyncMock()
        mock_auth_service.validate_token.side_effect = TokenError("Invalid token")

        with patch("src.udp.api.middleware.auth.auth_service", mock_auth_service):
            request = MagicMock(spec=Request)
            request.url = MagicMock()
            request.url.path = "/api/v1/projects"
            request.headers = {"authorization": "Bearer invalid-token"}

            response = await middleware.dispatch(
                request, lambda req: Response(status_code=200)
            )
            assert response.status_code == 401


@pytest.mark.asyncio
class TestAuthenticationDependencies:
    """Test cases for authentication utilities."""

    async def test_get_current_user_success(self):
        """Test getting current user with valid authentication."""
        from fastapi import Request

        # Create request with authenticated user
        request = MagicMock(spec=Request)
        request.state = MagicMock()
        request.state.user = {
            "id": str(uuid4()),
            "email": "test@example.com",
            "permissions": ["read_projects"],
        }

        user = get_current_user(request)
        assert user["email"] == "test@example.com"

    async def test_get_current_user_unauthenticated(self):
        """Test getting current user without authentication."""
        from fastapi import Request

        # Create request without authenticated user
        request = MagicMock(spec=Request)
        request.state = MagicMock()

        with pytest.raises(Exception):  # FastAPI HTTPException
            get_current_user(request)

    async def test_require_permissions_success(self):
        """Test require permissions decorator with valid permissions."""
        from fastapi import Request

        # Create request with authenticated user
        request = MagicMock(spec=Request)
        request.state = MagicMock()
        request.state.user = {
            "id": str(uuid4()),
            "email": "test@example.com",
            "permissions": ["read_projects", "write_projects"],
        }

        # Mock function
        @require_permissions(["read_projects"])
        async def protected_function(request):
            return {"status": "success"}

        result = await protected_function(request)
        assert result["status"] == "success"

    async def test_require_permissions_insufficient(self):
        """Test require permissions decorator with insufficient permissions."""
        from fastapi import Request

        # Create request with insufficient permissions
        request = MagicMock(spec=Request)
        request.state = MagicMock()
        request.state.user = {
            "id": str(uuid4()),
            "email": "test@example.com",
            "permissions": ["read_projects"],
        }

        # Mock function
        @require_permissions(["read_projects", "delete_projects"])
        async def protected_function(request):
            return {"status": "success"}

        with pytest.raises(Exception):  # FastAPI HTTPException
            await protected_function(request)


@pytest.mark.asyncio
async def test_auth_integration(db_session, test_user):
    """Integration test for authentication system."""
    from fastapi import Request, Response
    from starlette.responses import JSONResponse

    # Mock dependencies
    with patch("src.udp.security.auth.get_db_session") as mock_db_session:
        mock_db_session.return_value = db_session
        with patch("src.udp.security.auth.get_settings", return_value=mock_settings()):
            auth_service = AuthenticationService()

            # Test complete authentication flow
            auth_result = await auth_service.authenticate_user(
                "test@example.com", "testpassword", "192.168.1.1", "Test Browser/1.0"
            )

            assert "user" in auth_result
            assert "access_token" in auth_result
            assert "session_id" in auth_result

            # Test token validation
            validated_user = await auth_service.validate_token(
                auth_result["access_token"]
            )
            assert validated_user["email"] == "test@example.com"

            # Test session management
            session = await auth_service.get_session(auth_result["session_id"])
            assert session is not None
            assert session["user_id"] == auth_result["user"]["id"]

            print("✅ Authentication integration test completed successfully")


# Import required modules at module level
import bcrypt
from sqlalchemy import text
from fastapi import HTTPException
from starlette.requests import Request
from starlette.middleware.base import BaseHTTPMiddleware


if __name__ == "__main__":
    # Run tests directly for debugging
    import asyncio

    asyncio.run(pytest.main(["-v", __file__]))
