"""
Unit tests for escalation scenarios and timeout handling.

Tests comprehensive escalation logic, SLA tracking, notification
delivery, and timeout scenarios for enterprise approval workflows.
"""

import pytest
from datetime import datetime, timedelta
from uuid import uuid4
from unittest.mock import AsyncMock, MagicMock, patch

from src.udp.services.escalation_service import (
    EscalationService,
    EscalationSeverity,
    NotificationChannel,
    SLATracker,
    NotificationService
)
from src.udp.workflows.approval_workflow import ApprovalWorkflow, ApprovalType
from src.udp.domain.models import ApprovalRequirement, WorkflowStatus


class TestEscalationService:
    """Test escalation service functionality."""
    
    @pytest.fixture
    def organization_id(self):
        """Test organization ID."""
        return uuid4()
    
    @pytest.fixture
    def escalation_service(self, organization_id):
        """Create escalation service instance."""
        return EscalationService(organization_id)
    
    @pytest.fixture
    def sample_approval_state(self):
        """Sample approval state with pending requirements."""
        req_id = uuid4()
        return {
            "workflow_id": "test-workflow",
            "request_type": "dependency_update",
            "status": WorkflowStatus.WAITING_FOR_APPROVAL,
            "started_at": (datetime.utcnow() - timedelta(hours=25)).isoformat(),
            "sla_deadline": (datetime.utcnow() + timedelta(hours=1)).isoformat(),
            "sla_status": "at_risk",
            "escalation_level": 0,
            "escalation_history": [],
            "notifications_sent": [],
            "audit_trail_enhanced": [],
            "approval_requirements": [
                {
                    "id": str(req_id),
                    "workflow_id": "test-workflow",
                    "approver_role": "team_lead",
                    "approver_email": "lead@test.com",
                    "approver_user_id": str(uuid4()),
                    "approval_type": "technical_review",
                    "priority": 40,
                    "deadline": (datetime.utcnow() - timedelta(hours=2)).isoformat(),  # Overdue
                    "approval_status": "pending",
                    "escalation_count": 0,
                    "created_at": (datetime.utcnow() - timedelta(hours=25)).isoformat(),
                    "escalation_policy": {
                        "auto_escalate": True,
                        "escalation_threshold_hours": 24,
                        "max_escalations": 2
                    },
                    "stakeholder_hierarchy": [
                        {"role": "manager", "email": "manager@test.com", "user_id": str(uuid4())}
                    ]
                }
            ]
        }
    
    @pytest.mark.asyncio
    async def test_assess_escalation_need_overdue(self, escalation_service):
        """Test escalation need assessment for overdue requirement."""
        
        # Create overdue requirement
        requirement = ApprovalRequirement(
            workflow_id="test",
            approver_role="team_lead",
            approval_type="review",
            priority=50,
            deadline=datetime.utcnow() - timedelta(hours=5),  # 5 hours overdue
            escalation_policy={
                "auto_escalate": True,
                "escalation_threshold_hours": 2,
                "max_escalations": 3
            },
            stakeholder_hierarchy=[
                {"role": "manager", "email": "manager@test.com"}
            ]
        )
        
        current_time = datetime.utcnow()
        assessment = await escalation_service._assess_escalation_need(requirement, current_time)
        
        assert assessment["required"] is True
        assert assessment["severity"] == EscalationSeverity.LOW  # 5 hours overdue
        assert assessment["target"]["role"] == "manager"
        assert assessment["urgency_score"] > 0.5
        assert "threshold exceeded" in assessment["reason"]
    
    @pytest.mark.asyncio
    async def test_assess_escalation_need_critical_overdue(self, escalation_service):
        """Test escalation need assessment for critically overdue requirement."""
        
        requirement = ApprovalRequirement(
            workflow_id="test",
            approver_role="security_officer",
            approval_type="security_review",
            priority=10,
            deadline=datetime.utcnow() - timedelta(hours=50),  # 50 hours overdue
            escalation_policy={
                "auto_escalate": True,
                "escalation_threshold_hours": 4,
                "max_escalations": 2
            },
            stakeholder_hierarchy=[
                {"role": "security_manager", "email": "sec.mgr@test.com"}
            ]
        )
        
        current_time = datetime.utcnow()
        assessment = await escalation_service._assess_escalation_need(requirement, current_time)
        
        assert assessment["required"] is True
        assert assessment["severity"] == EscalationSeverity.CRITICAL  # >48 hours overdue
        assert assessment["urgency_score"] > 0.8
    
    @pytest.mark.asyncio
    async def test_assess_escalation_need_max_escalations_reached(self, escalation_service):
        """Test escalation assessment when max escalations reached."""
        
        requirement = ApprovalRequirement(
            workflow_id="test",
            approver_role="team_lead",
            approval_type="review",
            priority=50,
            deadline=datetime.utcnow() - timedelta(hours=10),
            escalation_count=2,  # Already escalated twice
            escalation_policy={
                "auto_escalate": True,
                "escalation_threshold_hours": 1,
                "max_escalations": 2  # Max reached
            },
            stakeholder_hierarchy=[
                {"role": "manager", "email": "manager@test.com"}
            ]
        )
        
        current_time = datetime.utcnow()
        assessment = await escalation_service._assess_escalation_need(requirement, current_time)
        
        assert assessment["required"] is False  # Max escalations reached
    
    @pytest.mark.asyncio
    async def test_assess_escalation_need_auto_escalate_disabled(self, escalation_service):
        """Test escalation assessment when auto-escalation is disabled."""
        
        requirement = ApprovalRequirement(
            workflow_id="test",
            approver_role="team_lead",
            approval_type="review",
            priority=50,
            deadline=datetime.utcnow() - timedelta(hours=10),
            escalation_policy={
                "auto_escalate": False,  # Disabled
                "escalation_threshold_hours": 1,
                "max_escalations": 3
            }
        )
        
        current_time = datetime.utcnow()
        assessment = await escalation_service._assess_escalation_need(requirement, current_time)
        
        assert assessment["required"] is False  # Auto-escalation disabled
    
    @pytest.mark.asyncio
    async def test_check_and_process_escalations(self, escalation_service, sample_approval_state):
        """Test complete escalation checking and processing."""
        
        with patch.object(escalation_service, '_send_escalation_notifications') as mock_notifications:
            mock_notifications.return_value = {"sent_count": 2, "failed_count": 0, "notifications": []}
            
            results = await escalation_service.check_and_process_escalations(sample_approval_state)
            
            assert results["escalations_processed"] == 1
            assert results["sla_violations"] == 1  # Requirement is overdue
            assert len(results["escalation_events"]) == 1
            
            # Verify escalation event details
            escalation_event = results["escalation_events"][0]
            assert escalation_event["escalation_level"] == 1
            assert escalation_event["severity"] in [EscalationSeverity.LOW, EscalationSeverity.MEDIUM]
            assert escalation_event["auto_escalated"] is True
            assert escalation_event["sla_violation"] is True
            
            # Verify state was updated
            assert sample_approval_state["escalation_level"] == 1
            assert len(sample_approval_state["escalation_history"]) == 1
            assert sample_approval_state["approval_requirements"][0]["approval_status"] == "escalated"
            
            # Verify notifications were sent
            mock_notifications.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_send_escalation_notifications(self, escalation_service, sample_approval_state):
        """Test escalation notification sending."""
        
        escalation_event = {
            "escalation_id": str(uuid4()),
            "escalated_to": {"role": "manager", "email": "manager@test.com"},
            "severity": EscalationSeverity.HIGH,
            "escalation_level": 2,
            "urgency_score": 0.8,
            "sla_violation": True,
            "escalated_from": {"role": "team_lead", "email": "lead@test.com"}
        }
        
        with patch.object(escalation_service.notification_service, 'send_notification') as mock_send:
            mock_send.return_value = "notification-123"
            
            result = await escalation_service._send_escalation_notifications(
                sample_approval_state, escalation_event
            )
            
            assert result["sent_count"] > 0
            assert result["failed_count"] == 0
            
            # Verify multiple channels were used for high severity
            assert mock_send.call_count >= 3  # Email, Slack, SMS, In-app for HIGH severity
            
            # Verify notification content
            call_args = mock_send.call_args_list[0]
            channel, content = call_args[0]
            assert channel in [NotificationChannel.EMAIL, NotificationChannel.SLACK, NotificationChannel.SMS, NotificationChannel.IN_APP]
            assert "APPROVAL ESCALATION" in content["subject"]
            assert "HIGH PRIORITY" in content["message"]
            assert content["priority"] == EscalationSeverity.HIGH
    
    def test_get_notification_channels_for_severity(self, escalation_service):
        """Test notification channel selection based on severity."""
        
        # Low severity - minimal channels
        low_channels = escalation_service._get_notification_channels_for_severity(EscalationSeverity.LOW)
        assert NotificationChannel.EMAIL in low_channels
        assert NotificationChannel.IN_APP in low_channels
        assert len(low_channels) == 2
        
        # Critical severity - all channels
        critical_channels = escalation_service._get_notification_channels_for_severity(EscalationSeverity.CRITICAL)
        assert NotificationChannel.EMAIL in critical_channels
        assert NotificationChannel.SLACK in critical_channels
        assert NotificationChannel.SMS in critical_channels
        assert NotificationChannel.WEBHOOK in critical_channels
        assert NotificationChannel.IN_APP in critical_channels
        assert len(critical_channels) == 5
    
    def test_build_escalation_message(self, escalation_service, sample_approval_state):
        """Test escalation message building."""
        
        escalation_event = {
            "escalated_from": {"role": "team_lead", "email": "lead@test.com"},
            "escalated_to": {"role": "manager", "email": "manager@test.com"},
            "severity": EscalationSeverity.HIGH,
            "escalation_level": 2,
            "reason": "SLA deadline exceeded",
            "urgency_score": 0.85,
            "sla_violation": True,
            "overdue_hours": 5.5,
            "escalation_id": "esc-123"
        }
        
        message = escalation_service._build_escalation_message(sample_approval_state, escalation_event)
        
        assert "APPROVAL ESCALATION - HIGH PRIORITY" in message
        assert "test-workflow" in message
        assert "Dependency Update" in message
        assert "Escalation Level: 2" in message
        assert "team_lead" in message
        assert "manager" in message
        assert "SLA VIOLATION" in message
        assert "5.5 hours overdue" in message
        assert "esc-123" in message
    
    @pytest.mark.asyncio
    async def test_get_escalation_metrics(self, escalation_service, sample_approval_state):
        """Test escalation metrics generation."""
        
        # Add some escalation history
        sample_approval_state["escalation_history"] = [
            {
                "auto_escalated": True,
                "severity": "medium",
                "escalation_level": 1
            },
            {
                "auto_escalated": False,
                "severity": "high",
                "escalation_level": 2
            }
        ]
        
        # Add some notifications
        sample_approval_state["notifications_sent"] = [
            {"channel": "email", "status": "sent"},
            {"channel": "slack", "status": "sent"},
            {"channel": "sms", "status": "failed"}
        ]
        
        metrics = await escalation_service.get_escalation_metrics(sample_approval_state)
        
        assert metrics["workflow_id"] == "test-workflow"
        assert metrics["current_escalation_level"] == 0  # From state
        assert metrics["total_escalations"] == 2
        assert metrics["escalation_breakdown"]["automatic"] == 1
        assert metrics["escalation_breakdown"]["manual"] == 1
        assert metrics["escalation_breakdown"]["by_severity"]["medium"] == 1
        assert metrics["escalation_breakdown"]["by_severity"]["high"] == 1
        
        assert metrics["notification_metrics"]["total_sent"] == 3
        assert metrics["notification_metrics"]["by_channel"]["email"]["sent"] == 1
        assert metrics["notification_metrics"]["by_channel"]["sms"]["failed"] == 1
        assert metrics["notification_metrics"]["success_rate"] == 2/3  # 2 sent, 1 failed
        
        assert metrics["sla_metrics"]["violations"] == 1  # One overdue requirement
        assert metrics["sla_metrics"]["status"] == "at_risk"


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


