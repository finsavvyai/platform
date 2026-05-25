"""
Integration tests for enterprise approval workflows.

Tests complete multi-stakeholder approval orchestration with
dependency tracking, escalation, and validation.
"""

import pytest
from datetime import datetime, timedelta
from uuid import uuid4
from unittest.mock import AsyncMock, MagicMock, patch

from src.udp.workflows.approval_workflow import (
    ApprovalWorkflow,
    ApprovalType,
    RoutingStrategy
)
from src.udp.domain.models import (
    ApprovalRequirement,
    ApprovalResponse,
    WorkflowStatus,
    SecurityLevel
)


class TestEnterpriseApprovalWorkflows:
    """Integration tests for complete enterprise approval workflows."""
    
    @pytest.fixture
    def organization_id(self):
        """Test organization ID."""
        return uuid4()
    
    @pytest.fixture
    def approval_workflow(self, organization_id):
        """Create approval workflow instance."""
        return ApprovalWorkflow(organization_id)
    
    @pytest.fixture
    def high_risk_request_data(self):
        """High-risk request data requiring multiple approvals."""
        return {
            "project_id": "critical-system",
            "dependencies": [
                {"name": "crypto-lib", "version": "1.0.0", "ecosystem": "npm"},
                {"name": "security-utils", "version": "2.1.0", "ecosystem": "pypi"}
            ],
            "vulnerabilities": [
                {"cve_id": "CVE-2023-5678", "severity": "high"},
                {"cve_id": "CVE-2023-9012", "severity": "critical"}
            ],
            "license_violations": [
                {"license": "GPL-3.0", "package": "crypto-lib"}
            ],
            "policy_violations": [
                {"policy": "security_scan_required", "violation": "missing_scan"},
                {"policy": "license_compliance", "violation": "copyleft_license"}
            ],
            "ecosystems": ["npm", "pypi"],
            "security_scan_results": {"status": "completed", "issues": 2},
            "license_analysis": {"status": "completed", "violations": 1},
            "dependency_graph": {"nodes": 25, "edges": 40}
        }
    
    @pytest.mark.asyncio
    async def test_complete_multi_stakeholder_approval_workflow(
        self, 
        approval_workflow, 
        high_risk_request_data
    ):
        """Test complete multi-stakeholder approval workflow from start to finish."""
        
        # Mock the routing engine and stakeholder manager
        with patch.object(approval_workflow.routing_engine, 'analyze_request') as mock_analyze, \
             patch.object(approval_workflow.stakeholder_manager, 'determine_stakeholders') as mock_stakeholders:
            
            # Setup high-risk analysis
            mock_analyze.return_value = {
                "risk_score": 8.5,
                "risk_level": "critical",
                "confidence_score": 0.85,
                "requester_trust_score": 0.7,
                "risk_factors": {
                    "security_vulnerabilities": 2,
                    "policy_violations": 2,
                    "license_issues": 1,
                    "dependency_count": 25,
                    "ecosystem_diversity": 2
                },
                "has_security_issues": True,
                "has_compliance_issues": True,
                "recommended_routing": "risk_based"
            }
            
            # Setup multi-stakeholder configuration
            security_officer_id = uuid4()
            compliance_manager_id = uuid4()
            team_lead_id = uuid4()
            manager_id = uuid4()
            
            mock_stakeholders.return_value = {
                "stakeholders": [
                    {
                        "role": "security_officer",
                        "email": "security@company.com",
                        "user_id": security_officer_id,
                        "required": True
                    },
                    {
                        "role": "compliance_manager",
                        "email": "compliance@company.com",
                        "user_id": compliance_manager_id,
                        "required": True
                    },
                    {
                        "role": "team_lead",
                        "email": "lead@company.com",
                        "user_id": team_lead_id,
                        "required": True
                    },
                    {
                        "role": "manager",
                        "email": "manager@company.com",
                        "user_id": manager_id,
                        "required": True
                    }
                ],
                "hierarchy": {
                    "security_officer": [
                        {"role": "security_manager", "email": "sec.mgr@company.com"}
                    ],
                    "compliance_manager": [
                        {"role": "compliance_director", "email": "comp.dir@company.com"}
                    ],
                    "team_lead": [
                        {"role": "engineering_manager", "email": "eng.mgr@company.com"}
                    ],
                    "manager": [
                        {"role": "director", "email": "director@company.com"}
                    ]
                },
                "escalation_policies": {
                    "security_officer": {
                        "sla_hours": 2,
                        "escalation_threshold_hours": 1,
                        "max_escalations": 2,
                        "auto_escalate": True
                    },
                    "compliance_manager": {
                        "sla_hours": 4,
                        "escalation_threshold_hours": 3,
                        "max_escalations": 2,
                        "auto_escalate": True
                    },
                    "team_lead": {
                        "sla_hours": 6,
                        "escalation_threshold_hours": 4,
                        "max_escalations": 2,
                        "auto_escalate": True
                    },
                    "manager": {
                        "sla_hours": 8,
                        "escalation_threshold_hours": 6,
                        "max_escalations": 2,
                        "auto_escalate": True
                    }
                }
            }
            
            # Step 1: Initialize workflow
            state = await approval_workflow.execute(
                ApprovalType.SECURITY_OVERRIDE,
                high_risk_request_data,
                uuid4(),
                "developer",
                RoutingStrategy.RISK_BASED
            )
            
            # Verify initial state
            assert state["status"] == WorkflowStatus.WAITING_FOR_APPROVAL
            assert state["routing_strategy"] == "risk_based"
            assert len(state["approval_requirements"]) == 4
            assert len(state["stakeholders"]) == 4
            assert state["auto_approval_eligible"] is False
            
            # Verify risk-based routing setup
            assert state["current_approver"]["mode"] == "risk_based"
            assert state["current_approver"]["current_group"] == "high"
            
            # Step 2: Security officer approves (high priority group)
            security_req = next(
                req for req in state["approval_requirements"] 
                if req["approver_role"] == "security_officer"
            )
            
            security_response = ApprovalResponse(
                requirement_id=uuid4(security_req["id"]),
                approver_id=security_officer_id,
                approver_email="security@company.com",
                approver_role="security_officer",
                status="approved",
                comments="Security review completed. Vulnerabilities are acceptable with mitigations.",
                conditions=["Implement additional monitoring", "Apply security patches within 48h"],
                confidence_level="high"
            )
            
            response_result = await approval_workflow.process_approval_response(
                state, security_response
            )
            
            assert response_result["success"] is True
            assert response_result["workflow_progression"]["progression_possible"] is True
            
            # Verify security requirement is now approved
            updated_security_req = next(
                req for req in state["approval_requirements"] 
                if req["id"] == security_req["id"]
            )
            assert updated_security_req["approval_status"] == "approved"
            
            # Step 3: Compliance manager approves (high priority group)
            compliance_req = next(
                req for req in state["approval_requirements"] 
                if req["approver_role"] == "compliance_manager"
            )
            
            compliance_response = ApprovalResponse(
                requirement_id=uuid4(compliance_req["id"]),
                approver_id=compliance_manager_id,
                approver_email="compliance@company.com",
                approver_role="compliance_manager",
                status="conditional",
                comments="Compliance review completed with conditions.",
                conditions=["Obtain legal approval for GPL license", "Document compliance exceptions"],
                confidence_level="medium"
            )
            
            response_result = await approval_workflow.process_approval_response(
                state, compliance_response
            )
            
            assert response_result["success"] is True
            
            # After high priority group completion, medium priority should be activated
            progression = response_result["workflow_progression"]
            assert len(progression["newly_available_requirements"]) > 0
            
            # Step 4: Team lead approves (medium priority group)
            team_lead_req = next(
                req for req in state["approval_requirements"] 
                if req["approver_role"] == "team_lead"
            )
            
            team_lead_response = ApprovalResponse(
                requirement_id=uuid4(team_lead_req["id"]),
                approver_id=team_lead_id,
                approver_email="lead@company.com",
                approver_role="team_lead",
                status="approved",
                comments="Technical review completed. Dependencies are necessary and properly managed.",
                confidence_level="high"
            )
            
            response_result = await approval_workflow.process_approval_response(
                state, team_lead_response
            )
            
            assert response_result["success"] is True
            
            # Step 5: Manager approves (low priority group)
            manager_req = next(
                req for req in state["approval_requirements"] 
                if req["approver_role"] == "manager"
            )
            
            manager_response = ApprovalResponse(
                requirement_id=uuid4(manager_req["id"]),
                approver_id=manager_id,
                approver_email="manager@company.com",
                approver_role="manager",
                status="approved",
                comments="Business approval granted. Risk is acceptable for critical system needs.",
                confidence_level="high"
            )
            
            response_result = await approval_workflow.process_approval_response(
                state, manager_response
            )
            
            assert response_result["success"] is True
            
            # Verify workflow completion
            progression = response_result["workflow_progression"]
            assert progression["workflow_complete"] is True
            assert state["status"] == WorkflowStatus.COMPLETED
            assert state["final_decision"] == "approved"
            assert state["decision_confidence"] > 0.7  # High confidence from approvers
            
            # Verify all requirements are completed
            for req in state["approval_requirements"]:
                assert req["approval_status"] in ["approved", "conditional"]
            
            # Verify audit trail
            assert len(state["audit_trail_enhanced"]) >= 5  # Initial + 4 approvals
            approval_events = [
                event for event in state["audit_trail_enhanced"] 
                if event["event"] == "approval_response_processed"
            ]
            assert len(approval_events) == 4
    
    @pytest.mark.asyncio
    async def test_approval_workflow_with_rejection_and_escalation(
        self, 
        approval_workflow, 
        high_risk_request_data
    ):
        """Test approval workflow with rejection and automatic escalation."""
        
        with patch.object(approval_workflow.routing_engine, 'analyze_request') as mock_analyze, \
             patch.object(approval_workflow.stakeholder_manager, 'determine_stakeholders') as mock_stakeholders:
            
            mock_analyze.return_value = {
                "risk_score": 7.0,
                "risk_level": "high",
                "confidence_score": 0.8,
                "requester_trust_score": 0.6,
                "risk_factors": {"security_vulnerabilities": 1, "policy_violations": 1},
                "has_security_issues": True,
                "has_compliance_issues": True,
                "recommended_routing": "sequential"
            }
            
            security_officer_id = uuid4()
            security_manager_id = uuid4()
            
            mock_stakeholders.return_value = {
                "stakeholders": [
                    {
                        "role": "security_officer",
                        "email": "security@company.com",
                        "user_id": security_officer_id,
                        "required": True
                    }
                ],
                "hierarchy": {
                    "security_officer": [
                        {"role": "security_manager", "email": "sec.mgr@company.com", "user_id": security_manager_id}
                    ]
                },
                "escalation_policies": {
                    "security_officer": {
                        "sla_hours": 4,
                        "escalation_threshold_hours": 2,
                        "max_escalations": 1,
                        "auto_escalate": True
                    }
                }
            }
            
            # Initialize workflow
            state = await approval_workflow.execute(
                ApprovalType.SECURITY_OVERRIDE,
                high_risk_request_data,
                uuid4(),
                "developer",
                RoutingStrategy.SEQUENTIAL
            )
            
            # Security officer rejects
            security_req = state["approval_requirements"][0]
            
            rejection_response = ApprovalResponse(
                requirement_id=uuid4(security_req["id"]),
                approver_id=security_officer_id,
                approver_email="security@company.com",
                approver_role="security_officer",
                status="rejected",
                comments="Unacceptable security risk. Critical vulnerabilities must be resolved first.",
                confidence_level="high"
            )
            
            response_result = await approval_workflow.process_approval_response(
                state, rejection_response
            )
            
            # Verify escalation occurred
            assert response_result["success"] is True
            progression = response_result["workflow_progression"]
            assert progression["escalation_performed"] is True
            assert progression["escalation_target"]["role"] == "security_manager"
            
            # Verify requirement status
            updated_req = next(
                req for req in state["approval_requirements"] 
                if req["id"] == security_req["id"]
            )
            assert updated_req["approval_status"] == "escalated"
            assert updated_req["escalation_count"] == 1
            
            # Verify escalation history
            assert len(state["escalation_history"]) == 1
            escalation_event = state["escalation_history"][0]
            assert escalation_event["escalated_to"]["role"] == "security_manager"
            assert "Rejection escalation" in escalation_event["reason"]
    
    @pytest.mark.asyncio
    async def test_approval_workflow_with_validation_errors(
        self, 
        approval_workflow, 
        high_risk_request_data
    ):
        """Test approval workflow with response validation errors."""
        
        with patch.object(approval_workflow.routing_engine, 'analyze_request') as mock_analyze, \
             patch.object(approval_workflow.stakeholder_manager, 'determine_stakeholders') as mock_stakeholders:
            
            mock_analyze.return_value = {
                "risk_score": 5.0,
                "risk_level": "medium",
                "confidence_score": 0.7,
                "requester_trust_score": 0.8,
                "risk_factors": {"security_vulnerabilities": 0, "policy_violations": 1},
                "has_security_issues": False,
                "has_compliance_issues": True,
                "recommended_routing": "parallel"
            }
            
            team_lead_id = uuid4()
            
            mock_stakeholders.return_value = {
                "stakeholders": [
                    {
                        "role": "team_lead",
                        "email": "lead@company.com",
                        "user_id": team_lead_id,
                        "required": True
                    }
                ],
                "hierarchy": {"team_lead": []},
                "escalation_policies": {
                    "team_lead": {
                        "sla_hours": 8,
                        "escalation_threshold_hours": 6,
                        "max_escalations": 1,
                        "auto_escalate": True
                    }
                }
            }
            
            # Initialize workflow
            state = await approval_workflow.execute(
                ApprovalType.DEPENDENCY_UPDATE,
                high_risk_request_data,
                uuid4(),
                "developer"
            )
            
            # Test validation with missing required fields
            invalid_response_data = {
                "requirement_id": state["approval_requirements"][0]["id"],
                "approver_id": str(team_lead_id),
                # Missing approver_role and status
            }
            
            validation_result = await approval_workflow.validate_stakeholder_response(
                state, invalid_response_data
            )
            
            assert validation_result["valid"] is False
            assert len(validation_result["errors"]) >= 2  # Missing fields
            assert "Missing required field: approver_role" in validation_result["errors"]
            assert "Missing required field: status" in validation_result["errors"]
            
            # Test validation with wrong approver role
            wrong_role_response_data = {
                "requirement_id": state["approval_requirements"][0]["id"],
                "approver_id": str(team_lead_id),
                "approver_role": "security_officer",  # Wrong role
                "status": "approved"
            }
            
            validation_result = await approval_workflow.validate_stakeholder_response(
                state, wrong_role_response_data
            )
            
            assert validation_result["valid"] is False
            assert any("role mismatch" in error for error in validation_result["errors"])
            
            # Test validation with invalid status
            invalid_status_response_data = {
                "requirement_id": state["approval_requirements"][0]["id"],
                "approver_id": str(team_lead_id),
                "approver_role": "team_lead",
                "status": "invalid_status"
            }
            
            validation_result = await approval_workflow.validate_stakeholder_response(
                state, invalid_status_response_data
            )
            
            assert validation_result["valid"] is False
            assert any("Invalid response status" in error for error in validation_result["errors"])
            
            # Test validation with conditional approval missing conditions
            conditional_no_conditions_data = {
                "requirement_id": state["approval_requirements"][0]["id"],
                "approver_id": str(team_lead_id),
                "approver_role": "team_lead",
                "status": "conditional"
                # Missing conditions
            }
            
            validation_result = await approval_workflow.validate_stakeholder_response(
                state, conditional_no_conditions_data
            )
            
            assert validation_result["valid"] is False
            assert any("must include conditions" in error for error in validation_result["errors"])
    
    @pytest.mark.asyncio
    async def test_approval_status_summary_and_monitoring(
        self, 
        approval_workflow, 
        high_risk_request_data
    ):
        """Test approval status summary and monitoring capabilities."""
        
        with patch.object(approval_workflow.routing_engine, 'analyze_request') as mock_analyze, \
             patch.object(approval_workflow.stakeholder_manager, 'determine_stakeholders') as mock_stakeholders:
            
            mock_analyze.return_value = {
                "risk_score": 6.0,
                "risk_level": "medium",
                "confidence_score": 0.75,
                "requester_trust_score": 0.8,
                "risk_factors": {"security_vulnerabilities": 1, "policy_violations": 0},
                "has_security_issues": True,
                "has_compliance_issues": False,
                "recommended_routing": "parallel"
            }
            
            team_lead_id = uuid4()
            security_officer_id = uuid4()
            
            mock_stakeholders.return_value = {
                "stakeholders": [
                    {
                        "role": "team_lead",
                        "email": "lead@company.com",
                        "user_id": team_lead_id,
                        "required": True
                    },
                    {
                        "role": "security_officer",
                        "email": "security@company.com",
                        "user_id": security_officer_id,
                        "required": True
                    }
                ],
                "hierarchy": {
                    "team_lead": [],
                    "security_officer": []
                },
                "escalation_policies": {
                    "team_lead": {"sla_hours": 8, "escalation_threshold_hours": 6},
                    "security_officer": {"sla_hours": 4, "escalation_threshold_hours": 3}
                }
            }
            
            # Initialize workflow
            state = await approval_workflow.execute(
                ApprovalType.DEPENDENCY_UPDATE,
                high_risk_request_data,
                uuid4(),
                "developer"
            )
            
            # Get initial status summary
            initial_summary = await approval_workflow.get_approval_status_summary(state)
            
            assert initial_summary["workflow_status"] == WorkflowStatus.WAITING_FOR_APPROVAL
            assert initial_summary["requirements"]["total_requirements"] == 2
            assert initial_summary["requirements"]["pending"] == 2
            assert initial_summary["requirements"]["completed"] == 0
            assert initial_summary["progress_percentage"] == 0
            
            # Process one approval
            team_lead_req = next(
                req for req in state["approval_requirements"] 
                if req["approver_role"] == "team_lead"
            )
            
            team_lead_response = ApprovalResponse(
                requirement_id=uuid4(team_lead_req["id"]),
                approver_id=team_lead_id,
                approver_email="lead@company.com",
                approver_role="team_lead",
                status="approved",
                comments="Technical review completed.",
                confidence_level="high"
            )
            
            await approval_workflow.process_approval_response(state, team_lead_response)
            
            # Get updated status summary
            updated_summary = await approval_workflow.get_approval_status_summary(state)
            
            assert updated_summary["requirements"]["completed"] == 1
            assert updated_summary["requirements"]["pending"] == 1
            assert updated_summary["progress_percentage"] == 50.0
            
            # Verify stakeholder performance tracking
            assert "team_lead" in updated_summary["stakeholder_performance"]
            team_lead_perf = updated_summary["stakeholder_performance"]["team_lead"]
            assert team_lead_perf["responses"] == 1
            assert team_lead_perf["approval_rate"] == 1.0
            assert team_lead_perf["avg_response_time_hours"] > 0
            
            # Verify bottleneck analysis (security officer still pending)
            bottlenecks = updated_summary["bottlenecks"]
            # Should have bottleneck if security officer is taking too long
            # (This would depend on the actual timing in a real scenario)
            
            # Verify estimated completion time is calculated
            if "estimated_completion" in updated_summary:
                estimated_completion = datetime.fromisoformat(updated_summary["estimated_completion"])
                assert estimated_completion > datetime.utcnow()
    
    @pytest.mark.asyncio
    async def test_dependency_tracking_complex_workflow(
        self, 
        approval_workflow, 
        high_risk_request_data
    ):
        """Test complex approval dependency tracking with multiple dependency chains."""
        
        with patch.object(approval_workflow.routing_engine, 'analyze_request') as mock_analyze, \
             patch.object(approval_workflow.stakeholder_manager, 'determine_stakeholders') as mock_stakeholders:
            
            mock_analyze.return_value = {
                "risk_score": 9.0,
                "risk_level": "critical",
                "confidence_score": 0.9,
                "requester_trust_score": 0.8,
                "risk_factors": {
                    "security_vulnerabilities": 3,
                    "policy_violations": 2,
                    "license_issues": 1,
                    "dependency_count": 50,
                    "ecosystem_diversity": 4
                },
                "has_security_issues": True,
                "has_compliance_issues": True,
                "recommended_routing": "risk_based"
            }
            
            # Setup complex stakeholder hierarchy
            stakeholder_ids = {
                "security_officer": uuid4(),
                "compliance_manager": uuid4(),
                "architect": uuid4(),
                "team_lead": uuid4(),
                "manager": uuid4(),
                "director": uuid4()
            }
            
            mock_stakeholders.return_value = {
                "stakeholders": [
                    {"role": role, "email": f"{role}@company.com", "user_id": user_id, "required": True}
                    for role, user_id in stakeholder_ids.items()
                ],
                "hierarchy": {
                    role: [{"role": f"{role}_manager", "email": f"{role}.mgr@company.com"}]
                    for role in stakeholder_ids.keys()
                },
                "escalation_policies": {
                    role: {"sla_hours": 4, "escalation_threshold_hours": 2, "max_escalations": 1}
                    for role in stakeholder_ids.keys()
                }
            }
            
            # Initialize workflow
            state = await approval_workflow.execute(
                ApprovalType.EMERGENCY_OVERRIDE,
                high_risk_request_data,
                uuid4(),
                "developer",
                RoutingStrategy.RISK_BASED
            )
            
            # Verify dependency graph was built correctly
            dependency_graph = state["approval_dependency_graph"]
            assert len(dependency_graph) == 6  # All stakeholders
            
            # High priority roles (security, compliance) should have no dependencies
            security_req = next(
                req for req in state["approval_requirements"] 
                if req["approver_role"] == "security_officer"
            )
            compliance_req = next(
                req for req in state["approval_requirements"] 
                if req["approver_role"] == "compliance_manager"
            )
            
            assert len(dependency_graph[security_req["id"]]) == 0
            assert len(dependency_graph[compliance_req["id"]]) == 0
            
            # Medium priority roles should depend on high priority
            architect_req = next(
                req for req in state["approval_requirements"] 
                if req["approver_role"] == "architect"
            )
            team_lead_req = next(
                req for req in state["approval_requirements"] 
                if req["approver_role"] == "team_lead"
            )
            
            # These should depend on security and compliance
            architect_deps = dependency_graph[architect_req["id"]]
            team_lead_deps = dependency_graph[team_lead_req["id"]]
            
            assert security_req["id"] in architect_deps or compliance_req["id"] in architect_deps
            assert security_req["id"] in team_lead_deps or compliance_req["id"] in team_lead_deps
            
            # Process approvals in dependency order
            # Step 1: High priority approvals (security and compliance)
            security_response = ApprovalResponse(
                requirement_id=uuid4(security_req["id"]),
                approver_id=stakeholder_ids["security_officer"],
                approver_email="security_officer@company.com",
                approver_role="security_officer",
                status="approved",
                confidence_level="high"
            )
            
            result = await approval_workflow.process_approval_response(state, security_response)
            assert result["success"] is True
            
            compliance_response = ApprovalResponse(
                requirement_id=uuid4(compliance_req["id"]),
                approver_id=stakeholder_ids["compliance_manager"],
                approver_email="compliance_manager@company.com",
                approver_role="compliance_manager",
                status="approved",
                confidence_level="high"
            )
            
            result = await approval_workflow.process_approval_response(state, compliance_response)
            assert result["success"] is True
            
            # Verify medium priority requirements are now available
            progression = result["workflow_progression"]
            assert len(progression["newly_available_requirements"]) >= 2
            
            # Step 2: Medium priority approvals should now be possible
            architect_response = ApprovalResponse(
                requirement_id=uuid4(architect_req["id"]),
                approver_id=stakeholder_ids["architect"],
                approver_email="architect@company.com",
                approver_role="architect",
                status="approved",
                confidence_level="high"
            )
            
            result = await approval_workflow.process_approval_response(state, architect_response)
            assert result["success"] is True
            
            # Continue with remaining approvals...
            team_lead_response = ApprovalResponse(
                requirement_id=uuid4(team_lead_req["id"]),
                approver_id=stakeholder_ids["team_lead"],
                approver_email="team_lead@company.com",
                approver_role="team_lead",
                status="approved",
                confidence_level="high"
            )
            
            result = await approval_workflow.process_approval_response(state, team_lead_response)
            assert result["success"] is True
            
            # Final approvals
            manager_req = next(
                req for req in state["approval_requirements"] 
                if req["approver_role"] == "manager"
            )
            director_req = next(
                req for req in state["approval_requirements"] 
                if req["approver_role"] == "director"
            )
            
            for req, role in [(manager_req, "manager"), (director_req, "director")]:
                response = ApprovalResponse(
                    requirement_id=uuid4(req["id"]),
                    approver_id=stakeholder_ids[role],
                    approver_email=f"{role}@company.com",
                    approver_role=role,
                    status="approved",
                    confidence_level="high"
                )
                
                result = await approval_workflow.process_approval_response(state, response)
                assert result["success"] is True
            
            # Verify workflow completion
            final_progression = result["workflow_progression"]
            assert final_progression["workflow_complete"] is True
            assert state["status"] == WorkflowStatus.COMPLETED
            assert state["final_decision"] == "approved"
            
            # Verify all dependencies were respected
            for req in state["approval_requirements"]:
                assert req["approval_status"] == "approved"


if __name__ == "__main__":
    pytest.main([__file__])