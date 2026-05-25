"""
Integration tests for workflow, analytics, and reporting systems.
"""

import pytest
import asyncio
from datetime import datetime, timedelta
from uuid import uuid4
from unittest.mock import AsyncMock, patch, Mock

from udp.workflows.dependency_analysis import DependencyAnalysisWorkflow
from udp.workflows.approval_workflow import ApprovalWorkflow
from udp.workflows.state import DependencyAnalysisState, ApprovalWorkflowState
from udp.analytics.engine import analytics_engine, TimeInterval
from udp.reporting.generators import report_generator, ReportFormat
from udp.reporting.scheduler import report_scheduler, ScheduleFrequency, DeliveryMethod
from udp.core.policy_engine import policy_engine
from udp.domain.models import Package, EcosystemType, LicenseType, SecurityLevel


class TestWorkflowAnalyticsIntegration:
    """Integration tests between workflows and analytics systems."""
    
    @pytest.fixture
    def sample_organization_id(self):
        """Sample organization ID for testing."""
        return uuid4()
    
    @pytest.fixture
    def sample_packages(self):
        """Sample packages for testing."""
        return [
            Package(
                name="react",
                version="18.2.0",
                ecosystem=EcosystemType.NPM,
                license=LicenseType.MIT,
                description="A JavaScript library for building user interfaces",
                author="Meta"
            ),
            Package(
                name="django",
                version="4.2.0",
                ecosystem=EcosystemType.PYPI,
                license=LicenseType.BSD_3_CLAUSE,
                description="A high-level Python web framework",
                author="Django Software Foundation"
            ),
            Package(
                name="spring-boot",
                version="3.1.0",
                ecosystem=EcosystemType.MAVEN,
                license=LicenseType.APACHE_2_0,
                description="Spring Boot Framework",
                author="Pivotal Software"
            )
        ]
    
    @pytest.fixture
    def mock_db_session(self):
        """Mock database session with realistic data."""
        session = AsyncMock()
        
        # Mock vulnerability data
        vuln_result = Mock()
        vuln_result.fetchall.return_value = [
            Mock(severity=SecurityLevel.CRITICAL, count=2),
            Mock(severity=SecurityLevel.HIGH, count=8),
            Mock(severity=SecurityLevel.MEDIUM, count=15)
        ]
        
        # Mock other queries
        session.execute.return_value = vuln_result
        session.get.return_value = Mock(
            id=uuid4(),
            name="Test Organization",
            compliance_frameworks=["SOX", "ISO27001"]
        )
        
        return session

    @pytest.mark.asyncio
    async def test_dependency_workflow_to_analytics_pipeline(
        self, 
        sample_organization_id, 
        sample_packages, 
        mock_db_session
    ):
        """Test complete pipeline from dependency analysis to analytics."""
        
        # Step 1: Execute dependency analysis workflow
        initial_state = DependencyAnalysisState(
            request_id="integration-test-001",
            organization_id=sample_organization_id,
            packages=sample_packages,
            raw_dependencies=[],
            resolved_dependencies=[],
            vulnerabilities=[],
            license_issues=[],
            policy_violations=[],
            risk_assessment={},
            recommendations=[],
            approval_required=False,
            current_step="validate_input",
            workflow_status="running",
            error_message=None,
            metadata={}
        )
        
        workflow = DependencyAnalysisWorkflow()
        
        # Mock policy engine for workflow
        with patch.object(policy_engine, 'evaluate_policies') as mock_policy_eval:
            mock_policy_eval.return_value = {}
            
            # Execute workflow steps
            state = initial_state
            state = await workflow.validate_input(state)
            state = await workflow.parse_dependencies(state)
            state = await workflow.resolve_dependencies(state)
            state = await workflow.analyze_security(state)
            state = await workflow.check_licenses(state)
            state = await workflow.evaluate_policies(state)
            state = await workflow.assess_risk(state)
            state = await workflow.generate_recommendations(state)
            
            # Workflow should complete successfully
            assert state.workflow_status == "running"
            assert len(state.packages) == 3
            assert state.current_step in ["assess_risk", "generate_recommendations"]
        
        # Step 2: Generate analytics from workflow results
        # Simulate storing workflow results in database and generating analytics
        
        with patch('udp.analytics.engine.get_async_session') as mock_session_factory:
            mock_session_factory.return_value.__aenter__.return_value = mock_db_session
            
            # Get security metrics based on workflow results
            security_metrics = await analytics_engine.get_security_metrics(
                db=mock_db_session,
                organization_id=sample_organization_id,
                time_range=TimeInterval.DAY
            )
            
            # Verify analytics results
            assert "critical_vulnerabilities" in security_metrics
            assert "average_cvss_score" in security_metrics
            assert security_metrics["critical_vulnerabilities"].value == 2.0
            
            # Get workflow performance metrics
            workflow_metrics = await analytics_engine.get_workflow_performance_metrics(
                db=mock_db_session,
                organization_id=sample_organization_id,
                time_range=TimeInterval.DAY
            )
            
            assert "workflow_completion_rate" in workflow_metrics
            assert "average_processing_time" in workflow_metrics
        
        # Step 3: Verify ecosystem insights reflect workflow packages
        with patch('udp.analytics.engine.get_async_session') as mock_session_factory:
            # Mock ecosystem distribution based on our sample packages
            ecosystem_result = Mock()
            ecosystem_result.fetchall.return_value = [
                (EcosystemType.NPM, 1),
                (EcosystemType.PYPI, 1),
                (EcosystemType.MAVEN, 1)
            ]
            mock_db_session.execute.return_value = ecosystem_result
            
            mock_session_factory.return_value.__aenter__.return_value = mock_db_session
            
            ecosystem_metrics = await analytics_engine.get_ecosystem_insights(
                db=mock_db_session,
                organization_id=sample_organization_id,
                time_range=TimeInterval.DAY
            )
            
            distribution = ecosystem_metrics["ecosystem_distribution"].metadata["distribution"]
            assert distribution["npm"] == 1
            assert distribution["pypi"] == 1
            assert distribution["maven"] == 1

    @pytest.mark.asyncio
    async def test_approval_workflow_to_reporting_integration(
        self, 
        sample_organization_id, 
        mock_db_session
    ):
        """Test integration between approval workflow and reporting system."""
        
        # Step 1: Create approval workflow state
        approval_state = ApprovalWorkflowState(
            request_id="approval-integration-001",
            organization_id=sample_organization_id,
            workflow_type="dependency_approval",
            analysis_results={
                "packages": 5,
                "critical_vulnerabilities": 2,
                "high_vulnerabilities": 6,
                "license_issues": 1
            },
            required_approvals=["security", "legal", "manager"],
            received_approvals=[],
            current_approver="security",
            approval_deadline=datetime.utcnow() + timedelta(hours=24),
            escalation_level=0,
            auto_approval_eligible=False,
            current_step="request_approval",
            workflow_status="waiting_for_approval",
            error_message=None,
            metadata={}
        )
        
        # Step 2: Execute approval workflow
        approval_workflow = ApprovalWorkflow()
        
        with patch('udp.workflows.approval_workflow.send_approval_request') as mock_send:
            mock_send.return_value = {"status": "sent"}
            
            # Request approval
            state = await approval_workflow.request_approval(approval_state)
            assert state.current_step == "wait_for_response"
            
            # Simulate approval received
            state.received_approvals = [
                {
                    "approver": "security_team",
                    "role": "security", 
                    "decision": "approved",
                    "timestamp": datetime.utcnow(),
                    "comments": "Security review passed"
                }
            ]
            
            # Process approval
            state = await approval_workflow.process_approval_response(state)
            assert len(state.received_approvals) == 1
        
        # Step 3: Generate compliance report including workflow data
        with patch('udp.reporting.generators.get_async_session') as mock_session_factory:
            mock_session_factory.return_value.__aenter__.return_value = mock_db_session
            
            # Mock analytics data that would reflect approval workflow activity
            with patch('udp.reporting.generators.analytics_engine') as mock_analytics:
                mock_analytics.get_workflow_performance_metrics.return_value = {
                    "workflow_completion_rate": Mock(value=85.0),
                    "average_processing_time": Mock(value=32.5),
                    "pending_approvals": Mock(value=3.0)
                }
                
                mock_analytics.get_security_metrics.return_value = {
                    "critical_vulnerabilities": Mock(value=2.0),
                    "high_vulnerabilities": Mock(value=6.0),
                    "average_cvss_score": Mock(value=7.2)
                }
                
                mock_analytics.get_license_compliance_metrics.return_value = {
                    "license_distribution": Mock(
                        value=100.0,
                        metadata={"distribution": {"MIT": 50, "Apache-2.0": 30}}
                    ),
                    "copyleft_percentage": Mock(value=15.0),
                    "enterprise_friendly_percentage": Mock(value=85.0)
                }
                
                # Generate compliance report
                report = await report_generator.generate_compliance_report(
                    db=mock_db_session,
                    organization_id=sample_organization_id,
                    framework="SOX",
                    time_range=TimeInterval.MONTH,
                    format=ReportFormat.JSON
                )
                
                # Verify report includes workflow-related data
                assert "report_data" in report
                report_data = report["report_data"]
                
                assert "operational_metrics" in report_data
                operational = report_data["operational_metrics"]
                assert operational["efficiency_metrics"]["completion_rate"] == 85.0
                assert operational["efficiency_metrics"]["pending_approvals"] == 3.0

    @pytest.mark.asyncio
    async def test_scheduled_analytics_report_workflow(
        self, 
        sample_organization_id, 
        mock_db_session
    ):
        """Test scheduled report generation with analytics data."""
        
        # Step 1: Create scheduled report
        schedule_id = await report_scheduler.create_schedule(
            organization_id=sample_organization_id,
            report_type="executive",
            frequency=ScheduleFrequency.WEEKLY,
            format=ReportFormat.HTML,
            delivery_methods=[DeliveryMethod.EMAIL],
            recipients=["ceo@company.com"],
            parameters={"time_range": TimeInterval.QUARTER},
            created_by="system"
        )
        
        assert schedule_id in report_scheduler.schedules
        
        # Step 2: Simulate time passing and schedule becoming due
        schedule = report_scheduler.schedules[schedule_id]
        schedule.next_run = datetime.utcnow() - timedelta(minutes=5)  # Make it due
        
        # Step 3: Execute scheduled report with mocked analytics
        with patch('udp.reporting.scheduler.get_async_session') as mock_session_factory, \
             patch('udp.reporting.scheduler.report_generator') as mock_report_gen:
            
            mock_session_factory.return_value.__aenter__.return_value = mock_db_session
            
            # Mock comprehensive dashboard data
            mock_dashboard_data = {
                "organization_id": str(sample_organization_id),
                "overall_risk_score": 6.8,
                "security_summary": {
                    "critical_vulnerabilities": 3,
                    "average_cvss_score": 6.9,
                    "exploitable_packages": 2
                },
                "compliance_summary": {
                    "copyleft_percentage": 12.5,
                    "enterprise_friendly_percentage": 87.5
                },
                "operational_summary": {
                    "workflow_completion_rate": 92.3,
                    "average_processing_time": 28.7,
                    "pending_approvals": 2
                },
                "recommendations": [
                    {
                        "type": "security",
                        "priority": "high",
                        "title": "Address Critical Vulnerabilities"
                    }
                ]
            }
            
            mock_report_gen.generate_executive_summary.return_value = {
                "report_data": mock_dashboard_data,
                "metadata": {"report_id": "exec_summary_001"}
            }
            
            # Mock delivery methods
            with patch.object(report_scheduler, '_save_report_output', return_value="/tmp/exec_report.html"), \
                 patch.object(report_scheduler, '_deliver_report', new_callable=AsyncMock):
                
                # Execute scheduled report
                await report_scheduler.run_scheduled_reports()
                
                # Verify report was generated
                mock_report_gen.generate_executive_summary.assert_called_once()
                call_args = mock_report_gen.generate_executive_summary.call_args
                assert call_args[1]["organization_id"] == sample_organization_id
                assert call_args[1]["time_range"] == TimeInterval.QUARTER
                
                # Verify schedule was updated
                assert schedule.last_status.value == "completed"
                assert schedule.last_run is not None
                assert schedule.next_run > datetime.utcnow()

    @pytest.mark.asyncio
    async def test_policy_violation_to_analytics_workflow(
        self, 
        sample_organization_id, 
        sample_packages, 
        mock_db_session
    ):
        """Test policy violations flowing through to analytics and reporting."""
        
        # Step 1: Set up policy violation scenario
        violation_packages = [
            Package(
                name="vulnerable-package",
                version="1.0.0",
                ecosystem=EcosystemType.NPM,
                license=LicenseType.GPL_3_0,  # Potentially problematic license
                description="A package with vulnerabilities"
            )
        ]
        
        # Step 2: Execute dependency analysis with policy violations
        state = DependencyAnalysisState(
            request_id="policy-violation-test",
            organization_id=sample_organization_id,
            packages=violation_packages,
            raw_dependencies=[],
            resolved_dependencies=[],
            vulnerabilities=[
                {
                    "package": "vulnerable-package",
                    "severity": "CRITICAL",
                    "cvss_score": 9.8,
                    "description": "Critical security vulnerability"
                }
            ],
            license_issues=[
                {
                    "package": "vulnerable-package",
                    "license": "GPL-3.0",
                    "issue": "Copyleft license may conflict with proprietary software"
                }
            ],
            policy_violations=[
                {
                    "policy_id": "security_policy_001",
                    "severity": "HIGH",
                    "message": "Critical vulnerability detected",
                    "action": "BLOCK"
                }
            ],
            risk_assessment={"overall_score": 9.2, "risk_level": "CRITICAL"},
            recommendations=[
                {
                    "type": "security",
                    "priority": "critical",
                    "description": "Immediately update or replace vulnerable-package"
                }
            ],
            approval_required=True,
            current_step="finalize_results",
            workflow_status="completed",
            error_message=None,
            metadata={}
        )
        
        # Step 3: Verify analytics reflect policy violations
        with patch('udp.analytics.engine.get_async_session') as mock_session_factory:
            # Mock data that reflects the policy violations
            critical_vuln_result = Mock()
            critical_vuln_result.fetchall.return_value = [
                Mock(severity=SecurityLevel.CRITICAL, count=1)
            ]
            
            cvss_result = Mock()
            cvss_result.scalar.return_value = 9.8
            
            mock_db_session.execute.side_effect = [
                critical_vuln_result,  # Vulnerability counts
                cvss_result,  # CVSS score
                Mock(scalar=lambda: 1),  # Exploitable packages
            ]
            
            mock_session_factory.return_value.__aenter__.return_value = mock_db_session
            
            security_metrics = await analytics_engine.get_security_metrics(
                db=mock_db_session,
                organization_id=sample_organization_id,
                time_range=TimeInterval.DAY
            )
            
            # Verify high-risk metrics
            assert security_metrics["critical_vulnerabilities"].value == 1.0
            assert security_metrics["average_cvss_score"].value == 9.8
            
        # Step 4: Generate alert report for policy violations
        with patch('udp.reporting.generators.get_async_session') as mock_session_factory:
            mock_session_factory.return_value.__aenter__.return_value = mock_db_session
            
            with patch('udp.reporting.generators.analytics_engine') as mock_analytics:
                mock_analytics.get_security_metrics.return_value = security_metrics
                mock_analytics.get_ecosystem_insights.return_value = {
                    "ecosystem_distribution": Mock(
                        metadata={"distribution": {"npm": 1}}
                    )
                }
                
                # Generate security report
                security_report = await report_generator.generate_security_report(
                    db=mock_db_session,
                    organization_id=sample_organization_id,
                    time_range=TimeInterval.DAY,
                    format=ReportFormat.JSON,
                    include_remediation_plan=True
                )
                
                # Verify report reflects critical security state
                report_data = security_report["report_data"]
                threat_landscape = report_data["threat_landscape"]
                assert threat_landscape["critical_vulnerabilities"] == 1.0
                assert threat_landscape["average_cvss_score"] == 9.8
                
                # Should include remediation plan for critical issues
                assert "remediation_plan" in report_data
                assert report_data["remediation_plan"] != {}

    @pytest.mark.asyncio
    async def test_cross_system_performance_metrics(
        self, 
        sample_organization_id, 
        mock_db_session
    ):
        """Test performance metrics across workflow, analytics, and reporting systems."""
        
        # Step 1: Measure workflow performance
        workflow_start = datetime.utcnow()
        
        # Simulate workflow execution time
        await asyncio.sleep(0.1)  # Simulate processing time
        
        workflow_duration = (datetime.utcnow() - workflow_start).total_seconds()
        
        # Step 2: Measure analytics performance
        analytics_start = datetime.utcnow()
        
        with patch('udp.analytics.engine.get_async_session') as mock_session_factory:
            mock_session_factory.return_value.__aenter__.return_value = mock_db_session
            
            # Generate multiple analytics concurrently
            tasks = [
                analytics_engine.get_security_metrics(mock_db_session, sample_organization_id, TimeInterval.DAY),
                analytics_engine.get_license_compliance_metrics(mock_db_session, sample_organization_id, TimeInterval.DAY),
                analytics_engine.get_workflow_performance_metrics(mock_db_session, sample_organization_id, TimeInterval.DAY)
            ]
            
            results = await asyncio.gather(*tasks)
            
        analytics_duration = (datetime.utcnow() - analytics_start).total_seconds()
        
        # Step 3: Measure reporting performance
        reporting_start = datetime.utcnow()
        
        with patch('udp.reporting.generators.get_async_session') as mock_session_factory, \
             patch('udp.reporting.generators.analytics_engine') as mock_analytics:
            
            mock_session_factory.return_value.__aenter__.return_value = mock_db_session
            
            # Mock analytics responses
            mock_analytics.get_security_metrics.return_value = results[0]
            mock_analytics.get_license_compliance_metrics.return_value = results[1]
            mock_analytics.get_workflow_performance_metrics.return_value = results[2]
            
            # Generate report
            report = await report_generator.generate_compliance_report(
                db=mock_db_session,
                organization_id=sample_organization_id,
                format=ReportFormat.JSON
            )
            
        reporting_duration = (datetime.utcnow() - reporting_start).total_seconds()
        
        # Step 4: Verify performance is within acceptable bounds
        # These are very lenient bounds for unit testing
        assert workflow_duration < 5.0  # Workflow should complete quickly
        assert analytics_duration < 5.0  # Analytics should be fast
        assert reporting_duration < 10.0  # Reporting might be slower due to formatting
        
        # Verify all systems produced valid outputs
        assert len(results) == 3
        assert all(isinstance(result, dict) for result in results)
        assert "report_data" in report


