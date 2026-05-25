"""
User management client implementation for SDLC.ai SDK

Provides comprehensive user management operations including CRUD,
bulk operations, and permission management.
"""

from typing import Optional, List, Dict, Any, Iterator
import structlog

from ..client import BaseClient
from ..models.user import (
    User,
    UserCreate,
    UserUpdate,
    UserListResponse,
    BulkUserCreate,
    BulkUserResult,
    UserPermissions,
    UserProfile,
    UserActivity,
    UserPreferences,
)
from ..utils.pagination import paginate, handle_pagination
from ..exceptions import ValidationError, NotFoundError, ConflictError

logger = structlog.get_logger("sdlc_sdk.users")


class UsersClient(BaseClient):
    """Synchronous user management client."""

    def create(self, user_data: UserCreate) -> User:
        """
        Create a new user.

        Args:
            user_data: User creation data

        Returns:
            Created user

        Raises:
            ValidationError: If user data is invalid
            ConflictError: If user already exists
        """
        response = self.client.post(endpoint="/users", json=user_data.dict())

        data = response.json()
        return User(**data)

    def get(self, user_id: str) -> User:
        """
        Get user by ID.

        Args:
            user_id: User ID

        Returns:
            User data

        Raises:
            NotFoundError: If user not found
        """
        response = self.client.get(endpoint=f"/users/{user_id}")

        data = response.json()
        return User(**data)

    def update(self, user_id: str, update_data: UserUpdate) -> User:
        """
        Update user information.

        Args:
            user_id: User ID
            update_data: Update data

        Returns:
            Updated user

        Raises:
            NotFoundError: If user not found
            ValidationError: If update data is invalid
        """
        response = self.client.patch(
            endpoint=f"/users/{user_id}", json=update_data.dict(exclude_unset=True)
        )

        data = response.json()
        return User(**data)

    def delete(self, user_id: str) -> bool:
        """
        Delete a user.

        Args:
            user_id: User ID

        Returns:
            True if successful

        Raises:
            NotFoundError: If user not found
        """
        response = self.client.delete(endpoint=f"/users/{user_id}")
        return response.status_code == 204

    def list(
        self,
        tenant_id: Optional[str] = None,
        page: int = 1,
        page_size: int = 50,
        search: Optional[str] = None,
        status: Optional[str] = None,
        role: Optional[str] = None,
        sort_by: Optional[str] = None,
        sort_order: str = "asc",
    ) -> UserListResponse:
        """
        List users with filtering and pagination.

        Args:
            tenant_id: Filter by tenant
            page: Page number
            page_size: Items per page
            search: Search query
            status: Filter by status
            role: Filter by role
            sort_by: Sort field
            sort_order: Sort order

        Returns:
            Paginated user list
        """
        params = {
            "page": page,
            "page_size": page_size,
            "sort_by": sort_by,
            "sort_order": sort_order,
        }

        if tenant_id:
            params["tenant_id"] = tenant_id
        if search:
            params["search"] = search
        if status:
            params["status"] = status
        if role:
            params["role"] = role

        response = self.client.get(endpoint="/users", params=params)

        data = response.json()
        return UserListResponse(**data)

    def search(
        self,
        query: str,
        tenant_id: Optional[str] = None,
        filters: Optional[Dict[str, Any]] = None,
        limit: int = 20,
    ) -> List[User]:
        """
        Search users.

        Args:
            query: Search query
            tenant_id: Filter by tenant
            filters: Additional filters
            limit: Result limit

        Returns:
            List of matching users
        """
        params = {"q": query, "limit": limit}

        if tenant_id:
            params["tenant_id"] = tenant_id
        if filters:
            params.update(filters)

        response = self.client.get(endpoint="/users/search", params=params)

        data = response.json()
        return [User(**item) for item in data.get("users", [])]

    def bulk_create(self, users_data: BulkUserCreate) -> BulkUserResult:
        """
        Create multiple users.

        Args:
            users_data: Bulk creation data

        Returns:
            Bulk operation result
        """
        response = self.client.post(endpoint="/users/bulk", json=users_data.dict())

        data = response.json()
        return BulkUserResult(**data)

    def get_permissions(self, user_id: str) -> UserPermissions:
        """
        Get user permissions.

        Args:
            user_id: User ID

        Returns:
            User permissions

        Raises:
            NotFoundError: If user not found
        """
        response = self.client.get(endpoint=f"/users/{user_id}/permissions")

        data = response.json()
        return UserPermissions(**data)

    def update_permissions(
        self, user_id: str, permissions: List[str], roles: Optional[List[str]] = None
    ) -> UserPermissions:
        """
        Update user permissions.

        Args:
            user_id: User ID
            permissions: Permission list
            roles: Role list

        Returns:
            Updated permissions

        Raises:
            NotFoundError: If user not found
        """
        data = {"permissions": permissions, "roles": roles or []}

        response = self.client.put(endpoint=f"/users/{user_id}/permissions", json=data)

        response_data = response.json()
        return UserPermissions(**response_data)

    def get_profile(self, user_id: str) -> UserProfile:
        """
        Get complete user profile.

        Args:
            user_id: User ID

        Returns:
            User profile

        Raises:
            NotFoundError: If user not found
        """
        response = self.client.get(endpoint=f"/users/{user_id}/profile")

        data = response.json()
        return UserProfile(**data)

    def update_preferences(
        self, user_id: str, preferences: Dict[str, Any]
    ) -> UserPreferences:
        """
        Update user preferences.

        Args:
            user_id: User ID
            preferences: Preference updates

        Returns:
            Updated preferences

        Raises:
            NotFoundError: If user not found
        """
        response = self.client.patch(
            endpoint=f"/users/{user_id}/preferences", json=preferences
        )

        data = response.json()
        return UserPreferences(**data)

    def get_activity(
        self, user_id: str, limit: int = 50, offset: int = 0
    ) -> List[UserActivity]:
        """
        Get user activity log.

        Args:
            user_id: User ID
            limit: Result limit
            offset: Result offset

        Returns:
            List of user activities
        """
        params = {"limit": limit, "offset": offset}

        response = self.client.get(endpoint=f"/users/{user_id}/activity", params=params)

        data = response.json()
        return [UserActivity(**item) for item in data.get("activities", [])]

    def activate(self, user_id: str) -> User:
        """
        Activate a user.

        Args:
            user_id: User ID

        Returns:
            Updated user

        Raises:
            NotFoundError: If user not found
        """
        return self.update(user_id, UserUpdate(is_active=True))

    def deactivate(self, user_id: str) -> User:
        """
        Deactivate a user.

        Args:
            user_id: User ID

        Returns:
            Updated user

        Raises:
            NotFoundError: If user not found
        """
        return self.update(user_id, UserUpdate(is_active=False))

    def invite(
        self, email: str, tenant_id: str, role: str = "member"
    ) -> Dict[str, Any]:
        """
        Invite a user to join a tenant.

        Args:
            email: User email
            tenant_id: Tenant ID
            role: Initial role

        Returns:
            Invitation details
        """
        data = {"email": email, "tenant_id": tenant_id, "role": role}

        response = self.client.post(endpoint="/users/invite", json=data)

        return response.json()

    def reset_password(self, user_id: str, send_email: bool = True) -> bool:
        """
        Reset user password.

        Args:
            user_id: User ID
            send_email: Whether to send reset email

        Returns:
            True if successful

        Raises:
            NotFoundError: If user not found
        """
        data = {"send_email": send_email}

        response = self.client.post(
            endpoint=f"/users/{user_id}/reset-password", json=data
        )

        return response.status_code == 200

    def change_password(
        self, user_id: str, current_password: str, new_password: str
    ) -> bool:
        """
        Change user password.

        Args:
            user_id: User ID
            current_password: Current password
            new_password: New password

        Returns:
            True if successful

        Raises:
            ValidationError: If passwords are invalid
            NotFoundError: If user not found
        """
        data = {"current_password": current_password, "new_password": new_password}

        response = self.client.post(
            endpoint=f"/users/{user_id}/change-password", json=data
        )

        return response.status_code == 200

    def list_all(
        self, tenant_id: Optional[str] = None, batch_size: int = 100
    ) -> Iterator[User]:
        """
        List all users with automatic pagination.

        Args:
            tenant_id: Filter by tenant
            batch_size: Items per page

        Yields:
            User objects
        """

        def fetch_page(page_token: Optional[str], page_size: int):
            params = {"page_size": page_size}
            if page_token:
                params["page_token"] = page_token
            if tenant_id:
                params["tenant_id"] = tenant_id

            response = self.client.get(endpoint="/users", params=params)

            return handle_pagination(response.json())

        paginator = paginate(fetch_page=fetch_page, page_size=batch_size)

        for user in paginator:
            yield User(**user)


