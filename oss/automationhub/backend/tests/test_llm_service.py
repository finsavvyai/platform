"""
Unit tests for LLM Service
Tests core LLM functionality, templates, and caching
"""

import pytest
import asyncio
from unittest.mock import Mock, patch, AsyncMock
from datetime import datetime

from app.services.llm_service import (
    LLMService,
    LLMRequest,
    LLMResponse,
    PromptTemplate,
    ModelSize,
    ModelProvider
)

class TestLLMService:
    """Test LLM Service functionality"""

    @pytest.fixture
    def llm_service(self):
        """Create LLM service instance for testing"""
        with patch('app.services.llm_service.openai.AsyncOpenAI'), \
             patch('app.services.llm_service.redis.from_url'):
            service = LLMService()
            return service

    @pytest.fixture
    def mock_openai_response(self):
        """Mock OpenAI API response"""
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = "This is a test response from the LLM."
        mock_response.choices[0].finish_reason = "stop"
        mock_response.usage.total_tokens = 25
        mock_response.usage.prompt_tokens = 15
        mock_response.usage.completion_tokens = 10
        mock_response.model = "gpt-4"
        return mock_response

    def test_llm_service_initialization(self, llm_service):
        """Test LLM service initializes correctly"""
        assert llm_service is not None
        assert len(llm_service.templates) > 0
        assert len(llm_service.model_configs) == 4
        assert ModelSize.SMALL in llm_service.model_configs
        assert ModelSize.MEDIUM in llm_service.model_configs

    def test_model_configurations(self, llm_service):
        """Test model configuration setup"""
        small_config = llm_service.model_configs[ModelSize.SMALL]
        assert small_config.model == "gpt-3.5-turbo"
        assert small_config.max_tokens == 1000
        assert small_config.cache_ttl == 7200

        large_config = llm_service.model_configs[ModelSize.LARGE]
        assert large_config.model == "gpt-4-turbo"
        assert large_config.max_tokens == 4000
        assert large_config.timeout == 60

    def test_default_templates_loaded(self, llm_service):
        """Test that default templates are loaded"""
        assert "code_generation" in llm_service.templates
        assert "workflow_analysis" in llm_service.templates
        assert "natural_conversation" in llm_service.templates
        assert "task_planning" in llm_service.templates

        code_template = llm_service.templates["code_generation"]
        assert "language" in code_template.required_vars
        assert "requirements" in code_template.required_vars

    def test_template_management(self, llm_service):
        """Test template addition and retrieval"""
        custom_template = PromptTemplate(
            name="test_template",
            template="Test template with {{ variable }}",
            description="Test template",
            required_vars=["variable"],
            category="testing"
        )

        llm_service.add_template(custom_template)
        assert "test_template" in llm_service.templates

        retrieved = llm_service.get_template("test_template")
        assert retrieved.name == "test_template"
        assert retrieved.category == "testing"

    def test_list_templates_by_category(self, llm_service):
        """Test template filtering by category"""
        all_templates = llm_service.list_templates()
        assert len(all_templates) > 0

        development_templates = llm_service.list_templates("development")
        code_template_found = any(t.name == "code_generation" for t in development_templates)
        assert code_template_found

    @pytest.mark.asyncio
    async def test_prompt_preparation_direct(self, llm_service):
        """Test direct prompt preparation"""
        request = LLMRequest(prompt="Test prompt")
        prepared = await llm_service._prepare_prompt(request)
        assert prepared == "Test prompt"

    @pytest.mark.asyncio
    async def test_prompt_preparation_with_template(self, llm_service):
        """Test prompt preparation with template"""
        request = LLMRequest(
            prompt="",
            template_name="code_generation",
            template_vars={
                "language": "Python",
                "requirements": "Create a hello world function"
            }
        )

        prepared = await llm_service._prepare_prompt(request)
        assert "Python" in prepared
        assert "hello world function" in prepared

    def test_cost_calculation(self, llm_service):
        """Test token cost calculation"""
        cost_gpt35 = llm_service._calculate_cost(1000, "gpt-3.5-turbo")
        assert cost_gpt35 == 0.002

        cost_gpt4 = llm_service._calculate_cost(1000, "gpt-4")
        assert cost_gpt4 == 0.03

    def test_confidence_calculation(self, llm_service, mock_openai_response):
        """Test confidence score calculation"""
        confidence = llm_service._calculate_confidence(mock_openai_response)
        assert 0.5 <= confidence <= 0.95
        assert isinstance(confidence, float)

    def test_cache_key_generation(self, llm_service):
        """Test cache key generation"""
        key1 = llm_service._generate_cache_key("test prompt", ModelSize.MEDIUM)
        key2 = llm_service._generate_cache_key("test prompt", ModelSize.MEDIUM)
        key3 = llm_service._generate_cache_key("different prompt", ModelSize.MEDIUM)

        assert key1 == key2  # Same inputs should generate same key
        assert key1 != key3  # Different inputs should generate different keys
        assert key1.startswith("llm_cache:")

    @pytest.mark.asyncio
    async def test_generate_completion_without_openai(self, llm_service):
        """Test completion generation when OpenAI is unavailable"""
        llm_service.openai_client = None

        request = LLMRequest(prompt="Test prompt")
        response = await llm_service.generate_completion(request)

        assert "Mock LLM response" in response.content or "technical issue" in response.content
        assert response.model in ["gpt-4", "fallback"]  # Could be either depending on fallback path
        assert response.provider in ["openai", "internal"]
        assert response.cached is False

    @pytest.mark.asyncio
    async def test_generate_completion_with_mock_openai(self, llm_service, mock_openai_response):
        """Test completion generation with mocked OpenAI"""
        # Mock the OpenAI client
        mock_client = AsyncMock()
        mock_client.chat.completions.create.return_value = mock_openai_response
        llm_service.openai_client = mock_client

        request = LLMRequest(
            prompt="Test prompt",
            model_size=ModelSize.MEDIUM,
            temperature=0.7
        )

        response = await llm_service.generate_completion(request)

        assert response.content == "This is a test response from the LLM."
        assert response.model == "gpt-4"
        assert response.tokens_used == 25
        assert response.processing_time > 0
        assert isinstance(response.confidence_score, float)

    @pytest.mark.asyncio
    async def test_model_info(self, llm_service):
        """Test model information retrieval"""
        info = await llm_service.get_model_info()

        assert "providers" in info
        assert "model_sizes" in info
        assert "configurations" in info
        assert "template_count" in info

        assert ModelProvider.OPENAI.value in info["providers"]
        assert len(info["model_sizes"]) == 4
        assert info["template_count"] > 0

    @pytest.mark.asyncio
    async def test_health_check(self, llm_service):
        """Test health check functionality"""
        health = await llm_service.health_check()

        assert "service" in health
        assert "openai_client" in health
        assert "redis_cache" in health
        assert "templates_loaded" in health
        assert "timestamp" in health

        assert health["service"] == "healthy"
        assert health["templates_loaded"] > 0

    def test_model_config_with_overrides(self, llm_service):
        """Test model configuration with request overrides"""
        request = LLMRequest(
            prompt="test",
            model_size=ModelSize.MEDIUM,
            temperature=0.5,
            max_tokens=1500
        )

        config = llm_service._get_model_config(request)

        assert config.temperature == 0.5  # Override applied
        assert config.max_tokens == 1500   # Override applied
        assert config.model == "gpt-4"     # From base config

    @pytest.mark.asyncio
    async def test_error_handling_in_generation(self, llm_service):
        """Test error handling during completion generation"""
        # Mock client that raises an exception
        mock_client = AsyncMock()
        mock_client.chat.completions.create.side_effect = Exception("API Error")
        llm_service.openai_client = mock_client

        request = LLMRequest(prompt="Test prompt")
        response = await llm_service.generate_completion(request)

        # Should return fallback response
        assert "technical issue" in response.content
        assert response.model == "fallback"
        assert "error" in response.metadata

    @pytest.mark.asyncio
    async def test_template_variable_validation(self, llm_service):
        """Test template with missing required variables"""
        request = LLMRequest(
            prompt="",
            template_name="code_generation",
            template_vars={"language": "Python"}  # Missing 'requirements'
        )

        # Should not raise error, template engine handles missing vars gracefully
        prepared = await llm_service._prepare_prompt(request)
        assert "Python" in prepared

