"""
Tenant Administration Service
Comprehensive tenant management, billing, and administration capabilities
"""

import logging
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, desc, asc, extract
from sqlalchemy.dialects.postgresql import UUID

from app.models.tenant import Tenant
from app.models.user import User
from app.models.branding import BrandingConfiguration, BrandAsset, EmailTemplate, DomainVerification
from app.middleware.tenant import get_current_tenant_id, tenant_context
from app.core.config import settings

logger = logging.getLogger(__name__)

class TenantAdminService:
    """
    Comprehensive tenant administration service
    Handles tenant lifecycle, user management, billing, and monitoring
    """

    def __init__(self, db: Session):
        self.db = db

    async def create_tenant_with_admin(
        self,
        tenant_data: Dict[str, Any],
        admin_user_data: Dict[str, Any],
        created_by: Optional[UUID] = None
    ) -> Tuple[Tenant, User]:
        """
        Create a new tenant with initial admin user

        Args:
            tenant_data: Tenant configuration
            admin_user_data: Admin user information
            created_by: User creating the tenant (optional)

        Returns:
            Tuple of created tenant and admin user
        """
        try:
            # Validate tenant data
            self._validate_tenant_creation_data(tenant_data)
            self._validate_admin_user_data(admin_user_data)

            # Check if subdomain is available
            if await self.is_subdomain_available(tenant_data.get("subdomain")):
                raise ValueError(f"Subdomain '{tenant_data.get('subdomain')}' is already taken")

            # Create tenant
            tenant = Tenant(
                slug=tenant_data["slug"],
                name=tenant_data["name"],
                display_name=tenant_data.get("display_name", tenant_data["name"]),
                email=tenant_data["email"],
                subdomain=tenant_data.get("subdomain"),
                custom_domain=tenant_data.get("custom_domain"),
                status="provisioning",
                tier=tenant_data.get("tier", "starter"),
                plan=tenant_data.get("plan", "starter"),
                industry=tenant_data.get("industry"),
                company_size=tenant_data.get("company_size"),
                max_users=tenant_data.get("max_users", 10),
                max_workflows=tenant_data.get("max_workflows", 25),
                storage_quota_gb=tenant_data.get("storage_quota_gb", 10),
                billing_email=tenant_data.get("billing_email", tenant_data["email"]),
                technical_contact_email=tenant_data.get("technical_contact_email"),
                auto_renew_enabled=tenant_data.get("auto_renew_enabled", True),
                created_at=datetime.now(timezone.utc),
                created_by=created_by
            )

            self.db.add(tenant)
            self.db.flush()  # Get tenant ID

            # Create branding configuration
            await self._create_default_branding(tenant.id, tenant_data)

            # Create admin user
            admin_user = User(
                tenant_id=tenant.id,
                email=admin_user_data["email"],
                username=admin_user_data.get("username", admin_user_data["email"].split("@")[0]),
                first_name=admin_user_data.get("first_name", "Admin"),
                last_name=admin_user_data.get("last_name", "User"),
                is_active=True,
                is_verified=True,
                is_superuser=True,
                roles=["tenant_admin", "user"],
                created_at=datetime.now(timezone.utc),
                created_by=created_by
            )

            # Set password if provided
            if "password" in admin_user_data:
                admin_user.set_password(admin_user_data["password"])

            self.db.add(admin_user)

            # Create initial tenant metrics
            await self._initialize_tenant_metrics(tenant.id)

            # Update tenant status
            tenant.status = "active"
            tenant.current_monthly_cost = Decimal("0.00")

            self.db.commit()
            self.db.refresh(tenant)
            self.db.refresh(admin_user)

            logger.info(f"Created tenant '{tenant.name}' with admin user '{admin_user.email}'")
            return tenant, admin_user

        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to create tenant: {str(e)}")
            raise

    async def update_tenant_configuration(
        self,
        tenant_id: UUID,
        updates: Dict[str, Any],
        updated_by: Optional[UUID] = None
    ) -> Tenant:
        """
        Update tenant configuration and settings

        Args:
            tenant_id: Tenant to update
            updates: Configuration updates
            updated_by: User making the changes

        Returns:
            Updated tenant object
        """
        try:
            tenant = self.db.query(Tenant).filter(Tenant.id == tenant_id).first()
            if not tenant:
                raise ValueError("Tenant not found")

            # Track what fields are being updated
            previous_values = {}
            for field, value in updates.items():
                if hasattr(tenant, field):
                    previous_values[field] = getattr(tenant, field)
                    setattr(tenant, field, value)

            # Special handling for plan changes
            if "plan" in updates and updates["plan"] != previous_values.get("plan"):
                await self._handle_plan_change(tenant, previous_values["plan"], updates["plan"])

            # Update timestamps
            tenant.updated_at = datetime.now(timezone.utc)
            tenant.updated_by = updated_by

            # Record configuration change
            await self._record_configuration_change(
                tenant_id, updates, previous_values, updated_by
            )

            self.db.commit()
            self.db.refresh(tenant)

            logger.info(f"Updated tenant '{tenant.name}' configuration")
            return tenant

        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to update tenant configuration: {str(e)}")
            raise

    async def suspend_tenant(
        self,
        tenant_id: UUID,
        reason: str,
        suspended_by: Optional[UUID] = None,
        effective_date: Optional[datetime] = None
    ) -> Tenant:
        """
        Suspend a tenant (temporary or permanent)

        Args:
            tenant_id: Tenant to suspend
            reason: Reason for suspension
            suspended_by: User performing the suspension
            effective_date: When suspension takes effect (default: now)

        Returns:
            Updated tenant object
        """
        try:
            tenant = self.db.query(Tenant).filter(Tenant.id == tenant_id).first()
            if not tenant:
                raise ValueError("Tenant not found")

            if tenant.status == "suspended":
                raise ValueError("Tenant is already suspended")

            effective_date = effective_date or datetime.now(timezone.utc)

            # Update tenant status
            tenant.status = "suspended"
            tenant.suspension_reason = reason
            tenant.suspended_at = effective_date
            tenant.suspended_by = suspended_by
            tenant.updated_at = datetime.now(timezone.utc)
            tenant.updated_by = suspended_by

            # Deactivate all user accounts
            await self._deactivate_tenant_users(tenant_id, effective_date)

            # Record suspension event
            await self._record_tenant_event(
                tenant_id, "suspended", {
                    "reason": reason,
                    "effective_date": effective_date.isoformat(),
                    "suspended_by": str(suspended_by) if suspended_by else None
                }
            )

            self.db.commit()
            self.db.refresh(tenant)

            logger.info(f"Suspended tenant '{tenant.name}' for reason: {reason}")
            return tenant

        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to suspend tenant: {str(e)}")
            raise

    async def reactivate_tenant(
        self,
        tenant_id: UUID,
        reactivated_by: Optional[UUID] = None
    ) -> Tenant:
        """
        Reactivate a suspended tenant

        Args:
            tenant_id: Tenant to reactivate
            reactivated_by: User performing the reactivation

        Returns:
            Updated tenant object
        """
        try:
            tenant = self.db.query(Tenant).filter(Tenant.id == tenant_id).first()
            if not tenant:
                raise ValueError("Tenant not found")

            if tenant.status != "suspended":
                raise ValueError("Only suspended tenants can be reactivated")

            # Update tenant status
            tenant.status = "active"
            tenant.suspension_reason = None
            tenant.suspended_at = None
            tenant.suspended_by = None
            tenant.updated_at = datetime.now(timezone.utc)
            tenant.updated_by = reactivated_by

            # Reactivate user accounts
            await self._reactivate_tenant_users(tenant_id)

            # Record reactivation event
            await self._record_tenant_event(
                tenant_id, "reactivated", {
                    "reactivated_by": str(reactivated_by) if reactivated_by else None
                }
            )

            self.db.commit()
            self.db.refresh(tenant)

            logger.info(f"Reactivated tenant '{tenant.name}'")
            return tenant

        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to reactivate tenant: {str(e)}")
            raise

    async def delete_tenant(
        self,
        tenant_id: UUID,
        reason: str,
        deleted_by: Optional[UUID] = None,
        soft_delete: bool = True
    ) -> bool:
        """
        Delete a tenant (soft or hard delete)

        Args:
            tenant_id: Tenant to delete
            reason: Reason for deletion
            deleted_by: User performing the deletion
            soft_delete: If True, mark as deleted (recommended)

        Returns:
            Success status
        """
        try:
            tenant = self.db.query(Tenant).filter(Tenant.id == tenant_id).first()
            if not tenant:
                raise ValueError("Tenant not found")

            if soft_delete:
                # Soft delete
                tenant.status = "deleted"
                tenant.deletion_reason = reason
                tenant.deleted_at = datetime.now(timezone.utc)
                tenant.deleted_by = deleted_by
                tenant.updated_at = datetime.now(timezone.utc)
                tenant.updated_by = deleted_by

                # Deactivate all users
                await self._deactivate_tenant_users(tenant_id, datetime.now(timezone.utc))

                # Record deletion event
                await self._record_tenant_event(
                    tenant_id, "deleted", {
                        "reason": reason,
                        "soft_delete": True,
                        "deleted_by": str(deleted_by) if deleted_by else None
                    }
                )

            else:
                # Hard delete - WARNING: This is irreversible
                # Delete all related records
                await self._hard_delete_tenant_data(tenant_id)

            self.db.commit()
            logger.info(f"Deleted tenant '{tenant.name}' ({'soft' if soft_delete else 'hard'} delete)")
            return True

        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to delete tenant: {str(e)}")
            raise

    async def get_tenant_users(
        self,
        tenant_id: UUID,
        include_inactive: bool = False,
        page: int = 1,
        limit: int = 50
    ) -> Dict[str, Any]:
        """
        Get users for a specific tenant

        Args:
            tenant_id: Tenant to get users for
            include_inactive: Include inactive/inactive users
            page: Page number
            limit: Results per page

        Returns:
            Paginated user list with metadata
        """
        try:
            query = self.db.query(User).filter(User.tenant_id == tenant_id)

            if not include_inactive:
                query = query.filter(User.is_active == True)

            # Get total count
            total = query.count()

            # Apply pagination
            offset = (page - 1) * limit
            users = query.offset(offset).limit(limit).all()

            return {
                "users": users,
                "pagination": {
                    "page": page,
                    "limit": limit,
                    "total": total,
                    "pages": (total + limit - 1) // limit
                }
            }

        except Exception as e:
            logger.error(f"Failed to get tenant users: {str(e)}")
            raise

    async def add_user_to_tenant(
        self,
        tenant_id: UUID,
        user_data: Dict[str, Any],
        added_by: Optional[UUID] = None
    ) -> User:
        """
        Add a new user to a tenant

        Args:
            tenant_id: Tenant to add user to
            user_data: User information
            added_by: User performing the action

        Returns:
            Created user object
        """
        try:
            # Check if tenant can add more users
            await self._check_user_quota(tenant_id)

            # Check if user already exists in tenant
            existing_user = self.db.query(User).filter(
                and_(
                    User.tenant_id == tenant_id,
                    User.email == user_data["email"]
                )
            ).first()

            if existing_user:
                raise ValueError("User with this email already exists in tenant")

            # Create user
            user = User(
                tenant_id=tenant_id,
                email=user_data["email"],
                username=user_data.get("username", user_data["email"].split("@")[0]),
                first_name=user_data.get("first_name", ""),
                last_name=user_data.get("last_name", ""),
                phone=user_data.get("phone"),
                department=user_data.get("department"),
                title=user_data.get("title"),
                is_active=user_data.get("is_active", True),
                is_verified=user_data.get("is_verified", False),
                is_superuser=user_data.get("is_superuser", False),
                roles=user_data.get("roles", ["user"]),
                permissions=user_data.get("permissions", []),
                created_at=datetime.now(timezone.utc),
                created_by=added_by
            )

            # Set password if provided
            if "password" in user_data:
                user.set_password(user_data["password"])

            self.db.add(user)
            self.db.commit()
            self.db.refresh(user)

            # Update user count
            await self._update_tenant_user_count(tenant_id)

            logger.info(f"Added user '{user.email}' to tenant")
            return user

        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to add user to tenant: {str(e)}")
            raise

    async def remove_user_from_tenant(
        self,
        tenant_id: UUID,
        user_id: UUID,
        reason: Optional[str] = None,
        removed_by: Optional[UUID] = None
    ) -> bool:
        """
        Remove a user from a tenant

        Args:
            tenant_id: Tenant containing the user
            user_id: User to remove
            reason: Reason for removal
            removed_by: User performing the action

        Returns:
            Success status
        """
        try:
            user = self.db.query(User).filter(
                and_(
                    User.tenant_id == tenant_id,
                    User.id == user_id
                )
            ).first()

            if not user:
                raise ValueError("User not found in tenant")

            # Don't allow removing the last admin
            if "tenant_admin" in user.roles:
                admin_count = self.db.query(User).filter(
                    and_(
                        User.tenant_id == tenant_id,
                        User.is_active == True,
                        User.roles.contains(["tenant_admin"])
                    )
                ).count()

                if admin_count <= 1:
                    raise ValueError("Cannot remove the last tenant admin")

            # Soft delete user
            user.is_active = False
            user.deleted_at = datetime.now(timezone.utc)
            user.deleted_by = removed_by
            user.updated_at = datetime.now(timezone.utc)
            user.updated_by = removed_by

            self.db.commit()

            # Update user count
            await self._update_tenant_user_count(tenant_id)

            logger.info(f"Removed user '{user.email}' from tenant")
            return True

        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to remove user from tenant: {str(e)}")
            raise

    async def get_tenant_usage_metrics(
        self,
        tenant_id: UUID,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Get comprehensive usage metrics for a tenant

        Args:
            tenant_id: Tenant to get metrics for
            start_date: Start date for metrics (default: 30 days ago)
            end_date: End date for metrics (default: now)

        Returns:
            Usage metrics dictionary
        """
        try:
            if not end_date:
                end_date = datetime.now(timezone.utc)
            if not start_date:
                start_date = end_date - timedelta(days=30)

            tenant = self.db.query(Tenant).filter(Tenant.id == tenant_id).first()
            if not tenant:
                raise ValueError("Tenant not found")

            # Get basic metrics
            total_users = self.db.query(User).filter(
                and_(
                    User.tenant_id == tenant_id,
                    User.is_active == True
                )
            ).count()

            active_users = self.db.query(User).filter(
                and_(
                    User.tenant_id == tenant_id,
                    User.is_active == True,
                    User.last_login >= start_date
                )
            ).count()

            # Get storage usage (placeholder - would integrate with actual storage service)
            storage_usage = await self._get_tenant_storage_usage(tenant_id)

            # Get API usage (placeholder - would integrate with actual API metrics)
            api_usage = await self._get_tenant_api_usage(tenant_id, start_date, end_date)

            # Get workflow execution metrics
            workflow_metrics = await self._get_tenant_workflow_metrics(tenant_id, start_date, end_date)

            # Calculate costs
            current_month_cost = await self._calculate_tenant_monthly_cost(tenant_id)

            return {
                "tenant_id": str(tenant_id),
                "period": {
                    "start_date": start_date.isoformat(),
                    "end_date": end_date.isoformat()
                },
                "users": {
                    "total": total_users,
                    "active": active_users,
                    "new_this_period": 0  # Would calculate from user creation dates
                },
                "storage": {
                    "used_gb": storage_usage["used_gb"],
                    "quota_gb": tenant.storage_quota_gb,
                    "usage_percentage": (storage_usage["used_gb"] / tenant.storage_quota_gb) * 100
                },
                "api": {
                    "requests": api_usage["requests"],
                    "errors": api_usage["errors"],
                    "average_response_time": api_usage["average_response_time"]
                },
                "workflows": workflow_metrics,
                "billing": {
                    "current_month_cost": float(current_month_cost),
                    "plan": tenant.plan,
                    "tier": tenant.tier
                },
                "quotas": {
                    "users_used": total_users,
                    "users_limit": tenant.max_users,
                    "workflows_used": workflow_metrics["total"],
                    "workflows_limit": tenant.max_workflows
                }
            }

        except Exception as e:
            logger.error(f"Failed to get tenant usage metrics: {str(e)}")
            raise

    async def bulk_update_tenants(
        self,
        tenant_ids: List[UUID],
        updates: Dict[str, Any],
        updated_by: Optional[UUID] = None
    ) -> List[Tenant]:
        """
        Bulk update multiple tenants

        Args:
            tenant_ids: List of tenant IDs to update
            updates: Updates to apply to all tenants
            updated_by: User performing the updates

        Returns:
            List of updated tenant objects
        """
        try:
            updated_tenants = []

            for tenant_id in tenant_ids:
                try:
                    tenant = await self.update_tenant_configuration(tenant_id, updates, updated_by)
                    updated_tenants.append(tenant)
                except Exception as e:
                    logger.error(f"Failed to update tenant {tenant_id}: {str(e)}")
                    # Continue with other tenants

            return updated_tenants

        except Exception as e:
            logger.error(f"Failed to bulk update tenants: {str(e)}")
            raise

    async def search_tenants(
        self,
        query: str,
        filters: Optional[Dict[str, Any]] = None,
        page: int = 1,
        limit: int = 50
    ) -> Dict[str, Any]:
        """
        Search tenants with filters

        Args:
            query: Search query
            filters: Additional filters (status, plan, tier, etc.)
            page: Page number
            limit: Results per page

        Returns:
            Paginated tenant search results
        """
        try:
            # Base query
            db_query = self.db.query(Tenant).filter(
                or_(
                    Tenant.name.ilike(f"%{query}%"),
                    Tenant.display_name.ilike(f"%{query}%"),
                    Tenant.email.ilike(f"%{query}%"),
                    Tenant.subdomain.ilike(f"%{query}%")
                )
            )

            # Apply filters
            if filters:
                if "status" in filters:
                    db_query = db_query.filter(Tenant.status == filters["status"])
                if "plan" in filters:
                    db_query = db_query.filter(Tenant.plan == filters["plan"])
                if "tier" in filters:
                    db_query = db_query.filter(Tenant.tier == filters["tier"])
                if "created_after" in filters:
                    db_query = db_query.filter(Tenant.created_at >= filters["created_after"])
                if "created_before" in filters:
                    db_query = db_query.filter(Tenant.created_at <= filters["created_before"])

            # Get total count
            total = db_query.count()

            # Apply pagination and ordering
            offset = (page - 1) * limit
            tenants = db_query.order_by(desc(Tenant.created_at)).offset(offset).limit(limit).all()

            return {
                "tenants": tenants,
                "pagination": {
                    "page": page,
                    "limit": limit,
                    "total": total,
                    "pages": (total + limit - 1) // limit
                },
                "filters_applied": filters or {}
            }

        except Exception as e:
            logger.error(f"Failed to search tenants: {str(e)}")
            raise

    # Private helper methods

    def _validate_tenant_creation_data(self, data: Dict[str, Any]) -> None:
        """Validate tenant creation data"""
        required_fields = ["slug", "name", "email"]
        for field in required_fields:
            if not data.get(field):
                raise ValueError(f"Required field '{field}' is missing")

        # Validate email format
        import re
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, data["email"]):
            raise ValueError("Invalid email format")

        # Validate slug format
        slug_pattern = r'^[a-z0-9]+(-[a-z0-9]+)*$'
        if not re.match(slug_pattern, data["slug"]):
            raise ValueError("Slug must contain only lowercase letters, numbers, and hyphens")

    def _validate_admin_user_data(self, data: Dict[str, Any]) -> None:
        """Validate admin user data"""
        required_fields = ["email"]
        for field in required_fields:
            if not data.get(field):
                raise ValueError(f"Required field '{field}' is missing")

        # Validate email format
        import re
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, data["email"]):
            raise ValueError("Invalid admin email format")

    async def is_subdomain_available(self, subdomain: str) -> bool:
        """Check if subdomain is available"""
        if not subdomain:
            return False

        existing = self.db.query(Tenant).filter(
            and_(
                Tenant.subdomain == subdomain,
                Tenant.status != "deleted"
            )
        ).first()

        return existing is None

    async def _create_default_branding(self, tenant_id: UUID, tenant_data: Dict[str, Any]) -> None:
        """Create default branding configuration for new tenant"""
        branding = BrandingConfiguration(
            tenant_id=tenant_id,
            theme_name="default",
            company_name=tenant_data["name"],
            company_description=tenant_data.get("description", ""),
            primary_color="#3B82F6",
            secondary_color="#10B981",
            accent_color="#F59E0B",
            background_color="#FFFFFF",
            text_color="#1F2937",
            font_family="Inter, sans-serif",
            font_size_base=16,
            border_radius=8,
            is_active=True,
            is_default=True,
            created_at=datetime.now(timezone.utc)
        )

        self.db.add(branding)

    async def _initialize_tenant_metrics(self, tenant_id: UUID) -> None:
        """Initialize tenant metrics tracking"""
        # This would integrate with metrics collection system
        # For now, just log the initialization
        logger.info(f"Initialized metrics for tenant {tenant_id}")

    async def _handle_plan_change(self, tenant: Tenant, old_plan: str, new_plan: str) -> None:
        """Handle tenant plan changes"""
        # Update quotas based on new plan
        plan_configs = {
            "starter": {"max_users": 10, "max_workflows": 25, "storage_quota_gb": 10},
            "professional": {"max_users": 50, "max_workflows": 250, "storage_quota_gb": 100},
            "enterprise": {"max_users": 200, "max_workflows": 1000, "storage_quota_gb": 1000}
        }

        if new_plan in plan_configs:
            config = plan_configs[new_plan]
            tenant.max_users = config["max_users"]
            tenant.max_workflows = config["max_workflows"]
            tenant.storage_quota_gb = config["storage_quota_gb"]

        await self._record_tenant_event(
            tenant.id, "plan_changed", {
                "old_plan": old_plan,
                "new_plan": new_plan,
                "changed_at": datetime.now(timezone.utc).isoformat()
            }
        )

    async def _record_configuration_change(
        self,
        tenant_id: UUID,
        updates: Dict[str, Any],
        previous_values: Dict[str, Any],
        changed_by: Optional[UUID]
    ) -> None:
        """Record tenant configuration changes"""
        # This would integrate with audit logging system
        logger.info(f"Configuration change recorded for tenant {tenant_id}")

    async def _record_tenant_event(self, tenant_id: UUID, event_type: str, event_data: Dict[str, Any]) -> None:
        """Record tenant events for audit and analytics"""
        # This would integrate with event logging system
        logger.info(f"Event recorded for tenant {tenant_id}: {event_type}")

    async def _deactivate_tenant_users(self, tenant_id: UUID, effective_date: datetime) -> None:
        """Deactivate all users in a tenant"""
        self.db.query(User).filter(User.tenant_id == tenant_id).update({
            "is_active": False,
            "updated_at": effective_date
        }, synchronize_session=False)

    async def _reactivate_tenant_users(self, tenant_id: UUID) -> None:
        """Reactivate all users in a tenant"""
        self.db.query(User).filter(User.tenant_id == tenant_id).update({
            "is_active": True,
            "updated_at": datetime.now(timezone.utc)
        }, synchronize_session=False)

    async def _hard_delete_tenant_data(self, tenant_id: UUID) -> None:
        """Hard delete all tenant data"""
        # Delete in order to respect foreign key constraints
        # This is a simplified version - actual implementation would be more comprehensive
        self.db.query(User).filter(User.tenant_id == tenant_id).delete(synchronize_session=False)
        self.db.query(BrandAsset).filter(BrandAsset.tenant_id == tenant_id).delete(synchronize_session=False)
        self.db.query(EmailTemplate).filter(EmailTemplate.tenant_id == tenant_id).delete(synchronize_session=False)
        self.db.query(BrandingConfiguration).filter(BrandingConfiguration.tenant_id == tenant_id).delete(synchronize_session=False)
        self.db.query(DomainVerification).filter(DomainVerification.tenant_id == tenant_id).delete(synchronize_session=False)
        self.db.query(Tenant).filter(Tenant.id == tenant_id).delete(synchronize_session=False)

    async def _check_user_quota(self, tenant_id: UUID) -> None:
        """Check if tenant can add more users"""
        tenant = self.db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if not tenant:
            raise ValueError("Tenant not found")

        current_users = self.db.query(User).filter(
            and_(
                User.tenant_id == tenant_id,
                User.is_active == True
            )
        ).count()

        if current_users >= tenant.max_users:
            raise ValueError(f"Tenant has reached user limit ({tenant.max_users})")

    async def _update_tenant_user_count(self, tenant_id: UUID) -> None:
        """Update tenant's current user count"""
        count = self.db.query(User).filter(
            and_(
                User.tenant_id == tenant_id,
                User.is_active == True
            )
        ).count()

        self.db.query(Tenant).filter(Tenant.id == tenant_id).update({
            "current_user_count": count,
            "updated_at": datetime.now(timezone.utc)
        }, synchronize_session=False)

    async def _get_tenant_storage_usage(self, tenant_id: UUID) -> Dict[str, Any]:
        """Get tenant storage usage"""
        # Placeholder - would integrate with actual storage service
        return {
            "used_gb": 2.5,
            "file_count": 124
        }

    async def _get_tenant_api_usage(self, tenant_id: UUID, start_date: datetime, end_date: datetime) -> Dict[str, Any]:
        """Get tenant API usage metrics"""
        # Placeholder - would integrate with actual API metrics service
        return {
            "requests": 15420,
            "errors": 23,
            "average_response_time": 245
        }

    async def _get_tenant_workflow_metrics(self, tenant_id: UUID, start_date: datetime, end_date: datetime) -> Dict[str, Any]:
        """Get tenant workflow execution metrics"""
        # Placeholder - would integrate with actual workflow metrics service
        return {
            "total": 847,
            "successful": 812,
            "failed": 35,
            "average_duration": 124.5
        }

    async def _calculate_tenant_monthly_cost(self, tenant_id: UUID) -> Decimal:
        """Calculate tenant's monthly cost"""
        # Placeholder - would integrate with actual billing system
        tenant = self.db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if not tenant:
            return Decimal("0.00")

        plan_costs = {
            "starter": Decimal("29.00"),
            "professional": Decimal("99.00"),
            "enterprise": Decimal("499.00")
        }

        base_cost = plan_costs.get(tenant.plan, Decimal("29.00"))

        # Add usage-based costs
        # This would be calculated based on actual usage metrics

        return base_cost