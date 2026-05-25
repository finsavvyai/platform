"""
Unit tests for enhanced approval workflow with enterprise features.

Tests intelligent routing, stakeholder hierarchy management,
and approval requirement generation.
"""

import pytest
from datetime import datetime, timedelta
from uuid import uuid4, UUID
from unittest.mock import AsyncMock, MagicMock, patch

from src.udp.workflows.approval_workflow import (
    ApprovalWorkflow,
    ApprovalType,
    RoutingStrategy,
    IntelligentRoutingEngine,
    StakeholderHierarchyManager,
    EscalationManager
)
from src.udp.domain.models import ApprovalRequirement, ApprovalResponse, WorkflowStatus, SecurityLevel
from src.udp.workflows.state import ApprovalState


class TestApprovalWorkflow:
    """Test enhanced approval workflow functionality."""
    
    @pytest.fixture
    def organization_id(self):
        """Test organization ID."""
        return uuid4()
    
    @pytest.fixture
    def approval_workflow(self, organization_id):
        """Create approval workflow instance."""
        return ApprovalWorkflow(organization_id)
    
    @pytest.fixture
    def sample_request_data(self):
        """Sample request data for testing."""
        return {
            "project_id": "test-project",
            "dependencies": [
                {"name": "requests", "version": "2.28.1", "ecosystem": "pypi"},
                {"name": "lodash", "version": "4.17.21", "ecosystem": "npm"}
            ],
            "vulnerabilities": [
                {"cve_id": "CVE-2023-1234", "severity": "medium"}
            ],
            "license_violations": [],
            "policy_violations": [
                {"policy": "max_dependencies", "violation": "exceeded_limit"}
            ],
            "ecosystems": ["pypi", "npm"],
            "security_scan_results": {"status": "completed"},
            "license_analysis": {"status": "completed"},
            "dependency_graph": {"nodes": 10, "edges": 15}
        }
    
    @pytest.mark.asyncio
    async def test_execute_workflow_with_auto_approval(self, approval_workflow, sample_request_data):
        """Test workflow execution with auto-approval eligibility."""
        
        # Mock low-risk scenario for auto-approval
        low_risk_data = {
            **sample_request_data,
            "vulnerabilities": [],
            "policy_violations": []
        }
        
        with patch.object(approval_workflow.routing_engine, 'analyze_request') as mock_analyze:
            mock_analyze.return_value = {
                "risk_score": 2.0,
                "risk_level": "low",
                "confidence_score": 0.95,
                "requester_trust_score": 0.9,
                "risk_factors": {"security_vulnerabilities": 0, "policy_violations": 0},
                "has_security_issues": False,
                "has_compliance_issues": False,
                "recommended_routing": "sequential"
            }
            
            state = await approval_workflow.execute(
                ApprovalType.DEPENDENCY_UPDATE,
                low_risk_data,
                uuid4(),
                "team_lead"
            )
        
        assert state["status"] == WorkflowStatus.COMPLETED
        assert state["auto_approval_eligible"] is True
        assert state["final_decision"] == "auto_approved"
        assert "Low risk request from trusted source" in state["decision_rationale"]
        assert len(state["audit_trail_enhanced"]) > 0
        assert state["audit_trail_enhanced"][-1]["event"] == "auto_approval"
    
    @pytest.mark.asyncio
    async def test_execute_workflow_with_manual_approval(self, approval_workflow, sample_request_data):
        """Test workflow execution requiring manual approval."""
        
        with patch.object(approval_workflow.routing_engine, 'analyze_request') as mock_analyze, \
             patch.object(approval_workflow.stakeholder_manager, 'determine_stakeholders') as mock_stakeholders:
            
            mock_analyze.return_value = {
                "risk_score": 6.5,
                "risk_level": "high",
                "confidence_score": 0.7,
                "requester_trust_score": 0.6,
                "risk_factors": {"security_vulnerabilities": 1, "policy_violations": 1},
                "has_security_issues": True,
                "has_compliance_issues": True,
                "recommended_routing": "risk_based"
            }
            
            mock_stakeholders.return_value = {
                "stakeholders": [
                    {"role": "security_officer", "email": "security@test.com", "user_id": uuid4(), "required": True},
                    {"role": "team_lead", "email": "lead@test.com", "user_id": uuid4(), "required": True}
                ],
                "hierarchy": {
                    "security_officer": [{"role": "security_manager", "email": "sec.mgr@test.com"}],
                    "team_lead": [{"role": "manager", "email": "manager@test.com"}]
                },
                "escalation_policies": {
                    "security_officer": {"sla_hours": 4, "escalation_threshold_hours": 3},
                    "team_lead": {"sla_hours": 8, "escalation_threshold_hours": 6}
                }
            }
            
            state = await approval_workflow.execute(
                ApprovalType.DEPENDENCY_UPDATE,
                sample_request_data,
                uuid4(),
                "developer"
            )
        
        assert state["status"] == WorkflowStatus.WAITING_FOR_APPROVAL
        assert state["auto_approval_eligible"] is False
        assert len(state["approval_requirements"]) == 2
        assert state["routing_strategy"] == "risk_based"
        assert state["sla_deadline"] is not None
        assert len(state["stakeholders"]) == 2
        assert "security_officer" in [s["role"] for s in state["stakeholders"]]
        assert "team_lead" in [s["role"] for s in state["stakeholders"]]
    
    @pytest.mark.asyncio
    async def test_generate_approval_requirements(self, approval_workflow, sample_request_data):
        """Test approval requirements generation."""
        
        state = {
            "workflow_id": "test-workflow",
            "request_type": "dependency_update",
            "request_data": sample_request_data
        }
        
        routing_analysis = {
            "risk_level": "medium",
            "confidence_score": 0.8
        }
        
        stakeholder_config = {
            "stakeholders": [
                {"role": "team_lead", "email": "lead@test.com", "user_id": uuid4()},
                {"role": "security_officer", "email": "security@test.com", "user_id": uuid4()}
            ],
            "escalation_policies": {
                "team_lead": {"sla_hours": 8},
                "security_officer": {"sla_hours": 4}
            },
            "hierarchy": {
                "team_lead": [{"role": "manager", "email": "manager@test.com"}],
                "security_officer": [{"role": "security_manager", "email": "sec.mgr@test.com"}]
            }
        }
        
        requirements = await approval_workflow._generate_approval_requirements(
            state, routing_analysis, stakeholder_config
        )
        
        assert len(requirements) == 2
        
        # Check security officer requirement (should have higher priority)
        security_req = next(r for r in requirements if r.approver_role == "security_officer")
        assert security_req.priority < 50  # High priority
        assert security_req.deadline > datetime.utcnow()
        assert security_req.escalation_policy is not None
        assert len(security_req.stakeholder_hierarchy) > 0
        
        # Check team lead requirement
        lead_req = next(r for r in requirements if r.approver_role == "team_lead")
        assert lead_req.priority > security_req.priority  # Lower priority than security
        assert lead_req.deadline > datetime.utcnow()
    
    def test_build_dependency_graph(self, approval_workflow):
        """Test approval dependency graph building."""
        
        requirements = [
            ApprovalRequirement(
                workflow_id="test",
                approver_role="security_officer",
                approval_type="security_review",
                priority=10,
                deadline=datetime.utcnow() + timedelta(hours=4)
            ),
            ApprovalRequirement(
                workflow_id="test",
                approver_role="team_lead",
                approval_type="technical_review",
                priority=40,
                deadline=datetime.utcnow() + timedelta(hours=8)
            ),
            ApprovalRequirement(
                workflow_id="test",
                approver_role="manager",
                approval_type="business_review",
                priority=50,
                deadline=datetime.utcnow() + timedelta(hours=24)
            )
        ]
        
        dependency_graph = approval_workflow._build_dependency_graph(requirements)
        
        assert len(dependency_graph) == 3
        
        # Security officer should have no dependencies (highest priority)
        security_id = str(requirements[0].id)
        assert len(dependency_graph[security_id]) == 0
        
        # Team lead should depend on security officer
        lead_id = str(requirements[1].id)
        assert security_id in dependency_graph[lead_id]
        
        # Manager should depend on team lead
        manager_id = str(requirements[2].id)
        assert lead_id in dependency_graph[manager_id]
    
    @pytest.mark.asyncio
    async def test_check_auto_approval_eligibility_approved(self, approval_workflow):
        """Test auto-approval eligibility check - approved case."""
        
        routing_analysis = {
            "risk_level": "low",
            "confidence_score": 0.95,
            "requester_trust_score": 0.9,
            "has_security_issues": False,
            "has_compliance_issues": False
        }
        
        result = await approval_workflow._check_auto_approval_eligibility(
            ApprovalType.DEPENDENCY_UPDATE,
            {"test": "data"},
            routing_analysis
        )
        
        assert result["eligible"] is True
        assert result["confidence"] > 0.9
        assert "Low risk request from trusted source" in result["reason"]
        assert all(result["conditions"].values())
    
    @pytest.mark.asyncio
    async def test_check_auto_approval_eligibility_rejected(self, approval_workflow):
        """Test auto-approval eligibility check - rejected case."""
        
        routing_analysis = {
            "risk_level": "high",
            "confidence_score": 0.6,
            "requester_trust_score": 0.4,
            "has_security_issues": True,
            "has_compliance_issues": False
        }
        
        result = await approval_workflow._check_auto_approval_eligibility(
            ApprovalType.DEPENDENCY_UPDATE,
            {"test": "data"},
            routing_analysis
        )
        
        assert result["eligible"] is False
        assert result["confidence"] == 0.0
        assert "Manual approval required" in result["reason"]
        assert not all(result["conditions"].values())
    
    def test_calculate_sla_deadline(self, approval_workflow):
        """Test SLA deadline calculation."""
        
        # Test different request types
        assert approval_workflow._calculate_sla_deadline(
            ApprovalType.DEPENDENCY_UPDATE, {"risk_level": "low"}
        ) == 24
        
        assert approval_workflow._calculate_sla_deadline(
            ApprovalType.SECURITY_OVERRIDE, {"risk_level": "high"}
        ) == 24  # 12 * 2.0
        
        assert approval_workflow._calculate_sla_deadline(
            ApprovalType.EMERGENCY_OVERRIDE, {"risk_level": "critical"}
        ) == 2  # 4 * 0.5
    
    @pytest.mark.asyncio
    async def test_initialize_sequential_workflow(self, approval_workflow):
        """Test sequential workflow initialization."""
        
        requirements = [
            ApprovalRequirement(
                workflow_id="test",
                approver_role="team_lead",
                approval_type="technical",
                priority=40,
                deadline=datetime.utcnow() + timedelta(hours=8),
                approver_email="lead@test.com"
            ),
            ApprovalRequirement(
                workflow_id="test",
                approver_role="security_officer",
                approval_type="security",
                priority=10,
                deadline=datetime.utcnow() + timedelta(hours=4),
                approver_email="security@test.com"
            )
        ]
        
        state = {
            "approval_workflow": [],
            "current_approver": None
        }
        
        await approval_workflow._initialize_sequential_workflow(state, requirements)
        
        assert len(state["approval_workflow"]) == 2
        
        # First step should be security officer (higher priority)
        first_step = state["approval_workflow"][0]
        assert first_step["approver_role"] == "security_officer"
        assert first_step["status"] == "pending"
        assert len(first_step["depends_on"]) == 0
        
        # Second step should be team lead
        second_step = state["approval_workflow"][1]
        assert second_step["approver_role"] == "team_lead"
        assert second_step["status"] == "waiting"
        assert len(second_step["depends_on"]) == 1
        
        # Current approver should be security officer
        assert state["current_approver"]["role"] == "security_officer"
        assert state["current_approver"]["email"] == "security@test.com"
    
    @pytest.mark.asyncio
    async def test_initialize_parallel_workflow(self, approval_workflow):
        """Test parallel workflow initialization."""
        
        requirements = [
            ApprovalRequirement(
                workflow_id="test",
                approver_role="team_lead",
                approval_type="technical",
                priority=40,
                deadline=datetime.utcnow() + timedelta(hours=8),
                approver_email="lead@test.com"
            ),
            ApprovalRequirement(
                workflow_id="test",
                approver_role="architect",
                approval_type="architectural",
                priority=30,
                deadline=datetime.utcnow() + timedelta(hours=16),
                approver_email="architect@test.com"
            )
        ]
        
        state = {
            "approval_workflow": [],
            "current_approver": None
        }
        
        await approval_workflow._initialize_parallel_workflow(state, requirements)
        
        assert len(state["approval_workflow"]) == 2
        
        # All steps should be pending with no dependencies
        for step in state["approval_workflow"]:
            assert step["status"] == "pending"
            assert len(step["depends_on"]) == 0
        
        # Current approver should be in parallel mode
        assert state["current_approver"]["mode"] == "parallel"
        assert len(state["current_approver"]["active_approvers"]) == 2
    
    @pytest.mark.asyncio
    async def test_initialize_risk_based_workflow(self, approval_workflow):
        """Test risk-based workflow initialization."""
        
        requirements = [
            ApprovalRequirement(
                workflow_id="test",
                approver_role="security_officer",  # High priority
                approval_type="security",
                priority=10,
                deadline=datetime.utcnow() + timedelta(hours=4),
                approver_email="security@test.com"
            ),
            ApprovalRequirement(
                workflow_id="test",
                approver_role="team_lead",  # Medium priority
                approval_type="technical",
                priority=40,
                deadline=datetime.utcnow() + timedelta(hours=8),
                approver_email="lead@test.com"
            ),
            ApprovalRequirement(
                workflow_id="test",
                approver_role="manager",  # Low priority
                approval_type="business",
                priority=50,
                deadline=datetime.utcnow() + timedelta(hours=24),
                approver_email="manager@test.com"
            )
        ]
        
        state = {
            "approval_workflow": [],
            "current_approver": None
        }
        
        await approval_workflow._initialize_risk_based_workflow(state, requirements)
        
        assert len(state["approval_workflow"]) == 3
        
        # Find steps by role
        security_step = next(s for s in state["approval_workflow"] if s["approver_role"] == "security_officer")
        lead_step = next(s for s in state["approval_workflow"] if s["approver_role"] == "team_lead")
        manager_step = next(s for s in state["approval_workflow"] if s["approver_role"] == "manager")
        
        # Security officer should be pending with no dependencies
        assert security_step["status"] == "pending"
        assert len(security_step["depends_on"]) == 0
        assert security_step["priority_group"] == "high"
        
        # Team lead should be waiting and depend on security officer
        assert lead_step["status"] == "waiting"
        assert security_step["step_id"] in lead_step["depends_on"]
        assert lead_step["priority_group"] == "medium"
        
        # Manager should be waiting and depend on team lead
        assert manager_step["status"] == "waiting"
        assert lead_step["step_id"] in manager_step["depends_on"]
        assert manager_step["priority_group"] == "low"
        
        # Current approver should be security officer (high priority group)
        assert state["current_approver"]["mode"] == "risk_based"
        assert state["current_approver"]["current_group"] == "high"
        assert len(state["current_approver"]["active_approvers"]) == 1
        assert state["current_approver"]["active_approvers"][0]["role"] == "security_officer"


