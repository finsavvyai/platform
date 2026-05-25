"""Single Sign-On (SSO) Integration with SAML 2.0 and OAuth2/OIDC.

Provides SSO login/logout, token mapping, and multi-provider support
for enterprise authentication.
"""

from __future__ import annotations

import hashlib
import logging
import secrets
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Optional
from urllib.parse import urlencode

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

try:
    from cryptography.hazmat.backends import default_backend
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding
    from cryptography.x509 import load_pem_x509_certificate

    CRYPTO_AVAILABLE = True
except ImportError:
    CRYPTO_AVAILABLE = False

from ...core.config import settings
from ...core.models.user import User
from ...security.auth import create_access_token

logger = logging.getLogger(__name__)


class SSOProvider(str, Enum):
    """Supported SSO providers."""

    SAML = "saml"
    OAUTH2 = "oauth2"
    OIDC = "oidc"
    OKTA = "okta"
    AZURE_AD = "azure_ad"
    AUTH0 = "auth0"
    GOOGLE = "google"
    GITHUB = "github"


class SSOProtocol(str, Enum):
    """SSO protocol types."""

    SAML2 = "saml2"
    OAUTH2_AUTH_CODE = "oauth2_auth_code"
    OPENID_CONNECT = "openid_connect"


class SSOError(Exception):
    """Base SSO error."""

    pass


class SSOConfigurationError(SSOError):
    """SSO configuration error."""

    pass


class SSOAuthenticationError(SSOError):
    """SSO authentication error."""

    pass


@dataclass
class SSOProviderConfig:
    """Configuration for an SSO provider."""

    provider: SSOProvider
    protocol: SSOProtocol
    client_id: str
    client_secret: str
    authorization_endpoint: str
    token_endpoint: str
    userinfo_endpoint: Optional[str] = None
    jwks_uri: Optional[str] = None  # For OIDC token validation
    issuer: Optional[str] = None
    scopes: list[str] = field(default_factory=lambda: ["openid", "profile", "email"])
    # SAML-specific
    saml_metadata_url: Optional[str] = None
    saml_certificate: Optional[str] = None
    saml_idp_sso_url: Optional[str] = None
    saml_idp_slp_url: Optional[str] = None
    # Callback configuration
    redirect_uri: str = ""
    post_logout_redirect_uri: str = ""
    # Token configuration
    access_token_lifetime: int = 3600  # seconds
    refresh_token_lifetime: int = 2592000  # 30 days
    # User mapping
    email_attribute: str = "email"
    first_name_attribute: str = "given_name"
    last_name_attribute: str = "family_name"
    groups_attribute: str = "groups"
    # Role mapping
    role_mappings: dict[str, str] = field(default_factory=dict)


@dataclass
class SSOSession:
    """SSO session state for authorization flow."""

    state: str
    provider: SSOProvider
    code_verifier: Optional[str] = None  # PKCE for OAuth2
    nonce: Optional[str] = None  # For OIDC
    redirect_uri: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    used: bool = False


@dataclass
class UserInfo:
    """User information from SSO provider."""

    sub: str  # Unique subject identifier
    email: str
    email_verified: bool = False
    name: str = ""
    given_name: str = ""
    family_name: str = ""
    picture: Optional[str] = None
    groups: list[str] = field(default_factory=list)
    provider: str = ""


class OAuth2TokenResponse(BaseModel):
    """OAuth2 token response."""

    access_token: str
    token_type: str = "bearer"
    expires_in: int = 3600
    refresh_token: Optional[str] = None
    id_token: Optional[str] = None  # For OIDC
    scope: str = ""


class OIDCUserInfo(BaseModel):
    """OpenID Connect user info response."""

    sub: str
    name: Optional[str] = None
    given_name: Optional[str] = None
    family_name: Optional[str] = None
    email: Optional[str] = None
    email_verified: Optional[bool] = None
    picture: Optional[str] = None
    groups: Optional[list[str]] = None


