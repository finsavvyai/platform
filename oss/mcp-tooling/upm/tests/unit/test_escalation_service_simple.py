"""
Simple unit tests for escalation service core functionality.

Tests escalation logic without complex workflow dependencies.
"""

import pytest
from datetime import datetime, timedelta
from uuid import uuid4

from src.udp.services.escalation_service import (
    EscalationSeverity,
    NotificationChannel,
    SLATracker,
    NotificationService
)


class TestSLATracker:
    """Test SLA tracking functionality."""
    
    @pytest.fixture
    def sla_tracker(self):
        """Create SLA tracker instance."""
        return SLATracker()
    
    def test_calculate_sla_deadline_dependency_update(self, sla_tracker):
        """Test SLA deadline calculation for dependency updates."""
        
        created_at = datetime.utcnow()
        
        # Test different risk levels
        low_deadline = sla_tracker.calculate_sla_deadline("dependency_update", "low", created_at)
        medium_deadline = sla_tracker.calculate_sla_deadline("dependency_update", "medium", created_at)
        high_deadline = sla_tracker.calculate_sla_deadline("dependency_update", "high", created_at)
        critical_deadline = sla_tracker.calculate_sla_deadline("dependency_update", "critical", created_at)
        
        # Low risk should have longest deadline
        assert low_deadline > medium_deadline
        assert medium_deadline > high_deadline
        assert high_deadline > critical_deadline
        
        # Check specific hours
        assert (low_deadline - created_at).total_seconds() / 3600 == 48
        assert (medium_deadline - created_at).total_seconds() / 3600 == 24
        assert (high_deadline - created_at).total_seconds() / 3600 == 16
        assert (critical_deadline - created_at).total_seconds() / 3600 == 8
    
    def test_calculate_sla_deadline_emergency_override(self, sla_tracker):
        """Test SLA deadline calculation for emergency overrides."""
        
        created_at = datetime.utcnow()
        
        critical_deadline = sla_tracker.calculate_sla_deadline("emergency_override", "critical", created_at)
        high_deadline = sla_tracker.calculate_sla_deadline("emergency_override", "high", created_at)
        
        # Emergency overrides should have very short deadlines
        assert (critical_deadline - created_at).total_seconds() / 3600 == 1
        assert (high_deadline - created_at).total_seconds() / 3600 == 2
    
    def test_calculate_sla_deadline_unknown_request_type(self, sla_tracker):
        """Test SLA deadline calculation for unknown request types."""
        
        created_at = datetime.utcnow()
        
        # Should fall back to dependency_update defaults
        unknown_deadline = sla_tracker.calculate_sla_deadline("unknown_type", "medium", created_at)
        dependency_deadline = sla_tracker.calculate_sla_deadline("dependency_update", "medium", created_at)
        
        assert unknown_deadline == dependency_deadline
    
    def test_get_sla_status_on_time(self, sla_tracker):
        """Test SLA status calculation for on-time scenarios."""
        
        deadline = datetime.utcnow() + timedelta(hours=12)
        current_time = datetime.utcnow()
        
        status, time_remaining = sla_tracker.get_sla_status(deadline, current_time)
        
        assert status == "on_time"
        assert time_remaining == 12.0
    
    def test_get_sla_status_at_risk(self, sla_tracker):
        """Test SLA status calculation for at-risk scenarios."""
        
        deadline = datetime.utcnow() + timedelta(hours=4)
        current_time = datetime.utcnow()
        
        status, time_remaining = sla_tracker.get_sla_status(deadline, current_time)
        
        assert status == "at_risk"
        assert time_remaining == 4.0
    
    def test_get_sla_status_critical(self, sla_tracker):
        """Test SLA status calculation for critical scenarios."""
        
        deadline = datetime.utcnow() + timedelta(minutes=30)
        current_time = datetime.utcnow()
        
        status, time_remaining = sla_tracker.get_sla_status(deadline, current_time)
        
        assert status == "critical"
        assert time_remaining == 0.5
    
    def test_get_sla_status_overdue(self, sla_tracker):
        """Test SLA status calculation for overdue scenarios."""
        
        deadline = datetime.utcnow() - timedelta(hours=3)
        current_time = datetime.utcnow()
        
        status, time_remaining = sla_tracker.get_sla_status(deadline, current_time)
        
        assert status == "overdue"
        assert time_remaining == -3.0
    
    def test_get_sla_status_default_current_time(self, sla_tracker):
        """Test SLA status calculation with default current time."""
        
        deadline = datetime.utcnow() + timedelta(hours=6)
        
        status, time_remaining = sla_tracker.get_sla_status(deadline)
        
        assert status == "at_risk"  # 6 hours is at risk
        assert 5.9 <= time_remaining <= 6.1  # Allow for small timing differences


