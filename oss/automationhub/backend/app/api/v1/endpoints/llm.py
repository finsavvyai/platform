"""
LLM API Endpoints
Provides REST API access to the LLM service functionality
"""

from typing import Dict, List, Optional, Any
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, Field

from app.services.llm_service import (
    llm_service,
    LLMRequest,
    LLMResponse,
    PromptTemplate,
    ModelSize,
    ModelProvider
)

router = APIRouter()

class TemplateCreateRequest(BaseModel):
    """Request model for creating custom templates"""
    name: str
    template: str
    description: str
    required_vars: List[str]
    optional_vars: List[str] = Field(default_factory=list)
    category: str = "custom"
    model_size: ModelSize = ModelSize.MEDIUM

class BatchLLMRequest(BaseModel):
    """Request model for batch LLM processing"""
    requests: List[LLMRequest]
    max_concurrent: int = Field(default=3, ge=1, le=10)

class ModelUsageStats(BaseModel):
    """Model usage statistics"""
    total_requests: int
    total_tokens: int
    total_cost: float
    avg_response_time: float
    cache_hit_rate: float

@router.post("/generate", response_model=LLMResponse)
async def generate_completion(request: LLMRequest):
    """
    Generate LLM completion with template support and caching

    This endpoint provides access to various LLM models with:
    - Template-based prompt generation
    - Automatic caching for cost optimization
    - Multiple model sizes for different use cases
    - Error handling and fallback responses
    """
    try:
        response = await llm_service.generate_completion(request)
        return response

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"LLM generation failed: {str(e)}"
        )

@router.post("/generate/batch", response_model=List[LLMResponse])
async def generate_batch_completions(request: BatchLLMRequest):
    """
    Generate multiple LLM completions concurrently

    Processes multiple requests in parallel with configurable concurrency
    to optimize throughput while respecting API rate limits.
    """
    import asyncio
    from asyncio import Semaphore

    try:
        # Use semaphore to limit concurrent requests
        semaphore = Semaphore(request.max_concurrent)

        async def generate_with_semaphore(llm_request: LLMRequest):
            async with semaphore:
                return await llm_service.generate_completion(llm_request)

        # Execute all requests concurrently
        tasks = [generate_with_semaphore(req) for req in request.requests]
        responses = await asyncio.gather(*tasks, return_exceptions=True)

        # Handle any exceptions in responses
        processed_responses = []
        for i, response in enumerate(responses):
            if isinstance(response, Exception):
                # Create error response
                processed_responses.append(LLMResponse(
                    content=f"Request {i+1} failed: {str(response)}",
                    model="error",
                    provider="internal",
                    tokens_used=0,
                    cost_estimate=0.0,
                    processing_time=0.0,
                    metadata={"error": True, "batch_index": i}
                ))
            else:
                processed_responses.append(response)

        return processed_responses

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Batch generation failed: {str(e)}"
        )

@router.get("/templates", response_model=List[PromptTemplate])
async def list_templates(category: Optional[str] = None):
    """
    List available prompt templates

    Optionally filter by category to find templates for specific use cases.
    """
    try:
        templates = llm_service.list_templates(category)
        return templates

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list templates: {str(e)}"
        )

@router.get("/templates/{template_name}", response_model=PromptTemplate)
async def get_template(template_name: str):
    """
    Get specific prompt template by name
    """
    try:
        template = llm_service.get_template(template_name)
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Template '{template_name}' not found"
            )
        return template

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get template: {str(e)}"
        )

@router.post("/templates", response_model=Dict[str, str])
async def create_template(request: TemplateCreateRequest):
    """
    Create custom prompt template

    Allows users to define reusable prompt templates with variable substitution
    for common use cases and standardized workflows.
    """
    try:
        # Check if template already exists
        existing = llm_service.get_template(request.name)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Template '{request.name}' already exists"
            )

        # Create new template
        template = PromptTemplate(
            name=request.name,
            template=request.template,
            description=request.description,
            required_vars=request.required_vars,
            optional_vars=request.optional_vars,
            category=request.category,
            model_size=request.model_size
        )

        llm_service.add_template(template)

        return {
            "message": f"Template '{request.name}' created successfully",
            "template_name": request.name
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create template: {str(e)}"
        )

