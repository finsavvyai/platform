#!/usr/bin/env python3
"""
Comprehensive test suite for Task 1.5.2 - Self-Healing Automation

Tests self-healing capabilities including:
- AI-powered element detection
- Automatic selector repair mechanisms
- Visual element matching capabilities
- Learning from execution history
- Fallback selector strategies
- Self-healing workflow execution
"""

import asyncio
import json
import pytest
import uuid
from datetime import datetime
from unittest.mock import Mock, AsyncMock, patch

# Test HTML content with various elements
TEST_HTML_CONTENT = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Page for Self-Healing</title>
</head>
<body>
    <header>
        <h1>Self-Healing Test Page</h1>
        <nav>
            <ul>
                <li><a href="#home" data-testid="nav-home">Home</a></li>
                <li><a href="#about" data-testid="nav-about">About</a></li>
                <li><a href="#contact" data-testid="nav-contact">Contact</a></li>
            </ul>
        </nav>
    </header>

    <main>
        <section id="hero">
            <h2>Welcome to Our Platform</h2>
            <p>This is a test page for self-healing automation capabilities.</p>
            <button id="cta-button" class="btn btn-primary" data-testid="hero-button">
                Get Started
            </button>
            <button class="btn-secondary" data-testid="secondary-button">
                Learn More
            </button>
        </section>

        <section id="features">
            <h2>Features</h2>
            <div class="feature-grid">
                <div class="feature-card" data-feature="automation">
                    <h3>Automation</h3>
                    <p>Advanced automation capabilities</p>
                    <input type="text" placeholder="Enter your email" data-testid="email-input" class="form-input">
                    <button class="btn-submit" data-testid="submit-btn">Submit</button>
                </div>
                <div class="feature-card" data-feature="analytics">
                    <h3>Analytics</h3>
                    <p>Comprehensive analytics dashboard</p>
                    <a href="/analytics" class="feature-link" data-testid="analytics-link">View Analytics</a>
                </div>
                <div class="feature-card" data-feature="monitoring">
                    <h3>Monitoring</h3>
                    <p>Real-time monitoring tools</p>
                    <select name="monitoring-type" data-testid="monitoring-select">
                        <option value="performance">Performance</option>
                        <option value="availability">Availability</option>
                        <option value="errors">Error Tracking</option>
                    </select>
                </div>
            </div>
        </section>

        <section id="forms">
            <h2>Contact Form</h2>
            <form id="contact-form" data-testid="contact-form">
                <div class="form-group">
                    <label for="name">Name:</label>
                    <input type="text" id="name" name="name" required data-testid="name-input">
                </div>
                <div class="form-group">
                    <label for="email">Email:</label>
                    <input type="email" id="email" name="email" required data-testid="email-form-input">
                </div>
                <div class="form-group">
                    <label for="message">Message:</label>
                    <textarea id="message" name="message" rows="4" data-testid="message-textarea"></textarea>
                </div>
                <button type="submit" class="btn-submit" data-testid="form-submit">Send Message</button>
            </form>
        </section>
    </main>

    <footer>
        <p>&copy; 2024 Self-Healing Test Platform</p>
        <div class="footer-links">
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            <a href="/support">Support</a>
        </div>
    </footer>
