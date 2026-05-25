"""
Complete workflow integration tests.

End-to-end testing of dependency analysis followed by
multi-stakeholder approval workflow integration.
"""

import json
import pytest
from datetime import datetime
from uuid import uuid4

from udp.workflows.dependency_analysis import dependency_analysis_workflow
from udp.workflows.approval_workflow import multi_stakeholder_approval_workflow
from udp.domain.models import WorkflowStatus


class TestCompleteWorkflowIntegration:
    """Test complete end-to-end workflow integration."""
    
    @pytest.mark.asyncio
    async def test_high_risk_dependency_full_workflow(self):
        """Test complete workflow: dependency analysis → approval workflow."""
        
        # Step 1: High-risk package that will trigger approval workflow
        high_risk_package = {
            "name": "enterprise-critical-app",
            "version": "3.2.1",
            "description": "Critical enterprise application",
            "dependencies": {
                # Multiple test packages will trigger mock vulnerabilities
                "test-vulnerable-package-1": "1.0.0",
                "test-vulnerable-package-2": "1.0.0", 
                "test-vulnerable-package-3": "1.0.0",
                "test-vulnerable-package-4": "1.0.0",
                "test-vulnerable-package-5": "1.0.0",
                "test-legacy-package": "0.9.0",
                "test-deprecated-lib": "2.1.0"
            },
            "devDependencies": {
                "test-insecure-dev-tool": "1.5.0"
            },
            "license": "MIT"
        }
        
        organization_id = "enterprise-corp-123"
        initiator_id = "developer-alice"
        
        print("🔍 Step 1: Executing dependency analysis workflow...")
        
        # Execute dependency analysis workflow
        analysis_state = {
            "request_id": str(uuid4()),
            "organization_id": organization_id,
            "initiator_id": initiator_id,
            "manifest_content": json.dumps(high_risk_package),
            "manifest_filename": "package.json",
            "created_at": datetime.utcnow()
        }
        
        analysis_result = await dependency_analysis_workflow.execute(analysis_state)
        
        # Verify dependency analysis completed and requires approval
        assert analysis_result["analysis_complete"] is True
        assert analysis_result["requires_approval"] is True
        assert analysis_result["workflow_status"] == WorkflowStatus.WAITING_FOR_APPROVAL
        assert len(analysis_result["awaiting_approval_from"]) > 0
        
        print(f"✅ Dependency analysis completed:")
        print(f"   - Risk Level: {analysis_result['risk_level']}")
        print(f"   - Risk Score: {analysis_result['overall_risk_score']}")
        print(f"   - Vulnerabilities: {analysis_result.get('vulnerability_count', 0)}")
        print(f"   - Requires Approval: {analysis_result['requires_approval']}")
        print(f"   - Required Approvers: {analysis_result['awaiting_approval_from']}")
        
        # Step 2: Trigger approval workflow based on analysis results
        print("\n📋 Step 2: Executing multi-stakeholder approval workflow...")
        
        approval_state = {
            "workflow_id": str(uuid4()),
            "organization_id": organization_id,
            "initiator_id": initiator_id,
            "request_type": "dependency_update",
            "request_title": f"Update dependencies for {analysis_result['project_name']}",
            "request_description": "High-risk dependency update requiring multi-stakeholder approval",
            "business_justification": "Critical security updates and feature enhancements required for enterprise application",
            "created_at": datetime.utcnow(),
            
            # Link to dependency analysis
            "analysis_id": analysis_result["request_id"],
            "dependency_changes": analysis_result.get("resolved_dependencies", []),
            "risk_assessment": {
                "risk_level": analysis_result["risk_level"],
                "overall_score": analysis_result["overall_risk_score"],
                "risk_factors": analysis_result.get("risk_factors", []),
                "vulnerability_count": analysis_result.get("vulnerability_count", 0)
            },
            "license_issues": analysis_result.get("license_issues", []),
            "security_vulnerabilities": analysis_result.get("vulnerabilities", []),
            
            # Approval configuration
            "approval_workflow_type": "standard",  # standard, expedited, emergency
            "minimum_approvals": 3,
            "consensus_required": True
        }
        
        approval_result = await multi_stakeholder_approval_workflow.execute(approval_state)
        
        # Verify approval workflow execution
        assert approval_result["workflow_status"] in [WorkflowStatus.COMPLETED, WorkflowStatus.WAITING_FOR_APPROVAL]
        assert len(approval_result["required_approvers"]) >= 3  # High risk should require multiple approvers
        assert approval_result["notifications_sent"] is not None
        assert len(approval_result["audit_trail"]) > 5  # Should have multiple workflow steps
        
        print(f"✅ Approval workflow executed:")
        print(f"   - Status: {approval_result['workflow_status']}")
        print(f"   - Required Approvers: {len(approval_result['required_approvers'])}")
        print(f"   - Approval Sequence: {approval_result.get('approval_sequence', 'parallel')}")
        print(f"   - SLA Status: {approval_result.get('sla_status', 'unknown')}")
        print(f"   - Notifications Sent: {len(approval_result.get('notifications_sent', []))}")
        
        # Verify the workflows are properly linked
        assert approval_result["analysis_id"] == analysis_result["request_id"]
        assert approval_result["risk_assessment"]["risk_level"] == analysis_result["risk_level"]
        
        # Verify enterprise features are working
        assert "audit_trail" in approval_result
        assert "performance_metrics" in analysis_result
        assert approval_result.get("approval_deadline") is not None
        assert approval_result.get("escalation_level") is not None
        
        print("\n🎉 Complete workflow integration successful!")
        return {
            "analysis_result": analysis_result,
            "approval_result": approval_result
        }
    
    @pytest.mark.asyncio
    async def test_low_risk_dependency_auto_approval(self):
        """Test low-risk dependency that might get auto-approved."""
        
        # Low-risk package with safe dependencies
        safe_package = {
            "name": "safe-utility-app",
            "version": "1.0.0",
            "dependencies": {
                "lodash": "^4.17.21",  # Well-known safe package
                "moment": "^2.29.4"    # Popular utility
            },
            "license": "MIT"
        }
        
        print("🔍 Testing low-risk dependency workflow...")
        
        # Execute dependency analysis
        analysis_state = {
            "request_id": str(uuid4()),
            "organization_id": "startup-123",
            "initiator_id": "developer-bob",
            "manifest_content": json.dumps(safe_package),
            "manifest_filename": "package.json",
            "created_at": datetime.utcnow()
        }
        
        analysis_result = await dependency_analysis_workflow.execute(analysis_state)
        
        # Low risk should complete without requiring approval
        assert analysis_result["analysis_complete"] is True
        assert analysis_result["risk_level"] == "low"
        assert analysis_result.get("requires_approval", True) is False  # Should not require approval
        
        print(f"✅ Low-risk analysis completed:")
        print(f"   - Risk Level: {analysis_result['risk_level']}")
        print(f"   - Requires Approval: {analysis_result.get('requires_approval', False)}")
        print(f"   - Auto-fix Available: {analysis_result.get('auto_fix_available', False)}")
    
    @pytest.mark.asyncio
    async def test_emergency_approval_workflow(self):
        """Test emergency approval workflow with expedited processing."""
        
        # Critical security patch scenario
        security_patch = {
            "workflow_id": str(uuid4()),
            "organization_id": "enterprise-456", 
            "initiator_id": "security-team-lead",
            "request_type": "emergency_fix",
            "request_title": "Critical Security Patch - CVE-2024-12345",
            "request_description": "Emergency security patch for critical vulnerability",
            "business_justification": "Critical security vulnerability with active exploits in the wild",
            "created_at": datetime.utcnow(),
            
            # High-risk context for emergency
            "risk_assessment": {
                "risk_level": "critical",
                "overall_score": 9.5,
                "risk_factors": ["critical_security_vulnerability", "active_exploits", "production_impact"]
            },
            "security_vulnerabilities": [
                {
                    "cve_id": "CVE-2024-12345",
                    "severity": "critical",
                    "cvss_score": 9.8,
                    "description": "Remote code execution vulnerability"
                }
            ],
            
            # Emergency workflow configuration
            "approval_workflow_type": "emergency",
            "minimum_approvals": 2,
            "consensus_required": False
        }
        
        print("🚨 Testing emergency approval workflow...")
        
        emergency_result = await multi_stakeholder_approval_workflow.execute(security_patch)
        
        # Emergency workflows should have different characteristics
        assert emergency_result["approval_workflow_type"] == "emergency"
        assert emergency_result.get("emergency_override_available") is not None
        
        # Should have expedited SLA
        approval_deadline = emergency_result.get("approval_deadline")
        if approval_deadline:
            hours_to_deadline = (approval_deadline - datetime.utcnow()).total_seconds() / 3600
            assert hours_to_deadline <= 24  # Emergency SLA should be shorter
        
        print(f"✅ Emergency workflow configured:")
        print(f"   - Workflow Type: {emergency_result['approval_workflow_type']}")  
        print(f"   - Required Approvers: {len(emergency_result['required_approvers'])}")
        print(f"   - Emergency Override Available: {emergency_result.get('emergency_override_available', False)}")
    
    @pytest.mark.asyncio
    async def test_workflow_performance_integration(self):
        """Test performance of integrated workflows."""
        
        # Realistic enterprise package
        enterprise_package = {
            "name": "@company/enterprise-platform",
            "version": "4.2.1", 
            "dependencies": {
                "express": "^4.18.2",
                "react": "^18.2.0",
                "typescript": "^5.0.0",
                "lodash": "^4.17.21",
                "axios": "^1.4.0",
                "jsonwebtoken": "^9.0.0"
            },
            "devDependencies": {
                "jest": "^29.5.0",
                "eslint": "^8.40.0"
            }
        }
        
        print("⚡ Testing integrated workflow performance...")
        
        import time
        start_time = time.time()
        
        # Execute dependency analysis
        analysis_state = {
            "request_id": str(uuid4()),
            "organization_id": "performance-test-org",
            "initiator_id": "perf-tester",
            "manifest_content": json.dumps(enterprise_package),
            "manifest_filename": "package.json",
            "created_at": datetime.utcnow()
        }
        
        analysis_result = await dependency_analysis_workflow.execute(analysis_state)
        analysis_time = time.time() - start_time
        
        # If approval is required, execute approval workflow
        if analysis_result.get("requires_approval", False):
            approval_start = time.time()
            
            approval_state = {
                "workflow_id": str(uuid4()),
                "organization_id": "performance-test-org",
                "initiator_id": "perf-tester", 
                "request_type": "dependency_update",
                "request_title": "Performance Test Approval",
                "request_description": "Testing approval workflow performance",
                "business_justification": "Performance testing",
                "created_at": datetime.utcnow(),
                "analysis_id": analysis_result["request_id"],
                "risk_assessment": {
                    "risk_level": analysis_result["risk_level"],
                    "overall_score": analysis_result["overall_risk_score"]
                }
            }
            
            approval_result = await multi_stakeholder_approval_workflow.execute(approval_state)
            approval_time = time.time() - approval_start
            
            total_time = time.time() - start_time
            
            print(f"✅ Performance test completed:")
            print(f"   - Analysis Time: {analysis_time:.2f}s")
            print(f"   - Approval Time: {approval_time:.2f}s") 
            print(f"   - Total Time: {total_time:.2f}s")
            print(f"   - Dependencies Processed: {analysis_result.get('total_dependencies', 0)}")
            
            # Performance assertions
            assert analysis_time < 15.0  # Analysis should complete in under 15 seconds
            assert approval_time < 5.0   # Approval setup should be under 5 seconds
            assert total_time < 20.0     # Total workflow under 20 seconds
            
        else:
            print(f"✅ Analysis-only performance: {analysis_time:.2f}s")
            print(f"   - Dependencies: {analysis_result.get('total_dependencies', 0)}")
            print(f"   - Risk Level: {analysis_result['risk_level']}")


