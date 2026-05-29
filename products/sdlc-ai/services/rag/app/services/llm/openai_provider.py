"""
OpenAI LLM Provider Implementation.

This module provides integration with OpenAI's API, supporting GPT models,
embeddings, and various OpenAI-specific features.
"""

import asyncio
import json
import logging
import time
from datetime import datetime
from typing import Any, Dict, List, Optional, AsyncGenerator, Union

import openai
from openai import AsyncOpenAI
from openai.types.chat import ChatCompletion, ChatCompletionChunk
import tiktoken

from .base_provider import (
    BaseLLMProvider,
    LLMRequest,
    LLMResponse,
    LLMMessage,
    LLMTool,
    TokenUsage,
    ModelInfo,
    ModelCapability,
    MessageRole,
    ProviderStatus,
    ProviderError,
    RateLimitError,
    ModelNotFoundError,
    AuthenticationError,
    InvalidRequestError,
    APIConnectionError,
    TimeoutError,
    retry_on_error,
    ProviderFactory,
)

logger = logging.getLogger(__name__)


# OpenAI model configurations
OPENAI_MODELS = [
    ModelInfo(
        name="gpt-4-turbo-preview",
        provider="openai",
        capabilities=[
            ModelCapability.TEXT_GENERATION,
            ModelCapability.CODE_GENERATION,
            ModelCapability.STREAMING,
            ModelCapability.FUNCTION_CALLING,
            ModelCapability.VISION,
            ModelCapability.TOOL_USE,
        ],
        max_tokens=4096,
        input_cost_per_1k=0.01,
        output_cost_per_1k=0.03,
        context_window=128000,
        description="Most capable GPT-4 model, optimized for chat",
        streaming_supported=True,
        function_calling_supported=True,
        vision_supported=True,
    ),
    ModelInfo(
        name="gpt-4",
        provider="openai",
        capabilities=[
            ModelCapability.TEXT_GENERATION,
            ModelCapability.CODE_GENERATION,
            ModelCapability.STREAMING,
            ModelCapability.FUNCTION_CALLING,
            ModelCapability.TOOL_USE,
        ],
        max_tokens=4096,
        input_cost_per_1k=0.03,
        output_cost_per_1k=0.06,
        context_window=8192,
        description="GPT-4 model for complex tasks",
        streaming_supported=True,
        function_calling_supported=True,
        vision_supported=False,
    ),
    ModelInfo(
        name="gpt-3.5-turbo",
        provider="openai",
        capabilities=[
            ModelCapability.TEXT_GENERATION,
            ModelCapability.CODE_GENERATION,
            ModelCapability.STREAMING,
            ModelCapability.FUNCTION_CALLING,
            ModelCapability.TOOL_USE,
        ],
        max_tokens=4096,
        input_cost_per_1k=0.0015,
        output_cost_per_1k=0.002,
        context_window=16385,
        description="Fast and efficient model for most tasks",
        streaming_supported=True,
        function_calling_supported=True,
        vision_supported=False,
    ),
    ModelInfo(
        name="gpt-3.5-turbo-16k",
        provider="openai",
        capabilities=[
            ModelCapability.TEXT_GENERATION,
            ModelCapability.CODE_GENERATION,
            ModelCapability.STREAMING,
            ModelCapability.FUNCTION_CALLING,
            ModelCapability.TOOL_USE,
        ],
        max_tokens=4096,
        input_cost_per_1k=0.003,
        output_cost_per_1k=0.004,
        context_window=16385,
        description="GPT-3.5 with 16K context window",
        streaming_supported=True,
        function_calling_supported=True,
        vision_supported=False,
    ),
    ModelInfo(
        name="text-embedding-ada-002",
        provider="openai",
        capabilities=[ModelCapability.EMBEDDINGS],
        max_tokens=8191,
        input_cost_per_1k=0.0001,
        output_cost_per_1k=0.0,
        context_window=8191,
        description="Text embedding model",
        streaming_supported=False,
        function_calling_supported=False,
        vision_supported=False,
    ),
    ModelInfo(
        name="text-embedding-3-small",
        provider="openai",
        capabilities=[ModelCapability.EMBEDDINGS],
        max_tokens=8191,
        input_cost_per_1k=0.00002,
        output_cost_per_1k=0.0,
        context_window=8191,
        description="Smaller embedding model",
        streaming_supported=False,
        function_calling_supported=False,
        vision_supported=False,
    ),
    ModelInfo(
        name="text-embedding-3-large",
        provider="openai",
        capabilities=[ModelCapability.EMBEDDINGS],
        max_tokens=8191,
        input_cost_per_1k=0.00013,
        output_cost_per_1k=0.0,
        context_window=8191,
        description="Larger embedding model",
        streaming_supported=False,
        function_calling_supported=False,
        vision_supported=False,
    ),
]