</body>
</html>
"""

@pytest.fixture
def mock_llm_service():
    """Mock LLM service for testing."""
    mock_service = Mock()
    mock_service.generate_completion = AsyncMock()
    return mock_service

@pytest.fixture
def mock_redis_client():
    """Mock Redis client for testing."""
    mock_client = Mock()
    mock_client.get = AsyncMock(return_value=None)
    mock_client.set = AsyncMock(return_value=True)
    mock_client.keys = AsyncMock(return_value=[])
    return mock_client

class TestSelfHealingService:
    """Test cases for SelfHealingService."""

    @pytest.fixture
    def service(self, mock_llm_service, mock_redis_client):
        """Create service instance with mocked dependencies."""
        with patch('app.services.self_healing.llm_service', mock_llm_service), \
             patch('app.services.self_healing.redis_client', mock_redis_client):
            from app.services.self_healing import SelfHealingService
            return SelfHealingService()

    @pytest.mark.asyncio
    async def test_service_initialization(self, service):
        """Test service initialization."""
        assert service.repair_strategies is not None
        assert len(service.repair_strategies) > 0
        assert "ai_detection" in service.repair_strategies

    @pytest.mark.asyncio
    async def test_element_detection_with_ai(self, service, mock_llm_service):
        """Test AI-powered element detection."""
        # Mock AI response
        mock_llm_service.generate_completion.return_value = {
            "content": json.dumps([
                {
                    "selector": "#cta-button",
                    "confidence": 0.9,
                    "reasoning": "Main call-to-action button"
                },
                {
                    "selector": "button[data-testid='hero-button']",
                    "confidence": 0.85,
                    "reasoning": "Button with test ID"
                }
            ])
        }

        matches = await service.detect_element(
            page_content=TEST_HTML_CONTENT,
            page_url="https://test.example.com",
            description="main call to action button",
            original_selector="#nonexistent-button"
        )

        assert len(matches) > 0
        assert matches[0].selector == "#cta-button"
        assert matches[0].confidence == 0.9
        mock_llm_service.generate_completion.assert_called_once()

    @pytest.mark.asyncio
    async def test_selector_repair(self, service, mock_llm_service):
        """Test selector repair functionality."""
        # Mock AI response for repair
        mock_llm_service.generate_completion.return_value = {
            "content": "#cta-button"
        }

        repair_result = await service.repair_selector(
            failed_selector="#broken-button",
            page_content=TEST_HTML_CONTENT,
            page_url="https://test.example.com",
            error_type="element_not_found"
        )

        assert repair_result.original_selector == "#broken-button"
        assert repair_result.repaired_selector == "#cta-button"
        assert repair_result.confidence > 0
        assert repair_result.repair_strategy == "ai_generation"

    @pytest.mark.asyncio
    async def test_learning_from_execution(self, service, mock_redis_client):
        """Test learning from execution history."""
        execution_id = uuid4()

        await service.learn_from_execution(
            execution_id=execution_id,
            selector="#cta-button",
            url="https://test.example.com",
            success=True,
            page_snapshot=TEST_HTML_CONTENT,
            confidence=0.9
        )

        # Verify data was stored
        url_hash = hash("https://test.example.com") % (2**32)
        assert url_hash in service.execution_history
        assert len(service.execution_history[url_hash]) == 1
        assert service.execution_history[url_hash][0].success is True
        assert service.execution_history[url_hash][0].confidence == 0.9

    @pytest.mark.asyncio
    async def test_pattern_based_detection(self, service):
        """Test pattern-based element detection."""
        # First, add some historical data
        await service.learn_from_execution(
            execution_id=uuid4(),
            selector="#cta-button",
            url="https://test.example.com",
            success=True,
            page_snapshot=TEST_HTML_CONTENT,
            confidence=0.9
        )

        # Now test pattern-based detection
        matches = await service.detect_element(
            page_content=TEST_HTML_CONTENT,
            page_url="https://test.example.com",
            original_selector="#cta-button",
            description="main button"
        )

        # Should find pattern-based matches
        assert len(matches) > 0

    def test_selector_validation(self, service):
        """Test selector validation methods."""
        # Valid selectors
        assert service._validate_selector_format("#cta-button") is True
        assert service._validate_selector_format(".btn-primary") is True
        assert service._validate_selector_format("button[data-testid='hero']") is True

        # Invalid selectors
        assert service._validate_selector_format("") is False
        assert service._validate_selector_format("button[invalid") is False
        assert service._validate_selector_format("<invalid>") is False

    def test_selector_confidence_calculation(self, service):
        """Test selector confidence calculation."""
        # High confidence for ID selector
        confidence = service._calculate_selector_confidence("#cta-button", 1, TEST_HTML_CONTENT)
        assert confidence > 0.8

        # Lower confidence for generic selector
        confidence = service._calculate_selector_confidence("div", 10, TEST_HTML_CONTENT)
        assert confidence < 0.8

    def test_selector_similarity_calculation(self, service):
        """Test selector similarity calculation."""
        # High similarity
        similarity = service._calculate_selector_similarity(
            "#cta-button", "#cta-button.btn-primary"
        )
        assert similarity > 0.5

        # Low similarity
        similarity = service._calculate_selector_similarity(
            "#cta-button", "nav ul li a"
        )
        assert similarity < 0.5

    def test_statistics_collection(self, service):
        """Test statistics collection."""
        stats = service.get_statistics()
        assert "total_execution_history" in stats
        assert "visual_signatures" in stats
        assert "selector_patterns" in stats
        assert "successful_repairs" in stats

class TestAISelectorService:
    """Test cases for AISelectorService."""

    @pytest.fixture
    def service(self, mock_llm_service):
        """Create service instance with mocked dependencies."""
        with patch('app.services.ai_selector.llm_service', mock_llm_service):
            from app.services.ai_selector import AISelectorService
            return AISelectorService()

    @pytest.mark.asyncio
    async def test_element_analysis(self, service, mock_llm_service):
        """Test element analysis functionality."""
        # Mock AI response
        mock_llm_service.generate_completion.return_value = {
            "content": json.dumps([
                {
                    "element_type": "button",
                    "text_content": "Get Started",
                    "attributes": {
                        "id": "cta-button",
                        "class": "btn btn-primary",
                        "data-testid": "hero-button"
                    },
                    "css_path": "#cta-button",
                    "xpath": "//button[@id='cta-button']",
                    "confidence": 0.95,
                    "accessibility_features": {
                        "role": "button"
                    },
                    "visual_description": "Blue call-to-action button"
                }
            ])
        }

        analyses = await service.analyze_element(
            html_content=TEST_HTML_CONTENT,
            element_description="main call to action button",
            context={"page_type": "landing page"},
            page_url="https://test.example.com"
        )

        assert len(analyses) > 0
        analysis = analyses[0]
        assert analysis.element_type == "button"
        assert analysis.text_content == "Get Started"
        assert analysis.attributes["id"] == "cta-button"
        assert analysis.confidence == 0.95

    @pytest.mark.asyncio
    async def test_selector_generation(self, service):
        """Test selector generation from element analysis."""
        from app.services.ai_selector import ElementAnalysis

        analysis = ElementAnalysis(
            element_type="button",
            text_content="Get Started",
            attributes={"id": "cta-button", "class": "btn btn-primary"},
            css_path="#cta-button",
            confidence=0.9
        )

        selectors = await service.generate_selectors(
            element_analysis=analysis,
            html_content=TEST_HTML_CONTENT,
            requirements={"prefer_accessibility": True}
        )

        assert len(selectors) > 0

        # Should have ID-based selector
        id_selectors = [s for s in selectors if "cta-button" in s.selector]
        assert len(id_selectors) > 0

        # Check confidence scores are valid
        for selector in selectors:
            assert 0 <= selector.confidence <= 1
            assert selector.reasoning is not None

    @pytest.mark.asyncio
    async def test_selector_validation(self, service):
        """Test selector validation."""
        validation = await service.validate_selector(
            selector="#cta-button",
            html_content=TEST_HTML_CONTENT
        )

        assert validation["valid"] is True
        assert validation["confidence"] > 0.5
        assert validation["matches"] > 0
        assert validation["element_type"] == "button"

    @pytest.mark.asyncio
    async def test_selector_improvement(self, service, mock_llm_service):
        """Test selector improvement functionality."""
        # Mock AI response for improvement
        mock_llm_service.generate_completion.return_value = {
            "content": json.dumps([
                {
                    "selector": "button[data-testid='hero-button']",
                    "reasoning": "More reliable test automation attribute",
                    "confidence": 0.9,
                    "robustness": 0.85,
                    "performance": 0.8
                }
            ])
        }

        improvements = await service.improve_selector(
            original_selector="button.btn-primary",
            html_content=TEST_HTML_CONTENT,
            error_context={"error": "element not found"},
            improvement_goals=["prefer_robustness"]
        )

        assert len(improvements) > 0
        improvement = improvements[0]
        assert "data-testid" in improvement.selector
        assert improvement.confidence > 0.8

    def test_selector_specificity_calculation(self, service):
        """Test CSS selector specificity calculation."""
        # High specificity
        specificity = service._calculate_selector_specificity("#cta-button.btn-primary")
        assert specificity > 0.5

        # Low specificity
        specificity = service._calculate_selector_specificity("div")
        assert specificity < 0.3

    def test_element_pattern_recognition(self, service):
        """Test element pattern recognition."""
        patterns = service.element_patterns
        assert "interactive_elements" in patterns
        assert "content_elements" in patterns
        assert "form_elements" in patterns
        assert "navigation_elements" in patterns

        # Check interactive elements patterns
        interactive = patterns["interactive_elements"]
        assert "button" in interactive["tags"]
        assert "data-testid" in interactive["test_ids"]

class TestBrowserAutomationSelfHealing:
    """Test cases for browser automation with self-healing."""

    @pytest.fixture
    def service(self, mock_llm_service, mock_redis_client):
        """Create browser automation service with mocked dependencies."""
        with patch('app.services.browser_automation.llm_service', mock_llm_service), \
             patch('app.services.browser_automation.redis_client', mock_redis_client), \
             patch('app.services.browser_automation.self_healing_service'), \
             patch('app.services.browser_automation.ai_selector_service'):
            from app.services.browser_automation import BrowserAutomationService
            return BrowserAutomationService()

    @pytest.mark.asyncio
    async def test_self_healing_configuration(self, service):
        """Test self-healing mode configuration."""
        config = await service.enable_self_healing_mode(
            enabled=True,
            confidence_threshold=0.6,
            max_healing_attempts=2
        )

        assert config["enabled"] is True
        assert config["confidence_threshold"] == 0.6
        assert config["max_healing_attempts"] == 2
        assert len(config["healing_strategies"]) > 0

    @pytest.mark.asyncio
    async def test_selector_health_analysis(self, service):
        """Test selector health analysis."""
        analysis = await service.analyze_selector_health(
            selector="button.btn-primary",
            page_url="https://test.example.com",
            historical_data=False
        )

        assert "health_score" in analysis
        assert "robustness_score" in analysis
        assert "complexity_score" in analysis
        assert "syntax_valid" in analysis
        assert "recommendations" in analysis

    @pytest.mark.asyncio
    async def test_self_healing_action_execution(self, service, mock_llm_service):
        """Test action execution with self-healing."""
        from app.agents.browser_agent import BrowserAction
        from playwright.async_api import Page

        # Create mock page
        mock_page = Mock(spec=Page)
        mock_page.url = "https://test.example.com"
        mock_page.content = AsyncMock(return_value=TEST_HTML_CONTENT)

        # Create action that will need healing
        action = BrowserAction(
            action_type="click",
            selector="#missing-button"
        )

        # Mock self-healing service to return repaired selector
        with patch.object(service, '_attempt_selector_healing') as mock_healing:
            mock_healing.return_value = {
                "healed": True,
                "repaired_selector": "#cta-button",
                "confidence": 0.8
            }

            # Mock the actual click to succeed with repaired selector
            mock_page.click = AsyncMock()

            result = await service.execute_action_with_self_healing(
                page=mock_page,
                action=action
            )

            assert result["self_healing"]["healing_applied"] is True
            assert result["self_healing"]["attempts"] == 1
            assert result["self_healing"]["original_selector"] == "#missing-button"
            assert result["self_healing"]["final_selector"] == "#cta-button"

    @pytest.mark.asyncio
    async def test_self_healing_statistics(self, service):
        """Test self-healing statistics collection."""
        stats = await service.get_self_healing_statistics()

        assert "total_execution_history" in stats
        assert "visual_signatures" in stats
        assert "successful_repairs" in stats
        assert "browser_automation_service" in stats

class TestIntegrationScenarios:
    """Integration test scenarios for self-healing automation."""

    @pytest.mark.asyncio
    async def test_complete_self_healing_workflow(self, mock_llm_service, mock_redis_client):
        """Test complete self-healing workflow from failure to recovery."""
        # Mock AI responses
        mock_llm_service.generate_completion.side_effect = [
            {"content": "#cta-button"},  # For selector repair
            {"content": json.dumps([{"selector": "#cta-button", "confidence": 0.9}])}  # For element detection
        ]

        with patch('app.services.self_healing.llm_service', mock_llm_service), \
             patch('app.services.self_healing.redis_client', mock_redis_client), \
             patch('app.services.ai_selector.llm_service', mock_llm_service):

            from app.services.self_healing import self_healing_service
            from app.services.ai_selector import ai_selector_service

            # Step 1: Simulate failed execution
            await self_healing_service.learn_from_execution(
                execution_id=uuid4(),
                selector="#broken-button",
                url="https://test.example.com",
                success=False,
                page_snapshot=TEST_HTML_CONTENT,
                error_type="element_not_found"
            )

            # Step 2: Attempt selector repair
            repair_result = await self_healing_service.repair_selector(
                failed_selector="#broken-button",
                page_content=TEST_HTML_CONTENT,
                page_url="https://test.example.com"
            )

            assert repair_result.repaired_selector == "#cta-button"
            assert repair_result.confidence > 0

            # Step 3: Validate repaired selector
            validation = await ai_selector_service.validate_selector(
                selector=repair_result.repaired_selector,
                html_content=TEST_HTML_CONTENT
            )

            assert validation["valid"] is True

            # Step 4: Learn from successful repair
            await self_healing_service.learn_from_execution(
                execution_id=uuid4(),
                selector=repair_result.repaired_selector,
                url="https://test.example.com",
                success=True,
                page_snapshot=TEST_HTML_CONTENT,
                repaired_selector="#broken-button",
                confidence=0.9
            )

            # Step 5: Verify learning
            stats = self_healing_service.get_statistics()
            assert stats["total_execution_history"] >= 2

    @pytest.mark.asyncio
    async def test_multiple_selector_repair_strategies(self, mock_llm_service, mock_redis_client):
        """Test multiple selector repair strategies."""
        with patch('app.services.self_healing.llm_service', mock_llm_service), \
             patch('app.services.self_healing.redis_client', mock_redis_client):

            from app.services.self_healing import self_healing_service

            # Test different repair scenarios
            test_scenarios = [
                ("#missing-id", "element_not_found"),
                (".missing-class", "element_not_found"),
                ("button[invalid", "selector_invalid"),
                ("div.container > h1", "element_not_visible")
            ]

            for failed_selector, error_type in test_scenarios:
                repair_result = await self_healing_service.repair_selector(
                    failed_selector=failed_selector,
                    page_content=TEST_HTML_CONTENT,
                    page_url="https://test.example.com",
                    error_type=error_type
                )

                # At least attempt repair
                assert repair_result.repair_strategy is not None
                assert isinstance(repair_result.confidence, float)

    @pytest.mark.asyncio
    async def test_visual_element_matching(self, mock_llm_service, mock_redis_client):
        """Test visual element matching capabilities."""
        with patch('app.services.self_healing.llm_service', mock_llm_service), \
             patch('app.services.self_healing.redis_client', mock_redis_client):

            from app.services.self_healing import self_healing_service

            # Create visual context
            visual_context = {
                "element_hash": "test_hash_123",
                "element_snapshot": '<button id="cta-button">Get Started</button>'
            }

            matches = await self_healing_service.detect_element(
                page_content=TEST_HTML_CONTENT,
                page_url="https://test.example.com",
                original_selector="#missing-button",
                description="main button",
                visual_context=visual_context
            )

            # Should attempt visual matching
            assert isinstance(matches, list)

# Performance and load testing
class TestSelfHealingPerformance:
    """Performance tests for self-healing automation."""

    @pytest.mark.asyncio
    async def test_concurrent_selector_repairs(self, mock_llm_service, mock_redis_client):
        """Test concurrent selector repair operations."""
        mock_llm_service.generate_completion.return_value = {"content": "#cta-button"}

        with patch('app.services.self_healing.llm_service', mock_llm_service), \
             patch('app.services.self_healing.redis_client', mock_redis_client):

            from app.services.self_healing import self_healing_service

            # Create multiple repair tasks
            repair_tasks = []
            for i in range(10):
                task = self_healing_service.repair_selector(
                    failed_selector=f"#broken-button-{i}",
                    page_content=TEST_HTML_CONTENT,
                    page_url="https://test.example.com"
                )
                repair_tasks.append(task)

            # Execute all repairs concurrently
            results = await asyncio.gather(*repair_tasks)

            # All repairs should complete
            assert len(results) == 10
            for result in results:
                assert result.repair_strategy is not None
                assert isinstance(result.confidence, float)

    @pytest.mark.asyncio
    async def test_large_content_processing(self, mock_llm_service):
        """Test processing large HTML content efficiently."""
        # Create large HTML content
        large_content = TEST_HTML_CONTENT * 10  # Repeat content

        mock_llm_service.generate_completion.return_value = {
            "content": json.dumps([
                {
                    "selector": "#cta-button",
                    "confidence": 0.9,
                    "reasoning": "Main button found"
                }
            ])
        }

        with patch('app.services.ai_selector.llm_service', mock_llm_service):
            from app.services.ai_selector import ai_selector_service

            import time
            start_time = time.time()

            analyses = await ai_selector_service.analyze_element(
                html_content=large_content,
                element_description="main call to action button",
                page_url="https://test.example.com"
            )

            processing_time = time.time() - start_time

            # Should complete within reasonable time (less than 5 seconds)
            assert processing_time < 5.0
            assert len(analyses) > 0

# Error handling and edge cases
class TestSelfHealingEdgeCases:
    """Test edge cases and error handling."""

    @pytest.mark.asyncio
    async def test_empty_page_content(self, mock_llm_service, mock_redis_client):
        """Test handling of empty page content."""
        with patch('app.services.self_healing.llm_service', mock_llm_service), \
             patch('app.services.self_healing.redis_client', mock_redis_client):

            from app.services.self_healing import self_healing_service

            matches = await self_healing_service.detect_element(
                page_content="",
                page_url="https://test.example.com",
                description="main button"
            )

            # Should handle empty content gracefully
            assert isinstance(matches, list)

    @pytest.mark.asyncio
    async def test_malformed_html_content(self, mock_llm_service, mock_redis_client):
        """Test handling of malformed HTML content."""
        malformed_content = "<div><button>Test</div>"  # Unclosed tags

        with patch('app.services.self_healing.llm_service', mock_llm_service), \
             patch('app.services.self_healing.redis_client', mock_redis_client):

            from app.services.self_healing import self_healing_service

            # Should not crash on malformed HTML
            matches = await self_healing_service.detect_element(
                page_content=malformed_content,
                page_url="https://test.example.com",
                description="button"
            )

            assert isinstance(matches, list)

    @pytest.mark.asyncio
    async def test_llm_service_failure(self, mock_llm_service, mock_redis_client):
        """Test handling of LLM service failures."""
        # Mock LLM service to raise exception
        mock_llm_service.generate_completion.side_effect = Exception("LLM service unavailable")

        with patch('app.services.self_healing.llm_service', mock_llm_service), \
             patch('app.services.self_healing.redis_client', mock_redis_client):

            from app.services.self_healing import self_healing_service

            # Should fallback gracefully
            matches = await self_healing_service.detect_element(
                page_content=TEST_HTML_CONTENT,
                page_url="https://test.example.com",
                description="main button"
            )

            # Should still return some results via fallback strategies
            assert isinstance(matches, list)

    @pytest.mark.asyncio
    async def test_redis_connection_failure(self, mock_llm_service):
        """Test handling of Redis connection failures."""
        # Mock Redis to raise connection error
        mock_redis = Mock()
        mock_redis.get.side_effect = Exception("Redis connection failed")
        mock_redis.set.side_effect = Exception("Redis connection failed")

        with patch('app.services.self_healing.llm_service', mock_llm_service), \
             patch('app.services.self_healing.redis_client', mock_redis):

            from app.services.self_healing import self_healing_service

            # Should still work with in-memory storage
            await self_healing_service.learn_from_execution(
                execution_id=uuid4(),
                selector="#cta-button",
                url="https://test.example.com",
                success=True,
                page_snapshot=TEST_HTML_CONTENT
            )

            # Should have stored in memory despite Redis failure
            stats = self_healing_service.get_statistics()
            assert stats["total_execution_history"] >= 1

if __name__ == "__main__":
    # Run tests directly
    pytest.main([__file__, "-v"])