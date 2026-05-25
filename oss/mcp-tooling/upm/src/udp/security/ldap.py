"""LDAP/Active Directory Integration for UPM.

Provides authentication and user synchronization against enterprise
directories using LDAP protocol.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

try:
    from ldap3 import ALL, LEVEL, MODIFY_ADD, MODIFY_DELETE, SUBTREE, Connection, Server
    from ldap3.core.exceptions import LDAPBindError, LDAPException, LDAPSearchError

    LDAP_AVAILABLE = True
except ImportError:
    LDAP_AVAILABLE = False
    Server = None
    Connection = None
    ALL = SUBTREE = LEVEL = MODIFY_ADD = MODIFY_DELETE = object

from ...core.models.user import User

logger = logging.getLogger(__name__)


class LDAPSyncMode(str, Enum):
    """LDAP synchronization mode."""

    READ_ONLY = "read_only"  # Only authenticate, don't sync users
    SYNC_ON_LOGIN = "sync_on_login"  # Sync user attributes on each login
    SYNC_BACKGROUND = "sync_background"  # Background periodic sync


@dataclass
class LDAPServerConfig:
    """LDAP server configuration."""

    host: str
    port: int = 389
    use_ssl: bool = True
    use_tls: bool = False
    bind_dn: Optional[str] = None
    bind_password: Optional[str] = None
    user_search_base: str = ""
    user_search_filter: str = "(objectClass=user)"
    user_object_class: str = "user"
    username_attribute: str = "sAMAccountName"  # AD default
    email_attribute: str = "mail"
    first_name_attribute: str = "givenName"
    last_name_attribute: str = "sn"
    group_search_base: Optional[str] = None
    group_search_filter: str = "(objectClass=group)"
    group_name_attribute: str = "cn"
    group_member_attribute: str = "member"
    sync_mode: LDAPSyncMode = LDAPSyncMode.SYNC_ON_LOGIN


@dataclass
class LDAPUserAttributes:
    """LDAP user attributes."""

    dn: str
    username: str
    email: str
    first_name: str
    last_name: str
    display_name: str = ""
    phone: Optional[str] = None
    department: Optional[str] = None
    title: Optional[str] = None
    groups: list[str] = field(default_factory=list)
    is_active: bool = True


class LDAPAuthenticationError(Exception):
    """LDAP authentication failed."""

    pass


class LDAPConnectionError(Exception):
    """Failed to connect to LDAP server."""

    pass


class LDAPSyncError(Exception):
    """Failed to synchronize LDAP data."""

    pass


class LDAPGroupMapping:
    """Maps LDAP groups to UPM roles."""

    # Default group mappings
    DEFAULT_MAPPINGS: dict[str, str] = {
        "Domain Admins": "admin",
        "Enterprise Admins": "admin",
        "Administrators": "admin",
        "Developers": "developer",
        "DevOps": "developer",
        "Security": "security_admin",
        "Users": "user",
    }

    def __init__(self, custom_mappings: Optional[dict[str, str]] = None):
        self.mappings = {**self.DEFAULT_MAPPINGS}
        if custom_mappings:
            self.mappings.update(custom_mappings)

    def get_role(self, ldap_group: str) -> Optional[str]:
        """Get UPM role for an LDAP group."""
        return self.mappings.get(ldap_group)

    def get_roles(self, ldap_groups: list[str]) -> set[str]:
        """Get UPM roles for LDAP groups."""
        roles = set()
        for group in ldap_groups:
            role = self.get_role(group)
            if role:
                roles.add(role)
        return roles


class LDAPAuthProvider:
    """LDAP authentication provider for UPM."""

    def __init__(self, config: LDAPServerConfig):
        if not LDAP_AVAILABLE:
            raise ImportError(
                "ldap3 is required for LDAP authentication. "
                "Install with: pip install ldap3"
            )

        self.config = config
        self.group_mapping = LDAPGroupMapping()

    def _get_connection(self) -> Connection:
        """Establish connection to LDAP server."""
        server = Server(
            self.config.host,
            port=self.config.port,
            use_ssl=self.config.use_ssl,
            get_info=ALL,
        )

        try:
            if self.config.bind_dn and self.config.bind_password:
                # Simple bind
                conn = Connection(
                    server,
                    auto_bind=True,
                    user=self.config.bind_dn,
                    password=self.config.bind_password,
                )
            else:
                # Anonymous bind
                conn = Connection(server, auto_bind=True)

            # Start TLS if configured
            if self.config.use_tls:
                conn.start_tls()

            return conn

        except LDAPBindError as e:
            raise LDAPConnectionError(f"Failed to bind to LDAP server: {e}")
        except LDAPException as e:
            raise LDAPConnectionError(f"Failed to connect to LDAP server: {e}")

    def authenticate(
        self,
        username: str,
        password: str,
    ) -> Optional[LDAPUserAttributes]:
        """Authenticate a user against LDAP.

        Args:
            username: Username (sAMAccountName for AD)
            password: User password

        Returns:
            LDAPUserAttributes if authentication succeeds, None otherwise

        Raises:
            LDAPConnectionError: If connection fails
        """
        conn = None
        try:
            conn = self._get_connection()

            # Search for user
            user_dn = self._find_user_dn(conn, username)

            if not user_dn:
                logger.warning(f"User not found in LDAP: {username}")
                return None

            # Attempt to bind as the user to verify password
            try:
                user_conn = Connection(
                    conn.server,
                    user=user_dn,
                    password=password,
                    auto_bind=True,
                )
                user_conn.unbind()
            except LDAPBindError:
                logger.warning(f"LDAP authentication failed for: {username}")
                return None

            # Fetch user attributes
            attributes = self._get_user_attributes(conn, user_dn)

            logger.info(f"LDAP authentication successful: {username}")
            return attributes

        except LDAPException as e:
            logger.error(f"LDAP authentication error: {e}")
            raise LDAPAuthenticationError(f"LDAP authentication failed: {e}")
        finally:
            if conn:
                conn.unbind()

    def _find_user_dn(self, conn: Connection, username: str) -> Optional[str]:
        """Find user's Distinguished Name."""
        try:
            search_filter = f"(&{self.config.user_search_filter}({self.config.username_attribute}={username}))"

            conn.search(
                search_base=self.config.user_search_base,
                search_filter=search_filter,
                search_scope=SUBTREE,
                attributes=[self.config.username_attribute, "distinguishedName"],
            )

            result = conn.entries()

            if result:
                return result[0].get("distinguishedName", [None])[0]

        except LDAPSearchError as e:
            logger.error(f"LDAP search error: {e}")

        return None

    def _get_user_attributes(
        self, conn: Connection, user_dn: str
    ) -> Optional[LDAPUserAttributes]:
        """Get all attributes for a user."""
        try:
            conn.search(
                search_base=user_dn,
                search_filter="(objectClass=*)",
                search_scope=BASE,
                attributes=[
                    "distinguishedName",
                    self.config.username_attribute,
                    self.config.email_attribute,
                    self.config.first_name_attribute,
                    self.config.last_name_attribute,
                    "displayName",
                    "telephoneNumber",
                    "department",
                    "title",
                    "userAccountControl",  # AD for account status
                ],
            )

            result = conn.entries()

            if not result:
                return None

            entry = result[0]

            # Check if account is disabled (AD)
            user_account_control = entry.get("userAccountControl", [0])[0]
            is_disabled = bool(int(user_account_control) & 0x0002)

            # Get user groups
            groups = []
            if self.config.group_search_base:
                groups = self._get_user_groups(
                    conn, entry.get("distinguishedName", [""])[0]
                )

            return LDAPUserAttributes(
                dn=entry.get("distinguishedName", [""])[0],
                username=entry.get(self.config.username_attribute, [""])[0],
                email=entry.get(self.config.email_attribute, [""])[0] or "",
                first_name=entry.get(self.config.first_name_attribute, [""])[0] or "",
                last_name=entry.get(self.config.last_name_attribute, [""])[0] or "",
                display_name=entry.get("displayName", [""])[0] or "",
                phone=entry.get("telephoneNumber", [None])[0],
                department=entry.get("department", [None])[0],
                title=entry.get("title", [None])[0],
                groups=groups,
                is_active=not is_disabled,
            )

        except Exception as e:
            logger.error(f"Error fetching user attributes: {e}")
            return None

    def _get_user_groups(self, conn: Connection, user_dn: str) -> list[str]:
        """Get groups that a user is a member of."""
        groups = []

        try:
            # Search for groups where the user is a member
            search_filter = f"(&{self.config.group_search_filter}({self.config.group_member_attribute}={user_dn}))"

            conn.search(
                search_base=self.config.group_search_base,
                search_filter=search_filter,
                search_scope=SUBTREE,
                attributes=[self.config.group_name_attribute],
                size_limit=100,
            )

            result = conn.entries()

            for entry in result:
                group_name = entry.get(self.config.group_name_attribute, [""])[0]
                if group_name:
                    groups.append(group_name)

        except Exception as e:
            logger.warning(f"Error fetching user groups: {e}")

        return groups