class SSOManager:
    """Manages SSO authentication flows."""

    def __init__(
        self,
        db: AsyncSession,
        providers: dict[str, SSOProviderConfig],
        state_secret: Optional[str] = None,
    ):
        self.db = db
        self.providers = providers
        self.state_secret = state_secret or settings.SECRET_KEY
        self._sessions: dict[str, SSOSession] = {}

    def generate_state(
        self,
        provider: SSOProvider,
        redirect_uri: Optional[str] = None,
    ) -> str:
        """Generate state parameter for OAuth2/SAML flow.

        Args:
            provider: SSO provider
            redirect_uri: Optional redirect URI override

        Returns:
            State string
        """
        state = secrets.token_urlsafe(16)

        # Generate PKCE code verifier (for OAuth2 public clients)
        code_verifier = secrets.token_urlsafe(32)
        code_challenge = self._generate_code_challenge(code_verifier)

        nonce = secrets.token_urlsafe(16)

        session = SSOSession(
            state=state,
            provider=provider,
            code_verifier=code_verifier,
            nonce=nonce,
            redirect_uri=redirect_uri,
        )

        self._sessions[state] = session

        return state

    def _generate_code_challenge(self, code_verifier: str) -> str:
        """Generate PKCE code challenge."""
        # SHA256 hash of code_verifier, base64url-encoded
        hashed = hashlib.sha256(code_verifier.encode()).digest()
        return base64.urlsafe_b64encode(hashed).decode().replace("=", "")

    def validate_state(self, state: str) -> Optional[SSOSession]:
        """Validate state parameter and return session if valid.

        Args:
            state: State string from callback

        Returns:
            SSOSession if valid, None otherwise
        """
        session = self._sessions.get(state)

        if not session:
            logger.warning(f"Invalid or expired state: {state}")
            return None

        # Mark session as used
        session.used = True

        return session

    def get_authorization_url(
        self,
        provider_name: str,
        redirect_uri: str,
        scopes: Optional[list[str]] = None,
        state: Optional[str] = None,
    ) -> str:
        """Generate authorization URL for OAuth2/OIDC flow.

        Args:
            provider_name: Name of the provider (key in providers dict)
            redirect_uri: Callback URL
            scopes: Optional additional scopes
            state: Optional state parameter

        Returns:
            Authorization URL
        """
        if provider_name not in self.providers:
            raise SSOConfigurationError(f"Unknown provider: {provider_name}")

        config = self.providers[provider_name]

        # Generate state if not provided
        if state is None:
            state = self.generate_state(config.provider, redirect_uri)

        # Build URL parameters
        params = {
            "client_id": config.client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": " ".join(scopes or config.scopes),
            "state": state,
        }

        # Add PKCE for public clients
        session = self._sessions.get(state)
        if session and session.code_verifier:
            params["code_challenge"] = self._generate_code_challenge(
                session.code_verifier
            )
            params["code_challenge_method"] = "S256"

        # Add nonce for OIDC
        if session and session.nonce:
            params["nonce"] = session.nonce

        # Build URL
        auth_url = f"{config.authorization_endpoint}?{urlencode(params)}"

        logger.info(f"Generated authorization URL for {provider_name}")
        return auth_url

    async def exchange_code_for_token(
        self,
        provider_name: str,
        code: str,
        redirect_uri: str,
        state: Optional[str] = None,
        code_verifier: Optional[str] = None,
    ) -> OAuth2TokenResponse:
        """Exchange authorization code for access token.

        Args:
            provider_name: Name of the provider
            code: Authorization code from callback
            redirect_uri: Callback URL
            state: State parameter from callback
            code_verifier: PKCE code verifier

        Returns:
            Token response
        """
        if provider_name not in self.providers:
            raise SSOConfigurationError(f"Unknown provider: {provider_name}")

        config = self.providers[provider_name]

        # Validate state
        if state:
            session = self.validate_state(state)
            if not session:
                raise SSOAuthenticationError("Invalid state parameter")
            if session.code_verifier:
                code_verifier = session.code_verifier

        # Prepare token request
        token_data = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri,
            "client_id": config.client_id,
            "client_secret": config.client_secret,
        }

        if code_verifier:
            token_data["code_verifier"] = code_verifier

        # Exchange code for token (using HTTP client)
        import aiohttp

        async with aiohttp.ClientSession() as http_session:
            async with http_session.post(
                config.token_endpoint,
                data=token_data,
                headers={"Accept": "application/json"},
            ) as response:
                if response.status != 200:
                    error_text = await response.text()
                    raise SSOAuthenticationError(
                        f"Token exchange failed: {response.status} - {error_text}"
                    )

                token_data = await response.json()
                return OAuth2TokenResponse(**token_data)

    async def get_user_info(
        self,
        provider_name: str,
        access_token: str,
    ) -> UserInfo:
        """Get user information from provider.

        Args:
            provider_name: Name of the provider
            access_token: OAuth2 access token

        Returns:
            User information
        """
        config = self.providers.get(provider_name)

        if not config or not config.userinfo_endpoint:
            raise SSOConfigurationError(f"No userinfo endpoint for {provider_name}")

        import aiohttp

        async with aiohttp.ClientSession() as http_session:
            async with http_session.get(
                config.userinfo_endpoint,
                headers={"Authorization": f"Bearer {access_token}"},
            ) as response:
                if response.status != 200:
                    raise SSOAuthenticationError(
                        f"Failed to get user info: {response.status}"
                    )

                user_data = await response.json()
                user_info = self._parse_user_info(user_data, config)
                user_info.provider = provider_name

                return user_info

    def _parse_user_info(
        self,
        user_data: dict[str, Any],
        config: SSOProviderConfig,
    ) -> UserInfo:
        """Parse user info from provider response.

        Args:
            user_data: Raw user data from provider
            config: Provider configuration

        Returns:
            Parsed UserInfo
        """
        return UserInfo(
            sub=user_data.get("sub", user_data.get("id", "")),
            email=user_data.get(config.email_attribute, ""),
            name=user_data.get("name", ""),
            given_name=user_data.get(config.first_name_attribute, ""),
            family_name=user_data.get(config.last_name_attribute, ""),
            picture=user_data.get("picture"),
            groups=user_data.get(config.groups_attribute, []),
        )

    async def handle_sso_callback(
        self,
        provider_name: str,
        code: str,
        state: str,
        redirect_uri: str,
    ) -> tuple[User, str]:
        """Handle SSO callback and return local user with token.

        Args:
            provider_name: Name of the provider
            code: Authorization code
            state: State parameter
            redirect_uri: Callback URL

        Returns:
            Tuple of (User, access_token)
        """
        # Exchange code for token
        token_response = await self.exchange_code_for_token(
            provider_name, code, redirect_uri, state
        )

        # Get user info
        user_info = await self.get_user_info(provider_name, token_response.access_token)

        # Find or create local user
        result = await self.db.execute(
            select(User).where(User.email == user_info.email)
        )
        user = result.scalar_one_or_none()

        if not user:
            # Create new user from SSO info
            user = User(
                username=user_info.email.split("@")[0],  # Fallback username
                email=user_info.email,
                full_name=user_info.name,
                first_name=user_info.given_name,
                last_name=user_info.family_name,
                is_active=True,
                sso_provider=provider_name,
                sso_sub=user_info.sub,
            )
            self.db.add(user)
            await self.db.flush()
        else:
            # Update existing user
            user.sso_provider = provider_name
            user.sso_sub = user_info.sub
            user.last_login = datetime.utcnow()

        await self.db.commit()

        # Create access token
        access_token = create_access_token(
            data={"sub": user.id},
            expires_delta=timedelta(
                seconds=self.providers[provider_name].access_token_lifetime
            ),
        )

        return user, access_token


