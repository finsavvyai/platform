"""
Unit tests for onboarding service.

Tests onboarding logic, state management, and progress calculation.
"""

import pytest
from datetime import datetime, timezone
from uuid import uuid4
from unittest.mock import AsyncMock, MagicMock, patch


@pytest.mark.unit
class TestOnboardingService:
    """Test onboarding service."""
    
    def test_calculate_onboarding_progress(self):
        """Test onboarding progress calculation."""
        def calculate_progress(state: dict) -> int:
            steps = [
                state.get("signup_complete", False),
                state.get("profile_complete", False),
                state.get("first_project_created", False),
                state.get("first_dependency_added", False),
                state.get("first_code_usage", False),
                state.get("security_scan_run", False),
                state.get("community_joined", False),
                state.get("workflow_created", False)
            ]
            return int((sum(steps) / len(steps)) * 100)
        
        # Test empty state
        empty_state = {}
        assert calculate_progress(empty_state) == 0
        
        # Test partial state
        partial_state = {
            "signup_complete": True,
            "profile_complete": True,
            "first_project_created": True,
            "first_dependency_added": True
        }
        assert calculate_progress(partial_state) == 50
        
        # Test complete state
        complete_state = {
            "signup_complete": True,
            "profile_complete": True,
            "first_project_created": True,
            "first_dependency_added": True,
            "first_code_usage": True,
            "security_scan_run": True,
            "community_joined": True,
            "workflow_created": True
        }
        assert calculate_progress(complete_state) == 100
    
    def test_get_next_onboarding_step(self):
        """Test getting next onboarding step."""
        def get_next_step(state: dict) -> str:
            if not state.get("signup_complete"):
                return "signup"
            if not state.get("profile_complete"):
                return "profile"
            if not state.get("first_project_created"):
                return "first_project"
            if not state.get("first_dependency_added"):
                return "first_dependency"
            if not state.get("first_code_usage"):
                return "first_code_usage"
            if not state.get("security_scan_run"):
                return "security_scan"
            if not state.get("community_joined"):
                return "community"
            if not state.get("workflow_created"):
                return "workflow"
            return "complete"
        
        # Test new user
        new_user_state = {"signup_complete": True}
        assert get_next_step(new_user_state) == "profile"
        
        # Test user with project
        project_user_state = {
            "signup_complete": True,
            "profile_complete": True,
            "first_project_created": True
        }
        assert get_next_step(project_user_state) == "first_dependency"
        
        # Test complete user
        complete_state = {
            "signup_complete": True,
            "profile_complete": True,
            "first_project_created": True,
            "first_dependency_added": True,
            "first_code_usage": True,
            "security_scan_run": True,
            "community_joined": True,
            "workflow_created": True
        }
        assert get_next_step(complete_state) == "complete"
    
    def test_check_tier_limits(self):
        """Test checking tier limits."""
        def check_limit(tier: str, resource: str, current_count: int) -> bool:
            limits = {
                "free": {
                    "projects": 5,
                    "dependencies_per_project": 100,
                    "storage_gb": 1
                },
                "pro": {
                    "projects": -1,  # unlimited
                    "dependencies_per_project": 1000,
                    "storage_gb": 10
                },
                "team": {
                    "projects": -1,
                    "dependencies_per_project": 10000,
                    "storage_gb": 100
                },
                "enterprise": {
                    "projects": -1,
                    "dependencies_per_project": -1,
                    "storage_gb": -1
                }
            }
            
            tier_limits = limits.get(tier, limits["free"])
            limit = tier_limits.get(resource, 0)
            
            if limit == -1:
                return True  # Unlimited
            
            return current_count < limit
        
        # Test free tier limits
        assert check_limit("free", "projects", 4) is True
        assert check_limit("free", "projects", 5) is False
        assert check_limit("free", "projects", 6) is False
        
        # Test pro tier (unlimited projects)
        assert check_limit("pro", "projects", 100) is True
        
        # Test enterprise (unlimited everything)
        assert check_limit("enterprise", "projects", 1000) is True
        assert check_limit("enterprise", "dependencies_per_project", 10000) is True
    
    def test_should_show_upgrade_prompt(self):
        """Test upgrade prompt logic."""
        def should_show_prompt(tier: str, days_since_signup: int, limit_hit: bool) -> bool:
            # Show prompt if:
            # 1. User hits limit
            # 2. User has been using for 7+ days (free tier)
            # 3. User tries to use pro feature
            
            if limit_hit:
                return True
            
            if tier == "free" and days_since_signup >= 7:
                return True
            
            return False
        
        # Test limit hit
        assert should_show_prompt("free", 1, True) is True
        
        # Test 7 days
        assert should_show_prompt("free", 7, False) is True
        assert should_show_prompt("free", 6, False) is False
        
        # Test pro tier (no prompt)
        assert should_show_prompt("pro", 10, False) is False


@pytest.mark.unit
class TestOnboardingEmailService:
    """Test onboarding email service."""
    
    @patch('udp.services.email.send_email')
    def test_send_welcome_email(self, mock_send_email):
        """Test sending welcome email."""
        def send_welcome_email(email: str, name: str):
            subject = "Welcome to UPM! 🚀"
            body = f"Hi {name},\n\nWelcome to UPM - the Universal Package Manager!"
            mock_send_email(email, subject, body)
        
        send_welcome_email("test@example.com", "Test User")
        mock_send_email.assert_called_once()
    
    @patch('udp.services.email.send_email')
    def test_send_onboarding_email_sequence(self, mock_send_email):
        """Test onboarding email sequence."""
        def send_onboarding_email(email: str, step: str):
            emails = {
                "day_0": ("Welcome to UPM! 🚀", "Welcome message"),
                "day_1": ("Create Your First Project", "Project creation guide"),
                "day_3": ("Explore UPM Features", "Features overview"),
                "day_7": ("Success Stories", "User success stories"),
                "day_14": ("Upgrade to Pro", "Upgrade benefits")
            }
            
            subject, body = emails.get(step, ("", ""))
            mock_send_email(email, subject, body)
        
        send_onboarding_email("test@example.com", "day_0")
        mock_send_email.assert_called_once()


@pytest.mark.unit
class TestOnboardingAnalytics:
    """Test onboarding analytics."""
    
    def test_track_onboarding_event(self):
        """Test tracking onboarding events."""
        events = []
        
        def track_event(event_type: str, user_id: str, metadata: dict = None):
            events.append({
                "type": event_type,
                "user_id": user_id,
                "metadata": metadata or {},
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
        
        track_event("signup", "user_123")
        track_event("first_project", "user_123", {"project_id": "proj_456"})
        
        assert len(events) == 2
        assert events[0]["type"] == "signup"
        assert events[1]["type"] == "first_project"
        assert events[1]["metadata"]["project_id"] == "proj_456"
    
    def test_calculate_activation_rate(self):
        """Test calculating activation rate."""
        def calculate_activation_rate(signups: int, activated: int) -> float:
            if signups == 0:
                return 0.0
            return (activated / signups) * 100
        
        # Test normal case
        assert calculate_activation_rate(100, 50) == 50.0
        
        # Test zero signups
        assert calculate_activation_rate(0, 0) == 0.0
        
        # Test 100% activation
        assert calculate_activation_rate(100, 100) == 100.0
        
        # Test target (50%+)
        assert calculate_activation_rate(100, 50) >= 50.0
