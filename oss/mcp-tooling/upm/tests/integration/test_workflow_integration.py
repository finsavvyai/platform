"""
Integration tests for dependency analysis workflow.

End-to-end testing of the complete dependency analysis workflow
including ecosystem adapters, security analysis, and approval processes.
"""

import json
import pytest
from datetime import datetime
from uuid import uuid4

from udp.workflows.dependency_analysis import dependency_analysis_workflow
from udp.domain.models import EcosystemType, WorkflowStatus


class TestDependencyAnalysisWorkflow:
    """Test complete dependency analysis workflow integration."""
    
    @pytest.mark.asyncio
    async def test_npm_package_analysis_workflow(self):
        """Test complete workflow with npm package.json."""
        
        # Sample package.json with some test dependencies
        package_json = {
            "name": "test-project",
            "version": "1.0.0",
            "description": "Test project for workflow",
            "dependencies": {
                "lodash": "^4.17.21",
                "express": "^4.18.0",
                "test-vulnerable-package": "1.0.0"  # Mock vulnerable package
            },
            "devDependencies": {
                "jest": "^29.0.0"
            },
            "license": "MIT"
        }
        
        # Initial workflow state
        initial_state = {
            "request_id": str(uuid4()),
            "organization_id": "test-org-123",
            "initiator_id": "test-user-456",
            "manifest_content": json.dumps(package_json),
            "manifest_filename": "package.json",
            "created_at": datetime.utcnow()
        }
        
        # Execute workflow
        result = await dependency_analysis_workflow.execute(initial_state)
        
        # Verify workflow completion
        assert result["analysis_complete"] is True
        assert result["workflow_status"] == WorkflowStatus.COMPLETED
        assert result["ecosystem"] == EcosystemType.NPM
        assert result["project_name"] == "test-project"
        assert result["total_dependencies"] == 4  # 3 deps + 1 dev dep
        
        # Verify analysis steps completed
        expected_steps = [
            "validate_input",
            "parse_manifest", 
            "resolve_dependencies",
            "analyze_security",
            "check_licenses",
            "evaluate_policies",
            "assess_risk",
            "generate_recommendations",
            "finalize_analysis"
        ]
        
        for step in expected_steps:
            assert step in result["completed_steps"]
        
        # Verify analysis results
        assert "resolved_dependencies" in result
        assert "vulnerabilities" in result
        assert "recommendations" in result
        assert "risk_level" in result
        assert "overall_risk_score" in result
        
        # Verify audit trail
        assert "audit_log" in result
        assert len(result["audit_log"]) >= len(expected_steps)
        
        # Verify performance metrics
        assert "performance_metrics" in result
        assert "parse_manifest_duration" in result["performance_metrics"]
        
        print(f"✅ Workflow completed successfully!")
        print(f"   - Project: {result['project_name']}")
        print(f"   - Dependencies: {result['total_dependencies']}")
        print(f"   - Risk Level: {result['risk_level']}")
        print(f"   - Risk Score: {result['overall_risk_score']}")
        print(f"   - Vulnerabilities: {result.get('vulnerability_count', 0)}")
        print(f"   - Recommendations: {len(result.get('recommendations', []))}")
    
    @pytest.mark.asyncio
    async def test_python_requirements_analysis_workflow(self):
        """Test complete workflow with requirements.txt."""
        
        # Sample requirements.txt
        requirements_txt = """
# Web framework
flask>=2.2.0
requests>=2.28.0

# Testing
pytest>=7.0.0
"""
        
        # Initial workflow state
        initial_state = {
            "request_id": str(uuid4()),
            "organization_id": "test-org-456", 
            "initiator_id": "test-user-789",
            "manifest_content": requirements_txt,
            "manifest_filename": "requirements.txt",
            "created_at": datetime.utcnow()
        }
        
        # Execute workflow
        result = await dependency_analysis_workflow.execute(initial_state)
        
        # Verify workflow completion
        assert result["analysis_complete"] is True
        assert result["workflow_status"] == WorkflowStatus.COMPLETED
        assert result["ecosystem"] == EcosystemType.PYPI
        assert result["total_dependencies"] == 3  # flask, requests, pytest
        
        # Verify Python-specific parsing
        assert "flask" in str(result["dependencies"])
        assert "requests" in str(result["dependencies"]) 
        assert "pytest" in str(result["dependencies"])
        
        print(f"✅ Python workflow completed successfully!")
        print(f"   - Dependencies: {result['total_dependencies']}")
        print(f"   - Risk Level: {result['risk_level']}")
    
    @pytest.mark.asyncio
    async def test_high_risk_package_requires_approval(self):
        """Test that high-risk packages trigger approval workflow."""
        
        # Package.json with multiple test packages (triggers mock vulnerabilities)
        high_risk_package = {
            "name": "high-risk-project",
            "version": "1.0.0",
            "dependencies": {
                "test-package-1": "1.0.0",
                "test-package-2": "1.0.0", 
                "test-package-3": "1.0.0",
                "test-package-4": "1.0.0",
                "test-package-5": "1.0.0",
                "test-package-6": "1.0.0"  # Many test packages = high vulnerability count
            }
        }
        
        # Initial workflow state
        initial_state = {
            "request_id": str(uuid4()),
            "organization_id": "test-org-789",
            "initiator_id": "test-user-123",
            "manifest_content": json.dumps(high_risk_package),
            "manifest_filename": "package.json",
            "created_at": datetime.utcnow()
        }
        
        # Execute workflow
        result = await dependency_analysis_workflow.execute(initial_state)
        
        # Should require approval due to mock vulnerabilities
        assert result["requires_approval"] is True
        assert result["workflow_status"] == WorkflowStatus.WAITING_FOR_APPROVAL
        assert result["human_input_required"] is True
        assert len(result["awaiting_approval_from"]) > 0
        
        # Verify approval context is set
        assert "approval_context" in result
        assert "approval_deadline" in result
        
        print(f"✅ High-risk workflow correctly requires approval!")
        print(f"   - Vulnerabilities: {result.get('vulnerability_count', 0)}")
        print(f"   - Required approvers: {result.get('awaiting_approval_from', [])}")
        print(f"   - Risk score: {result.get('overall_risk_score', 0)}")
    
    @pytest.mark.asyncio
    async def test_workflow_error_handling(self):
        """Test workflow error handling with invalid input."""
        
        # Invalid initial state (missing required fields)
        invalid_state = {
            "request_id": str(uuid4()),
            # Missing organization_id, manifest_content, etc.
        }
        
        # Execute workflow
        result = await dependency_analysis_workflow.execute(invalid_state)
        
        # Should fail gracefully
        assert result["workflow_status"] == WorkflowStatus.FAILED
        assert "error_message" in result
        assert "validate_input" in result["failed_steps"]
        
        print(f"✅ Error handling works correctly!")
        print(f"   - Error: {result['error_message']}")