class TestApprovalWorkflowEscalation:
    """Test escalation integration with approval workflow."""
    
    @pytest.fixture
    def organization_id(self):
        """Test organization ID."""
        return uuid4()
    
    @pytest.fixture
    def approval_workflow(self, organization_id):
        """Create approval workflow instance."""
        return ApprovalWorkflow(organization_id)
    
    @pytest.fixture
    def escalation_state(self):
        """Approval state requiring escalation."""
        return {
            "workflow_id": "escalation-test",
            "request_type": "security_override",
            "status": WorkflowStatus.WAITING_FOR_APPROVAL,
            "started_at": (datetime.utcnow() - timedelta(hours=10)).isoformat(),
            "sla_deadline": (datetime.utcnow() - timedelta(hours=2)).isoformat(),  # Overdue
            "sla_status": "overdue",
            "escalation_level": 1,
            "escalation_history": [],
            "notifications_sent": [],
            "audit_trail_enhanced": [],
            "auto_escalation_enabled": True,
            "approval_requirements": [
                {
                    "id": str(uuid4()),
                    "workflow_id": "escalation-test",
                    "approver_role": "security_officer",
                    "approver_email": "security@test.com",
                    "approval_status": "pending",
                    "deadline": (datetime.utcnow() - timedelta(hours=3)).isoformat(),
                    "escalation_count": 1,
                    "created_at": (datetime.utcnow() - timedelta(hours=10)).isoformat(),
                    "escalation_policy": {
                        "auto_escalate": True,
                        "escalation_threshold_hours": 4,
                        "max_escalations": 3
                    },
                    "stakeholder_hierarchy": [
                        {"role": "security_manager", "email": "sec.mgr@test.com"}
                    ]
                }
            ]
        }
    
    @pytest.mark.asyncio
    async def test_process_periodic_escalation_check(self, approval_workflow, escalation_state):
        """Test periodic escalation check processing."""
        
        with patch.object(approval_workflow.escalation_service, 'check_and_process_escalations') as mock_escalation:
            mock_escalation.return_value = {
                "escalations_processed": 1,
                "notifications_sent": 3,
                "sla_violations": 1,
                "escalation_events": [{"escalation_id": "esc-123"}],
                "errors": []
            }
            
            result = await approval_workflow.process_periodic_escalation_check(escalation_state)
            
            assert result["processed"] is True
            assert result["workflow_updated"] is True
            assert result["escalation_results"]["escalations_processed"] == 1
            
            # Verify audit trail was updated
            audit_events = escalation_state["audit_trail_enhanced"]
            escalation_check_event = next(
                event for event in audit_events 
                if event["event"] == "periodic_escalation_check"
            )
            assert escalation_check_event["escalations_processed"] == 1
            assert escalation_check_event["notifications_sent"] == 3
            
            mock_escalation.assert_called_once_with(escalation_state)
    
    @pytest.mark.asyncio
    async def test_process_periodic_escalation_check_completed_workflow(self, approval_workflow, escalation_state):
        """Test escalation check skips completed workflows."""
        
        escalation_state["status"] = WorkflowStatus.COMPLETED
        
        result = await approval_workflow.process_periodic_escalation_check(escalation_state)
        
        assert result["processed"] is False
        assert "does not require escalation checks" in result["reason"]
    
    @pytest.mark.asyncio
    async def test_get_escalation_dashboard_data(self, approval_workflow, escalation_state):
        """Test escalation dashboard data generation."""
        
        # Add some escalation history and notifications
        escalation_state["escalation_history"] = [
            {
                "escalated_at": (datetime.utcnow() - timedelta(hours=2)).isoformat(),
                "escalated_to": {"role": "security_manager"},
                "escalation_level": 2,
                "severity": "high",
                "auto_escalated": True
            }
        ]
        
        escalation_state["notifications_sent"] = [
            {
                "channel": "email",
                "status": "sent",
                "recipient": {"email": "sec.mgr@test.com"}
            },
            {
                "channel": "slack",
                "status": "failed",
                "error": "Channel not found"
            }
        ]
        
        with patch.object(approval_workflow.escalation_service, 'get_escalation_metrics') as mock_metrics, \
             patch.object(approval_workflow, 'get_approval_status_summary') as mock_summary:
            
            mock_metrics.return_value = {
                "current_escalation_level": 2,
                "total_escalations": 1,
                "escalation_breakdown": {"automatic": 1, "manual": 0}
            }
            
            mock_summary.return_value = {
                "workflow_status": WorkflowStatus.WAITING_FOR_APPROVAL,
                "progress_percentage": 25.0
            }
            
            dashboard_data = await approval_workflow.get_escalation_dashboard_data(escalation_state)
            
            assert dashboard_data["workflow_overview"]["workflow_id"] == "escalation-test"
            assert dashboard_data["workflow_overview"]["request_type"] == "security_override"
            assert dashboard_data["escalation_metrics"]["current_escalation_level"] == 2
            assert dashboard_data["sla_tracking"]["status"] == "overdue"
            assert dashboard_data["sla_tracking"]["current_level"] == 1
            
            # Check recent events
            recent_events = dashboard_data["recent_events"]
            assert len(recent_events) > 0
            escalation_event = next(
                event for event in recent_events 
                if event["type"] == "escalation"
            )
            assert "security_manager" in escalation_event["description"]
            assert escalation_event["severity"] == "high"
            
            # Check notification status
            notification_status = dashboard_data["notification_status"]
            assert notification_status["total_sent"] == 2
            assert notification_status["successful"] == 1
            assert notification_status["failed"] == 1
            assert notification_status["success_rate"] == 0.5
            
            # Check risk indicators
            risk_indicators = dashboard_data["risk_indicators"]
            assert risk_indicators["sla_risk"] == "critical"  # Overdue
            assert risk_indicators["escalation_risk"] in ["medium", "high"]  # Level 1
            assert len(risk_indicators["factors"]) > 0
    
    def test_calculate_risk_indicators_critical_scenario(self, approval_workflow):
        """Test risk indicator calculation for critical scenarios."""
        
        critical_state = {
            "sla_status": "overdue",
            "escalation_level": 3,
            "approval_requirements": [
                {
                    "approval_status": "pending",
                    "created_at": (datetime.utcnow() - timedelta(hours=72)).isoformat()  # 72 hours old
                }
            ]
        }
        
        risk_indicators = approval_workflow._calculate_risk_indicators(critical_state)
        
        assert risk_indicators["overall_risk"] == "critical"
        assert risk_indicators["sla_risk"] == "critical"
        assert risk_indicators["escalation_risk"] == "critical"
        assert len(risk_indicators["factors"]) >= 2  # SLA + escalation factors
        assert any("SLA deadline exceeded" in factor for factor in risk_indicators["factors"])
        assert any("Multiple escalation levels" in factor for factor in risk_indicators["factors"])
        assert any("stalled for >48h" in factor for factor in risk_indicators["factors"])


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
        
        # Mock successful sending
        with patch('random.random', return_value=0.1):  # Below 0.95 success rate
            notification_id = await notification_service.send_notification(
                NotificationChannel.EMAIL, content
            )
            
            assert notification_id is not None
            assert len(notification_id) > 0
    
    @pytest.mark.asyncio
    async def test_send_notification_failure(self, notification_service):
        """Test notification sending failure."""
        
        content = {
            "subject": "Test Escalation",
            "message": "This is a test escalation message",
            "recipient": {"email": "test@example.com"},
            "priority": "high"
        }
        
        # Mock failure
        with patch('random.random', return_value=0.99):  # Above success rate
            with pytest.raises(Exception, match="Failed to send email notification"):
                await notification_service.send_notification(
                    NotificationChannel.EMAIL, content
                )


if __name__ == "__main__":
    pytest.main([__file__])