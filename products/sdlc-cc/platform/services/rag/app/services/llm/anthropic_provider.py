"""
Anthropic LLM Provider Implementation.

This module provides integration with Anthropic's Claude API, supporting
Claude models and Anthropic-specific features.
"""

import json
import logging
import time
from typing import Any, Dict, List, Optional, AsyncGenerator

import anthropic
from anthropic import AsyncAnthropic
from anthropic.types import Message

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


# Anthropic model configurations
ANTHROPIC_MODELS = [
    ModelInfo(
        name="claude-3-opus-20240229",
        provider="anthropic",
        capabilities=[
            ModelCapability.TEXT_GENERATION,
            ModelCapability.CODE_GENERATION,
            ModelCapability.STREAMING,
            ModelCapability.VISION,
            ModelCapability.TOOL_USE,
        ],
        max_tokens=4096,
        input_cost_per_1k=0.015,
        output_cost_per_1k=0.075,
        context_window=200000,
        description="Most powerful Claude model for complex tasks",
        streaming_supported=True,
        function_calling_supported=True,
        vision_supported=True,
    ),
    ModelInfo(
        name="claude-3-sonnet-20240229",
        provider="anthropic",
        capabilities=[
            ModelCapability.TEXT_GENERATION,
            ModelCapability.CODE_GENERATION,
            ModelCapability.STREAMING,
            ModelCapability.VISION,
            ModelCapability.TOOL_USE,
        ],
        max_tokens=4096,
        input_cost_per_1k=0.003,
        output_cost_per_1k=0.015,
        context_window=200000,
        description="Balanced Claude model for most tasks",
        streaming_supported=True,
        function_calling_supported=True,
        vision_supported=True,
    ),
    ModelInfo(
        name="claude-3-haiku-20240307",
        provider="anthropic",
        capabilities=[
            ModelCapability.TEXT_GENERATION,
            ModelCapability.CODE_GENERATION,
            ModelCapability.STREAMING,
            ModelCapability.VISION,
        ],
        max_tokens=4096,
        input_cost_per_1k=0.00025,
        output_cost_per_1k=0.00125,
        context_window=200000,
        description="Fast and compact Claude model",
        streaming_supported=True,
        function_calling_supported=False,
        vision_supported=True,
    ),
    ModelInfo(
        name="claude-2.1",
        provider="anthropic",
        capabilities=[
            ModelCapability.TEXT_GENERATION,
            ModelCapability.CODE_GENERATION,
            ModelCapability.STREAMING,
        ],
        max_tokens=4096,
        input_cost_per_1k=0.008,
        output_cost_per_1k=0.024,
        context_window=200000,
        description="Previous generation Claude model",
        streaming_supported=True,
        function_calling_supported=False,
        vision_supported=False,
    ),
    ModelInfo(
        name="claude-2.0",
        provider="anthropic",
        capabilities=[
            ModelCapability.TEXT_GENERATION,
            ModelCapability.CODE_GENERATION,
            ModelCapability.STREAMING,
        ],
        max_tokens=4096,
        input_cost_per_1k=0.008,
        output_cost_per_1k=0.024,
        context_window=100000,
        description="Claude 2.0 model",
        streaming_supported=True,
        function_calling_supported=False,
        vision_supported=False,
    ),
    ModelInfo(
        name="claude-instant-1.2",
        provider="anthropic",
        capabilities=[
            ModelCapability.TEXT_GENERATION,
            ModelCapability.CODE_GENERATION,
            ModelCapability.STREAMING,
        ],
        max_tokens=4096,
        input_cost_per_1k=0.0008,
        output_cost_per_1k=0.0024,
        context_window=100000,
        description="Fast and cost-effective Claude model",
        streaming_supported=True,
        function_calling_supported=False,
        vision_supported=False,
    ),
]


