"""
Tenant Service - Business logic for multi-tenant operations
Handles tenant creation, management, resource allocation, and isolation
"""

from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List, Tuple
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, func, desc
from fastapi import HTTPException, status
import uuid
import re
import logging

from ..models.tenant import Tenant, TenantConfiguration, TenantUsageLog
from ..models.user import User
from ..database import get_db

logger = logging.getLogger(__name__)

class TenantService:
    """Service for managing multi-tenant operations"""

    def __init__(self, db: Session):
        self.db = db

    # Tenant Creation and Management
    async def create_tenant(
        self,
        name: str,
        email: str,
        subdomain: str,
        plan: str = "starter",
        tier: str = "basic",
        created_by: Optional[uuid.UUID] = None,
        **kwargs
    ) -> Tenant:
        """Create a new tenant with validation and setup"""

        # Validate inputs
        await self._validate_tenant_creation_data(name, email, subdomain, plan, tier)

        # Create tenant
        tenant = Tenant(
            name=name,
            email=email.lower(),
            subdomain=subdomain.lower(),
            plan=plan,
            tier=tier,
            created_by=created_by,
            status="trial",
            trial_ends_at=datetime.now(timezone.utc) + timedelta(days=30)
        )

        # Apply additional attributes
        for key, value in kwargs.items():
            if hasattr(tenant, key) and key not in ['id', 'created_at', 'updated_at']:
                setattr(tenant, key, value)

        # Set plan-specific limits
        await self._set_plan_limits(tenant, plan, tier)

        try:
            self.db.add(tenant)
            self.db.flush()  # Get ID without committing

            # Initialize tenant configuration
            await self._initialize_tenant_configuration(tenant)

            # Create initial audit log
            await self._create_audit_log(
                tenant.id,
                "tenant_created",
                f"Tenant created with plan {plan} and tier {tier}",
                created_by
            )

            self.db.commit()
            logger.info(f"Created new tenant: {tenant.slug} (ID: {tenant.id})")

            return tenant

        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to create tenant {subdomain}: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create tenant: {str(e)}"
            )

    async def get_tenant_by_id(self, tenant_id: uuid.UUID) -> Optional[Tenant]:
        """Get tenant by ID with relationships"""
        return self.db.query(Tenant)\
            .options(joinedload(Tenant.users))\
            .options(joinedload(Tenant.workflows))\
            .options(joinedload(Tenant.agents))\
            .filter(Tenant.id == tenant_id)\
            .first()

    async def get_tenant_by_slug(self, slug: str) -> Optional[Tenant]:
        """Get tenant by slug"""
        return self.db.query(Tenant)\
            .options(joinedload(Tenant.users))\
            .filter(Tenant.slug == slug)\
            .first()

    async def get_tenant_by_subdomain(self, subdomain: str) -> Optional[Tenant]:
        """Get tenant by subdomain"""
        return self.db.query(Tenant)\
            .options(joinedload(Tenant.users))\
            .filter(Tenant.subdomain == subdomain)\
            .first()

    async def get_tenant_by_domain(self, domain: str) -> Optional[Tenant]:
        """Get tenant by custom domain"""
        return self.db.query(Tenant)\
            .options(joinedload(Tenant.users))\
            .filter(or_(
                Tenant.domain == domain,
                Tenant.subdomain == domain.split('.')[0] if '.' in domain else None
            ))\
            .first()

    async def update_tenant(
        self,
        tenant_id: uuid.UUID,
        update_data: Dict[str, Any],
        updated_by: Optional[uuid.UUID] = None
    ) -> Tenant:
        """Update tenant information"""

        tenant = await self.get_tenant_by_id(tenant_id)
        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tenant not found"
            )

        # Track changes for audit
        changes = {}

        # Update allowed fields
        updatable_fields = [
            'name', 'display_name', 'description', 'email', 'phone', 'website',
            'address_line1', 'address_line2', 'city', 'state', 'country', 'postal_code',
            'industry', 'company_size', 'revenue_tier', 'domain', 'settings',
            'preferences', 'integrations', 'billing_email', 'billing_cycle'
        ]

        for field, value in update_data.items():
            if field in updatable_fields and hasattr(tenant, field):
                old_value = getattr(tenant, field)
                if old_value != value:
                    changes[field] = {'old': old_value, 'new': value}
                    setattr(tenant, field, value)

        if changes:
            tenant.updated_by = updated_by
            tenant.updated_at = datetime.now(timezone.utc)

            # Create audit log
            await self._create_audit_log(
                tenant_id,
                "tenant_updated",
                f"Tenant updated: {', '.join(changes.keys())}",
                updated_by
            )

            self.db.commit()
            logger.info(f"Updated tenant {tenant.slug}: {', '.join(changes.keys())}")

        return tenant

    async def change_tenant_plan(
        self,
        tenant_id: uuid.UUID,
        new_plan: str,
        new_tier: str,
        changed_by: Optional[uuid.UUID] = None
    ) -> Tenant:
        """Change tenant subscription plan and tier"""

        tenant = await self.get_tenant_by_id(tenant_id)
        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tenant not found"
            )

        old_plan = tenant.plan
        old_tier = tenant.tier

        # Update plan and tier
        tenant.plan = new_plan
        tenant.tier = new_tier
        tenant.updated_by = changed_by
        tenant.updated_at = datetime.now(timezone.utc)

        # Update limits based on new plan
        await self._set_plan_limits(tenant, new_plan, new_tier)

        # If moving from trial to paid, set subscription dates
        if tenant.status == 'trial' and new_plan not in ['trial', 'free']:
            tenant.status = 'active'
            tenant.subscription_starts_at = datetime.now(timezone.utc)

            # Set subscription end date based on billing cycle
            if tenant.billing_cycle == 'annual':
                tenant.subscription_ends_at = datetime.now(timezone.utc) + timedelta(days=365)
            else:
                tenant.subscription_ends_at = datetime.now(timezone.utc) + timedelta(days=30)

        # Create audit log
        await self._create_audit_log(
            tenant_id,
            "plan_changed",
            f"Plan changed from {old_plan}/{old_tier} to {new_plan}/{new_tier}",
            changed_by
        )

        self.db.commit()
        logger.info(f"Changed plan for tenant {tenant.slug} to {new_plan}/{new_tier}")

        return tenant

    async def suspend_tenant(
        self,
        tenant_id: uuid.UUID,
        reason: str,
        suspended_by: Optional[uuid.UUID] = None
    ) -> Tenant:
        """Suspend tenant"""

        tenant = await self.get_tenant_by_id(tenant_id)
        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tenant not found"
            )

        tenant.status = 'suspended'
        tenant.updated_by = suspended_by
        tenant.updated_at = datetime.now(timezone.utc)

        # Create audit log
        await self._create_audit_log(
            tenant_id,
            "tenant_suspended",
            f"Tenant suspended: {reason}",
            suspended_by
        )

        self.db.commit()
        logger.warning(f"Suspended tenant {tenant.slug}: {reason}")

        return tenant

    async def activate_tenant(
        self,
        tenant_id: uuid.UUID,
        activated_by: Optional[uuid.UUID] = None
    ) -> Tenant:
        """Activate suspended tenant"""

        tenant = await self.get_tenant_by_id(tenant_id)
        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tenant not found"
            )

        tenant.status = 'active'
        tenant.updated_by = activated_by
        tenant.updated_at = datetime.now(timezone.utc)

        # Create audit log
        await self._create_audit_log(
            tenant_id,
            "tenant_activated",
            "Tenant activated",
            activated_by
        )

        self.db.commit()
        logger.info(f"Activated tenant {tenant.slug}")

        return tenant

    # Resource Management
    async def check_resource_limits(
        self,
        tenant_id: uuid.UUID,
        resource_type: str,
        additional_amount: int = 1
    ) -> Tuple[bool, Dict[str, Any]]:
        """Check if tenant can consume additional resources"""

        tenant = await self.get_tenant_by_id(tenant_id)
        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tenant not found"
            )

        if not tenant.is_active:
            return False, {'error': 'Tenant is not active'}

        # Check specific resource limits
        if resource_type == 'users':
            can_consume = tenant.can_create_user()
            current = tenant.current_users
            limit = tenant.max_users
        elif resource_type == 'storage':
            can_consume = tenant.can_use_storage(additional_amount)
            current = tenant.current_storage_gb
            limit = tenant.max_storage_gb
        elif resource_type == 'api_calls':
            can_consume = tenant.can_make_api_call()
            current = tenant.current_api_calls_month
            limit = tenant.max_api_calls_per_month
        elif resource_type == 'workflows':
            can_consume = tenant.current_workflows < tenant.max_workflows
            current = tenant.current_workflows
            limit = tenant.max_workflows
        elif resource_type == 'agents':
            can_consume = tenant.current_agents < tenant.max_agents
            current = tenant.current_agents
            limit = tenant.max_agents
        else:
            return False, {'error': f'Unknown resource type: {resource_type}'}

        return can_consume, {
            'current': current,
            'limit': limit,
            'additional_amount': additional_amount,
            'percentage': (current / limit * 100) if limit > 0 else 0
        }

    async def increment_usage(
        self,
        tenant_id: uuid.UUID,
        metric: str,
        amount: int = 1
    ) -> bool:
        """Increment tenant usage metric"""

        tenant = await self.get_tenant_by_id(tenant_id)
        if not tenant:
            return False

        try:
            tenant.increment_usage(metric, amount)
            self.db.commit()
            return True
        except Exception as e:
            logger.error(f"Failed to increment usage for tenant {tenant_id}: {str(e)}")
            self.db.rollback()
            return False

    async def decrement_usage(
        self,
        tenant_id: uuid.UUID,
        metric: str,
        amount: int = 1
    ) -> bool:
        """Decrement tenant usage metric"""

        tenant = await self.get_tenant_by_id(tenant_id)
        if not tenant:
            return False

        try:
            tenant.decrement_usage(metric, amount)
            self.db.commit()
            return True
        except Exception as e:
            logger.error(f"Failed to decrement usage for tenant {tenant_id}: {str(e)}")
            self.db.rollback()
            return False

    # Configuration Management
    async def get_tenant_configuration(
        self,
        tenant_id: uuid.UUID,
        category: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get tenant configuration"""

        query = self.db.query(TenantConfiguration)\
            .filter(TenantConfiguration.tenant_id == tenant_id)

        if category:
            query = query.filter(TenantConfiguration.category == category)

        configs = query.all()

        result = {}
        for config in configs:
            if config.category not in result:
                result[config.category] = {}
            result[config.category][config.key] = config.value

        return result

    async def update_tenant_configuration(
        self,
        tenant_id: uuid.UUID,
        category: str,
        key: str,
        value: Any,
        description: Optional[str] = None,
        is_encrypted: bool = False
    ) -> TenantConfiguration:
        """Update tenant configuration"""

        # Check if configuration exists
        config = self.db.query(TenantConfiguration)\
            .filter(
                and_(
                    TenantConfiguration.tenant_id == tenant_id,
                    TenantConfiguration.category == category,
                    TenantConfiguration.key == key
                )
            )\
            .first()

        if config:
            config.value = value
            config.description = description or config.description
            config.is_encrypted = is_encrypted
            config.updated_at = datetime.now(timezone.utc)
        else:
            config = TenantConfiguration(
                tenant_id=tenant_id,
                category=category,
                key=key,
                value=value,
                description=description,
                is_encrypted=is_encrypted
            )
            self.db.add(config)

        self.db.commit()
        return config

    # Usage Analytics
    async def get_usage_analytics(
        self,
        tenant_id: uuid.UUID,
        days: int = 30
    ) -> Dict[str, Any]:
        """Get tenant usage analytics"""

        start_date = datetime.now(timezone.utc) - timedelta(days=days)

        # Get daily usage logs
        usage_logs = self.db.query(TenantUsageLog)\
            .filter(
                and_(
                    TenantUsageLog.tenant_id == tenant_id,
                    TenantUsageLog.date >= start_date
                )
            )\
            .order_by(desc(TenantUsageLog.date))\
            .all()

        # Get current tenant state
        tenant = await self.get_tenant_by_id(tenant_id)
        if not tenant:
            return {}

        # Aggregate data
        daily_data = []
        total_api_calls = sum(log.api_calls for log in usage_logs)
        avg_response_time = sum(log.avg_response_time_ms or 0 for log in usage_logs) // len(usage_logs) if usage_logs else 0
        avg_error_rate = sum(log.error_rate_percentage or 0 for log in usage_logs) // len(usage_logs) if usage_logs else 0

        for log in usage_logs:
            daily_data.append({
                'date': log.date.isoformat(),
                'api_calls': log.api_calls,
                'storage_gb': log.storage_gb,
                'users_count': log.users_count,
                'workflows_count': log.workflows_count,
                'agents_count': log.agents_count,
                'avg_response_time_ms': log.avg_response_time_ms,
                'error_rate_percentage': log.error_rate_percentage,
                'estimated_cost_usd': log.estimated_cost_usd
            })

        return {
            'tenant': tenant.to_dict(include_sensitive=True),
            'period': {
                'days': days,
                'start_date': start_date.isoformat(),
                'end_date': datetime.now(timezone.utc).isoformat()
            },
            'current_usage': {
                'users': tenant.current_users,
                'storage_gb': tenant.current_storage_gb,
                'api_calls_month': tenant.current_api_calls_month,
                'workflows': tenant.current_workflows,
                'agents': tenant.current_agents
            },
            'limits': {
                'max_users': tenant.max_users,
                'max_storage_gb': tenant.max_storage_gb,
                'max_api_calls_per_month': tenant.max_api_calls_per_month,
                'max_workflows': tenant.max_workflows,
                'max_agents': tenant.max_agents
            },
            'usage_percentages': {
                'users': tenant.user_usage_percentage,
                'storage': tenant.storage_usage_percentage,
                'api_calls': tenant.api_usage_percentage
            },
            'analytics': {
                'total_api_calls': total_api_calls,
                'avg_response_time_ms': avg_response_time,
                'avg_error_rate_percentage': avg_error_rate,
                'daily_usage': daily_data
            }
        }

    async def record_daily_usage(self) -> None:
        """Record daily usage for all tenants (should be run as a scheduled job)"""

        # Get all active tenants
        tenants = self.db.query(Tenant)\
            .filter(Tenant.status.in_(['active', 'trial']))\
            .all()

        today = datetime.now(timezone.utc).date()
        start_of_day = datetime.combine(today, datetime.min.time()).replace(tzinfo=timezone.utc)

        for tenant in tenants:
            try:
                # Check if usage already recorded for today
                existing_log = self.db.query(TenantUsageLog)\
                    .filter(
                        and_(
                            TenantUsageLog.tenant_id == tenant.id,
                            TenantUsageLog.date >= start_of_day
                        )
                    )\
                    .first()

                if existing_log:
                    continue  # Already recorded for today

                # Get actual usage data (this would integrate with your monitoring systems)
                usage_data = await self._calculate_tenant_usage(tenant.id, start_of_day)

                # Create usage log
                usage_log = TenantUsageLog(
                    tenant_id=tenant.id,
                    date=start_of_day,
                    **usage_data
                )

                self.db.add(usage_log)

            except Exception as e:
                logger.error(f"Failed to record usage for tenant {tenant.id}: {str(e)}")
                continue

        try:
            self.db.commit()
            logger.info(f"Recorded daily usage for {len(tenants)} tenants")
        except Exception as e:
            logger.error(f"Failed to commit daily usage records: {str(e)}")
            self.db.rollback()

    # List and Search
    async def list_tenants(
        self,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None,
        tier: Optional[str] = None,
        search: Optional[str] = None
    ) -> List[Tenant]:
        """List tenants with filtering and pagination"""

        query = self.db.query(Tenant)

        if status:
            query = query.filter(Tenant.status == status)

        if tier:
            query = query.filter(Tenant.tier == tier)

        if search:
            query = query.filter(
                or_(
                    Tenant.name.ilike(f"%{search}%"),
                    Tenant.display_name.ilike(f"%{search}%"),
                    Tenant.email.ilike(f"%{search}%"),
                    Tenant.subdomain.ilike(f"%{search}%")
                )
            )

        return query.offset(skip).limit(limit).all()

    async def count_tenants(
        self,
        status: Optional[str] = None,
        tier: Optional[str] = None,
        search: Optional[str] = None
    ) -> int:
        """Count tenants with filtering"""

        query = self.db.query(func.count(Tenant.id))

        if status:
            query = query.filter(Tenant.status == status)

        if tier:
            query = query.filter(Tenant.tier == tier)

        if search:
            query = query.filter(
                or_(
                    Tenant.name.ilike(f"%{search}%"),
                    Tenant.display_name.ilike(f"%{search}%"),
                    Tenant.email.ilike(f"%{search}%"),
                    Tenant.subdomain.ilike(f"%{search}%")
                )
            )

        return query.scalar() or 0

    # Private Helper Methods
    async def _validate_tenant_creation_data(
        self,
        name: str,
        email: str,
        subdomain: str,
        plan: str,
        tier: str
    ) -> None:
        """Validate tenant creation data"""

        # Basic validation
        if not name or len(name.strip()) < 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Name must be at least 2 characters long"
            )

        if not email or '@' not in email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Valid email address is required"
            )

        if not subdomain or not re.match(r'^[a-z0-9]+(-[a-z0-9]+)*$', subdomain):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Subdomain must contain only lowercase letters, numbers, and hyphens"
            )

        # Check for duplicates
        existing_by_email = self.db.query(Tenant)\
            .filter(Tenant.email == email.lower())\
            .first()
        if existing_by_email:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email address is already registered"
            )

        existing_by_subdomain = self.db.query(Tenant)\
            .filter(Tenant.subdomain == subdomain.lower())\
            .first()
        if existing_by_subdomain:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Subdomain is already taken"
            )

        # Validate plan and tier
        valid_plans = ['free', 'starter', 'professional', 'enterprise']
        valid_tiers = ['basic', 'professional', 'enterprise', 'custom']

        if plan not in valid_plans:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Plan must be one of: {valid_plans}"
            )

        if tier not in valid_tiers:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Tier must be one of: {valid_tiers}"
            )

    async def _set_plan_limits(self, tenant: Tenant, plan: str, tier: str) -> None:
        """Set resource limits based on plan and tier"""

        # Plan-based limits
        plan_limits = {
            'free': {
                'max_users': 3,
                'max_storage_gb': 5,
                'max_api_calls_per_month': 1000,
                'max_workflows': 5,
                'max_agents': 1
            },
            'starter': {
                'max_users': 10,
                'max_storage_gb': 20,
                'max_api_calls_per_month': 10000,
                'max_workflows': 25,
                'max_agents': 3
            },
            'professional': {
                'max_users': 50,
                'max_storage_gb': 100,
                'max_api_calls_per_month': 100000,
                'max_workflows': 250,
                'max_agents': 10
            },
            'enterprise': {
                'max_users': 500,
                'max_storage_gb': 1000,
                'max_api_calls_per_month': 1000000,
                'max_workflows': 2500,
                'max_agents': 50
            }
        }

        # Tier-based multipliers
        tier_multipliers = {
            'basic': 1.0,
            'professional': 1.5,
            'enterprise': 2.0,
            'custom': 3.0
        }

        limits = plan_limits.get(plan, plan_limits['starter'])
        multiplier = tier_multipliers.get(tier, 1.0)

        tenant.max_users = int(limits['max_users'] * multiplier)
        tenant.max_storage_gb = int(limits['max_storage_gb'] * multiplier)
        tenant.max_api_calls_per_month = int(limits['max_api_calls_per_month'] * multiplier)
        tenant.max_workflows = int(limits['max_workflows'] * multiplier)
        tenant.max_agents = int(limits['max_agents'] * multiplier)

    async def _initialize_tenant_configuration(self, tenant: Tenant) -> None:
        """Initialize default tenant configuration"""

        default_configs = {
            'security': {
                'two_factor_required': False,
                'session_timeout_minutes': 480,
                'password_min_length': 8,
                'require_strong_password': True
            },
            'notifications': {
                'email_notifications': True,
                'slack_notifications': False,
                'webhook_notifications': False
            },
            'ui': {
                'theme': 'default',
                'timezone': 'UTC',
                'date_format': 'YYYY-MM-DD',
                'language': 'en'
            },
            'features': {
                'advanced_analytics': tenant.tier in ['professional', 'enterprise'],
                'custom_integrations': tenant.tier == 'enterprise',
                'api_access': True,
                'white_labeling': tenant.tier == 'enterprise'
            }
        }

        for category, configs in default_configs.items():
            for key, value in configs.items():
                config = TenantConfiguration(
                    tenant_id=tenant.id,
                    category=category,
                    key=key,
                    value=value
                )
                self.db.add(config)

    async def _create_audit_log(
        self,
        tenant_id: uuid.UUID,
        action: str,
        details: str,
        user_id: Optional[uuid.UUID] = None
    ) -> None:
        """Create audit log entry"""

        # This would create an audit log entry
        # Implementation depends on your audit log model
        logger.info(f"Audit: {action} for tenant {tenant_id} by user {user_id}: {details}")

    async def _calculate_tenant_usage(
        self,
        tenant_id: uuid.UUID,
        date: datetime
    ) -> Dict[str, Any]:
        """Calculate tenant usage for a specific date"""

        # This would integrate with your monitoring and logging systems
        # to get actual usage metrics

        # Placeholder implementation
        return {
            'users_count': 5,
            'storage_gb': 15,
            'api_calls': 500,
            'workflows_count': 12,
            'agents_count': 3,
            'avg_response_time_ms': 150,
            'error_rate_percentage': 2,
            'estimated_cost_usd': 25
        }