class LDAPUserSynchronizer:
    """Synchronizes LDAP users with UPM database."""

    def __init__(
        self,
        db: AsyncSession,
        config: LDAPServerConfig,
        group_mapping: Optional[LDAPGroupMapping] = None,
    ):
        self.db = db
        self.config = config
        self.group_mapping = group_mapping or LDAPGroupMapping()

    async def sync_user(
        self,
        ldap_attrs: LDAPUserAttributes,
        organization_id: Optional[str] = None,
    ) -> User:
        """Synchronize a single LDAP user to UPM database.

        Args:
            ldap_attrs: LDAP user attributes
            organization_id: Optional organization ID

        Returns:
            Synchronized User instance
        """
        # Check if user exists
        result = await self.db.execute(
            select(User).where(User.username == ldap_attrs.username)
        )
        user = result.scalar_one_or_none()

        if user:
            # Update existing user
            user.email = ldap_attrs.email
            user.full_name = f"{ldap_attrs.first_name} {ldap_attrs.last_name}"
            user.first_name = ldap_attrs.first_name
            user.last_name = ldap_attrs.last_name
            user.phone = ldap_attrs.phone
            user.department = ldap_attrs.department
            user.title = ldap_attrs.title
            user.is_active = ldap_attrs.is_active

            # Update roles based on LDAP groups
            await self._sync_user_roles(user, ldap_attrs.groups, organization_id)

        else:
            # Create new user
            user = User(
                username=ldap_attrs.username,
                email=ldap_attrs.email,
                full_name=f"{ldap_attrs.first_name} {ldap_attrs.last_name}",
                first_name=ldap_attrs.first_name,
                last_name=ldap_attrs.last_name,
                phone=ldap_attrs.phone,
                department=ldap_attrs.department,
                title=ldap_attrs.title,
                is_active=ldap_attrs.is_active,
            )

            self.db.add(user)
            await self.db.flush()

            # Set initial roles
            await self._sync_user_roles(user, ldap_attrs.groups, organization_id)

        await self.db.commit()

        logger.info(f"Synchronized LDAP user: {ldap_attrs.username}")
        return user

    async def _sync_user_roles(
        self,
        user: User,
        ldap_groups: list[str],
        organization_id: Optional[str],
    ) -> None:
        """Synchronize user roles based on LDAP groups."""
        # Get UPM roles from LDAP groups
        mapped_roles = self.group_mapping.get_roles(ldap_groups)

        # If no roles mapped, assign default user role
        if not mapped_roles:
            mapped_roles = {"user"}

        # Update user roles
        user.roles = list(mapped_roles)

    async def sync_all_users(
        self,
        organization_id: Optional[str] = None,
        batch_size: int = 100,
    ) -> dict[str, Any]:
        """Synchronize all users from LDAP.

        Args:
            organization_id: Optional organization ID
            batch_size: Number of users to sync per batch

        Returns:
            Sync statistics
        """
        stats = {
            "synced": 0,
            "created": 0,
            "updated": 0,
            "failed": 0,
            "errors": [],
        }

        provider = LDAPAuthProvider(self.config)

        try:
            conn = provider._get_connection()

            # Search for all users
            conn.search(
                search_base=self.config.user_search_base,
                search_filter=self.config.user_search_filter,
                search_scope=SUBTREE,
                attributes=[
                    self.config.username_attribute,
                    self.config.email_attribute,
                    "distinguishedName",
                ],
                size_limit=batch_size,
            )

            entries = conn.entries()

            for entry in entries:
                try:
                    username = entry.get(self.config.username_attribute, [""])[0]
                    if not username:
                        continue

                    # Get full attributes and sync
                    user_dn = entry.get("distinguishedName", [""])[0]
                    attrs = provider._get_user_attributes(conn, user_dn)

                    if attrs:
                        existing = await self.db.execute(
                            select(User).where(User.username == username)
                        )
                        user_obj = existing.scalar_one_or_none()

                        if user_obj:
                            stats["updated"] += 1
                        else:
                            stats["created"] += 1

                        await self.sync_user(attrs, organization_id)
                        stats["synced"] += 1

                except Exception as e:
                    stats["failed"] += 1
                    stats["errors"].append(str(e))
                    logger.error(f"Failed to sync user: {e}")

            conn.unbind()

        except Exception as e:
            logger.error(f"LDAP sync error: {e}")
            raise LDAPSyncError(f"Failed to sync users: {e}")

        return stats