class TestLLMModels:
    """Test LLM model classes"""

    def test_llm_request_defaults(self):
        """Test LLM request default values"""
        request = LLMRequest(prompt="test")

        assert request.model_size == ModelSize.MEDIUM
        assert request.use_cache is True
        assert request.stream is False
        assert request.template_vars is None

    def test_llm_response_creation(self):
        """Test LLM response model"""
        response = LLMResponse(
            content="Test content",
            model="gpt-4",
            provider="openai",
            tokens_used=100,
            cost_estimate=0.002,
            processing_time=1.5
        )

        assert response.content == "Test content"
        assert response.cached is False
        assert response.confidence_score is None
        assert len(response.metadata) == 0

    def test_prompt_template_validation(self):
        """Test prompt template model validation"""
        template = PromptTemplate(
            name="test",
            template="Hello {{ name }}",
            description="Test template",
            required_vars=["name"]
        )

        assert template.model_size == ModelSize.MEDIUM
        assert template.category == "general"
        assert len(template.optional_vars) == 0

class TestModelEnums:
    """Test enum definitions"""

    def test_model_provider_enum(self):
        """Test ModelProvider enum values"""
        assert ModelProvider.OPENAI == "openai"
        assert ModelProvider.ANTHROPIC == "anthropic"
        assert ModelProvider.GOOGLE == "google"
        assert ModelProvider.LOCAL == "local"

    def test_model_size_enum(self):
        """Test ModelSize enum values"""
        assert ModelSize.SMALL == "small"
        assert ModelSize.MEDIUM == "medium"
        assert ModelSize.LARGE == "large"
        assert ModelSize.XLARGE == "xlarge"

    def test_enum_iteration(self):
        """Test enum iteration"""
        providers = list(ModelProvider)
        assert len(providers) == 4

        sizes = list(ModelSize)
        assert len(sizes) == 4

if __name__ == "__main__":
    pytest.main([__file__, "-v"])