class TestIntelligentRoutingEngine:
    """Test intelligent routing engine functionality."""
    
    @pytest.fixture
    def routing_engine(self):
        """Create routing engine instance."""
        return IntelligentRoutingEngine(uuid4())
    
    @pytest.mark.asyncio
    async def test_analyze_request_low_risk(self, routing_engine):
        """Test request analysis for low-risk scenario."""
        
        request_data = {
            "vulnerabilities": [],
            "license_violations": [],
            "policy_violations": [],
            "dependencies": ["package1", "package2"],
            "ecosystems": ["npm"],
            "security_scan_results": {"status": "completed"},
            "license_analysis": {"status": "completed"},
            "dependency_graph": {"nodes": 5}
        }
        
        result = await routing_engine.analyze_request(
            ApprovalType.DEPENDENCY_UPDATE,
            request_data,
            "team_lead"
        )
        
        assert result["risk_level"] == "low"
        assert result["risk_score"] < 3.0
        assert result["confidence_score"] > 0.5
        assert result["requester_trust_score"] == 0.8  # team_lead is trusted
        assert not result["has_security_issues"]
        assert not result["has_compliance_issues"]
        assert result["recommended_routing"] in ["sequential", "parallel"]
    
    @pytest.mark.asyncio
    async def test_analyze_request_high_risk(self, routing_engine):
        """Test request analysis for high-risk scenario."""
        
        request_data = {
            "vulnerabilities": [{"cve": "CVE-1"}, {"cve": "CVE-2"}, {"cve": "CVE-3"}],
            "license_violations": [{"license": "GPL"}],
            "policy_violations": [{"policy": "security"}, {"policy": "compliance"}],
            "dependencies": ["pkg" + str(i) for i in range(20)],  # Many dependencies
            "ecosystems": ["npm", "pypi", "maven", "cargo"],  # High diversity
            "security_scan_results": None,  # Missing scan
            "license_analysis": None,  # Missing analysis
            "dependency_graph": None  # Missing graph
        }
        
        result = await routing_engine.analyze_request(
            ApprovalType.SECURITY_OVERRIDE,
            request_data,
            "developer"
        )
        
        assert result["risk_level"] in ["high", "critical"]
        assert result["risk_score"] >= 6.0
        assert result["confidence_score"] < 0.5  # Low confidence due to missing data
        assert result["requester_trust_score"] == 0.5  # developer is less trusted
        assert result["has_security_issues"]
        assert result["has_compliance_issues"]
        assert result["recommended_routing"] == "risk_based"
    
    def test_recommend_routing_strategy(self, routing_engine):
        """Test routing strategy recommendation logic."""
        
        # Critical risk should use risk-based routing
        assert routing_engine._recommend_routing_strategy("critical", 0.9) == "risk_based"
        
        # High risk should use risk-based routing
        assert routing_engine._recommend_routing_strategy("high", 0.8) == "risk_based"
        
        # Medium risk with high confidence should use parallel
        assert routing_engine._recommend_routing_strategy("medium", 0.9) == "parallel"
        
        # Low risk with high confidence should use sequential
        assert routing_engine._recommend_routing_strategy("low", 0.95) == "sequential"
        
        # Medium risk with low confidence should use risk-based
        assert routing_engine._recommend_routing_strategy("medium", 0.6) == "risk_based"
    
    def test_estimate_approval_time(self, routing_engine):
        """Test approval time estimation."""
        
        # Low risk with simple factors
        time_low = routing_engine._estimate_approval_time("low", {"dependency_count": 5, "ecosystem_diversity": 1})
        assert time_low == 4.0 * 1.15  # Base time * complexity multiplier
        
        # High risk with complex factors
        time_high = routing_engine._estimate_approval_time("high", {"dependency_count": 50, "ecosystem_diversity": 4})
        assert time_high > 24.0  # Should be higher than base time due to complexity