class TestSystemResilience:
    """Test resilience and error handling across integrated systems."""
    
    @pytest.mark.asyncio
    async def test_workflow_failure_analytics_recovery(self, mock_db_session):
        """Test analytics system handling workflow failures gracefully."""
        organization_id = uuid4()
        
        # Simulate workflow failure scenario
        with patch('udp.analytics.engine.get_async_session') as mock_session_factory:
            # Mock database queries that might fail
            mock_db_session.execute.side_effect = [
                Exception("Database connection lost"),
                Mock(scalar=lambda: 0),  # Recovery query succeeds
                Mock(fetchall=lambda: [])  # Empty result
            ]
            
            mock_session_factory.return_value.__aenter__.return_value = mock_db_session
            
            # Analytics should handle database errors gracefully
            with pytest.raises(Exception):
                await analytics_engine.get_security_metrics(
                    db=mock_db_session,
                    organization_id=organization_id,
                    time_range=TimeInterval.DAY
                )

    @pytest.mark.asyncio
    async def test_reporting_system_degraded_analytics(self, mock_db_session):
        """Test reporting system handling degraded analytics data."""
        organization_id = uuid4()
        
        with patch('udp.reporting.generators.get_async_session') as mock_session_factory, \
             patch('udp.reporting.generators.analytics_engine') as mock_analytics:
            
            mock_session_factory.return_value.__aenter__.return_value = mock_db_session
            
            # Simulate partial analytics failure
            mock_analytics.get_security_metrics.side_effect = Exception("Security metrics unavailable")
            mock_analytics.get_license_compliance_metrics.return_value = {
                "copyleft_percentage": Mock(value=20.0)
            }
            mock_analytics.get_workflow_performance_metrics.return_value = {
                "workflow_completion_rate": Mock(value=85.0)
            }
            
            # Report generation should handle partial failures
            with pytest.raises(Exception):
                await report_generator.generate_compliance_report(
                    db=mock_db_session,
                    organization_id=organization_id,
                    format=ReportFormat.JSON
                )


if __name__ == "__main__":
    pytest.main([__file__])