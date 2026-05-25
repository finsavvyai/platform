"""
Revenue Management for Workflow Marketplace.

Handles revenue sharing, payment processing, and financial reporting
for the workflow marketplace platform.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from .models import TemplatePurchase

logger = logging.getLogger(__name__)


class RevenueTransaction(BaseModel):
    """Represents a revenue transaction in the marketplace."""
    id: str = Field(default_factory=lambda: str(UUID()))
    purchase_id: str
    template_id: str
    creator_id: UUID
    organization_id: UUID

    # Transaction amounts
    total_amount: float
    platform_fee: float
    creator_revenue: float
    currency: str = "USD"

    # Transaction details
    transaction_date: datetime = Field(default_factory=datetime.utcnow)
    payment_status: str = "pending"  # "pending", "completed", "failed", "refunded"
    payment_reference: Optional[str] = None

    # Revenue sharing details
    platform_commission_rate: float = 0.30  # 30% default
    creator_commission_rate: float = 0.70   # 70% default

    # Metadata
    transaction_type: str = "template_purchase"  # "template_purchase", "subscription", "usage"
    metadata: dict[str, Any] = Field(default_factory=dict)


class CreatorEarnings(BaseModel):
    """Represents creator earnings summary."""
    creator_id: UUID
    period_start: datetime
    period_end: datetime

    # Earnings breakdown
    total_earnings: float = 0.0
    template_sales: float = 0.0
    subscription_revenue: float = 0.0
    usage_revenue: float = 0.0

    # Transaction counts
    total_transactions: int = 0
    successful_transactions: int = 0
    failed_transactions: int = 0

    # Top performing templates
    top_templates: list[dict[str, Any]] = Field(default_factory=list)

    # Payment status
    payment_status: str = "pending"  # "pending", "paid", "processing"
    payment_reference: Optional[str] = None
    payment_date: Optional[datetime] = None


class PlatformRevenue(BaseModel):
    """Represents platform revenue summary."""
    period_start: datetime
    period_end: datetime

    # Revenue breakdown
    total_revenue: float = 0.0
    template_sales_revenue: float = 0.0
    subscription_revenue: float = 0.0
    usage_revenue: float = 0.0

    # Transaction metrics
    total_transactions: int = 0
    successful_transactions: int = 0
    failed_transactions: int = 0
    refunded_transactions: int = 0

    # Creator payments
    total_creator_payments: float = 0.0
    pending_creator_payments: float = 0.0

    # Platform metrics
    active_creators: int = 0
    active_templates: int = 0
    new_templates_published: int = 0


class RevenueManager:
    """Manages revenue sharing and financial operations for the marketplace."""

    def __init__(self):
        self.platform_commission = 0.30  # 30% platform fee
        self.creator_commission = 0.70   # 70% creator fee
        self.minimum_payout = 50.0       # Minimum payout amount
        self.payout_frequency = "monthly"  # "weekly", "monthly", "quarterly"

    async def record_transaction(self, purchase: TemplatePurchase) -> str:
        """
        Record a revenue transaction for a template purchase.

        Args:
            purchase: The template purchase transaction

        Returns:
            Transaction ID
        """
        try:
            logger.info(f"Recording revenue transaction for purchase {purchase.id}")

            # Create revenue transaction
            transaction = RevenueTransaction(
                purchase_id=purchase.id,
                template_id=purchase.template_id,
                creator_id=await self._get_template_creator(purchase.template_id),
                organization_id=purchase.organization_id,
                total_amount=purchase.total_amount,
                platform_fee=purchase.platform_fee,
                creator_revenue=purchase.creator_revenue,
                currency=purchase.currency,
                transaction_date=purchase.purchase_date,
                payment_status=purchase.payment_status,
                payment_reference=purchase.payment_reference,
                platform_commission_rate=self.platform_commission,
                creator_commission_rate=self.creator_commission,
                transaction_type="template_purchase",
                metadata={
                    "pricing_model": purchase.pricing_model.value,
                    "customizations": purchase.customizations
                }
            )

            # Store transaction (in production, this would be in a database)
            await self._store_transaction(transaction)

            # Update creator earnings
            await self._update_creator_earnings(transaction)

            # Update platform revenue metrics
            await self._update_platform_metrics(transaction)

            logger.info(f"Revenue transaction recorded: {transaction.id}")
            return transaction.id

        except Exception as e:
            logger.error(f"Failed to record revenue transaction: {e}", exc_info=True)
            raise

    async def get_creator_earnings(
        self,
        creator_id: UUID,
        period_start: Optional[datetime] = None,
        period_end: Optional[datetime] = None
    ) -> CreatorEarnings:
        """
        Get earnings summary for a creator.

        Args:
            creator_id: ID of the creator
            period_start: Start of earnings period (default: 30 days ago)
            period_end: End of earnings period (default: now)

        Returns:
            Creator earnings summary
        """
        try:
            if not period_start:
                period_start = datetime.utcnow() - timedelta(days=30)
            if not period_end:
                period_end = datetime.utcnow()

            # Get transactions for the period
            transactions = await self._get_creator_transactions(
                creator_id, period_start, period_end
            )

            # Calculate earnings
            total_earnings = sum(t.creator_revenue for t in transactions if t.payment_status == "completed")
            template_sales = sum(
                t.creator_revenue for t in transactions
                if t.transaction_type == "template_purchase" and t.payment_status == "completed"
            )
            subscription_revenue = sum(
                t.creator_revenue for t in transactions
                if t.transaction_type == "subscription" and t.payment_status == "completed"
            )
            usage_revenue = sum(
                t.creator_revenue for t in transactions
                if t.transaction_type == "usage" and t.payment_status == "completed"
            )

            # Get top performing templates
            top_templates = await self._get_creator_top_templates(creator_id, period_start, period_end)

            earnings = CreatorEarnings(
                creator_id=creator_id,
                period_start=period_start,
                period_end=period_end,
                total_earnings=total_earnings,
                template_sales=template_sales,
                subscription_revenue=subscription_revenue,
                usage_revenue=usage_revenue,
                total_transactions=len(transactions),
                successful_transactions=len([t for t in transactions if t.payment_status == "completed"]),
                failed_transactions=len([t for t in transactions if t.payment_status == "failed"]),
                top_templates=top_templates,
                payment_status="pending" if total_earnings >= self.minimum_payout else "below_minimum"
            )

            return earnings

        except Exception as e:
            logger.error(f"Failed to get creator earnings: {e}", exc_info=True)
            raise

    async def get_platform_revenue(
        self,
        period_start: Optional[datetime] = None,
        period_end: Optional[datetime] = None
    ) -> PlatformRevenue:
        """
        Get platform revenue summary.

        Args:
            period_start: Start of revenue period (default: 30 days ago)
            period_end: End of revenue period (default: now)

        Returns:
            Platform revenue summary
        """
        try:
            if not period_start:
                period_start = datetime.utcnow() - timedelta(days=30)
            if not period_end:
                period_end = datetime.utcnow()

            # Get all transactions for the period
            transactions = await self._get_platform_transactions(period_start, period_end)

            # Calculate revenue
            total_revenue = sum(t.platform_fee for t in transactions if t.payment_status == "completed")
            template_sales_revenue = sum(
                t.platform_fee for t in transactions
                if t.transaction_type == "template_purchase" and t.payment_status == "completed"
            )
            subscription_revenue = sum(
                t.platform_fee for t in transactions
                if t.transaction_type == "subscription" and t.payment_status == "completed"
            )
            usage_revenue = sum(
                t.platform_fee for t in transactions
                if t.transaction_type == "usage" and t.payment_status == "completed"
            )

            # Calculate creator payments
            total_creator_payments = sum(t.creator_revenue for t in transactions if t.payment_status == "completed")
            pending_creator_payments = await self._calculate_pending_creator_payments()

            # Get platform metrics
            active_creators = await self._get_active_creators_count(period_start, period_end)
            active_templates = await self._get_active_templates_count(period_start, period_end)
            new_templates = await self._get_new_templates_count(period_start, period_end)

            revenue = PlatformRevenue(
                period_start=period_start,
                period_end=period_end,
                total_revenue=total_revenue,
                template_sales_revenue=template_sales_revenue,
                subscription_revenue=subscription_revenue,
                usage_revenue=usage_revenue,
                total_transactions=len(transactions),
                successful_transactions=len([t for t in transactions if t.payment_status == "completed"]),
                failed_transactions=len([t for t in transactions if t.payment_status == "failed"]),
                refunded_transactions=len([t for t in transactions if t.payment_status == "refunded"]),
                total_creator_payments=total_creator_payments,
                pending_creator_payments=pending_creator_payments,
                active_creators=active_creators,
                active_templates=active_templates,
                new_templates_published=new_templates
            )

            return revenue

        except Exception as e:
            logger.error(f"Failed to get platform revenue: {e}", exc_info=True)
            raise

    async def process_creator_payouts(self, creator_id: Optional[UUID] = None) -> dict[str, Any]:
        """
        Process creator payouts.

        Args:
            creator_id: Specific creator to process (None for all eligible creators)

        Returns:
            Payout processing results
        """
        try:
            logger.info(f"Processing creator payouts for {creator_id or 'all creators'}")

            # Get eligible creators
            if creator_id:
                eligible_creators = [creator_id]
            else:
                eligible_creators = await self._get_eligible_creators_for_payout()

            payout_results = {
                "processed_creators": 0,
                "total_payout_amount": 0.0,
                "failed_payouts": 0,
                "payout_details": []
            }

            for creator in eligible_creators:
                try:
                    # Get creator earnings
                    earnings = await self.get_creator_earnings(creator)

                    if earnings.total_earnings >= self.minimum_payout:
                        # Process payout
                        payout_result = await self._process_creator_payout(creator, earnings)

                        if payout_result["success"]:
                            payout_results["processed_creators"] += 1
                            payout_results["total_payout_amount"] += earnings.total_earnings
                            payout_results["payout_details"].append({
                                "creator_id": str(creator),
                                "amount": earnings.total_earnings,
                                "payment_reference": payout_result["payment_reference"]
                            })
                        else:
                            payout_results["failed_payouts"] += 1
                            payout_results["payout_details"].append({
                                "creator_id": str(creator),
                                "amount": earnings.total_earnings,
                                "error": payout_result["error"]
                            })

                except Exception as e:
                    logger.error(f"Failed to process payout for creator {creator}: {e}")
                    payout_results["failed_payouts"] += 1

            logger.info(f"Payout processing completed: {payout_results}")
            return payout_results

        except Exception as e:
            logger.error(f"Failed to process creator payouts: {e}", exc_info=True)
            raise

    async def _get_template_creator(self, template_id: str) -> UUID:
        """Get the creator ID for a template."""
        # In production, this would query the template registry
        # For now, return a mock creator ID
        return UUID("12345678-1234-1234-1234-123456789012")

    async def _store_transaction(self, transaction: RevenueTransaction):
        """Store a revenue transaction."""
        # In production, this would store in a database
        # For now, we'll just log it
        logger.info(f"Stored revenue transaction: {transaction.id}")

    async def _update_creator_earnings(self, transaction: RevenueTransaction):
        """Update creator earnings with a new transaction."""
        # In production, this would update creator earnings in the database
        logger.info(f"Updated earnings for creator {transaction.creator_id}")

    async def _update_platform_metrics(self, transaction: RevenueTransaction):
        """Update platform revenue metrics."""
        # In production, this would update platform metrics
        logger.info(f"Updated platform metrics for transaction {transaction.id}")

    async def _get_creator_transactions(
        self,
        creator_id: UUID,
        period_start: datetime,
        period_end: datetime
    ) -> list[RevenueTransaction]:
        """Get transactions for a creator in a period."""
        # In production, this would query the database
        # For now, return empty list
        return []

    async def _get_creator_top_templates(
        self,
        creator_id: UUID,
        period_start: datetime,
        period_end: datetime
    ) -> list[dict[str, Any]]:
        """Get top performing templates for a creator."""
        # In production, this would query the database
        return []

    async def _get_platform_transactions(
        self,
        period_start: datetime,
        period_end: datetime
    ) -> list[RevenueTransaction]:
        """Get all platform transactions in a period."""
        # In production, this would query the database
        return []

    async def _calculate_pending_creator_payments(self) -> float:
        """Calculate total pending creator payments."""
        # In production, this would calculate from the database
        return 0.0

    async def _get_active_creators_count(
        self,
        period_start: datetime,
        period_end: datetime
    ) -> int:
        """Get count of active creators in a period."""
        # In production, this would query the database
        return 0

    async def _get_active_templates_count(
        self,
        period_start: datetime,
        period_end: datetime
    ) -> int:
        """Get count of active templates in a period."""
        # In production, this would query the database
        return 0

    async def _get_new_templates_count(
        self,
        period_start: datetime,
        period_end: datetime
    ) -> int:
        """Get count of new templates published in a period."""
        # In production, this would query the database
        return 0

    async def _get_eligible_creators_for_payout(self) -> list[UUID]:
        """Get creators eligible for payout."""
        # In production, this would query the database for creators with earnings >= minimum_payout
        return []

    async def _process_creator_payout(
        self,
        creator_id: UUID,
        earnings: CreatorEarnings
    ) -> dict[str, Any]:
        """Process payout for a specific creator."""
        try:
            # In production, this would integrate with payment processors like Stripe
            # For now, we'll simulate successful payout

            payment_reference = f"PAYOUT_{creator_id.hex[:8]}_{datetime.utcnow().strftime('%Y%m%d')}"

            # Simulate payment processing
            await asyncio.sleep(0.1)

            logger.info(f"Processed payout for creator {creator_id}: ${earnings.total_earnings}")

            return {
                "success": True,
                "payment_reference": payment_reference,
                "amount": earnings.total_earnings
            }

        except Exception as e:
            logger.error(f"Failed to process payout for creator {creator_id}: {e}")
            return {
                "success": False,
                "error": str(e)
            }


# Singleton instance
revenue_manager = RevenueManager()