@pytest.mark.asyncio
async def test_workflow_performance():
    """Test workflow performance with realistic package.json."""
    
    # Realistic package.json with moderate dependencies
    realistic_package = {
        "name": "enterprise-app",
        "version": "2.1.0",
        "dependencies": {
            "express": "^4.18.0",
            "lodash": "^4.17.21", 
            "moment": "^2.29.0",
            "axios": "^1.0.0",
            "jsonwebtoken": "^9.0.0"
        },
        "devDependencies": {
            "jest": "^29.0.0",
            "eslint": "^8.0.0",
            "typescript": "^5.0.0"
        }
    }
    
    # Initial state
    initial_state = {
        "request_id": str(uuid4()),
        "organization_id": "enterprise-org",
        "initiator_id": "developer-123",
        "manifest_content": json.dumps(realistic_package),
        "manifest_filename": "package.json",
        "created_at": datetime.utcnow()
    }
    
    # Measure execution time
    import time
    start_time = time.time()
    
    result = await dependency_analysis_workflow.execute(initial_state)
    
    execution_time = time.time() - start_time
    
    # Verify performance
    assert execution_time < 10.0  # Should complete in under 10 seconds
    assert result["analysis_complete"] is True
    
    # Check performance metrics
    metrics = result.get("performance_metrics", {})
    total_workflow_time = sum(metrics.values())
    
    print(f"✅ Performance test completed!")
    print(f"   - Total execution time: {execution_time:.2f}s")
    print(f"   - Workflow step time: {total_workflow_time:.2f}s")
    print(f"   - Dependencies analyzed: {result['total_dependencies']}")
    
    # Verify all performance metrics are present
    expected_metrics = [
        "parse_manifest_duration",
        "resolve_dependencies_duration", 
        "analyze_security_duration",
        "check_licenses_duration",
        "evaluate_policies_duration",
        "assess_risk_duration",
        "generate_recommendations_duration"
    ]
    
    for metric in expected_metrics:
        assert metric in metrics, f"Missing performance metric: {metric}"