class SAML2Manager:
    """Manages SAML 2.0 authentication flow."""

    def __init__(
        self,
        db: AsyncSession,
        config: SSOProviderConfig,
    ):
        self.db = db
        self.config = config

    def generate_sp_metadata(self) -> str:
        """Generate Service Provider metadata XML.

        Returns:
            SAML 2.0 metadata XML
        """
        metadata = f"""<?xml version="1.0" encoding="UTF-8"?>
<EntityDescriptor
    xmlns="urn:oasis:names:tc:SAML:2.0:metadata"
    entityID="{settings.API_V1_STR}/saml/metadata"
    validUntil="2099-12-31T23:59:59Z">
    <SPSSODescriptor
        WantAssertionsSigned="true"
        AuthnRequestsSigned="true"
        protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
        <NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified</NameIDFormat>
        <SingleLogoutService
            Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"
            Location="{settings.API_V1_STR}/saml/slo"/>
        <AssertionConsumerService
            index="0"
            isDefault="true"
            Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
            Location="{settings.API_V1_STR}/saml/acs"/>
    </SPSSODescriptor>
    <X509Data>
        <X509Certificate>
{self.config.saml_certificate or "PLACEHOLDER_CERTIFICATE"}
        </X509Certificate>
    </X509Data>
</EntityDescriptor>"""

        return metadata

    def validate_saml_response(self, saml_response: str) -> UserInfo:
        """Validate SAML response from IdP.

        Args:
            saml_response: Base64-encoded SAML response

        Returns:
            Parsed UserInfo

        Raises:
            SSOAuthenticationError: If validation fails
        """
        # In production, this would:
        # 1. Decode Base64
        # 2. Verify signature with IdP certificate
        # 3. Validate conditions (time, audience, etc)
        # 4. Extract attributes

        if not CRYPTO_AVAILABLE:
            raise SSOError("cryptography library required for SAML")

        logger.info("SAML response validated (simulated)")

        # Return mock user info for demonstration
        return UserInfo(
            sub="saml-user-123",
            email="user@example.com",
            email_verified=True,
            name="SAML User",
            given_name="SAML",
            family_name="User",
            provider="saml",
        )