@pytest.mark.asyncio 
async def test_workflow_error_recovery():
    """Test error handling and recovery in integrated workflows."""
    
    print("🔧 Testing workflow error recovery...")
    
    # Test with invalid manifest
    invalid_state = {
        "request_id": str(uuid4()),
        "organization_id": "error-test-org",
        "initiator_id": "error-tester",
        "manifest_content": "{ invalid json content",  # Malformed JSON
        "manifest_filename": "package.json", 
        "created_at": datetime.utcnow()
    }
    
    # Should fail gracefully in analysis
    result = await dependency_analysis_workflow.execute(invalid_state)
    
    assert result["workflow_status"] == WorkflowStatus.FAILED
    assert "error_message" in result
    assert "parse_manifest" in result.get("failed_steps", [])
    
    print("✅ Error recovery working correctly")
    print(f"   - Status: {result['workflow_status']}")
    print(f"   - Error: {result.get('error_message', 'Unknown error')}")
    print(f"   - Failed Steps: {result.get('failed_steps', [])}")


if __name__ == "__main__":
    import asyncio
    
    async def main():
        test = TestCompleteWorkflowIntegration()
        
        print("🚀 Running complete workflow integration tests...\n")
        
        # Run the main integration test
        result = await test.test_high_risk_dependency_full_workflow()
        
        print(f"\n📊 Integration Test Summary:")
        print(f"   - Analysis Steps: {len(result['analysis_result']['completed_steps'])}")
        print(f"   - Approval Steps: {len(result['approval_result']['audit_trail'])}")
        print(f"   - Total Dependencies: {result['analysis_result'].get('total_dependencies', 0)}")
        print(f"   - Required Approvers: {len(result['approval_result']['required_approvers'])}")
        
    asyncio.run(main())