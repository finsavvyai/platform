"""
OAuth2/OIDC Integration Service for Enterprise SSO
"""

from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
import httpx
import jwt
from urllib.parse import urlencode, parse_qs
import secrets
import logging

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, Column, String, DateTime, Boolean, JSON
from sqlalchemy.dialects.postgresql import UUID
import uuid

from app.core.database import Base
from app.core.config import settings
from app.models.user import User
from app.services.jwt_service import JWTService

logger = logging.getLogger(__name__)


class OAuthProvider(Base):
    """OAuth provider configuration"""
    
    __tablename__ = "oauth_providers"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), unique=True, nullable=False)  # e.g., "google", "microsoft", "okta"
    display_name = Column(String(200), nullable=False)
    client_id = Column(String(500), nullable=False)
    client_secret = Column(String(500), nullable=False)  # Should be encrypted
    authorization_url = Column(String(500), nullable=False)
    token_url = Column(String(500), nullable=False)
    userinfo_url = Column(String(500), nullable=False)
    jwks_url = Column(String(500), nullable=True)  # For OIDC
    scopes = Column(JSON, default=list)  # List of scopes to request
    is_active = Column(Boolean, default=True)
    is_oidc = Column(Boolean, default=False)  # OpenID Connect support
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Configuration for user mapping
    user_mapping = Column(JSON, default=dict)  # Map OAuth fields to user fields