@router.get("/models", response_model=Dict[str, Any])
async def get_model_info():
    """
    Get information about available models and configurations

    Provides details about supported providers, model sizes,
    and current service configuration.
    """
    try:
        info = await llm_service.get_model_info()
        return info

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get model info: {str(e)}"
        )

@router.get("/health", response_model=Dict[str, Any])
async def health_check():
    """
    Health check for LLM service

    Verifies service status, external API availability,
    and cache connectivity.
    """
    try:
        health = await llm_service.health_check()
        return health

    except Exception as e:
        return {
            "service": "unhealthy",
            "error": str(e),
            "timestamp": "unknown"
        }

@router.post("/chat", response_model=LLMResponse)
async def chat_completion(
    message: str,
    context: Optional[str] = None,
    experience_level: Optional[str] = "intermediate",
    model_size: ModelSize = ModelSize.MEDIUM
):
    """
    Simple chat completion endpoint

    Provides a convenient interface for natural conversation
    using the built-in conversation template.
    """
    try:
        request = LLMRequest(
            prompt="",  # Will be filled by template
            template_name="natural_conversation",
            template_vars={
                "user_query": message,
                "context": context,
                "experience_level": experience_level
            },
            model_size=model_size
        )

        response = await llm_service.generate_completion(request)
        return response

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Chat completion failed: {str(e)}"
        )

@router.post("/code-assist", response_model=LLMResponse)
async def code_assistance(
    language: str,
    requirements: str,
    context: Optional[str] = None,
    examples: Optional[str] = None,
    model_size: ModelSize = ModelSize.MEDIUM
):
    """
    Code generation assistance endpoint

    Uses the code generation template to provide programming assistance
    with language-specific best practices and error handling.
    """
    try:
        request = LLMRequest(
            prompt="",
            template_name="code_generation",
            template_vars={
                "language": language,
                "requirements": requirements,
                "context": context,
                "examples": examples
            },
            model_size=model_size
        )

        response = await llm_service.generate_completion(request)
        return response

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Code assistance failed: {str(e)}"
        )

@router.post("/workflow-planning", response_model=LLMResponse)
async def workflow_planning(
    task_description: str,
    timeline: Optional[str] = None,
    resources: Optional[str] = None,
    constraints: Optional[str] = None,
    model_size: ModelSize = ModelSize.LARGE
):
    """
    Workflow planning assistance

    Breaks down complex tasks into actionable steps with
    time estimates and resource requirements.
    """
    try:
        request = LLMRequest(
            prompt="",
            template_name="task_planning",
            template_vars={
                "task_description": task_description,
                "timeline": timeline,
                "resources": resources,
                "constraints": constraints
            },
            model_size=model_size
        )

        response = await llm_service.generate_completion(request)
        return response

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Workflow planning failed: {str(e)}"
        )

@router.get("/cache/stats", response_model=Dict[str, Any])
async def get_cache_stats():
    """
    Get cache statistics and performance metrics
    """
    try:
        if not llm_service.redis_client:
            return {
                "cache_enabled": False,
                "message": "Redis cache not available"
            }

        # Get basic Redis info
        info = llm_service.redis_client.info("memory")
        keyspace = llm_service.redis_client.info("keyspace")

        return {
            "cache_enabled": True,
            "memory_usage": info.get("used_memory_human", "unknown"),
            "keys_count": keyspace.get("db0", {}).get("keys", 0) if keyspace.get("db0") else 0,
            "hit_rate": "Available in Redis stats",
            "timestamp": "current"
        }

    except Exception as e:
        return {
            "cache_enabled": False,
            "error": str(e)
        }