class AnthropicProvider(BaseLLMProvider):
    """Anthropic Claude provider implementation."""

    def __init__(self, name: str = "anthropic", config: Dict[str, Any] = None):
        """Initialize Anthropic provider."""
        super().__init__(name, config or {})

        self.api_key = self.config.get("api_key")
        self.base_url = self.config.get("base_url")
        self.timeout = self.config.get("timeout", 30)
        self.max_retries = self.config.get("max_retries", 3)

        self._client: Optional[AsyncAnthropic] = None

        if not self.api_key:
            raise ValueError("Anthropic API key is required")

    @property
    def supported_models(self) -> List[ModelInfo]:
        """Get list of supported models."""
        return ANTHROPIC_MODELS

    @property
    def default_model(self) -> str:
        """Get default model name."""
        return "claude-3-sonnet-20240229"

    async def initialize(self) -> None:
        """Initialize Anthropic client."""
        try:
            self._client = AsyncAnthropic(
                api_key=self.api_key,
                base_url=self.base_url,
                timeout=self.timeout,
                max_retries=self.max_retries,
            )

            # Test connection with a simple request
            await self.health_check()
            logger.info(f"Anthropic provider '{self.name}' initialized successfully")

        except Exception as e:
            logger.error(f"Failed to initialize Anthropic provider: {e}")
            raise AuthenticationError(
                f"Anthropic authentication failed: {e}", provider=self.name
            )

    async def cleanup(self) -> None:
        """Clean up Anthropic client."""
        # Anthropic client doesn't have explicit cleanup
        self._client = None
        logger.info(f"Anthropic provider '{self.name}' cleaned up")

    async def health_check(self) -> ProviderStatus:
        """Check Anthropic API health."""
        try:
            if not self._client:
                await self.initialize()

            # Simple message as health check
            await self._client.messages.create(
                model=self.default_model,
                max_tokens=10,
                messages=[{"role": "user", "content": "Hi"}],
            )
            return ProviderStatus.HEALTHY

        except anthropic.AuthenticationError as e:
            logger.error(f"Anthropic authentication error: {e}")
            return ProviderStatus.ERROR

        except anthropic.RateLimitError as e:
            logger.warning(f"Anthropic rate limit error: {e}")
            return ProviderStatus.RATE_LIMITED

        except anthropic.APIConnectionError as e:
            logger.error(f"Anthropic connection error: {e}")
            return ProviderStatus.UNAVAILABLE

        except Exception as e:
            logger.error(f"Anthropic health check error: {e}")
            return ProviderStatus.ERROR

    async def get_models(self, force_refresh: bool = False) -> List[ModelInfo]:
        """Get available models from Anthropic."""
        # Anthropic doesn't have a models endpoint, so return predefined models
        # Check cache first
        current_time = time.time()
        if (
            not force_refresh
            and self._models_cache
            and self._models_cache_time
            and (current_time - self._models_cache_time) < self._models_cache_ttl
        ):
            return self._models_cache

        self._models_cache = ANTHROPIC_MODELS
        self._models_cache_time = current_time

        return ANTHROPIC_MODELS

    @retry_on_error(max_retries=3)
    async def complete(self, request: LLMRequest) -> LLMResponse:
        """Complete a chat request using Anthropic."""
        start_time = time.time()
        request_id = f"anthropic_{int(start_time * 1000)}"

        try:
            if not self._client:
                await self.initialize()

            await self.validate_request(request)

            # Convert messages to Anthropic format
            anthropic_messages, system_message = self._convert_messages_to_anthropic(
                request.messages
            )

            # Convert tools to Anthropic format
            tools = None
            if request.tools and self.supports_capability(
                ModelCapability.TOOL_USE, request.model
            ):
                tools = self._convert_tools_to_anthropic(request.tools)

            # Prepare request parameters
            message_params = {
                "model": request.model,
                "messages": anthropic_messages,
                "max_tokens": request.max_tokens or 1024,
                "temperature": request.temperature,
            }

            # Add system message if present
            if system_message:
                message_params["system"] = system_message

            # Add optional parameters
            if request.top_p:
                message_params["top_p"] = request.top_p
            if request.stop:
                message_params["stop_sequences"] = (
                    request.stop if isinstance(request.stop, list) else [request.stop]
                )
            if tools:
                message_params["tools"] = tools
                if request.tool_choice:
                    message_params["tool_choice"] = request.tool_choice

            # Make API call
            response: Message = await self._client.messages.create(**message_params)

            # Convert response
            llm_response = self._convert_response_from_anthropic(response, request)
            llm_response.request_id = request_id
            llm_response.provider = self.name

            # Update metrics
            response_time = time.time() - start_time
            tokens = response.usage.input_tokens + response.usage.output_tokens
            cost = self.calculate_cost(llm_response.usage, request.model)
            self.update_metrics(True, response_time, tokens, cost)

            return llm_response

        except anthropic.AuthenticationError as e:
            error = AuthenticationError(
                f"Anthropic authentication error: {e}", provider=self.name
            )
            self.update_metrics(False, time.time() - start_time)
            raise error

        except anthropic.RateLimitError as e:
            retry_after = None
            if hasattr(e, "response") and e.response:
                retry_after = e.response.headers.get("retry-after")
            error = RateLimitError(
                f"Anthropic rate limit error: {e}",
                provider=self.name,
                retry_after=int(retry_after) if retry_after else None,
            )
            self.update_metrics(False, time.time() - start_time)
            raise error

        except anthropic.NotFoundError as e:
            error = ModelNotFoundError(
                f"Anthropic model not found: {e}", provider=self.name
            )
            self.update_metrics(False, time.time() - start_time)
            raise error

        except anthropic.BadRequestError as e:
            error = InvalidRequestError(
                f"Anthropic invalid request: {e}", provider=self.name
            )
            self.update_metrics(False, time.time() - start_time)
            raise error

        except anthropic.APIConnectionError as e:
            error = APIConnectionError(
                f"Anthropic connection error: {e}", provider=self.name
            )
            self.update_metrics(False, time.time() - start_time)
            raise error

        except anthropic.APITimeoutError as e:
            error = TimeoutError(
                f"Anthropic timeout error: {e}",
                provider=self.name,
                timeout=self.timeout,
            )
            self.update_metrics(False, time.time() - start_time)
            raise error

        except Exception as e:
            error = ProviderError(f"Anthropic provider error: {e}", provider=self.name)
            self.update_metrics(False, time.time() - start_time)
            raise error

    @retry_on_error(max_retries=3)
    async def complete_stream(self, request: LLMRequest) -> AsyncGenerator[str, None]:
        """Complete a chat request with streaming."""
        start_time = time.time()
        f"anthropic_stream_{int(start_time * 1000)}"

        try:
            if not self._client:
                await self.initialize()

            await self.validate_request(request)

            # Convert messages to Anthropic format
            anthropic_messages, system_message = self._convert_messages_to_anthropic(
                request.messages
            )

            # Convert tools to Anthropic format
            tools = None
            if request.tools and self.supports_capability(
                ModelCapability.TOOL_USE, request.model
            ):
                tools = self._convert_tools_to_anthropic(request.tools)

            # Prepare request parameters
            message_params = {
                "model": request.model,
                "messages": anthropic_messages,
                "max_tokens": request.max_tokens or 1024,
                "temperature": request.temperature,
                "stream": True,
            }

            # Add system message if present
            if system_message:
                message_params["system"] = system_message

            # Add optional parameters
            if request.top_p:
                message_params["top_p"] = request.top_p
            if request.stop:
                message_params["stop_sequences"] = (
                    request.stop if isinstance(request.stop, list) else [request.stop]
                )
            if tools:
                message_params["tools"] = tools
                if request.tool_choice:
                    message_params["tool_choice"] = request.tool_choice

            # Make streaming API call
            stream = await self._client.messages.create(**message_params)

            full_content = ""
            async for event in stream:
                if event.type == "content_block_delta":
                    if hasattr(event.delta, "text"):
                        content = event.delta.text
                        full_content += content
                        yield content

            # Update metrics after stream completion
            response_time = time.time() - start_time
            tokens = self.estimate_tokens(full_content, request.model)
            cost = self._calculate_stream_cost(
                full_content, request.messages, request.model
            )
            self.update_metrics(True, response_time, tokens, cost)

        except anthropic.AuthenticationError as e:
            error = AuthenticationError(
                f"Anthropic authentication error: {e}", provider=self.name
            )
            self.update_metrics(False, time.time() - start_time)
            raise error

        except anthropic.RateLimitError as e:
            retry_after = None
            if hasattr(e, "response") and e.response:
                retry_after = e.response.headers.get("retry-after")
            error = RateLimitError(
                f"Anthropic rate limit error: {e}",
                provider=self.name,
                retry_after=int(retry_after) if retry_after else None,
            )
            self.update_metrics(False, time.time() - start_time)
            raise error

        except anthropic.NotFoundError as e:
            error = ModelNotFoundError(
                f"Anthropic model not found: {e}", provider=self.name
            )
            self.update_metrics(False, time.time() - start_time)
            raise error

        except anthropic.BadRequestError as e:
            error = InvalidRequestError(
                f"Anthropic invalid request: {e}", provider=self.name
            )
            self.update_metrics(False, time.time() - start_time)
            raise error

        except anthropic.APIConnectionError as e:
            error = APIConnectionError(
                f"Anthropic connection error: {e}", provider=self.name
            )
            self.update_metrics(False, time.time() - start_time)
            raise error

        except anthropic.APITimeoutError as e:
            error = TimeoutError(
                f"Anthropic timeout error: {e}",
                provider=self.name,
                timeout=self.timeout,
            )
            self.update_metrics(False, time.time() - start_time)
            raise error

        except Exception as e:
            error = ProviderError(f"Anthropic provider error: {e}", provider=self.name)
            self.update_metrics(False, time.time() - start_time)
            raise error

    def estimate_tokens(self, text: str, model: str = None) -> int:
        """Estimate token count for text."""
        # Anthropic uses a similar tokenizer to GPT models
        # Rough estimate: 1 token ≈ 4 characters for English
        # For more accurate estimation, you might want to use a proper tokenizer
        return len(text) // 4

    def calculate_cost(self, usage: TokenUsage, model: str) -> float:
        """Calculate cost for token usage."""
        model_info = self.get_model_info(model)
        if not model_info:
            return 0.0

        input_cost = (usage.prompt_tokens / 1000) * model_info.input_cost_per_1k
        output_cost = (usage.completion_tokens / 1000) * model_info.output_cost_per_1k

        return input_cost + output_cost

    def _convert_messages_to_anthropic(
        self, messages: List[LLMMessage]
    ) -> tuple[List[Dict[str, Any]], Optional[str]]:
        """Convert LLM messages to Anthropic format."""
        anthropic_messages = []
        system_message = None

        for message in messages:
            if message.role == MessageRole.SYSTEM:
                system_message = message.content
            elif message.role == MessageRole.USER:
                anthropic_messages.append(
                    {
                        "role": "user",
                        "content": message.content,
                    }
                )
            elif message.role == MessageRole.ASSISTANT:
                anthropic_messages.append(
                    {
                        "role": "assistant",
                        "content": message.content,
                    }
                )
            # Anthropic doesn't support function/tool roles in the same way

        return anthropic_messages, system_message

    def _convert_tools_to_anthropic(self, tools: List[LLMTool]) -> List[Dict[str, Any]]:
        """Convert LLM tools to Anthropic format."""
        anthropic_tools = []

        for tool in tools:
            anthropic_tool = {
                "name": tool.name,
                "description": tool.description,
                "input_schema": tool.parameters,
            }
            anthropic_tools.append(anthropic_tool)

        return anthropic_tools

    def _convert_response_from_anthropic(
        self, response: Message, request: LLMRequest
    ) -> LLMResponse:
        """Convert Anthropic response to LLM response."""
        # Convert choices
        choices = []

        for content in response.content:
            if content.type == "text":
                choice_data = {
                    "index": 0,
                    "finish_reason": response.stop_reason,
                    "message": {
                        "role": "assistant",
                        "content": content.text,
                    },
                }
                choices.append(choice_data)
            elif content.type == "tool_use":
                # Handle tool use responses
                choice_data = {
                    "index": 0,
                    "finish_reason": response.stop_reason,
                    "message": {
                        "role": "assistant",
                        "content": None,
                        "tool_calls": [
                            {
                                "id": content.id,
                                "type": "function",
                                "function": {
                                    "name": content.name,
                                    "arguments": json.dumps(content.input),
                                },
                            }
                        ],
                    },
                }
                choices.append(choice_data)

        # Convert usage
        usage = TokenUsage()
        if response.usage:
            usage.prompt_tokens = response.usage.input_tokens
            usage.completion_tokens = response.usage.output_tokens
            usage.total_tokens = (
                response.usage.input_tokens + response.usage.output_tokens
            )

        return LLMResponse(
            id=response.id,
            object="chat.completion",
            created=int(time.time()),
            model=response.model,
            choices=choices,
            usage=usage,
            finish_reason=response.stop_reason,
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


# Register the provider
ProviderFactory.register("anthropic", AnthropicProvider)
