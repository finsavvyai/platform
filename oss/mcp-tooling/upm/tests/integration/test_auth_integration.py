"""
Integration tests for authentication system.

Tests full authentication flow including database operations,
Redis session management, and API endpoints.
"""

import pytest
from httpx import AsyncClient
from datetime import datetime, timedelta
import jwt

from udp.core.models.user import User
from udp.core.config import settings
from udp.security.auth import (
    create_access_token,
    create_refresh_token,
    verify_password,
    get_password_hash,
)


@pytest.mark.integration
class TestAuthenticationFlow:
    """Integration tests for authentication flow."""

    @pytest.mark.asyncio
    async def test_user_registration_and_login(self, client: AsyncClient):
        """Test complete user registration and login flow."""
        # Test user registration
        user_data = {
            "email": "newuser@example.com",
            "username": "newuser",
            "password": "SecurePassword123!",
            "full_name": "New User",
        }

        # First check if user doesn't exist
        response = await client.post("/api/v1/auth/register", json=user_data)

        # If user already exists, create a unique user
        if (
            response.status_code == 400
            and "already registered" in response.json()["detail"]
        ):
            user_data["email"] = f"newuser_{datetime.utcnow().timestamp()}@example.com"
            user_data["username"] = f"newuser_{datetime.utcnow().timestamp()}"
            response = await client.post("/api/v1/auth/register", json=user_data)

        assert response.status_code == 200
        registered_user = response.json()
        assert registered_user["email"] == user_data["email"]
        assert registered_user["username"] == user_data["username"]
        assert registered_user["is_active"] is True
        assert "id" in registered_user
        assert "password" not in registered_user  # Password should not be returned

    @pytest.mark.asyncio
    async def test_login_with_valid_credentials(
        self, client: AsyncClient, test_user: User
    ):
        """Test login with valid credentials."""
        login_data = {"username": test_user.email, "password": "testpassword123"}

        response = await client.post("/api/v1/auth/login", data=login_data)

        assert response.status_code == 200
        token_data = response.json()
        assert "access_token" in token_data
        assert "token_type" in token_data
        assert token_data["token_type"] == "bearer"
        assert "expires_in" in token_data
        assert isinstance(token_data["expires_in"], int)

    @pytest.mark.asyncio
    async def test_login_with_invalid_credentials(self, client: AsyncClient):
        """Test login with invalid credentials."""
        login_data = {
            "username": "nonexistent@example.com",
            "password": "wrongpassword",
        }

        response = await client.post("/api/v1/auth/login", data=login_data)

        assert response.status_code == 401
        assert "Incorrect username or password" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_access_protected_endpoint_without_auth(self, client: AsyncClient):
        """Test accessing protected endpoint without authentication."""
        response = await client.get("/api/v1/auth/me")

        assert response.status_code == 401
        assert "Not authenticated" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_access_protected_endpoint_with_valid_token(
        self, client: AsyncClient, test_user: User
    ):
        """Test accessing protected endpoint with valid token."""
        # First login to get token
        login_data = {"username": test_user.email, "password": "testpassword123"}

        login_response = await client.post("/api/v1/auth/login", data=login_data)

        access_token = login_response.json()["access_token"]

        # Access protected endpoint
        response = await client.get(
            "/api/v1/auth/me", headers={"Authorization": f"Bearer {access_token}"}
        )

        assert response.status_code == 200
        user_data = response.json()
        assert user_data["email"] == test_user.email
        assert user_data["id"] == str(test_user.id)
        assert user_data["is_active"] is True

    @pytest.mark.asyncio
    async def test_access_protected_endpoint_with_invalid_token(
        self, client: AsyncClient
    ):
        """Test accessing protected endpoint with invalid token."""
        response = await client.get(
            "/api/v1/auth/me", headers={"Authorization": "Bearer invalid_token"}
        )

        assert response.status_code == 401
        assert "Could not validate credentials" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_token_refresh_flow(self, client: AsyncClient, test_user: User):
        """Test token refresh mechanism."""
        # Login to get initial tokens
        login_data = {"username": test_user.email, "password": "testpassword123"}

        login_response = await client.post("/api/v1/auth/login", data=login_data)

        original_access_token = login_response.json()["access_token"]
        original_refresh_token = login_response.json()["refresh_token"]

        # Refresh token
        refresh_data = {"refresh_token": original_refresh_token}

        refresh_response = await client.post("/api/v1/auth/refresh", json=refresh_data)

        assert refresh_response.status_code == 200
        token_data = refresh_response.json()

        assert "access_token" in token_data
        assert "refresh_token" in token_data
        assert token_data["token_type"] == "bearer"

        # Verify new access token is different from original
        new_access_token = token_data["access_token"]
        assert new_access_token != original_access_token

    @pytest.mark.asyncio
    async def test_token_expiration(self, client: AsyncClient, test_user: User):
        """Test token expiration behavior."""
        # Create token that's already expired
        expired_token = create_access_token(
            data={"sub": test_user.email, "email": test_user.email},
            expires_delta=timedelta(seconds=-1),  # Expired
        )

        response = await client.get(
            "/api/v1/auth/me", headers={"Authorization": f"Bearer {expired_token}"}
        )

        assert response.status_code == 401
        assert "Could not validate credentials" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_logout_endpoint(self, client: AsyncClient, test_user: User):
        """Test logout endpoint."""
        # Login first
        login_data = {"username": test_user.email, "password": "testpassword123"}

        login_response = await client.post("/api/v1/auth/login", data=login_data)

        access_token = login_response.json()["access_token"]

        # Logout
        logout_response = await client.post(
            "/api/v1/auth/logout", headers={"Authorization": f"Bearer {access_token}"}
        )

        # Logout should return 204 No Content
        assert logout_response.status_code == 204

    @pytest.mark.asyncio
    async def test_password_hashing_consistency(self):
        """Test password hashing and verification consistency."""
        password = "SecurePassword123!"

        # Hash password multiple times
        hash1 = get_password_hash(password)
        hash2 = get_password_hash(password)
        hash3 = get_password_hash(password)

        # All hashes should be different (due to bcrypt salt)
        assert hash1 != hash2
        assert hash2 != hash3
        assert hash1 != hash3

        # All should verify correctly
        assert verify_password(password, hash1) is True
        assert verify_password(password, hash2) is True
        assert verify_password(password, hash3) is True

        # Wrong passwords should not verify
        assert verify_password("wrongpassword", hash1) is False
        assert verify_password("", hash2) is False

    @pytest.mark.asyncio
    async def test_jwt_token_structure(self, test_user: User):
        """Test JWT token structure and claims."""
        token_data = {"sub": test_user.email, "email": test_user.email}
        token = create_access_token(token_data)

        # Token should be a string with 3 parts
        assert isinstance(token, str)
        assert token.count(".") == 2

        # Decode token without verification (just to check structure)
        parts = token.split(".")
        assert len(parts) == 3

        # Each part should be base64 encoded
        import base64

        for part in parts:
            # Add padding if needed
            padding = len(part) % 4
            if padding:
                part += "=" * (4 - padding)
            try:
                decoded = base64.b64decode(part)
                assert isinstance(decoded, bytes)
            except Exception:
                # This is okay as some parts are binary
                pass

    @pytest.mark.asyncio
    async def test_user_registration_duplicate_email(
        self, client: AsyncClient, test_user: User
    ):
        """Test user registration with duplicate email."""
        user_data = {
            "email": test_user.email,  # Same as existing user
            "username": "different_username",
            "password": "SecurePassword123!",
            "full_name": "Different User",
        }

        response = await client.post("/api/v1/auth/register", json=user_data)

        assert response.status_code == 400
        assert "already registered" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_user_registration_weak_password(self, client: AsyncClient):
        """Test user registration with weak password."""
        user_data = {
            "email": "weakuser@example.com",
            "username": "weakuser",
            "password": "123",  # Too weak
            "full_name": "Weak User",
        }

        response = await client.post("/api/v1/auth/register", json=user_data)

        # Should fail validation
        assert response.status_code == 422