class AsyncUsersClient(UsersClient):
    """Asynchronous user management client."""

    async def create(self, user_data: UserCreate) -> User:
        """Async version of create."""
        response = await self.client.post(endpoint="/users", json=user_data.dict())

        data = response.json()
        return User(**data)

    async def get(self, user_id: str) -> User:
        """Async version of get."""
        response = await self.client.get(endpoint=f"/users/{user_id}")

        data = response.json()
        return User(**data)

    async def update(self, user_id: str, update_data: UserUpdate) -> User:
        """Async version of update."""
        response = await self.client.patch(
            endpoint=f"/users/{user_id}", json=update_data.dict(exclude_unset=True)
        )

        data = response.json()
        return User(**data)

    async def delete(self, user_id: str) -> bool:
        """Async version of delete."""
        response = await self.client.delete(endpoint=f"/users/{user_id}")
        return response.status_code == 204

    async def list(
        self,
        tenant_id: Optional[str] = None,
        page: int = 1,
        page_size: int = 50,
        search: Optional[str] = None,
        status: Optional[str] = None,
        role: Optional[str] = None,
        sort_by: Optional[str] = None,
        sort_order: str = "asc",
    ) -> UserListResponse:
        """Async version of list."""
        params = {
            "page": page,
            "page_size": page_size,
            "sort_by": sort_by,
            "sort_order": sort_order,
        }

        if tenant_id:
            params["tenant_id"] = tenant_id
        if search:
            params["search"] = search
        if status:
            params["status"] = status
        if role:
            params["role"] = role

        response = await self.client.get(endpoint="/users", params=params)

        data = response.json()
        return UserListResponse(**data)

    async def bulk_create(self, users_data: BulkUserCreate) -> BulkUserResult:
        """Async version of bulk_create."""
        response = await self.client.post(
            endpoint="/users/bulk", json=users_data.dict()
        )

        data = response.json()
        return BulkUserResult(**data)
