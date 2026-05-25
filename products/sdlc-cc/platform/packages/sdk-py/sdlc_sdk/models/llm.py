"""
LLM (Large Language Model) models for SDLC.ai SDK

Provides models for LLM operations including chat, completions, and embeddings.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any, Literal, Union
from pydantic import Field, validator

from .base import BaseModel, TimestampModel, ListResponseModel


class LLMMessage(BaseModel):
    """LLM message model."""

    role: Literal["system", "user", "assistant", "function"] = Field(
        ..., description="Message role"
    )
    content: str = Field(..., description="Message content")

    # Additional fields
    name: Optional[str] = Field(None, description="Sender name (for function messages)")
    function_call: Optional[Dict[str, Any]] = Field(
        None, description="Function call info"
    )

    # Metadata
    timestamp: Optional[datetime] = Field(None, description="Message timestamp")
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Message metadata"
    )

    @validator("content")
    def validate_content(cls, v, values):
        """Validate message content."""
        if not v or not v.strip():
            if values.get("role") != "function":
                raise ValueError("Message content cannot be empty")
        return v.strip()


class LLMUsage(BaseModel):
    """LLM usage statistics model."""

    # Token counts
    prompt_tokens: int = Field(0, description="Prompt tokens")
    completion_tokens: int = Field(0, description="Completion tokens")
    total_tokens: int = Field(0, description="Total tokens")

    # Cost information
    prompt_cost: float = Field(0.0, description="Prompt cost")
    completion_cost: float = Field(0.0, description="Completion cost")
    total_cost: float = Field(0.0, description="Total cost")

    @validator("total_tokens")
    def calculate_total_tokens(cls, v, values):
        """Calculate total tokens."""
        if "prompt_tokens" in values and "completion_tokens" in values:
            return values["prompt_tokens"] + values["completion_tokens"]
        return v

    @validator("total_cost")
    def calculate_total_cost(cls, v, values):
        """Calculate total cost."""
        if "prompt_cost" in values and "completion_cost" in values:
            return values["prompt_cost"] + values["completion_cost"]
        return v


class LLMChoice(BaseModel):
    """LLM response choice model."""

    index: int = Field(..., description="Choice index")
    message: LLMMessage = Field(..., description="Response message")

    # Quality metrics
    finish_reason: Optional[str] = Field(None, description="Finish reason")
    logprobs: Optional[Dict[str, Any]] = Field(None, description="Log probabilities")

    # Probability
    probability: Optional[float] = Field(None, description="Choice probability")


class LLMChatRequest(BaseModel):
    """LLM chat request model."""

    # Messages
    messages: List[LLMMessage] = Field(..., description="Conversation messages")

    # Model configuration
    model: str = Field("gpt-3.5-turbo", description="LLM model")
    temperature: float = Field(0.7, description="Sampling temperature")
    max_tokens: int = Field(1000, description="Maximum tokens to generate")

    # Generation options
    top_p: float = Field(1.0, description="Nucleus sampling parameter")
    frequency_penalty: float = Field(0.0, description="Frequency penalty")
    presence_penalty: float = Field(0.0, description="Presence penalty")

    # Response options
    n: int = Field(1, description="Number of choices to generate")
    stream: bool = Field(False, description="Stream response")

    # Stop conditions
    stop: Optional[Union[str, List[str]]] = Field(None, description="Stop sequences")

    # Functions
    functions: Optional[List[Dict[str, Any]]] = Field(
        None, description="Available functions"
    )
    function_call: Optional[Union[str, Dict[str, Any]]] = Field(
        None, description="Function call mode"
    )

    # Metadata
    user: Optional[str] = Field(None, description="User identifier")
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Request metadata"
    )

    @validator("messages")
    def validate_messages(cls, v):
        """Validate messages list."""
        if not v:
            raise ValueError("Messages list cannot be empty")

        # Check for system message at beginning
        if v[0].role != "system":
            # Add default system message
            v.insert(
                0, LLMMessage(role="system", content="You are a helpful assistant.")
            )

        return v

    @validator("temperature")
    def validate_temperature(cls, v):
        """Validate temperature."""
        if not 0 <= v <= 2:
            raise ValueError("Temperature must be between 0 and 2")
        return v


class LLMChatResponse(BaseModel):
    """LLM chat response model."""

    id: str = Field(..., description="Response ID")
    object: str = Field("chat.completion", description="Object type")
    created: int = Field(..., description="Creation timestamp")
    model: str = Field(..., description="Model used")

    # Choices
    choices: List[LLMChoice] = Field(..., description="Generated choices")

    # Usage
    usage: LLMUsage = Field(..., description="Token usage")

    # Metadata
    system_fingerprint: Optional[str] = Field(None, description="System fingerprint")
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Response metadata"
    )

    @property
    def first_choice(self) -> Optional[LLMChoice]:
        """Get first choice."""
        return self.choices[0] if self.choices else None

    @property
    def content(self) -> Optional[str]:
        """Get content of first choice."""
        return self.first_choice.message.content if self.first_choice else None


class LLMCompletionRequest(BaseModel):
    """LLM completion request model."""

    # Prompt
    prompt: Union[str, List[str]] = Field(..., description="Completion prompt")

    # Model configuration
    model: str = Field("text-davinci-003", description="LLM model")
    temperature: float = Field(0.7, description="Sampling temperature")
    max_tokens: int = Field(1000, description="Maximum tokens to generate")

    # Generation options
    top_p: float = Field(1.0, description="Nucleus sampling parameter")
    frequency_penalty: float = Field(0.0, description="Frequency penalty")
    presence_penalty: float = Field(0.0, description="Presence penalty")
    best_of: int = Field(1, description="Number of completions to generate")

    # Response options
    n: int = Field(1, description="Number of choices to generate")
    stream: bool = Field(False, description="Stream response")
    echo: bool = Field(False, description="Echo prompt in response")

    # Stop conditions
    stop: Optional[Union[str, List[str]]] = Field(None, description="Stop sequences")
    suffix: Optional[str] = Field(None, description="Suffix to append")

    # Metadata
    user: Optional[str] = Field(None, description="User identifier")
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Request metadata"
    )


class LLMCompletionResponse(BaseModel):
    """LLM completion response model."""

    id: str = Field(..., description="Response ID")
    object: str = Field("text.completion", description="Object type")
    created: int = Field(..., description="Creation timestamp")
    model: str = Field(..., description="Model used")

    # Choices
    choices: List[Dict[str, Any]] = Field(..., description="Generated choices")

    # Usage
    usage: LLMUsage = Field(..., description="Token usage")

    # Metadata
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Response metadata"
    )

    @property
    def text(self) -> str:
        """Get completion text."""
        return self.choices[0]["text"] if self.choices else ""


class LLMEmbeddingRequest(BaseModel):
    """LLM embedding request model."""

    # Input
    input: Union[str, List[str]] = Field(..., description="Text to embed")
    model: str = Field("text-embedding-ada-002", description="Embedding model")

    # Options
    user: Optional[str] = Field(None, description="User identifier")
    encoding_format: Literal["float", "base64"] = Field(
        "float", description="Encoding format"
    )

    # Metadata
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Request metadata"
    )

    @validator("input")
    def validate_input(cls, v):
        """Validate input text."""
        if isinstance(v, str):
            if not v.strip():
                raise ValueError("Input text cannot be empty")
        elif isinstance(v, list):
            if not v:
                raise ValueError("Input list cannot be empty")
            for text in v:
                if not text.strip():
                    raise ValueError("Input text cannot be empty")
        return v


class LLMEmbeddingResponse(BaseModel):
    """LLM embedding response model."""

    object: str = Field("list", description="Object type")
    data: List[Dict[str, Any]] = Field(..., description="Embedding data")
    model: str = Field(..., description="Model used")
    usage: LLMUsage = Field(..., description="Token usage")

    # Metadata
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Response metadata"
    )

    @property
    def embeddings(self) -> List[List[float]]:
        """Get embedding vectors."""
        return [item["embedding"] for item in self.data]


class LLMStreamChunk(BaseModel):
    """LLM streaming response chunk model."""

    id: str = Field(..., description="Chunk ID")
    object: str = Field("chat.completion.chunk", description="Object type")
    created: int = Field(..., description="Creation timestamp")
    model: str = Field(..., description="Model used")

    # Choices
    choices: List[Dict[str, Any]] = Field(..., description="Delta choices")

    # Metadata
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Chunk metadata")

    @property
    def delta(self) -> Optional[str]:
        """Get delta content."""
        if self.choices and "delta" in self.choices[0]:
            return self.choices[0]["delta"].get("content")
        return None

    @property
    def is_finished(self) -> bool:
        """Check if stream is finished."""
        if self.choices and "finish_reason" in self.choices[0]:
            return self.choices[0]["finish_reason"] is not None
        return False


class LLMFunction(BaseModel):
    """LLM function definition model."""

    name: str = Field(..., description="Function name")
    description: str = Field(..., description="Function description")
    parameters: Dict[str, Any] = Field(..., description="Function parameters schema")

    # Metadata
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Function metadata"
    )


class LLMToolCall(BaseModel):
    """LLM tool call model."""

    id: str = Field(..., description="Tool call ID")
    type: str = Field("function", description="Tool type")
    function: Dict[str, Any] = Field(..., description="Function call details")

    @property
    def function_name(self) -> str:
        """Get function name."""
        return self.function.get("name", "")

    @property
    def function_arguments(self) -> str:
        """Get function arguments."""
        return self.function.get("arguments", "{}")


class LLMAnalytics(BaseModel):
    """LLM usage analytics model."""

    tenant_id: str = Field(..., description="Tenant ID")
    period: str = Field(..., description="Analytics period")

    # Usage metrics
    total_requests: int = Field(0, description="Total requests")
    total_tokens: int = Field(0, description="Total tokens")
    total_cost: float = Field(0.0, description="Total cost")

    # Model breakdown
    model_usage: Dict[str, Dict[str, Any]] = Field(
        default_factory=dict, description="Usage by model"
    )

    # User breakdown
    user_usage: Dict[str, Dict[str, Any]] = Field(
        default_factory=dict, description="Usage by user"
    )

    # Performance metrics
    average_response_time_ms: float = Field(0.0, description="Average response time")
    error_rate: float = Field(0.0, description="Error rate")

    # Top queries
    top_queries: List[Dict[str, Any]] = Field(
        default_factory=list, description="Top queries"
    )

    # Timestamp
    generated_at: datetime = Field(..., description="Generation timestamp")