class TestStakeholderHierarchyManager:
    """Test stakeholder hierarchy manager functionality."""
    
    @pytest.fixture
    def stakeholder_manager(self):
        """Create stakeholder manager instance."""
        return StakeholderHierarchyManager(uuid4())
    
    @pytest.mark.asyncio
    async def test_determine_stakeholders_dependency_update(self, stakeholder_manager):
        """Test stakeholder determination for dependency update."""
        
        routing_analysis = {
            "risk_level": "medium",
            "has_security_issues": False,
            "has_compliance_issues": False,
            "risk_factors": {"ecosystem_diversity": 1}
        }
        
        result = await stakeholder_manager.determine_stakeholders(
            ApprovalType.DEPENDENCY_UPDATE,
            {},
            routing_analysis
        )
        
        stakeholder_roles = [s["role"] for s in result["stakeholders"]]
        
        # Should always include team lead for dependency updates
        assert "team_lead" in stakeholder_roles
        
        # Should not include security officer for medium risk without security issues
        assert "security_officer" not in stakeholder_roles
        
        # Should have hierarchy defined
        assert "team_lead" in result["hierarchy"]
        assert len(result["hierarchy"]["team_lead"]) > 0
        
        # Should have escalation policies
        assert "team_lead" in result["escalation_policies"]
    
    @pytest.mark.asyncio
    async def test_determine_stakeholders_high_risk_security(self, stakeholder_manager):
        """Test stakeholder determination for high-risk security scenario."""
        
        routing_analysis = {
            "risk_level": "high",
            "has_security_issues": True,
            "has_compliance_issues": True,
            "risk_factors": {"ecosystem_diversity": 3}
        }
        
        result = await stakeholder_manager.determine_stakeholders(
            ApprovalType.SECURITY_OVERRIDE,
            {},
            routing_analysis
        )
        
        stakeholder_roles = [s["role"] for s in result["stakeholders"]]
        
        # Should include security officer for security override
        assert "security_officer" in stakeholder_roles
        
        # Should include compliance manager for compliance issues
        assert "compliance_manager" in stakeholder_roles
        
        # Should include architect for high ecosystem diversity
        assert "architect" in stakeholder_roles
        
        # Should include manager for high risk
        assert "manager" in stakeholder_roles
        
        # Should include team lead (always for dependency updates)
        assert "team_lead" in stakeholder_roles
    
    def test_build_stakeholder_hierarchy(self, stakeholder_manager):
        """Test stakeholder hierarchy building."""
        
        stakeholders = [
            {"role": "team_lead", "email": "lead@test.com"},
            {"role": "security_officer", "email": "security@test.com"},
            {"role": "manager", "email": "manager@test.com"}
        ]
        
        hierarchy = stakeholder_manager._build_stakeholder_hierarchy(stakeholders)
        
        # Each role should have escalation chain
        assert "team_lead" in hierarchy
        assert "security_officer" in hierarchy
        assert "manager" in hierarchy
        
        # Team lead should escalate to manager
        team_lead_chain = hierarchy["team_lead"]
        assert len(team_lead_chain) > 0
        assert any(escalation["role"] == "manager" for escalation in team_lead_chain)
        
        # Security officer should have security-specific escalation
        security_chain = hierarchy["security_officer"]
        assert len(security_chain) > 0
        assert any("security" in escalation["role"] for escalation in security_chain)
    
    def test_define_escalation_policies_risk_adjustment(self, stakeholder_manager):
        """Test escalation policy definition with risk adjustment."""
        
        # Test critical risk policies (should be faster)
        critical_policies = stakeholder_manager._define_escalation_policies("critical")
        
        # Test low risk policies (should be slower)
        low_policies = stakeholder_manager._define_escalation_policies("low")
        
        # Critical risk should have shorter SLA times
        assert critical_policies["team_lead"]["sla_hours"] < low_policies["team_lead"]["sla_hours"]
        assert critical_policies["security_officer"]["sla_hours"] < low_policies["security_officer"]["sla_hours"]
        
        # All policies should have required fields
        for role, policy in critical_policies.items():
            assert "sla_hours" in policy
            assert "escalation_threshold_hours" in policy
            assert "max_escalations" in policy
            assert "auto_escalate" in policy