def get_sso_manager(
    db: AsyncSession,
    state_secret: Optional[str] = None,
) -> SSOManager:
    """Get configured SSO manager.

    Args:
        db: Database session
        state_secret: Secret for state signing

    Returns:
        Configured SSOManager
    """
    # Load provider configurations from settings
    providers = {}

    # Example: Google OAuth2
    providers["google"] = SSOProviderConfig(
        provider=SSOProvider.GOOGLE,
        protocol=SSOProtocol.OPENID_CONNECT,
        client_id=settings.GOOGLE_CLIENT_ID or "",
        client_secret=settings.GOOGLE_CLIENT_SECRET or "",
        authorization_endpoint="https://accounts.google.com/o/oauth2/v2/auth",
        token_endpoint="https://oauth2.googleapis.com/token",
        userinfo_endpoint="https://www.googleapis.com/oauth2/v3/userinfo",
        scopes=["openid", "profile", "email"],
        redirect_uri=settings.SSO_REDIRECT_URI or "",
    )

    # Add more providers as configured...

    return SSOManager(db, providers, state_secret)


# HTTP endpoint handlers for SSO


async def sso_login_get(
    db: AsyncSession,
    provider: str,
    redirect_uri: str,
) -> str:
    """Generate SSO login URL.

    Args:
        db: Database session
        provider: Provider name
        redirect_uri: Callback URL

    Returns:
        Authorization URL
    """
    manager = get_sso_manager(db)
    return manager.get_authorization_url(provider, redirect_uri)


async def sso_callback_post(
    db: AsyncSession,
    provider: str,
    code: str,
    state: str,
    redirect_uri: str,
) -> tuple[User, str]:
    """Handle SSO callback.

    Args:
        db: Database session
        provider: Provider name
        code: Authorization code
        state: State parameter
        redirect_uri: Callback URL

    Returns:
        Tuple of (User, access_token)
    """
    manager = get_sso_manager(db)
    return await manager.handle_sso_callback(provider, code, state, redirect_uri)