class OpenAIProvider(BaseLLMProvider):
    """OpenAI LLM provider implementation."""

    def __init__(self, name: str = "openai", config: Dict[str, Any] = None):
        """Initialize OpenAI provider."""
        super().__init__(name, config or {})

        self.api_key = self.config.get("api_key")
        self.organization = self.config.get("organization")
        self.base_url = self.config.get("base_url")
        self.timeout = self.config.get("timeout", 30)
        self.max_retries = self.config.get("max_retries", 3)

        self._client: Optional[AsyncOpenAI] = None
        self._tokenizers: Dict[str, tiktoken.Encoding] = {}

        if not self.api_key:
            raise ValueError("OpenAI API key is required")

    @property
    def supported_models(self) -> List[ModelInfo]:
        """Get list of supported models."""
        return OPENAI_MODELS

    @property
    def default_model(self) -> str:
        """Get default model name."""
        return "gpt-3.5-turbo"

    async def initialize(self) -> None:
        """Initialize OpenAI client."""
        try:
            self._client = AsyncOpenAI(
                api_key=self.api_key,
                organization=self.organization,
                base_url=self.base_url,
                timeout=self.timeout,
                max_retries=self.max_retries,
            )

            # Test connection with a simple request
            await self.health_check()
            logger.info(f"OpenAI provider '{self.name}' initialized successfully")

        except Exception as e:
            logger.error(f"Failed to initialize OpenAI provider: {e}")
            raise AuthenticationError(
                f"OpenAI authentication failed: {e}", provider=self.name
            )

    async def cleanup(self) -> None:
        """Clean up OpenAI client."""
        if self._client:
            await self._client.close()
            self._client = None
        logger.info(f"OpenAI provider '{self.name}' cleaned up")

    async def health_check(self) -> ProviderStatus:
        """Check OpenAI API health."""
        try:
            if not self._client:
                await self.initialize()

            # Simple models list request as health check
            await self._client.models.list()
            return ProviderStatus.HEALTHY

        except openai.AuthenticationError as e:
            logger.error(f"OpenAI authentication error: {e}")
            return ProviderStatus.ERROR

        except openai.RateLimitError as e:
            logger.warning(f"OpenAI rate limit error: {e}")
            return ProviderStatus.RATE_LIMITED

        except openai.APIConnectionError as e:
            logger.error(f"OpenAI connection error: {e}")
            return ProviderStatus.UNAVAILABLE

        except Exception as e:
            logger.error(f"OpenAI health check error: {e}")
            return ProviderStatus.ERROR

    async def get_models(self, force_refresh: bool = False) -> List[ModelInfo]:
        """Get available models from OpenAI."""
        # Check cache first
        current_time = time.time()
        if (
            not force_refresh
            and self._models_cache
            and self._models_cache_time
            and (current_time - self._models_cache_time) < self._models_cache_ttl
        ):
            return self._models_cache

        try:
            if not self._client:
                await self.initialize()

            # Fetch models from OpenAI API
            response = await self._client.models.list()

            # Filter and map to our ModelInfo format
            available_models = []
            api_models = {model.id for model in response.data}

            for model_info in OPENAI_MODELS:
                if model_info.name in api_models:
                    available_models.append(model_info)

            self._models_cache = available_models
            self._models_cache_time = current_time

            return available_models

        except Exception as e:
            logger.error(f"Failed to fetch OpenAI models: {e}")
            # Return cached models if available
            return self._models_cache or OPENAI_MODELS

    @retry_on_error(max_retries=3)
    async def complete(self, request: LLMRequest) -> LLMResponse:
        """Complete a chat request using OpenAI."""
        start_time = time.time()
        request_id = f"openai_{int(start_time * 1000)}"

        try:
            if not self._client:
                await self.initialize()

            await self.validate_request(request)

            # Convert messages to OpenAI format
            openai_messages = self._convert_messages_to_openai(request.messages)

            # Convert tools to OpenAI format
            tools = None
            tool_choice = None
            if request.tools:
                tools = self._convert_tools_to_openai(request.tools)
                tool_choice = request.tool_choice

            # Prepare request parameters
            completion_params = {
                "model": request.model,
                "messages": openai_messages,
                "temperature": request.temperature,
                "stream": False,
                "user": request.user,
            }

            # Add optional parameters
            if request.max_tokens:
                completion_params["max_tokens"] = request.max_tokens
            if request.top_p:
                completion_params["top_p"] = request.top_p
            if request.frequency_penalty:
                completion_params["frequency_penalty"] = request.frequency_penalty
            if request.presence_penalty:
                completion_params["presence_penalty"] = request.presence_penalty
            if request.stop:
                completion_params["stop"] = request.stop
            if tools:
                completion_params["tools"] = tools
                completion_params["tool_choice"] = tool_choice or "auto"

            # Make API call
            response: ChatCompletion = await self._client.chat.completions.create(
                **completion_params
            )

            # Convert response
            llm_response = self._convert_response_from_openai(response, request)
            llm_response.request_id = request_id
            llm_response.provider = self.name

            # Update metrics
            response_time = time.time() - start_time
            tokens = response.usage.total_tokens if response.usage else 0
            cost = self.calculate_cost(llm_response.usage, request.model)
            self.update_metrics(True, response_time, tokens, cost)

            return llm_response

        except openai.AuthenticationError as e:
            error = AuthenticationError(
                f"OpenAI authentication error: {e}", provider=self.name
            )
            self.update_metrics(False, time.time() - start_time)
            raise error

        except openai.RateLimitError as e:
            retry_after = None
            if hasattr(e, "response") and e.response:
                retry_after = e.response.headers.get("retry-after")
            error = RateLimitError(
                f"OpenAI rate limit error: {e}",
                provider=self.name,
                retry_after=int(retry_after) if retry_after else None,
            )
            self.update_metrics(False, time.time() - start_time)
            raise error

        except openai.NotFoundError as e:
            error = ModelNotFoundError(
                f"OpenAI model not found: {e}", provider=self.name
            )
            self.update_metrics(False, time.time() - start_time)
            raise error

        except openai.BadRequestError as e:
            error = InvalidRequestError(
                f"OpenAI invalid request: {e}", provider=self.name
            )
            self.update_metrics(False, time.time() - start_time)
            raise error

        except openai.APIConnectionError as e:
            error = APIConnectionError(
                f"OpenAI connection error: {e}", provider=self.name
            )
            self.update_metrics(False, time.time() - start_time)
            raise error

        except openai.APITimeoutError as e:
            error = TimeoutError(
                f"OpenAI timeout error: {e}", provider=self.name, timeout=self.timeout
            )
            self.update_metrics(False, time.time() - start_time)
            raise error

        except Exception as e:
            error = ProviderError(f"OpenAI provider error: {e}", provider=self.name)
            self.update_metrics(False, time.time() - start_time)
            raise error

    @retry_on_error(max_retries=3)
    async def complete_stream(self, request: LLMRequest) -> AsyncGenerator[str, None]:
        """Complete a chat request with streaming."""
        start_time = time.time()
        request_id = f"openai_stream_{int(start_time * 1000)}"

        try:
            if not self._client:
                await self.initialize()

            await self.validate_request(request)

            # Convert messages to OpenAI format
            openai_messages = self._convert_messages_to_openai(request.messages)

            # Convert tools to OpenAI format
            tools = None
            tool_choice = None
            if request.tools:
                tools = self._convert_tools_to_openai(request.tools)
                tool_choice = request.tool_choice

            # Prepare request parameters
            completion_params = {
                "model": request.model,
                "messages": openai_messages,
                "temperature": request.temperature,
                "stream": True,
                "user": request.user,
            }

            # Add optional parameters
            if request.max_tokens:
                completion_params["max_tokens"] = request.max_tokens
            if request.top_p:
                completion_params["top_p"] = request.top_p
            if request.frequency_penalty:
                completion_params["frequency_penalty"] = request.frequency_penalty
            if request.presence_penalty:
                completion_params["presence_penalty"] = request.presence_penalty
            if request.stop:
                completion_params["stop"] = request.stop
            if tools:
                completion_params["tools"] = tools
                completion_params["tool_choice"] = tool_choice or "auto"

            # Make streaming API call
            stream = await self._client.chat.completions.create(**completion_params)

            full_content = ""
            async for chunk in stream:
                if chunk.choices:
                    choice = chunk.choices[0]
                    if choice.delta.content:
                        content = choice.delta.content
                        full_content += content
                        yield content

            # Update metrics after stream completion
            response_time = time.time() - start_time
            tokens = self.estimate_tokens(full_content, request.model)
            cost = self._calculate_stream_cost(
                full_content, request.messages, request.model
            )
            self.update_metrics(True, response_time, tokens, cost)

        except openai.AuthenticationError as e:
            error = AuthenticationError(
                f"OpenAI authentication error: {e}", provider=self.name
            )
            self.update_metrics(False, time.time() - start_time)
            raise error

        except openai.RateLimitError as e:
            retry_after = None
            if hasattr(e, "response") and e.response:
                retry_after = e.response.headers.get("retry-after")
            error = RateLimitError(
                f"OpenAI rate limit error: {e}",
                provider=self.name,
                retry_after=int(retry_after) if retry_after else None,
            )
            self.update_metrics(False, time.time() - start_time)
            raise error

        except openai.NotFoundError as e:
            error = ModelNotFoundError(
                f"OpenAI model not found: {e}", provider=self.name
            )
            self.update_metrics(False, time.time() - start_time)
            raise error

        except openai.BadRequestError as e:
            error = InvalidRequestError(
                f"OpenAI invalid request: {e}", provider=self.name
            )
            self.update_metrics(False, time.time() - start_time)
            raise error

        except openai.APIConnectionError as e:
            error = APIConnectionError(
                f"OpenAI connection error: {e}", provider=self.name
            )
            self.update_metrics(False, time.time() - start_time)
            raise error

        except openai.APITimeoutError as e:
            error = TimeoutError(
                f"OpenAI timeout error: {e}", provider=self.name, timeout=self.timeout
            )
            self.update_metrics(False, time.time() - start_time)
            raise error

        except Exception as e:
            error = ProviderError(f"OpenAI provider error: {e}", provider=self.name)
            self.update_metrics(False, time.time() - start_time)
            raise error

    def estimate_tokens(self, text: str, model: str = None) -> int:
        """Estimate token count using tiktoken."""
        try:
            # Get tokenizer for model
            tokenizer = self._get_tokenizer(model or self.default_model)
            return len(tokenizer.encode(text))
        except Exception as e:
            logger.warning(f"Token estimation failed: {e}, using rough estimate")
            # Rough estimate: 1 token ≈ 4 characters for English
            return len(text) // 4

    def calculate_cost(self, usage: TokenUsage, model: str) -> float:
        """Calculate cost for token usage."""
        model_info = self.get_model_info(model)
        if not model_info:
            return 0.0

        input_cost = (usage.prompt_tokens / 1000) * model_info.input_cost_per_1k
        output_cost = (usage.completion_tokens / 1000) * model_info.output_cost_per_1k

        return input_cost + output_cost

    def _get_tokenizer(self, model: str) -> tiktoken.Encoding:
        """Get tiktoken tokenizer for model."""
        if model not in self._tokenizers:
            # Determine encoding based on model
            if model.startswith("gpt-4"):
                encoding_name = "cl100k_base"
            elif model.startswith("gpt-3.5"):
                encoding_name = "cl100k_base"
            else:
                # Default encoding
                encoding_name = "cl100k_base"

            try:
                self._tokenizers[model] = tiktoken.get_encoding(encoding_name)
            except KeyError:
                # Fallback to default encoding
                self._tokenizers[model] = tiktoken.get_encoding("cl100k_base")

        return self._tokenizers[model]

    def _convert_messages_to_openai(
        self, messages: List[LLMMessage]
    ) -> List[Dict[str, Any]]:
        """Convert LLM messages to OpenAI format."""
        openai_messages = []

        for message in messages:
            openai_message = {
                "role": message.role.value,
                "content": message.content,
            }

            if message.name:
                openai_message["name"] = message.name

            if message.function_call:
                openai_message["function_call"] = message.function_call

            if message.tool_calls:
                openai_message["tool_calls"] = message.tool_calls

            if message.tool_call_id:
                openai_message["tool_call_id"] = message.tool_call_id

            openai_messages.append(openai_message)

        return openai_messages

    def _convert_tools_to_openai(self, tools: List[LLMTool]) -> List[Dict[str, Any]]:
        """Convert LLM tools to OpenAI format."""
        openai_tools = []

        for tool in tools:
            openai_tool = {
                "type": "function",
                "function": {
                    "name": tool.name,
                    "description": tool.description,
                    "parameters": tool.parameters,
                },
            }
            openai_tools.append(openai_tool)

        return openai_tools

    def _convert_response_from_openai(
        self, response: ChatCompletion, request: LLMRequest
    ) -> LLMResponse:
        """Convert OpenAI response to LLM response."""
        # Convert choices
        choices = []
        for choice in response.choices:
            choice_data = {
                "index": choice.index,
                "finish_reason": choice.finish_reason,
            }

            if choice.message:
                message_data = {
                    "role": choice.message.role,
                    "content": choice.message.content,
                }

                if choice.message.function_call:
                    message_data["function_call"] = choice.message.function_call

                if choice.message.tool_calls:
                    message_data["tool_calls"] = choice.message.tool_calls

                choice_data["message"] = message_data

            choices.append(choice_data)

        # Convert usage
        usage = TokenUsage()
        if response.usage:
            usage.prompt_tokens = response.usage.prompt_tokens
            usage.completion_tokens = response.usage.completion_tokens
            usage.total_tokens = response.usage.total_tokens

        return LLMResponse(
            id=response.id,
            object=response.object,
            created=response.created,
            model=response.model,
            choices=choices,
            usage=usage,
            finish_reason=choices[0]["finish_reason"] if choices else None,
        )

    def _calculate_stream_cost(
        self, response_content: str, messages: List[LLMMessage], model: str
    ) -> float:
        """Calculate cost for streaming response."""
        # Estimate input tokens
        input_text = "\n".join([msg.content for msg in messages])
        input_tokens = self.estimate_tokens(input_text, model)

        # Estimate output tokens
        output_tokens = self.estimate_tokens(response_content, model)

        # Calculate cost
        model_info = self.get_model_info(model)
        if not model_info:
            return 0.0

        input_cost = (input_tokens / 1000) * model_info.input_cost_per_1k
        output_cost = (output_tokens / 1000) * model_info.output_cost_per_1k

        return input_cost + output_cost

    async def create_embedding(
        self, texts: Union[str, List[str]], model: str = "text-embedding-ada-002"
    ) -> List[List[float]]:
        """Create embeddings for texts."""
        try:
            if not self._client:
                await self.initialize()

            # Normalize input
            if isinstance(texts, str):
                texts = [texts]

            response = await self._client.embeddings.create(model=model, input=texts)

            return [data.embedding for data in response.data]

        except Exception as e:
            logger.error(f"Failed to create embeddings: {e}")
            raise ProviderError(f"Embedding creation failed: {e}", provider=self.name)


# Register the provider
ProviderFactory.register("openai", OpenAIProvider)
