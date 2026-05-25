"""
LLM service for AI integrations with prompt templates and advanced features
"""

import openai
from typing import Optional, Dict, Any, List, Union
import logging
from datetime import datetime
import json
import hashlib
from jinja2 import Template
from enum import Enum

from app.core.config import settings
from app.core.redis import redis_client

logger = logging.getLogger(__name__)


class LLMProvider(Enum):
    """Supported LLM providers"""
    OPENAI = "openai"
    ANTHROPIC = "anthropic"


class PromptTemplate:
    """Template for LLM prompts with Jinja2 support"""
    
    def __init__(self, template: str, name: str = None):
        self.template = Template(template)
        self.name = name or "unnamed"
        self.raw_template = template
    
    def render(self, **kwargs) -> str:
        """Render template with provided variables"""
        try:
            return self.template.render(**kwargs)
        except Exception as e:
            logger.error(f"Template rendering failed for {self.name}: {e}")
            raise ValueError(f"Template rendering failed: {e}")


# Pre-defined prompt templates
PROMPT_TEMPLATES = {
    "task_analysis": PromptTemplate("""
You are an AI agent task analyzer. Analyze the following task and provide a structured response.

Task: {{ task_description }}
Context: {{ context }}

Please provide:
1. Task type classification
2. Required capabilities
3. Estimated complexity (1-10)
4. Suggested approach
5. Potential risks

Respond in JSON format.
""", "task_analysis"),

    "workflow_generation": PromptTemplate("""
Generate a workflow for the following objective:

Objective: {{ objective }}
Available Tools: {{ tools }}
Constraints: {{ constraints }}

Create a step-by-step workflow that achieves the objective using the available tools.
Each step should include:
- action: what to do
- tool: which tool to use
- parameters: required parameters
- expected_output: what the step should produce

Respond in JSON format with a "steps" array.
""", "workflow_generation"),

    "error_analysis": PromptTemplate("""
Analyze the following error and suggest solutions:

Error: {{ error_message }}
Context: {{ error_context }}
Stack Trace: {{ stack_trace }}

Provide:
1. Root cause analysis
2. Suggested fixes
3. Prevention strategies
4. Alternative approaches

Respond in JSON format.
""", "error_analysis"),

    "code_generation": PromptTemplate("""
Generate {{ language }} code for the following requirements:

Requirements: {{ requirements }}
Framework: {{ framework }}
Style Guide: {{ style_guide }}

Generate clean, well-documented code that follows best practices.
Include error handling and type hints where applicable.
""", "code_generation")
}