class ActiveDirectoryAuthProvider(LDAPAuthProvider):
    """Specialized LDAP provider for Active Directory."""

    def __init__(
        self,
        host: str,
        domain: str,
        bind_dn: Optional[str] = None,
        bind_password: Optional[str] = None,
        use_ssl: bool = True,
    ):
        config = LDAPServerConfig(
            host=host,
            port=636 if use_ssl else 389,
            use_ssl=use_ssl,
            bind_dn=bind_dn or f"{bind_dn.split(',')[0] if bind_dn else ''}",
            bind_password=bind_password,
            user_search_base=f"DC={',DC='.join(domain.split('.'))}",
            user_search_filter="(objectClass=user)",
            user_object_class="user",
            username_attribute="sAMAccountName",
            email_attribute="mail",
            first_name_attribute="givenName",
            last_name_attribute="sn",
            group_search_base=f"DC={',DC='.join(domain.split('.'))}",
            group_search_filter="(objectClass=group)",
            group_name_attribute="cn",
            group_member_attribute="member",
        )

        super().__init__(config)


# Helper functions for backward compatibility
async def authenticate_with_ldap(
    username: str,
    password: str,
    config: LDAPServerConfig,
) -> Optional[LDAPUserAttributes]:
    """Authenticate a user using LDAP.

    Args:
        username: Username
        password: Password
        config: LDAP server configuration

    Returns:
        LDAPUserAttributes if successful, None otherwise
    """
    provider = LDAPAuthProvider(config)
    return provider.authenticate(username, password)


async def sync_ldap_user(
    db: AsyncSession,
    ldap_attrs: LDAPUserAttributes,
    config: LDAPServerConfig,
    organization_id: Optional[str] = None,
) -> User:
    """Synchronize an LDAP user to UPM database.

    Args:
        db: Database session
        ldap_attrs: LDAP user attributes
        config: LDAP server configuration
        organization_id: Optional organization ID

    Returns:
        Synchronized User instance
    """
    syncer = LDAPUserSynchronizer(db, config)
    return await syncer.sync_user(ldap_attrs, organization_id)
