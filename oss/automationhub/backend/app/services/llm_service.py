"""
LLM Service - Core Large Language Model Integration
Provides centralized LLM capabilities with OpenAI integration, prompt templates, and caching
"""

import asyncio
import hashlib
import json
import logging
from typing import Dict, List, Optional, Any, Union
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from enum import Enum

import openai
from jinja2 import Environment, BaseLoader, Template
from pydantic import BaseModel, Field
import redis
from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import settings

logger = logging.getLogger(__name__)

class ModelProvider(str, Enum):
    """Supported LLM providers"""
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GOOGLE = "google"
    LOCAL = "local"

class ModelSize(str, Enum):
    """Model size categories for cost optimization"""
    SMALL = "small"      # GPT-3.5, fast responses
    MEDIUM = "medium"    # GPT-4, balanced
    LARGE = "large"      # GPT-4-turbo, complex tasks
    XLARGE = "xlarge"    # GPT-4o, maximum capability

@dataclass
class LLMConfig:
    """LLM configuration settings"""
    model: str
    provider: ModelProvider
    temperature: float = 0.7
    max_tokens: int = 2000
    top_p: float = 1.0
    frequency_penalty: float = 0.0
    presence_penalty: float = 0.0
    timeout: int = 30
    retry_attempts: int = 3
    cache_ttl: int = 3600  # 1 hour

class LLMRequest(BaseModel):
    """LLM request model"""
    prompt: str
    template_name: Optional[str] = None
    template_vars: Optional[Dict[str, Any]] = None
    model_size: ModelSize = ModelSize.MEDIUM
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    use_cache: bool = True
    stream: bool = False

class LLMResponse(BaseModel):
    """LLM response model"""
    content: str
    model: str
    provider: str
    tokens_used: int
    cost_estimate: float
    cached: bool = False
    processing_time: float
    confidence_score: Optional[float] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

class PromptTemplate(BaseModel):
    """Prompt template definition"""
    name: str
    template: str
    description: str
    required_vars: List[str]
    optional_vars: List[str] = Field(default_factory=list)
    category: str = "general"
    model_size: ModelSize = ModelSize.MEDIUM