class OAuthState(Base):
    """OAuth state tracking for security"""
    
    __tablename__ = "oauth_states"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    state = Column(String(100), unique=True, nullable=False)
    provider_name = Column(String(100), nullable=False)
    redirect_uri = Column(String(500), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class OAuthService:
    """OAuth2/OIDC integration service"""
    
    def __init__(self):
        self.jwt_service = JWTService()
        self.state_expire_minutes = 10  # OAuth state expires in 10 minutes
        
        # Default provider configurations
        self.default_providers = {
            "google": {
                "display_name": "Google",
                "authorization_url": "https://accounts.google.com/o/oauth2/v2/auth",
                "token_url": "https://oauth2.googleapis.com/token",
                "userinfo_url": "https://www.googleapis.com/oauth2/v2/userinfo",
                "jwks_url": "https://www.googleapis.com/oauth2/v3/certs",
                "scopes": ["openid", "email", "profile"],
                "is_oidc": True,
                "user_mapping": {
                    "email": "email",
                    "name": "full_name",
                    "given_name": "first_name",
                    "family_name": "last_name",
                    "picture": "avatar_url"
                }
            },
            "microsoft": {
                "display_name": "Microsoft",
                "authorization_url": "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
                "token_url": "https://login.microsoftonline.com/common/oauth2/v2.0/token",
                "userinfo_url": "https://graph.microsoft.com/v1.0/me",
                "jwks_url": "https://login.microsoftonline.com/common/discovery/v2.0/keys",
                "scopes": ["openid", "email", "profile", "User.Read"],
                "is_oidc": True,
                "user_mapping": {
                    "mail": "email",
                    "displayName": "full_name",
                    "givenName": "first_name",
                    "surname": "last_name"
                }
            },
            "github": {
                "display_name": "GitHub",
                "authorization_url": "https://github.com/login/oauth/authorize",
                "token_url": "https://github.com/login/oauth/access_token",
                "userinfo_url": "https://api.github.com/user",
                "scopes": ["user:email"],
                "is_oidc": False,
                "user_mapping": {
                    "email": "email",
                    "name": "full_name",
                    "login": "username"
                }
            }
        }
    
    async def initialize_providers(self, db: AsyncSession) -> None:
        """Initialize OAuth providers from configuration"""
        try:
            for provider_name, config in self.default_providers.items():
                # Check if provider exists
                result = await db.execute(
                    select(OAuthProvider).where(OAuthProvider.name == provider_name)
                )
                existing_provider = result.scalar_one_or_none()
                
                if not existing_provider:
                    # Get credentials from environment
                    client_id = getattr(settings, f"{provider_name.upper()}_CLIENT_ID", None)
                    client_secret = getattr(settings, f"{provider_name.upper()}_CLIENT_SECRET", None)
                    
                    if client_id and client_secret:
                        provider = OAuthProvider(
                            name=provider_name,
                            display_name=config["display_name"],
                            client_id=client_id,
                            client_secret=client_secret,  # Should encrypt this
                            authorization_url=config["authorization_url"],
                            token_url=config["token_url"],
                            userinfo_url=config["userinfo_url"],
                            jwks_url=config.get("jwks_url"),
                            scopes=config["scopes"],
                            is_oidc=config["is_oidc"],
                            user_mapping=config["user_mapping"]
                        )
                        db.add(provider)
                        logger.info(f"Added OAuth provider: {provider_name}")
            
            await db.commit()
            
        except Exception as e:
            logger.error(f"Error initializing OAuth providers: {e}")
            await db.rollback()
    
    async def get_authorization_url(
        self,
        db: AsyncSession,
        provider_name: str,
        redirect_uri: str
    ) -> Optional[str]:
        """Generate OAuth authorization URL"""
        try:
            # Get provider configuration
            result = await db.execute(
                select(OAuthProvider).where(
                    OAuthProvider.name == provider_name,
                    OAuthProvider.is_active == True
                )
            )
            provider = result.scalar_one_or_none()
            
            if not provider:
                logger.error(f"OAuth provider {provider_name} not found")
                return None
            
            # Generate state for CSRF protection
            state = secrets.token_urlsafe(32)
            
            # Store state
            oauth_state = OAuthState(
                state=state,
                provider_name=provider_name,
                redirect_uri=redirect_uri,
                expires_at=datetime.utcnow() + timedelta(minutes=self.state_expire_minutes)
            )
            db.add(oauth_state)
            await db.commit()
            
            # Build authorization URL
            params = {
                "client_id": provider.client_id,
                "redirect_uri": redirect_uri,
                "scope": " ".join(provider.scopes),
                "state": state,
                "response_type": "code"
            }
            
            if provider.is_oidc:
                params["response_mode"] = "query"
            
            auth_url = f"{provider.authorization_url}?{urlencode(params)}"
            return auth_url
            
        except Exception as e:
            logger.error(f"Error generating authorization URL for {provider_name}: {e}")
            return None
    
    async def handle_callback(
        self,
        db: AsyncSession,
        provider_name: str,
        code: str,
        state: str,
        redirect_uri: str
    ) -> Optional[Dict[str, Any]]:
        """Handle OAuth callback and return user info"""
        try:
            # Verify state
            result = await db.execute(
                select(OAuthState).where(
                    OAuthState.state == state,
                    OAuthState.provider_name == provider_name,
                    OAuthState.expires_at > datetime.utcnow()
                )
            )
            oauth_state = result.scalar_one_or_none()
            
            if not oauth_state:
                logger.error(f"Invalid or expired OAuth state: {state}")
                return None
            
            # Get provider
            result = await db.execute(
                select(OAuthProvider).where(OAuthProvider.name == provider_name)
            )
            provider = result.scalar_one_or_none()
            
            if not provider:
                return None
            
            # Exchange code for token
            token_data = await self._exchange_code_for_token(
                provider, code, redirect_uri
            )
            
            if not token_data:
                return None
            
            # Get user info
            user_info = await self._get_user_info(provider, token_data)
            
            if not user_info:
                return None
            
            # Clean up state
            await db.delete(oauth_state)
            await db.commit()
            
            return {
                "provider": provider_name,
                "user_info": user_info,
                "token_data": token_data
            }
            
        except Exception as e:
            logger.error(f"Error handling OAuth callback for {provider_name}: {e}")
            return None
    
    async def _exchange_code_for_token(
        self,
        provider: OAuthProvider,
        code: str,
        redirect_uri: str
    ) -> Optional[Dict[str, Any]]:
        """Exchange authorization code for access token"""
        try:
            async with httpx.AsyncClient() as client:
                data = {
                    "grant_type": "authorization_code",
                    "client_id": provider.client_id,
                    "client_secret": provider.client_secret,
                    "code": code,
                    "redirect_uri": redirect_uri
                }
                
                headers = {"Accept": "application/json"}
                
                response = await client.post(
                    provider.token_url,
                    data=data,
                    headers=headers
                )
                
                if response.status_code == 200:
                    return response.json()
                else:
                    logger.error(f"Token exchange failed: {response.status_code} - {response.text}")
                    return None
                    
        except Exception as e:
            logger.error(f"Error exchanging code for token: {e}")
            return None
    
    async def _get_user_info(
        self,
        provider: OAuthProvider,
        token_data: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Get user information from OAuth provider"""
        try:
            access_token = token_data.get("access_token")
            if not access_token:
                return None
            
            # For OIDC, try to get user info from ID token first
            if provider.is_oidc and "id_token" in token_data:
                try:
                    # Decode ID token (should verify signature in production)
                    id_token = jwt.decode(
                        token_data["id_token"],
                        options={"verify_signature": False}  # Should verify in production
                    )
                    return self._map_user_info(provider, id_token)
                except Exception as e:
                    logger.warning(f"Failed to decode ID token: {e}")
            
            # Fallback to userinfo endpoint
            async with httpx.AsyncClient() as client:
                headers = {"Authorization": f"Bearer {access_token}"}
                
                response = await client.get(
                    provider.userinfo_url,
                    headers=headers
                )
                
                if response.status_code == 200:
                    user_data = response.json()
                    return self._map_user_info(provider, user_data)
                else:
                    logger.error(f"Userinfo request failed: {response.status_code}")
                    return None
                    
        except Exception as e:
            logger.error(f"Error getting user info: {e}")
            return None
    
    def _map_user_info(
        self,
        provider: OAuthProvider,
        raw_user_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Map OAuth user data to internal user format"""
        mapped_data = {}
        
        for oauth_field, internal_field in provider.user_mapping.items():
            if oauth_field in raw_user_data:
                mapped_data[internal_field] = raw_user_data[oauth_field]
        
        # Ensure we have required fields
        if "email" not in mapped_data:
            # Try common email fields
            for email_field in ["email", "mail", "emailAddress"]:
                if email_field in raw_user_data:
                    mapped_data["email"] = raw_user_data[email_field]
                    break
        
        return mapped_data
    
    async def find_or_create_user(
        self,
        db: AsyncSession,
        oauth_data: Dict[str, Any]
    ) -> Optional[User]:
        """Find existing user or create new one from OAuth data"""
        try:
            user_info = oauth_data["user_info"]
            provider_name = oauth_data["provider"]
            
            email = user_info.get("email")
            if not email:
                logger.error("No email provided in OAuth user info")
                return None
            
            # Try to find existing user
            result = await db.execute(
                select(User).where(User.email == email)
            )
            user = result.scalar_one_or_none()
            
            if user:
                # Update user info if needed
                if user_info.get("full_name") and not user.full_name:
                    user.full_name = user_info["full_name"]
                
                # Mark as verified since OAuth provider verified email
                user.is_verified = True
                user.last_login = datetime.utcnow()
                
                await db.commit()
                logger.info(f"Existing user {email} logged in via {provider_name}")
                return user
            else:
                # Create new user
                new_user = User(
                    email=email,
                    full_name=user_info.get("full_name", ""),
                    hashed_password="",  # OAuth users don't have passwords
                    is_active=True,
                    is_verified=True,  # OAuth provider verified email
                    last_login=datetime.utcnow(),
                    preferences={
                        "oauth_provider": provider_name,
                        "oauth_linked": True
                    }
                )
                
                db.add(new_user)
                await db.commit()
                await db.refresh(new_user)
                
                logger.info(f"Created new user {email} via {provider_name}")
                return new_user
                
        except Exception as e:
            logger.error(f"Error finding/creating OAuth user: {e}")
            await db.rollback()
            return None
    
    async def get_available_providers(self, db: AsyncSession) -> List[Dict[str, Any]]:
        """Get list of available OAuth providers"""
        try:
            result = await db.execute(
                select(OAuthProvider).where(OAuthProvider.is_active == True)
            )
            providers = result.scalars().all()
            
            return [
                {
                    "name": provider.name,
                    "display_name": provider.display_name,
                    "is_oidc": provider.is_oidc
                }
                for provider in providers
            ]
            
        except Exception as e:
            logger.error(f"Error getting available providers: {e}")
            return []