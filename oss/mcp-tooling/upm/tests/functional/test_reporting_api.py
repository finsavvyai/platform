"""
Functional tests for the reporting API endpoints.
"""

import pytest
import json
from datetime import datetime
from uuid import uuid4
from unittest.mock import AsyncMock, patch, Mock

from fastapi.testclient import TestClient

from udp.api.main import app
from udp.reporting.scheduler import ScheduleFrequency, DeliveryMethod, ReportStatus
from udp.reporting.generators import ReportFormat


class TestReportingAPI:
    """Functional tests for reporting API endpoints."""
    
    @pytest.fixture
    def client(self):
        """Create test client."""
        return TestClient(app)
    
    @pytest.fixture
    def sample_organization_id(self):
        """Sample organization ID for testing."""
        return str(uuid4())

    def test_generate_report_now_success(self, client, sample_organization_id):
        """Test successful on-demand report generation."""
        report_config = {
            "report_type": "compliance",
            "format": "pdf",
            "time_range": "1M",
            "delivery": {
                "methods": ["email", "webhook"],
                "recipients": ["admin@test.com", "https://webhook.example.com"]
            },
            "parameters": {
                "framework": "SOX",
                "include_details": True
            }
        }
        
        with patch('udp.api.routes.reporting.report_scheduler') as mock_scheduler:
            mock_scheduler.generate_report_now.return_value = "job-12345"
            
            response = client.post(
                f"/api/v1/reporting/generate/{sample_organization_id}",
                json=report_config
            )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert data["job_id"] == "job-12345"
        assert data["organization_id"] == sample_organization_id
        assert data["report_type"] == "compliance"
        assert data["format"] == "pdf"
        assert data["status"] == "running"
        assert "check_status_url" in data
        assert data["check_status_url"] == "/api/v1/reporting/jobs/job-12345/status"
        
        # Verify scheduler was called correctly
        mock_scheduler.generate_report_now.assert_called_once()
        call_args = mock_scheduler.generate_report_now.call_args
        assert call_args[1]["organization_id"] == uuid4(sample_organization_id)
        assert call_args[1]["report_type"] == "compliance"
        assert call_args[1]["format"] == ReportFormat.PDF

    def test_generate_report_now_invalid_report_type(self, client, sample_organization_id):
        """Test report generation with invalid report type."""
        report_config = {
            "report_type": "invalid_type",
            "format": "json"
        }
        
        response = client.post(
            f"/api/v1/reporting/generate/{sample_organization_id}",
            json=report_config
        )
        
        assert response.status_code == 400
        data = response.json()
        assert "report_type must be one of" in data["detail"]

    def test_generate_report_now_minimal_config(self, client, sample_organization_id):
        """Test report generation with minimal configuration."""
        report_config = {
            "report_type": "security"
        }
        
        with patch('udp.api.routes.reporting.report_scheduler') as mock_scheduler:
            mock_scheduler.generate_report_now.return_value = "job-67890"
            
            response = client.post(
                f"/api/v1/reporting/generate/{sample_organization_id}",
                json=report_config
            )
        
        assert response.status_code == 200
        data = response.json()
        assert data["report_type"] == "security"
        assert data["format"] == "pdf"  # Default format

    def test_generate_report_now_unknown_delivery_method(self, client, sample_organization_id):
        """Test report generation with unknown delivery method."""
        report_config = {
            "report_type": "compliance",
            "delivery": {
                "methods": ["unknown_method", "email"],
                "recipients": ["admin@test.com"]
            }
        }
        
        with patch('udp.api.routes.reporting.report_scheduler') as mock_scheduler:
            mock_scheduler.generate_report_now.return_value = "job-warning"
            
            response = client.post(
                f"/api/v1/reporting/generate/{sample_organization_id}",
                json=report_config
            )
        
        # Should succeed but log warning for unknown method
        assert response.status_code == 200

    def test_create_report_schedule_success(self, client, sample_organization_id):
        """Test successful report schedule creation."""
        schedule_config = {
            "report_type": "executive",
            "frequency": "weekly",
            "format": "html",
            "delivery": {
                "methods": ["email", "slack"],
                "recipients": ["ceo@company.com", "exec-channel"]
            },
            "parameters": {
                "time_range": "3M",
                "confidentiality": "restricted"
            }
        }
        
        with patch('udp.api.routes.reporting.report_scheduler') as mock_scheduler:
            mock_scheduler.create_schedule.return_value = "schedule-abc123"
            
            response = client.post(
                f"/api/v1/reporting/schedules/{sample_organization_id}",
                json=schedule_config,
                params={"created_by": "admin_user"}
            )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert data["schedule_id"] == "schedule-abc123"
        assert data["organization_id"] == sample_organization_id
        assert data["report_type"] == "executive"
        assert data["frequency"] == "weekly"
        assert data["status"] == "active"
        assert "view_schedule_url" in data
        
        # Verify scheduler was called with correct parameters
        mock_scheduler.create_schedule.assert_called_once()
        call_args = mock_scheduler.create_schedule.call_args
        assert call_args[1]["report_type"] == "executive"
        assert call_args[1]["frequency"] == ScheduleFrequency.WEEKLY
        assert call_args[1]["format"] == ReportFormat.HTML
        assert call_args[1]["created_by"] == "admin_user"

    def test_create_report_schedule_missing_required_fields(self, client, sample_organization_id):
        """Test schedule creation with missing required fields."""
        schedule_config = {
            "format": "pdf"
            # Missing report_type and frequency
        }
        
        response = client.post(
            f"/api/v1/reporting/schedules/{sample_organization_id}",
            json=schedule_config
        )
        
        assert response.status_code == 400
        data = response.json()
        assert "report_type and frequency are required" in data["detail"]

    def test_create_report_schedule_invalid_frequency(self, client, sample_organization_id):
        """Test schedule creation with invalid frequency."""
        schedule_config = {
            "report_type": "compliance",
            "frequency": "invalid_frequency"
        }
        
        response = client.post(
            f"/api/v1/reporting/schedules/{sample_organization_id}",
            json=schedule_config
        )
        
        assert response.status_code == 400
        data = response.json()
        assert "Invalid frequency" in data["detail"]

    def test_list_report_schedules_success(self, client, sample_organization_id):
        """Test successful schedule listing."""
        mock_schedules = [
            {
                "schedule_id": "schedule-1",
                "organization_id": sample_organization_id,
                "report_type": "compliance",
                "frequency": "daily",
                "is_active": True,
                "created_at": datetime.utcnow().isoformat()
            },
            {
                "schedule_id": "schedule-2",
                "organization_id": sample_organization_id,
                "report_type": "security",
                "frequency": "weekly",
                "is_active": True,
                "created_at": datetime.utcnow().isoformat()
            }
        ]
        
        with patch('udp.api.routes.reporting.report_scheduler') as mock_scheduler:
            mock_scheduler.list_schedules.return_value = mock_schedules
            
            response = client.get(f"/api/v1/reporting/schedules/{sample_organization_id}")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["organization_id"] == sample_organization_id
        assert data["total_count"] == 2
        assert data["active_only"] == True
        assert len(data["schedules"]) == 2
        assert data["schedules"][0]["schedule_id"] == "schedule-1"

    def test_list_report_schedules_include_inactive(self, client, sample_organization_id):
        """Test schedule listing including inactive schedules."""
        mock_schedules = [
            {
                "schedule_id": "schedule-active",
                "is_active": True,
                "organization_id": sample_organization_id
            },
            {
                "schedule_id": "schedule-inactive",
                "is_active": False,
                "organization_id": sample_organization_id
            }
        ]
        
        with patch('udp.api.routes.reporting.report_scheduler') as mock_scheduler:
            mock_scheduler.list_schedules.return_value = mock_schedules
            
            response = client.get(
                f"/api/v1/reporting/schedules/{sample_organization_id}",
                params={"active_only": False}
            )
        
        assert response.status_code == 200
        data = response.json()
        assert data["active_only"] == False
        assert data["total_count"] == 2

    def test_get_schedule_details_success(self, client):
        """Test successful schedule details retrieval."""
        schedule_id = "schedule-details-123"
        mock_schedule_info = {
            "schedule_id": schedule_id,
            "organization_id": str(uuid4()),
            "report_type": "compliance",
            "frequency": "monthly",
            "is_active": True,
            "next_run": datetime.utcnow().isoformat(),
            "last_run": None,
            "last_status": "scheduled",
            "created_at": datetime.utcnow().isoformat(),
            "created_by": "admin"
        }
        
        with patch('udp.api.routes.reporting.report_scheduler') as mock_scheduler:
            mock_scheduler.get_schedule_status.return_value = mock_schedule_info
            
            response = client.get(f"/api/v1/reporting/schedules/details/{schedule_id}")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["schedule_id"] == schedule_id
        assert data["report_type"] == "compliance"
        assert data["frequency"] == "monthly"
        assert data["is_active"] == True

    def test_get_schedule_details_not_found(self, client):
        """Test schedule details retrieval for non-existent schedule."""
        schedule_id = "nonexistent-schedule"
        
        with patch('udp.api.routes.reporting.report_scheduler') as mock_scheduler:
            mock_scheduler.get_schedule_status.return_value = None
            
            response = client.get(f"/api/v1/reporting/schedules/details/{schedule_id}")
        
        assert response.status_code == 404
        data = response.json()
        assert f"Schedule {schedule_id} not found" in data["detail"]

    def test_update_report_schedule_success(self, client):
        """Test successful schedule update."""
        schedule_id = "schedule-update-456"
        updates = {
            "frequency": "quarterly",
            "format": "xlsx",
            "is_active": False,
            "delivery": {
                "methods": ["s3_upload"],
                "recipients": ["s3://bucket/reports"]
            }
        }
        
        mock_updated_schedule = {
            "schedule_id": schedule_id,
            "frequency": "quarterly",
            "format": "xlsx",
            "is_active": False
        }
        
        with patch('udp.api.routes.reporting.report_scheduler') as mock_scheduler:
            mock_scheduler.update_schedule.return_value = True
            mock_scheduler.get_schedule_status.return_value = mock_updated_schedule
            
            response = client.put(
                f"/api/v1/reporting/schedules/{schedule_id}",
                json=updates
            )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["message"] == "Schedule updated successfully"
        assert "schedule" in data
        assert data["schedule"]["frequency"] == "quarterly"

    def test_update_report_schedule_not_found(self, client):
        """Test updating non-existent schedule."""
        schedule_id = "nonexistent-schedule"
        updates = {"frequency": "monthly"}
        
        with patch('udp.api.routes.reporting.report_scheduler') as mock_scheduler:
            mock_scheduler.update_schedule.return_value = False
            
            response = client.put(
                f"/api/v1/reporting/schedules/{schedule_id}",
                json=updates
            )
        
        assert response.status_code == 404
        data = response.json()
        assert f"Schedule {schedule_id} not found" in data["detail"]

    def test_delete_report_schedule_success(self, client):
        """Test successful schedule deletion."""
        schedule_id = "schedule-delete-789"
        
        with patch('udp.api.routes.reporting.report_scheduler') as mock_scheduler:
            mock_scheduler.delete_schedule.return_value = True
            
            response = client.delete(f"/api/v1/reporting/schedules/{schedule_id}")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["message"] == "Schedule deleted successfully"
        assert data["schedule_id"] == schedule_id

    def test_delete_report_schedule_not_found(self, client):
        """Test deleting non-existent schedule."""
        schedule_id = "nonexistent-schedule"
        
        with patch('udp.api.routes.reporting.report_scheduler') as mock_scheduler:
            mock_scheduler.delete_schedule.return_value = False
            
            response = client.delete(f"/api/v1/reporting/schedules/{schedule_id}")
        
        assert response.status_code == 404
        data = response.json()
        assert f"Schedule {schedule_id} not found" in data["detail"]

    def test_get_job_status_success(self, client):
        """Test successful job status retrieval."""
        job_id = "job-status-abc"
        mock_job_status = {
            "job_id": job_id,
            "schedule_id": "schedule-123",
            "organization_id": str(uuid4()),
            "report_type": "security",
            "status": "completed",
            "created_at": datetime.utcnow().isoformat(),
            "started_at": datetime.utcnow().isoformat(),
            "completed_at": datetime.utcnow().isoformat(),
            "error_message": None,
            "output_location": "/tmp/reports/security-report.pdf"
        }
        
        with patch('udp.api.routes.reporting.report_scheduler') as mock_scheduler:
            mock_scheduler.get_job_status.return_value = mock_job_status
            
            response = client.get(f"/api/v1/reporting/jobs/{job_id}/status")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["job_id"] == job_id
        assert data["status"] == "completed"
        assert data["output_location"] == "/tmp/reports/security-report.pdf"

    def test_get_job_status_not_found(self, client):
        """Test job status retrieval for non-existent job."""
        job_id = "nonexistent-job"
        
        with patch('udp.api.routes.reporting.report_scheduler') as mock_scheduler:
            mock_scheduler.get_job_status.return_value = None
            
            response = client.get(f"/api/v1/reporting/jobs/{job_id}/status")
        
        assert response.status_code == 404
        data = response.json()
        assert f"Job {job_id} not found" in data["detail"]

    def test_get_job_status_failed_job(self, client):
        """Test job status for failed job."""
        job_id = "failed-job-xyz"
        mock_job_status = {
            "job_id": job_id,
            "status": "failed",
            "error_message": "Report generation failed due to missing data",
            "created_at": datetime.utcnow().isoformat(),
            "started_at": datetime.utcnow().isoformat(),
            "completed_at": datetime.utcnow().isoformat()
        }
        
        with patch('udp.api.routes.reporting.report_scheduler') as mock_scheduler:
            mock_scheduler.get_job_status.return_value = mock_job_status
            
            response = client.get(f"/api/v1/reporting/jobs/{job_id}/status")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "failed"
        assert "Report generation failed" in data["error_message"]

    def test_run_scheduled_reports_success(self, client):
        """Test manual triggering of scheduled reports."""
        with patch('udp.api.routes.reporting.report_scheduler') as mock_scheduler:
            mock_scheduler.run_scheduled_reports.return_value = None
            
            response = client.post("/api/v1/reporting/run-scheduled")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["message"] == "Scheduled reports execution completed"
        assert "executed_at" in data
        
        # Verify scheduler was called
        mock_scheduler.run_scheduled_reports.assert_called_once()

    def test_run_scheduled_reports_failure(self, client):
        """Test handling of scheduled reports execution failure."""
        with patch('udp.api.routes.reporting.report_scheduler') as mock_scheduler:
            mock_scheduler.run_scheduled_reports.side_effect = Exception("Scheduler error")
            
            response = client.post("/api/v1/reporting/run-scheduled")
        
        assert response.status_code == 500
        data = response.json()
        assert "Failed to run scheduled reports" in data["detail"]

    def test_get_supported_formats_success(self, client):
        """Test retrieval of supported formats and methods."""
        response = client.get("/api/v1/reporting/formats")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "report_formats" in data
        assert "delivery_methods" in data
        assert "frequencies" in data
        assert "report_types" in data
        
        # Verify report formats
        formats = data["report_formats"]
        format_values = [f["value"] for f in formats]
        assert "json" in format_values
        assert "pdf" in format_values
        assert "html" in format_values
        assert "xlsx" in format_values
        assert "csv" in format_values
        
        # Verify delivery methods
        methods = data["delivery_methods"]
        method_values = [m["value"] for m in methods]
        assert "email" in method_values
        assert "slack" in method_values
        assert "webhook" in method_values
        assert "s3_upload" in method_values
        
        # Verify frequencies
        frequencies = data["frequencies"]
        freq_values = [f["value"] for f in frequencies]
        assert "daily" in freq_values
        assert "weekly" in freq_values
        assert "monthly" in freq_values
        assert "quarterly" in freq_values
        assert "annually" in freq_values
        
        # Verify report types
        types = data["report_types"]
        type_values = [t["value"] for t in types]
        assert "compliance" in type_values
        assert "security" in type_values
        assert "executive" in type_values

    def test_reporting_api_error_handling(self, client):
        """Test error handling in reporting API."""
        # Test with invalid organization ID format
        response = client.post(
            "/api/v1/reporting/generate/invalid-uuid",
            json={"report_type": "compliance"}
        )
        assert response.status_code == 422  # Validation error

    def test_reporting_api_request_validation(self, client, sample_organization_id):
        """Test request validation in reporting API."""
        # Test empty request body
        response = client.post(f"/api/v1/reporting/generate/{sample_organization_id}")
        assert response.status_code == 422
        
        # Test invalid JSON
        response = client.post(
            f"/api/v1/reporting/generate/{sample_organization_id}",
            data="invalid json",
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 422

    def test_reporting_api_complex_schedule_workflow(self, client, sample_organization_id):
        """Test complete workflow of creating, updating, and deleting schedule."""
        # Step 1: Create schedule
        schedule_config = {
            "report_type": "compliance",
            "frequency": "monthly",
            "format": "pdf",
            "delivery": {
                "methods": ["email"],
                "recipients": ["compliance@company.com"]
            }
        }
        
        with patch('udp.api.routes.reporting.report_scheduler') as mock_scheduler:
            schedule_id = "workflow-schedule-123"
            mock_scheduler.create_schedule.return_value = schedule_id
            
            # Create
            response = client.post(
                f"/api/v1/reporting/schedules/{sample_organization_id}",
                json=schedule_config
            )
            assert response.status_code == 200
            
            # Step 2: Get details
            mock_scheduler.get_schedule_status.return_value = {
                "schedule_id": schedule_id,
                "frequency": "monthly"
            }
            
            response = client.get(f"/api/v1/reporting/schedules/details/{schedule_id}")
            assert response.status_code == 200
            
            # Step 3: Update
            mock_scheduler.update_schedule.return_value = True
            mock_scheduler.get_schedule_status.return_value = {
                "schedule_id": schedule_id,
                "frequency": "quarterly"
            }
            
            response = client.put(
                f"/api/v1/reporting/schedules/{schedule_id}",
                json={"frequency": "quarterly"}
            )
            assert response.status_code == 200
            
            # Step 4: Delete
            mock_scheduler.delete_schedule.return_value = True
            
            response = client.delete(f"/api/v1/reporting/schedules/{schedule_id}")
            assert response.status_code == 200

    def test_reporting_concurrent_operations(self, client, sample_organization_id):
        """Test concurrent reporting operations."""
        import threading
        
        results = []
        errors = []
        
        def create_schedule():
            try:
                config = {
                    "report_type": "security",
                    "frequency": "weekly"
                }
                
                with patch('udp.api.routes.reporting.report_scheduler') as mock_scheduler:
                    mock_scheduler.create_schedule.return_value = f"schedule-{threading.current_thread().ident}"
                    
                    response = client.post(
                        f"/api/v1/reporting/schedules/{sample_organization_id}",
                        json=config
                    )
                    results.append(response.status_code)
            except Exception as e:
                errors.append(str(e))
        
        # Create multiple concurrent schedule creation requests
        threads = []
        for _ in range(3):
            thread = threading.Thread(target=create_schedule)
            threads.append(thread)
            thread.start()
        
        for thread in threads:
            thread.join()
        
        # All operations should succeed
        assert len(errors) == 0
        assert all(status == 200 for status in results)


class TestReportingAPIIntegration:
    """Integration tests for reporting API."""
    
    @pytest.fixture
    def client_with_db(self):
        """Create test client with database dependency override."""
        from udp.core.database import get_async_session
        
        async def mock_get_session():
            mock_session = AsyncMock()
            yield mock_session
        
        app.dependency_overrides[get_async_session] = mock_get_session
        client = TestClient(app)
        
        yield client
        
        app.dependency_overrides.clear()

    def test_end_to_end_report_generation(self, client_with_db):
        """Test end-to-end report generation workflow."""
        org_id = str(uuid4())
        
        # Generate report
        report_config = {
            "report_type": "compliance",
            "format": "json",
            "parameters": {"framework": "SOX"}
        }
        
        with patch('udp.api.routes.reporting.report_scheduler') as mock_scheduler:
            mock_scheduler.generate_report_now.return_value = "integration-job-123"
            
            response = client_with_db.post(
                f"/api/v1/reporting/generate/{org_id}",
                json=report_config
            )
            
            assert response.status_code == 200
            
            # Check job status
            mock_scheduler.get_job_status.return_value = {
                "job_id": "integration-job-123",
                "status": "completed",
                "output_location": "/tmp/compliance-report.json"
            }
            
            status_response = client_with_db.get(
                "/api/v1/reporting/jobs/integration-job-123/status"
            )
            
            assert status_response.status_code == 200
            status_data = status_response.json()
            assert status_data["status"] == "completed"


if __name__ == "__main__":
    pytest.main([__file__])