class LLMService:
    """
    Centralized LLM service with multi-provider support,
    prompt templates, caching, and cost optimization
    """

    def __init__(self):
        self.jinja_env = Environment(loader=BaseLoader())
        self.redis_client = None
        self.openai_client = None
        self.templates: Dict[str, PromptTemplate] = {}
        self.model_configs = self._initialize_model_configs()

        # Initialize clients
        self._initialize_openai()
        self._initialize_redis()
        self._load_default_templates()

    def _initialize_openai(self):
        """Initialize OpenAI client with fallback"""
        try:
            self.openai_client = openai.AsyncOpenAI(
                api_key=getattr(settings, 'OPENAI_API_KEY', None)
            )
            logger.info("OpenAI client initialized successfully")
        except Exception as e:
            logger.warning(f"OpenAI client initialization failed: {e}")
            self.openai_client = None

    def _initialize_redis(self):
        """Initialize Redis client for caching"""
        try:
            redis_url = getattr(settings, 'REDIS_URL', 'redis://localhost:6379/0')
            self.redis_client = redis.from_url(redis_url, decode_responses=True)
            # Test connection
            self.redis_client.ping()
            logger.info("Redis cache initialized successfully")
        except Exception as e:
            logger.warning(f"Redis cache initialization failed: {e}")
            self.redis_client = None

    def _initialize_model_configs(self) -> Dict[ModelSize, LLMConfig]:
        """Initialize model configurations for different sizes"""
        return {
            ModelSize.SMALL: LLMConfig(
                model="gpt-3.5-turbo",
                provider=ModelProvider.OPENAI,
                temperature=0.7,
                max_tokens=1000,
                timeout=15,
                cache_ttl=7200  # 2 hours for fast models
            ),
            ModelSize.MEDIUM: LLMConfig(
                model="gpt-4",
                provider=ModelProvider.OPENAI,
                temperature=0.7,
                max_tokens=2000,
                timeout=30,
                cache_ttl=3600  # 1 hour
            ),
            ModelSize.LARGE: LLMConfig(
                model="gpt-4-turbo",
                provider=ModelProvider.OPENAI,
                temperature=0.7,
                max_tokens=4000,
                timeout=60,
                cache_ttl=1800  # 30 minutes
            ),
            ModelSize.XLARGE: LLMConfig(
                model="gpt-4o",
                provider=ModelProvider.OPENAI,
                temperature=0.5,
                max_tokens=8000,
                timeout=120,
                cache_ttl=900  # 15 minutes for expensive models
            )
        }

    def _load_default_templates(self):
        """Load default prompt templates"""
        default_templates = [
            PromptTemplate(
                name="code_generation",
                template="""Generate {{ language }} code for the following requirements:

Requirements: {{ requirements }}
Context: {{ context | default("General purpose application") }}
Best Practices: Follow {{ language }} best practices and include error handling.

{% if examples %}
Examples:
{{ examples }}
{% endif %}

Generate clean, production-ready code with comments.""",
                description="Generate code in specified language",
                required_vars=["language", "requirements"],
                optional_vars=["context", "examples"],
                category="development",
                model_size=ModelSize.MEDIUM
            ),
            PromptTemplate(
                name="workflow_analysis",
                template="""Analyze the following workflow and provide optimization recommendations:

Workflow Description: {{ workflow_description }}
Current Performance: {{ current_performance | default("Unknown") }}
Goals: {{ goals }}

Please provide:
1. Efficiency analysis
2. Bottleneck identification
3. Optimization recommendations
4. Implementation steps""",
                description="Analyze and optimize workflows",
                required_vars=["workflow_description", "goals"],
                optional_vars=["current_performance"],
                category="optimization",
                model_size=ModelSize.LARGE
            ),
            PromptTemplate(
                name="natural_conversation",
                template="""You are a helpful AI assistant for UPM.Plus, an autonomous digital ecosystem orchestrator.

User Query: {{ user_query }}
Context: {{ context | default("General assistance") }}
User Experience Level: {{ experience_level | default("intermediate") }}

Provide a helpful, accurate response that:
- Addresses the user's specific question
- Uses appropriate technical level for their experience
- Includes actionable next steps when relevant
- Maintains a friendly, professional tone""",
                description="Natural conversation with users",
                required_vars=["user_query"],
                optional_vars=["context", "experience_level"],
                category="conversation",
                model_size=ModelSize.MEDIUM
            ),
            PromptTemplate(
                name="task_planning",
                template="""Break down the following complex task into actionable steps:

Task: {{ task_description }}
Timeline: {{ timeline | default("Flexible") }}
Resources: {{ resources | default("Standard resources available") }}
Constraints: {{ constraints | default("None specified") }}

Provide:
1. Step-by-step breakdown
2. Time estimates for each step
3. Required resources and dependencies
4. Risk assessment and mitigation strategies
5. Success criteria""",
                description="Break down complex tasks into steps",
                required_vars=["task_description"],
                optional_vars=["timeline", "resources", "constraints"],
                category="planning",
                model_size=ModelSize.LARGE
            )
        ]

        for template in default_templates:
            self.templates[template.name] = template

    async def generate_completion(self, request: LLMRequest) -> LLMResponse:
        """Generate LLM completion with caching and error handling"""
        start_time = datetime.now()

        try:
            # Prepare prompt
            final_prompt = await self._prepare_prompt(request)

            # Check cache first
            if request.use_cache:
                cached_response = await self._get_cached_response(final_prompt, request.model_size)
                if cached_response:
                    return cached_response

            # Get model configuration
            config = self._get_model_config(request)

            # Generate completion
            response = await self._call_llm(final_prompt, config)

            # Calculate processing time
            processing_time = (datetime.now() - start_time).total_seconds()

            # Create response object
            llm_response = LLMResponse(
                content=response["content"],
                model=config.model,
                provider=config.provider.value,
                tokens_used=response.get("tokens_used", 0),
                cost_estimate=self._calculate_cost(response.get("tokens_used", 0), config.model),
                processing_time=processing_time,
                confidence_score=response.get("confidence_score"),
                metadata=response.get("metadata", {})
            )

            # Cache response
            if request.use_cache:
                await self._cache_response(final_prompt, request.model_size, llm_response, config.cache_ttl)

            return llm_response

        except Exception as e:
            logger.error(f"LLM completion failed: {e}")
            # Return fallback response
            return LLMResponse(
                content=f"I apologize, but I'm currently unable to process your request due to a technical issue: {str(e)}",
                model="fallback",
                provider="internal",
                tokens_used=0,
                cost_estimate=0.0,
                processing_time=(datetime.now() - start_time).total_seconds(),
                metadata={"error": str(e), "fallback": True}
            )

    async def _prepare_prompt(self, request: LLMRequest) -> str:
        """Prepare final prompt from template or direct text"""
        if request.template_name and request.template_name in self.templates:
            template = self.templates[request.template_name]
            jinja_template = self.jinja_env.from_string(template.template)
            return jinja_template.render(request.template_vars or {})

        return request.prompt

    def _get_model_config(self, request: LLMRequest) -> LLMConfig:
        """Get model configuration with request overrides"""
        config = self.model_configs[request.model_size]

        # Apply request overrides
        if request.temperature is not None:
            config.temperature = request.temperature
        if request.max_tokens is not None:
            config.max_tokens = request.max_tokens

        return config

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
    async def _call_llm(self, prompt: str, config: LLMConfig) -> Dict[str, Any]:
        """Call LLM API with retry logic"""
        if not self.openai_client:
            # Return mock response for testing
            return {
                "content": f"Mock LLM response for prompt: {prompt[:100]}...",
                "tokens_used": len(prompt.split()) * 2,
                "confidence_score": 0.85,
                "metadata": {"mock": True}
            }

        try:
            response = await self.openai_client.chat.completions.create(
                model=config.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=config.temperature,
                max_tokens=config.max_tokens,
                top_p=config.top_p,
                frequency_penalty=config.frequency_penalty,
                presence_penalty=config.presence_penalty,
                timeout=config.timeout
            )

            return {
                "content": response.choices[0].message.content,
                "tokens_used": response.usage.total_tokens,
                "confidence_score": self._calculate_confidence(response),
                "metadata": {
                    "model": response.model,
                    "finish_reason": response.choices[0].finish_reason,
                    "prompt_tokens": response.usage.prompt_tokens,
                    "completion_tokens": response.usage.completion_tokens
                }
            }

        except Exception as e:
            logger.error(f"OpenAI API call failed: {e}")
            raise

    def _calculate_confidence(self, response) -> float:
        """Calculate confidence score based on response characteristics"""
        # Simple heuristic - can be made more sophisticated
        finish_reason = response.choices[0].finish_reason
        content_length = len(response.choices[0].message.content)

        base_confidence = 0.8

        if finish_reason == "stop":
            base_confidence += 0.1
        elif finish_reason == "length":
            base_confidence -= 0.1

        if content_length > 100:
            base_confidence += 0.05

        return min(0.95, max(0.5, base_confidence))

    def _calculate_cost(self, tokens: int, model: str) -> float:
        """Calculate estimated cost based on token usage"""
        # Pricing per 1K tokens (approximate)
        pricing = {
            "gpt-3.5-turbo": 0.002,
            "gpt-4": 0.03,
            "gpt-4-turbo": 0.01,
            "gpt-4o": 0.005
        }

        cost_per_1k = pricing.get(model, 0.01)
        return (tokens / 1000) * cost_per_1k

    async def _get_cached_response(self, prompt: str, model_size: ModelSize) -> Optional[LLMResponse]:
        """Get cached response if available"""
        if not self.redis_client:
            return None

        try:
            cache_key = self._generate_cache_key(prompt, model_size)
            cached_data = self.redis_client.get(cache_key)

            if cached_data:
                data = json.loads(cached_data)
                response = LLMResponse(**data)
                response.cached = True
                logger.info(f"Cache hit for prompt hash: {cache_key[:16]}...")
                return response

        except Exception as e:
            logger.warning(f"Cache retrieval failed: {e}")

        return None

    async def _cache_response(self, prompt: str, model_size: ModelSize, response: LLMResponse, ttl: int):
        """Cache LLM response"""
        if not self.redis_client:
            return

        try:
            cache_key = self._generate_cache_key(prompt, model_size)
            response_data = response.model_dump()
            response_data["cached"] = False  # Don't cache the cached flag

            self.redis_client.setex(
                cache_key,
                ttl,
                json.dumps(response_data, default=str)
            )
            logger.info(f"Cached response for prompt hash: {cache_key[:16]}...")

        except Exception as e:
            logger.warning(f"Cache storage failed: {e}")

    def _generate_cache_key(self, prompt: str, model_size: ModelSize) -> str:
        """Generate cache key for prompt and model"""
        content = f"{prompt}:{model_size.value}"
        return f"llm_cache:{hashlib.md5(content.encode()).hexdigest()}"

    def add_template(self, template: PromptTemplate):
        """Add custom prompt template"""
        self.templates[template.name] = template
        logger.info(f"Added prompt template: {template.name}")

    def get_template(self, name: str) -> Optional[PromptTemplate]:
        """Get prompt template by name"""
        return self.templates.get(name)

    def list_templates(self, category: Optional[str] = None) -> List[PromptTemplate]:
        """List available templates, optionally filtered by category"""
        templates = list(self.templates.values())

        if category:
            templates = [t for t in templates if t.category == category]

        return templates

    async def get_model_info(self) -> Dict[str, Any]:
        """Get information about available models and configurations"""
        return {
            "providers": [provider.value for provider in ModelProvider],
            "model_sizes": [size.value for size in ModelSize],
            "configurations": {
                size.value: {
                    "model": config.model,
                    "provider": config.provider.value,
                    "max_tokens": config.max_tokens,
                    "cache_ttl": config.cache_ttl
                }
                for size, config in self.model_configs.items()
            },
            "template_count": len(self.templates),
            "cache_available": self.redis_client is not None,
            "openai_available": self.openai_client is not None
        }

    async def health_check(self) -> Dict[str, Any]:
        """Health check for LLM service"""
        health = {
            "service": "healthy",
            "openai_client": "available" if self.openai_client else "unavailable",
            "redis_cache": "unavailable",
            "templates_loaded": len(self.templates),
            "timestamp": datetime.now().isoformat()
        }

        # Check Redis health
        if self.redis_client:
            try:
                self.redis_client.ping()
                health["redis_cache"] = "available"
            except Exception:
                health["redis_cache"] = "error"

        return health

    async def generate_response(self, prompt: str, system_prompt: Optional[str] = None,
                              max_tokens: int = 2000, temperature: float = 0.7,
                              user_id: Optional[str] = None, model_size: ModelSize = ModelSize.MEDIUM,
                              use_cache: bool = True) -> Dict[str, Any]:
        """
        Generate LLM response - simplified interface for RAG and other services

        Args:
            prompt: The user prompt
            system_prompt: Optional system prompt
            max_tokens: Maximum tokens in response
            temperature: Response temperature (0.0-1.0)
            user_id: Optional user ID for tracking
            model_size: Model size to use
            use_cache: Whether to use caching

        Returns:
            Dictionary with response content and metadata
        """
        try:
            # Create LLM request
            request = LLMRequest(
                prompt=prompt,
                model_size=model_size,
                temperature=temperature,
                max_tokens=max_tokens,
                use_cache=use_cache
            )

            # Add system prompt if provided
            if system_prompt:
                request.prompt = f"System: {system_prompt}\n\nUser: {prompt}"

            # Generate completion
            response = await self.generate_completion(request)

            # Convert to dictionary format expected by RAG service
            return {
                "content": response.content,
                "model": response.model,
                "provider": response.provider,
                "tokens_used": response.tokens_used,
                "cost_estimate": response.cost_estimate,
                "cached": response.cached,
                "processing_time": response.processing_time,
                "confidence_score": response.confidence_score,
                "metadata": response.metadata
            }

        except Exception as e:
            logger.error(f"Failed to generate response: {e}")
            return {
                "content": "I apologize, but I encountered an error generating a response.",
                "model": "error",
                "provider": "unknown",
                "tokens_used": 0,
                "cost_estimate": 0.0,
                "cached": False,
                "processing_time": 0.0,
                "confidence_score": 0.0,
                "metadata": {"error": str(e)}
            }

    async def generate_streaming_response(self, prompt: str, system_prompt: Optional[str] = None,
                                        max_tokens: int = 2000, temperature: float = 0.7,
                                        user_id: Optional[str] = None,
                                        model_size: ModelSize = ModelSize.MEDIUM):
        """
        Generate streaming LLM response for real-time applications

        Args:
            prompt: The user prompt
            system_prompt: Optional system prompt
            max_tokens: Maximum tokens in response
            temperature: Response temperature
            user_id: Optional user ID for tracking
            model_size: Model size to use

        Yields:
            Chunks of the response as they are generated
        """
        try:
            # Create LLM request with streaming enabled
            request = LLMRequest(
                prompt=prompt,
                model_size=model_size,
                temperature=temperature,
                max_tokens=max_tokens,
                use_cache=False,  # Disable caching for streaming
                stream=True
            )

            # Add system prompt if provided
            if system_prompt:
                request.prompt = f"System: {system_prompt}\n\nUser: {prompt}"

            # Generate streaming completion
            async for chunk in self._generate_streaming_completion(request):
                yield chunk

        except Exception as e:
            logger.error(f"Failed to generate streaming response: {e}")
            yield f"Error: {str(e)}"

    async def _generate_streaming_completion(self, request: LLMRequest):
        """Generate streaming completion - internal method"""
        if not self.openai_client:
            yield "Error: OpenAI client not available"
            return

        config = self._get_model_config(request)
        final_prompt = await self._prepare_prompt(request)

        try:
            stream = await self.openai_client.chat.completions.create(
                model=config.model,
                messages=[{"role": "user", "content": final_prompt}],
                temperature=config.temperature,
                max_tokens=config.max_tokens,
                stream=True
            )

            async for chunk in stream:
                if chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content

        except Exception as e:
            logger.error(f"Streaming completion failed: {e}")
            yield f"Error: {str(e)}"

    async def analyze_sentiment(self, text: str, language: str = "en") -> Dict[str, Any]:
        """
        Analyze sentiment of text using LLM

        Args:
            text: Text to analyze
            language: Language code

        Returns:
            Sentiment analysis results
        """
        try:
            prompt_templates = {
                "en": "Analyze the sentiment of the following text and respond with JSON format: {{'sentiment': 'positive/negative/neutral', 'confidence': 0.0-1.0, 'emotions': ['emotion1', 'emotion2']}}\n\nText: {text}",
                "es": "Analiza el sentimiento del siguiente texto y responde en formato JSON: {{'sentiment': 'positivo/negativo/neutro', 'confidence': 0.0-1.0, 'emotions': ['emoción1', 'emoción2']}}\n\nTexto: {text}",
                "fr": "Analysez le sentiment du texte suivant et répondez au format JSON : {{'sentiment': 'positif/négatif/neutre', 'confidence': 0.0-1.0, 'emotions': ['émotion1', 'émotion2']}}\n\nTexte : {text}"
            }

            template = prompt_templates.get(language, prompt_templates["en"])
            prompt = template.format(text=text)

            response = await self.generate_response(
                prompt=prompt,
                max_tokens=200,
                temperature=0.1,
                model_size=ModelSize.SMALL
            )

            try:
                # Try to parse JSON response
                import json
                result = json.loads(response["content"])
                return result
            except:
                # Fallback if JSON parsing fails
                return {
                    "sentiment": "neutral",
                    "confidence": 0.5,
                    "emotions": [],
                    "raw_response": response["content"]
                }

        except Exception as e:
            logger.error(f"Sentiment analysis failed: {e}")
            return {
                "sentiment": "neutral",
                "confidence": 0.0,
                "emotions": [],
                "error": str(e)
            }

    async def extract_entities(self, text: str, entity_types: List[str] = None,
                              language: str = "en") -> Dict[str, Any]:
        """
        Extract entities from text using LLM

        Args:
            text: Text to analyze
            entity_types: List of entity types to extract
            language: Language code

        Returns:
            Entity extraction results
        """
        try:
            if entity_types is None:
                entity_types = ["PERSON", "ORGANIZATION", "LOCATION", "DATE", "MONEY"]

            prompt_templates = {
                "en": f"""Extract entities from the following text. Focus on these types: {', '.join(entity_types)}.
Respond in JSON format: {{'entities': [{{'text': 'entity text', 'type': 'entity type', 'confidence': 0.0-1.0}}]}}

Text: {text}""",
                "es": f"""Extrae entidades del siguiente texto. Enfócate en estos tipos: {', '.join(entity_types)}.
Responde en formato JSON: {{'entities': [{{'text': 'texto entidad', 'type': 'tipo entidad', 'confidence': 0.0-1.0}}]}}

Texto: {text}""",
                "fr": f"""Extrayez les entités du texte suivant. Concentrez-vous sur ces types : {', '.join(entity_types)}.
Répondez au format JSON : {{'entities': [{{'text': 'texte entité', 'type': 'type entité', 'confidence': 0.0-1.0}}]}}

Texte : {text}"""
            }

            template = prompt_templates.get(language, prompt_templates["en"])
            prompt = template

            response = await self.generate_response(
                prompt=prompt,
                max_tokens=500,
                temperature=0.1,
                model_size=ModelSize.MEDIUM
            )

            try:
                # Try to parse JSON response
                import json
                result = json.loads(response["content"])
                return result
            except:
                # Fallback if JSON parsing fails
                return {
                    "entities": [],
                    "raw_response": response["content"],
                    "error": "Failed to parse entity response"
                }

        except Exception as e:
            logger.error(f"Entity extraction failed: {e}")
            return {
                "entities": [],
                "error": str(e)
            }

# Global LLM service instance
llm_service = LLMService()