"""
Unit tests for approval models (ApprovalRequirement and ApprovalResponse).

Tests the new domain models for enterprise approval workflows.
"""

import pytest
from datetime import datetime, timedelta
from uuid import uuid4

from src.udp.domain.models import ApprovalRequirement, ApprovalResponse


class TestApprovalRequirement:
    """Test ApprovalRequirement model functionality."""
    
    def test_approval_requirement_creation(self):
        """Test approval requirement creation and validation."""
        
        deadline = datetime.utcnow() + timedelta(hours=24)
        
        requirement = ApprovalRequirement(
            workflow_id="test-workflow",
            approver_role="team_lead",
            approver_email="lead@test.com",
            approval_type="technical_review",
            priority=40,
            deadline=deadline,
            context={"request_type": "dependency_update"},
            escalation_policy={"sla_hours": 24, "escalation_threshold_hours": 18},
            stakeholder_hierarchy=[{"role": "manager", "email": "manager@test.com"}]
        )
        
        assert requirement.workflow_id == "test-workflow"
        assert requirement.approver_role == "team_lead"
        assert requirement.approval_status == "pending"
        assert requirement.is_pending
        assert not requirement.is_approved
        assert not requirement.is_rejected
        assert not requirement.is_expired
        assert requirement.time_remaining_hours > 0
    
    def test_approval_requirement_validation_errors(self):
        """Test approval requirement validation errors."""
        
        # Test invalid approval status
        with pytest.raises(ValueError, match="Invalid approval status"):
            ApprovalRequirement(
                workflow_id="test",
                approver_role="team_lead",
                approval_type="review",
                priority=50,
                deadline=datetime.utcnow() + timedelta(hours=24),
                approval_status="invalid_status"
            )
    
    def test_approval_requirement_properties(self):
        """Test approval requirement computed properties."""
        
        # Test escalation requirement
        escalation_requirement = ApprovalRequirement(
            workflow_id="test",
            approver_role="team_lead",
            approval_type="review",
            priority=50,
            deadline=datetime.utcnow() + timedelta(hours=2),
            escalation_policy={"escalation_threshold_hours": 4}
        )
        
        assert escalation_requirement.requires_escalation
        
        # Test next escalation target
        hierarchy_requirement = ApprovalRequirement(
            workflow_id="test",
            approver_role="team_lead",
            approval_type="review",
            priority=50,
            deadline=datetime.utcnow() + timedelta(hours=24),
            stakeholder_hierarchy=[
                {"role": "manager", "email": "manager@test.com"},
                {"role": "director", "email": "director@test.com"}
            ]
        )
        
        next_target = hierarchy_requirement.next_escalation_target
        assert next_target is not None
        assert next_target["role"] == "manager"


class TestApprovalResponse:
    """Test ApprovalResponse model functionality."""
    
    def test_approval_response_creation(self):
        """Test approval response creation and validation."""
        
        response = ApprovalResponse(
            requirement_id=uuid4(),
            approver_id=uuid4(),
            approver_email="approver@test.com",
            approver_role="team_lead",
            status="approved",
            comments="Looks good to me",
            conditions=["Run additional tests"],
            confidence_level="high",
            ip_address="192.168.1.1",
            user_agent="Mozilla/5.0"
        )
        
        assert response.status == "approved"
        assert response.is_approval
        assert not response.is_rejection
        assert response.has_conditions
        assert response.confidence_level == "high"
        
        # Test audit summary
        audit_summary = response.audit_summary
        assert "approver_id" in audit_summary
        assert "approver_email" in audit_summary
        assert "status" in audit_summary
        assert audit_summary["has_conditions"] is True
    
    def test_approval_response_validation_errors(self):
        """Test approval response validation errors."""
        
        # Test invalid status
        with pytest.raises(ValueError, match="Invalid response status"):
            ApprovalResponse(
                requirement_id=uuid4(),
                approver_id=uuid4(),
                approver_email="test@test.com",
                approver_role="team_lead",
                status="invalid_status"
            )
        
        # Test invalid confidence level
        with pytest.raises(ValueError, match="Invalid confidence level"):
            ApprovalResponse(
                requirement_id=uuid4(),
                approver_id=uuid4(),
                approver_email="test@test.com",
                approver_role="team_lead",
                status="approved",
                confidence_level="invalid_level"
            )
    
    def test_approval_response_properties(self):
        """Test approval response computed properties."""
        
        # Test rejection response
        rejection = ApprovalResponse(
            requirement_id=uuid4(),
            approver_id=uuid4(),
            approver_email="test@test.com",
            approver_role="team_lead",
            status="rejected",
            comments="Security concerns"
        )
        
        assert not rejection.is_approval
        assert rejection.is_rejection
        assert not rejection.has_conditions
        
        # Test conditional approval
        conditional = ApprovalResponse(
            requirement_id=uuid4(),
            approver_id=uuid4(),
            approver_email="test@test.com",
            approver_role="team_lead",
            status="conditional",
            conditions=["Add security scan", "Update documentation"]
        )
        
        assert conditional.is_approval
        assert not conditional.is_rejection
        assert conditional.has_conditions


if __name__ == "__main__":
    pytest.main([__file__])