class LLMService:
    """Service for LLM integrations"""
    
    def __init__(self):
        self.openai_client = None
        # Only initialize OpenAI client with valid API keys (not test keys)
        if settings.OPENAI_API_KEY and not settings.OPENAI_API_KEY.startswith("test_key"):
            openai.api_key = settings.OPENAI_API_KEY
            self.openai_client = openai
    
    async def health_check(self) -> bool:
        """Check if LLM service is available"""
        try:
            if not self.openai_client:
                return False
            
            # Try a simple API call
            response = await self.openai_client.models.list()
            return True
        except Exception as e:
            logger.error(f"LLM health check failed: {e}")
            return False
    
    async def generate_completion(
        self,
        prompt: Union[str, PromptTemplate],
        model: str = "gpt-4o-mini",
        max_tokens: int = 1000,
        temperature: float = 0.7,
        cache_key: Optional[str] = None,
        template_vars: Optional[Dict[str, Any]] = None,
        system_message: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate text completion with template support"""
        try:
            # Process prompt template if provided
            if isinstance(prompt, PromptTemplate):
                if template_vars:
                    rendered_prompt = prompt.render(**template_vars)
                else:
                    rendered_prompt = prompt.raw_template
            else:
                rendered_prompt = prompt
            
            # Generate cache key if not provided
            if not cache_key:
                cache_content = f"{rendered_prompt}:{model}:{temperature}"
                cache_key = hashlib.md5(cache_content.encode()).hexdigest()
            
            # Check cache first
            cached_result = await redis_client.get(f"llm_completion:{cache_key}")
            if cached_result:
                logger.info(f"Using cached LLM result for key: {cache_key}")
                return json.loads(cached_result)
            
            if not self.openai_client:
                # Return fallback response when API key is not configured
                logger.warning("OpenAI client not configured, returning fallback response")
                return {
                    "content": f"[FALLBACK MODE] Task analysis for: {rendered_prompt[:100]}... - API key required for full functionality",
                    "model": "fallback",
                    "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
                    "timestamp": datetime.utcnow().isoformat(),
                    "fallback": True
                }
            
            # Prepare messages
            messages = []
            if system_message:
                messages.append({"role": "system", "content": system_message})
            messages.append({"role": "user", "content": rendered_prompt})
            
            # Make API call
            response = await self.openai_client.chat.completions.create(
                model=model,
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature
            )
            
            result = {
                "content": response.choices[0].message.content,
                "model": model,
                "usage": {
                    "prompt_tokens": response.usage.prompt_tokens,
                    "completion_tokens": response.usage.completion_tokens,
                    "total_tokens": response.usage.total_tokens
                },
                "timestamp": datetime.utcnow().isoformat()
            }
            
            # Cache result
            await redis_client.set(
                f"llm_completion:{cache_key}",
                json.dumps(result),
                expire=3600  # 1 hour cache
            )
            
            return result
            
        except Exception as e:
            logger.error(f"LLM completion failed: {e}")
            raise
    
    async def generate_embeddings(
        self,
        texts: List[str],
        model: str = "text-embedding-ada-002"
    ) -> List[List[float]]:
        """Generate embeddings for texts"""
        try:
            if not self.openai_client:
                # Return fallback embeddings when API key is not configured
                logger.warning("OpenAI client not configured, returning fallback embeddings")
                # Return zero vectors as fallback
                return [[0.0] * 1536 for _ in texts]  # OpenAI embeddings are 1536 dimensions
            
            response = await self.openai_client.embeddings.create(
                model=model,
                input=texts
            )
            
            embeddings = [item.embedding for item in response.data]
            return embeddings
            
        except Exception as e:
            logger.error(f"Embedding generation failed: {e}")
            raise
    
    async def analyze_sentiment(self, text: str) -> Dict[str, Any]:
        """Analyze sentiment of text"""
        prompt = f"""
        Analyze the sentiment of the following text and return a JSON response with:
        - sentiment: positive, negative, or neutral
        - confidence: a score from 0 to 1
        - reasoning: brief explanation
        
        Text: {text}
        """
        
        try:
            result = await self.generate_completion(
                prompt=prompt,
                temperature=0.1,
                cache_key=f"sentiment:{hash(text)}"
            )
            
            # Parse JSON response (simplified for now)
            return {
                "sentiment": "neutral",  # TODO: Parse actual response
                "confidence": 0.5,
                "reasoning": "Placeholder implementation",
                "raw_response": result["content"]
            }
            
        except Exception as e:
            logger.error(f"Sentiment analysis failed: {e}")
            raise
    
    async def analyze_task(self, task_description: str, context: str = "") -> Dict[str, Any]:
        """Analyze a task and provide structured insights"""
        try:
            template = PROMPT_TEMPLATES["task_analysis"]
            result = await self.generate_completion(
                prompt=template,
                template_vars={
                    "task_description": task_description,
                    "context": context
                },
                temperature=0.1,
                system_message="You are an expert task analyzer. Always respond with valid JSON."
            )
            
            # Try to parse JSON response
            try:
                analysis = json.loads(result["content"])
                return {
                    "analysis": analysis,
                    "raw_response": result["content"],
                    "usage": result["usage"]
                }
            except json.JSONDecodeError:
                logger.warning("Failed to parse JSON response from task analysis")
                return {
                    "analysis": {"error": "Failed to parse response"},
                    "raw_response": result["content"],
                    "usage": result["usage"]
                }
                
        except Exception as e:
            logger.error(f"Task analysis failed: {e}")
            raise
    
    async def generate_workflow(
        self, 
        objective: str, 
        tools: List[str], 
        constraints: str = ""
    ) -> Dict[str, Any]:
        """Generate a workflow for achieving an objective"""
        try:
            template = PROMPT_TEMPLATES["workflow_generation"]
            result = await self.generate_completion(
                prompt=template,
                template_vars={
                    "objective": objective,
                    "tools": ", ".join(tools),
                    "constraints": constraints
                },
                temperature=0.3,
                system_message="You are a workflow generation expert. Always respond with valid JSON containing a 'steps' array."
            )
            
            # Check if this is a fallback response
            if result.get("fallback", False):
                return {
                    "workflow": {"steps": []},
                    "raw_response": result["content"],
                    "usage": result["usage"],
                    "fallback": True
                }
            
            # Try to parse JSON response
            try:
                workflow = json.loads(result["content"])
                return {
                    "workflow": workflow,
                    "raw_response": result["content"],
                    "usage": result["usage"]
                }
            except json.JSONDecodeError:
                logger.warning("Failed to parse JSON response from workflow generation")
                return {
                    "workflow": {"steps": []},
                    "raw_response": result["content"],
                    "usage": result["usage"]
                }
                
        except Exception as e:
            logger.error(f"Workflow generation failed: {e}")
            raise
    
    async def analyze_error(
        self, 
        error_message: str, 
        error_context: str = "", 
        stack_trace: str = ""
    ) -> Dict[str, Any]:
        """Analyze an error and suggest solutions"""
        try:
            template = PROMPT_TEMPLATES["error_analysis"]
            result = await self.generate_completion(
                prompt=template,
                template_vars={
                    "error_message": error_message,
                    "error_context": error_context,
                    "stack_trace": stack_trace
                },
                temperature=0.1,
                system_message="You are an expert debugger. Always respond with valid JSON."
            )
            
            # Try to parse JSON response
            try:
                analysis = json.loads(result["content"])
                return {
                    "analysis": analysis,
                    "raw_response": result["content"],
                    "usage": result["usage"]
                }
            except json.JSONDecodeError:
                logger.warning("Failed to parse JSON response from error analysis")
                return {
                    "analysis": {"error": "Failed to parse response"},
                    "raw_response": result["content"],
                    "usage": result["usage"]
                }
                
        except Exception as e:
            logger.error(f"Error analysis failed: {e}")
            raise
    
    async def generate_code(
        self,
        requirements: str,
        language: str = "python",
        framework: str = "",
        style_guide: str = "PEP 8"
    ) -> Dict[str, Any]:
        """Generate code based on requirements"""
        try:
            template = PROMPT_TEMPLATES["code_generation"]
            result = await self.generate_completion(
                prompt=template,
                template_vars={
                    "requirements": requirements,
                    "language": language,
                    "framework": framework,
                    "style_guide": style_guide
                },
                temperature=0.2,
                system_message=f"You are an expert {language} developer. Generate clean, production-ready code."
            )
            
            return {
                "code": result["content"],
                "language": language,
                "framework": framework,
                "usage": result["usage"]
            }
                
        except Exception as e:
            logger.error(f"Code generation failed: {e}")
            raise
    
    def get_template(self, name: str) -> Optional[PromptTemplate]:
        """Get a prompt template by name"""
        return PROMPT_TEMPLATES.get(name)
    
    def add_template(self, name: str, template: PromptTemplate) -> None:
        """Add a new prompt template"""
        PROMPT_TEMPLATES[name] = template
        logger.info(f"Added new prompt template: {name}")


# Global LLM service instance
llm_service = LLMService()