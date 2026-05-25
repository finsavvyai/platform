"""Base provider interface for LLM backends."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, AsyncIterator, Dict, List, Optional


@dataclass
class ChatMessage:
    role: str
    content: str


@dataclass
class ChatRequest:
    messages: List[ChatMessage]
    model: str
    temperature: float = 0.7
    max_tokens: Optional[int] = None
    stream: bool = False
    top_p: float = 1.0
    stop: Optional[List[str]] = None
    tools: Optional[List[Dict[str, Any]]] = None
    tool_choice: Optional[str] = None


@dataclass
class ChatResponse:
    content: str
    model: str
    provider: str
    usage: Dict[str, int] = field(default_factory=dict)
    finish_reason: str = "stop"
    trace_id: str = ""


@dataclass
class StreamChunk:
    content: str
    finish_reason: Optional[str] = None


@dataclass
class ModelInfo:
    id: str
    provider: str
    owned_by: str = ""
    supports_streaming: bool = True
    supports_vision: bool = False
    supports_function_calling: bool = False
    context_length: int = 4096
    cost_tier: str = "standard"  # "free", "standard", "premium"


class BaseProvider(ABC):
    """Abstract base class for LLM providers."""

    name: str = "base"

    @abstractmethod
    async def chat(self, request: ChatRequest) -> ChatResponse:
        """Send a chat completion request."""
        ...

    @abstractmethod
    async def chat_stream(self, request: ChatRequest) -> AsyncIterator[StreamChunk]:
        """Send a streaming chat completion request."""
        ...

    @abstractmethod
    async def list_models(self) -> List[ModelInfo]:
        """List available models."""
        ...

    @abstractmethod
    async def health_check(self) -> bool:
        """Check if the provider is reachable."""
        ...