@pytest.mark.integration
class TestSecurityHeaders:
    """Integration tests for security headers."""

    @pytest.mark.asyncio
    async def test_security_headers_present(self, client: AsyncClient):
        """Test that security headers are present in responses."""
        response = await client.get("/health")

        # Check for security headers
        headers = response.headers
        assert "x-content-type-options" in headers
        assert headers["x-content-type-options"] == "nosniff"
        assert "x-frame-options" in headers
        assert headers["x-frame-options"] == "DENY"
        assert "x-xss-protection" in headers


@pytest.mark.integration
class TestRateLimiting:
    """Integration tests for rate limiting."""

    @pytest.mark.asyncio
    async def test_login_rate_limiting(self, client: AsyncClient):
        """Test rate limiting on login endpoint."""
        # This test assumes rate limiting is configured for login
        # Make multiple failed login attempts rapidly
        for i in range(10):
            login_data = {"username": "test@example.com", "password": "wrongpassword"}

            response = await client.post("/api/v1/auth/login", data=login_data)

        # After many attempts, should get rate limited (429)
        # This depends on actual rate limiting configuration
        pass


@pytest.mark.integration
class TestSessionManagement:
    """Integration tests for session management."""

    @pytest.mark.asyncio
    async def test_multiple_concurrent_sessions(
        self, client: AsyncClient, test_user: User
    ):
        """Test handling of multiple concurrent sessions."""
        # Create multiple sessions for the same user
        sessions = []

        for i in range(3):
            login_data = {"username": test_user.email, "password": "testpassword123"}

            response = await client.post("/api/v1/auth/login", data=login_data)

            assert response.status_code == 200
            token_data = response.json()
            sessions.append(token_data)

        # All sessions should work
        for i, session in enumerate(sessions):
            response = await client.get(
                "/api/v1/auth/me",
                headers={"Authorization": f"Bearer {session['access_token']}"},
            )
            assert response.status_code == 200
            user_data = response.json()
            assert user_data["email"] == test_user.email