class TestNotificationService:
    """Test notification service functionality."""
    
    @pytest.fixture
    def notification_service(self):
        """Create notification service instance."""
        return NotificationService()
    
    @pytest.mark.asyncio
    async def test_send_email_notification_success(self, notification_service):
        """Test successful email notification sending."""
        
        content = {
            "subject": "Test Escalation",
            "message": "This is a test escalation message",
            "recipient": {"email": "test@example.com"},
            "priority": "high"
        }
        
        # Mock successful sending by patching random to return low value
        import random
        original_random = random.random
        
        def mock_random():
            return 0.1  # Below 0.95 success rate for email
        
        random.random = mock_random
        
        try:
            notification_id = await notification_service.send_notification(
                NotificationChannel.EMAIL, content
            )
            
            assert notification_id is not None
            assert len(notification_id) > 0
            assert isinstance(notification_id, str)
        finally:
            random.random = original_random
    
    @pytest.mark.asyncio
    async def test_send_notification_failure(self, notification_service):
        """Test notification sending failure."""
        
        content = {
            "subject": "Test Escalation",
            "message": "This is a test escalation message",
            "recipient": {"email": "test@example.com"},
            "priority": "high"
        }
        
        # Mock failure by patching random to return high value
        import random
        original_random = random.random
        
        def mock_random():
            return 0.99  # Above success rate
        
        random.random = mock_random
        
        try:
            with pytest.raises(Exception, match="Failed to send email notification"):
                await notification_service.send_notification(
                    NotificationChannel.EMAIL, content
                )
        finally:
            random.random = original_random
    
    @pytest.mark.asyncio
    async def test_send_different_channel_types(self, notification_service):
        """Test sending notifications through different channels."""
        
        content = {
            "subject": "Test Escalation",
            "message": "This is a test escalation message",
            "recipient": {"email": "test@example.com"},
            "priority": "medium"
        }
        
        # Test all channel types
        channels = [
            NotificationChannel.EMAIL,
            NotificationChannel.SLACK,
            NotificationChannel.SMS,
            NotificationChannel.WEBHOOK,
            NotificationChannel.IN_APP
        ]
        
        import random
        original_random = random.random
        
        def mock_random():
            return 0.1  # Always succeed
        
        random.random = mock_random
        
        try:
            for channel in channels:
                notification_id = await notification_service.send_notification(channel, content)
                assert notification_id is not None
                assert len(notification_id) > 0
        finally:
            random.random = original_random


class TestEscalationEnums:
    """Test escalation-related enums and constants."""
    
    def test_escalation_severity_values(self):
        """Test escalation severity enum values."""
        
        assert EscalationSeverity.LOW == "low"
        assert EscalationSeverity.MEDIUM == "medium"
        assert EscalationSeverity.HIGH == "high"
        assert EscalationSeverity.CRITICAL == "critical"
        
        # Test all values are unique
        values = [
            EscalationSeverity.LOW,
            EscalationSeverity.MEDIUM,
            EscalationSeverity.HIGH,
            EscalationSeverity.CRITICAL
        ]
        assert len(values) == len(set(values))
    
    def test_notification_channel_values(self):
        """Test notification channel enum values."""
        
        assert NotificationChannel.EMAIL == "email"
        assert NotificationChannel.SLACK == "slack"
        assert NotificationChannel.SMS == "sms"
        assert NotificationChannel.WEBHOOK == "webhook"
        assert NotificationChannel.IN_APP == "in_app"
        
        # Test all values are unique
        values = [
            NotificationChannel.EMAIL,
            NotificationChannel.SLACK,
            NotificationChannel.SMS,
            NotificationChannel.WEBHOOK,
            NotificationChannel.IN_APP
        ]
        assert len(values) == len(set(values))


if __name__ == "__main__":
    pytest.main([__file__])