class TestEscalationManager:
    """Test escalation manager functionality."""
    
    @pytest.fixture
    def escalation_manager(self):
        """Create escalation manager instance."""
        return EscalationManager(uuid4())
    
    @pytest.fixture
    def sample_approval_state(self):
        """Sample approval state for testing."""
        req_id = uuid4()
        return {
            "workflow_id": "test-workflow",
            "approval_requirements": [
                {
                    "id": str(req_id),
                    "approver_role": "team_lead",
                    "approver_email": "lead@test.com",
                    "approval_status": "pending",
                    "deadline": (datetime.utcnow() - timedelta(hours=2)).isoformat(),  # Overdue
                    "escalation_count": 0,
                    "escalation_policy": {
                        "escalation_threshold_hours": 1,
                        "max_escalations": 2
                    },
                    "stakeholder_hierarchy": [
                        {"role": "manager", "email": "manager@test.com"}
                    ]
                }
            ],
            "escalation_history": [],
            "escalation_level": 0,
            "sla_status": "on_time"
        }
    
    @pytest.mark.asyncio
    async def test_check_escalation_needed(self, escalation_manager, sample_approval_state):
        """Test escalation need detection."""
        
        escalations = await escalation_manager.check_escalation_needed(sample_approval_state)
        
        assert len(escalations) == 1
        
        escalation = escalations[0]
        assert escalation["approver_role"] == "team_lead"
        assert escalation["current_approver"] == "lead@test.com"
        assert escalation["escalation_target"]["role"] == "manager"
        assert escalation["time_overdue_hours"] > 0
        assert escalation["escalation_count"] == 0
    
    @pytest.mark.asyncio
    async def test_execute_escalation(self, escalation_manager, sample_approval_state):
        """Test escalation execution."""
        
        requirement_id = sample_approval_state["approval_requirements"][0]["id"]
        escalation_target = {"role": "manager", "email": "manager@test.com"}
        
        escalation_event = await escalation_manager.execute_escalation(
            sample_approval_state,
            requirement_id,
            escalation_target
        )
        
        # Check escalation event
        assert escalation_event["requirement_id"] == requirement_id
        assert escalation_event["escalated_to"] == escalation_target
        assert escalation_event["escalation_level"] == 1
        assert escalation_event["reason"] == "SLA deadline exceeded"
        
        # Check state updates
        updated_req = sample_approval_state["approval_requirements"][0]
        assert updated_req["escalation_count"] == 1
        assert updated_req["last_escalated_at"] is not None
        
        # Check escalation history
        assert len(sample_approval_state["escalation_history"]) == 1
        assert sample_approval_state["escalation_history"][0] == escalation_event
        
        # Check SLA status update
        assert sample_approval_state["sla_status"] == "at_risk"
        assert sample_approval_state["escalation_level"] == 1


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
        
        # Test deadline in the past
        with pytest.raises(ValueError, match="Approval deadline must be in the future"):
            ApprovalRequirement(
                workflow_id="test",
                approver_role="team_lead",
                approval_type="review",
                priority=50,
                deadline=datetime.utcnow() - timedelta(hours=1)
            )
    
    def test_approval_requirement_properties(self):
        """Test approval requirement computed properties."""
        
        # Test expired requirement
        expired_requirement = ApprovalRequirement(
            workflow_id="test",
            approver_role="team_lead",
            approval_type="review",
            priority=50,
            deadline=datetime.utcnow() - timedelta(hours=1)  # This will fail validation
        )
        
        # We need to manually set the deadline to test expired property
        # since validation prevents past deadlines
        expired_requirement.deadline = datetime.utcnow() - timedelta(hours=1)
        assert expired_requirement.is_expired
        assert expired_requirement.time_remaining_hours == 0.0
        
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